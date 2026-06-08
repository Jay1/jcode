import type http from "node:http";

import {
  AuthBootstrapInput,
  AuthCreatePairingCredentialInput,
  AuthHttpRoutes,
  AuthRevokeClientSessionInput,
  AuthRevokePairingLinkInput,
} from "@jcode/contracts";
import { DateTime, Effect, Schema } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import type { ServerConfigShape } from "../config";
import {
  isExplicitLoopbackHost,
  isLoopbackRemoteAddress,
  isSameOriginLoopbackRequest,
} from "../startupAccess";
import { AuthError, type AuthRequest, type ServerAuthShape } from "./Services/ServerAuth";
import type { SessionCredentialServiceShape } from "./Services/SessionCredentialService";
import { requireScope } from "./Services/scopeGuard";
import { deriveAuthClientMetadata } from "./utils";

type Respond = (
  statusCode: number,
  headers: Record<string, string | Array<string>>,
  body?: string | Uint8Array,
) => void;

export interface AuthHttpRouteOptions {
  readonly url: URL;
  readonly req: http.IncomingMessage;
  readonly respond: Respond;
  readonly serverConfig: ServerConfigShape;
  readonly serverAuth: ServerAuthShape;
  readonly sessionCredentials: Pick<SessionCredentialServiceShape, "cookieName">;
}

const decodeBootstrapInput = Schema.decodeUnknownEffect(AuthBootstrapInput);
const decodeCreatePairingCredentialInput = Schema.decodeUnknownEffect(
  AuthCreatePairingCredentialInput,
);
const decodeRevokePairingLinkInput = Schema.decodeUnknownEffect(AuthRevokePairingLinkInput);
const decodeRevokeClientSessionInput = Schema.decodeUnknownEffect(AuthRevokeClientSessionInput);

function normalizeHeaders(headers: http.IncomingHttpHeaders): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
  }
  return normalized;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string | undefined> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string | undefined> = {};
  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) continue;
    const name = part.slice(0, separatorIndex).trim();
    const rawValue = part.slice(separatorIndex + 1).trim();
    if (!name) continue;
    try {
      cookies[decodeURIComponent(name)] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
  }
  return cookies;
}

export function makeNodeAuthRequest(input: {
  readonly req: http.IncomingMessage;
  readonly url: URL;
}): AuthRequest {
  const headers = normalizeHeaders(input.req.headers);
  return {
    headers,
    cookies: parseCookies(headers.cookie),
    url: input.url,
  };
}

export function makeEffectAuthRequest(request: HttpServerRequest.HttpServerRequest): AuthRequest {
  const url = HttpServerRequest.toURL(request);
  const headers: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(request.headers)) {
    headers[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
  }
  return {
    headers,
    cookies: request.cookies,
    ...(url ? { url } : {}),
  };
}

function hasRequestBody(headers: Record<string, string | undefined>) {
  const contentLengthHeader = headers["content-length"];
  if (typeof contentLengthHeader === "string") {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(contentLength)) return contentLength > 0;
  }
  return typeof headers["transfer-encoding"] === "string";
}

async function readRequestBody(
  req: http.IncomingMessage,
  limitBytes = 1024 * 1024,
): Promise<string> {
  const chunks: Array<Buffer> = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > limitBytes) {
      throw new Error("Request body is too large.");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function readJsonBody(
  req: http.IncomingMessage,
  message: string,
): Effect.Effect<unknown, AuthError> {
  return Effect.tryPromise({
    try: async () => {
      const rawBody = await readRequestBody(req);
      if (rawBody.trim().length === 0) {
        throw new Error("Request body is empty.");
      }
      return JSON.parse(rawBody) as unknown;
    },
    catch: (cause) =>
      new AuthError({
        message,
        status: 400,
        cause,
      }),
  });
}

function encodeCookie(input: {
  readonly name: string;
  readonly value: string;
  readonly expiresAt: DateTime.DateTime;
}) {
  return `${encodeURIComponent(input.name)}=${encodeURIComponent(input.value)}; Expires=${DateTime.toDate(input.expiresAt).toUTCString()}; HttpOnly; Path=/; SameSite=Lax`;
}

function respondJson(
  respond: Respond,
  statusCode: number,
  body: unknown,
  headers: Record<string, string | Array<string>> = {},
) {
  respond(
    statusCode,
    {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
    JSON.stringify(body),
  );
}

export function respondToAuthError(respond: Respond, error: AuthError) {
  respondJson(respond, error.status ?? 500, { error: error.message });
}

export function authErrorResponse(error: AuthError) {
  return HttpServerResponse.jsonUnsafe({ error: error.message }, { status: error.status ?? 500 });
}

function deriveRequestClientMetadata(req: http.IncomingMessage, label?: string) {
  return deriveAuthClientMetadata({
    headers: normalizeHeaders(req.headers),
    remoteAddress: req.socket.remoteAddress ?? null,
    ...(label ? { label } : {}),
  });
}

export function canIssueDevAutomationAccess(input: {
  readonly config: Pick<ServerConfigShape, "devAutomationAccess" | "host">;
  readonly remoteAddress: string | null | undefined;
  readonly host: string | undefined;
  readonly origin: string | undefined;
}): boolean {
  return (
    input.config.devAutomationAccess &&
    isExplicitLoopbackHost(input.config.host) &&
    isLoopbackRemoteAddress(input.remoteAddress) &&
    isSameOriginLoopbackRequest({ host: input.host, origin: input.origin })
  );
}

const authenticateOwnerSession = (input: {
  readonly serverAuth: ServerAuthShape;
  readonly authRequest: AuthRequest;
}) =>
  Effect.gen(function* () {
    const session = yield* input.serverAuth.authenticateHttpRequest(input.authRequest);
    if (session.role !== "owner") {
      return yield* new AuthError({
        message: "Only owner sessions can manage network access.",
        status: 403,
      });
    }
    return session;
  });

export const serveAuthHttpRoute = Effect.fn(function* (input: AuthHttpRouteOptions) {
  if (!input.url.pathname.startsWith("/api/auth/")) return false;

  const method = input.req.method ?? "GET";
  const authRequest = makeNodeAuthRequest({ req: input.req, url: input.url });
  const headers = authRequest.headers;

  const route = Effect.gen(function* () {
    if (
      method === AuthHttpRoutes.session.method &&
      input.url.pathname === AuthHttpRoutes.session.pathname
    ) {
      const session = yield* input.serverAuth.getSessionState(authRequest);
      respondJson(input.respond, 200, session);
      return;
    }

    if (
      method === AuthHttpRoutes.bootstrap.method &&
      input.url.pathname === AuthHttpRoutes.bootstrap.pathname
    ) {
      const payload = yield* readJsonBody(input.req, "Invalid bootstrap payload.").pipe(
        Effect.flatMap((body) =>
          decodeBootstrapInput(body).pipe(
            Effect.mapError(
              (cause) =>
                new AuthError({
                  message: "Invalid bootstrap payload.",
                  status: 400,
                  cause,
                }),
            ),
          ),
        ),
      );
      const result = yield* input.serverAuth.exchangeBootstrapCredential(
        payload.credential,
        deriveRequestClientMetadata(input.req),
      );
      respondJson(input.respond, 200, result.response, {
        "Set-Cookie": encodeCookie({
          name: input.sessionCredentials.cookieName,
          value: result.sessionToken,
          expiresAt: result.response.expiresAt,
        }),
      });
      return;
    }

    if (
      method === AuthHttpRoutes.bootstrapBearer.method &&
      input.url.pathname === AuthHttpRoutes.bootstrapBearer.pathname
    ) {
      const payload = yield* readJsonBody(input.req, "Invalid bootstrap payload.").pipe(
        Effect.flatMap((body) =>
          decodeBootstrapInput(body).pipe(
            Effect.mapError(
              (cause) =>
                new AuthError({
                  message: "Invalid bootstrap payload.",
                  status: 400,
                  cause,
                }),
            ),
          ),
        ),
      );
      const result = yield* input.serverAuth.exchangeBootstrapCredentialForBearerSession(
        payload.credential,
        deriveRequestClientMetadata(input.req),
      );
      respondJson(input.respond, 200, result);
      return;
    }

    if (method === "POST" && input.url.pathname === "/api/auth/automation-access-grant") {
      if (
        !canIssueDevAutomationAccess({
          config: input.serverConfig,
          remoteAddress: input.req.socket.remoteAddress ?? null,
          host: headers.host,
          origin: headers.origin,
        })
      ) {
        return yield* new AuthError({
          message: "Dev automation access is unavailable.",
          status: 403,
        });
      }
      const result = yield* input.serverAuth.issueDevAutomationSession();
      respondJson(input.respond, 200, result.response, {
        "Set-Cookie": encodeCookie({
          name: input.sessionCredentials.cookieName,
          value: result.sessionToken,
          expiresAt: result.response.expiresAt,
        }),
      });
      return;
    }

    if (
      method === AuthHttpRoutes.webSocketToken.method &&
      input.url.pathname === AuthHttpRoutes.webSocketToken.pathname
    ) {
      const session = yield* input.serverAuth.authenticateHttpRequest(authRequest);
      const result = yield* input.serverAuth.issueWebSocketToken(session);
      respondJson(input.respond, 200, result);
      return;
    }

    if (
      method === AuthHttpRoutes.pairingToken.method &&
      input.url.pathname === AuthHttpRoutes.pairingToken.pathname
    ) {
      const session = yield* input.serverAuth.authenticateHttpRequest(authRequest);
      if (session.role !== "owner") {
        return yield* new AuthError({
          message: "Only owner sessions can create pairing credentials.",
          status: 403,
        });
      }
      const payload = hasRequestBody(headers)
        ? yield* readJsonBody(input.req, "Invalid pairing credential payload.").pipe(
            Effect.flatMap((body) =>
              decodeCreatePairingCredentialInput(body).pipe(
                Effect.mapError(
                  (cause) =>
                    new AuthError({
                      message: "Invalid pairing credential payload.",
                      status: 400,
                      cause,
                    }),
                ),
              ),
            ),
          )
        : {};
      const result = yield* input.serverAuth.issuePairingCredential(payload);
      respondJson(input.respond, 200, result);
      return;
    }

    if (
      method === AuthHttpRoutes.pairingLinks.method &&
      input.url.pathname === AuthHttpRoutes.pairingLinks.pathname
    ) {
      yield* authenticateOwnerSession({ serverAuth: input.serverAuth, authRequest });
      const pairingLinks = yield* input.serverAuth.listPairingLinks();
      respondJson(input.respond, 200, pairingLinks);
      return;
    }

    if (
      method === AuthHttpRoutes.revokePairingLink.method &&
      input.url.pathname === AuthHttpRoutes.revokePairingLink.pathname
    ) {
      yield* authenticateOwnerSession({ serverAuth: input.serverAuth, authRequest });
      const payload = yield* readJsonBody(input.req, "Invalid revoke pairing link payload.").pipe(
        Effect.flatMap((body) =>
          decodeRevokePairingLinkInput(body).pipe(
            Effect.mapError(
              (cause) =>
                new AuthError({
                  message: "Invalid revoke pairing link payload.",
                  status: 400,
                  cause,
                }),
            ),
          ),
        ),
      );
      const revoked = yield* input.serverAuth.revokePairingLink(payload.id);
      respondJson(input.respond, 200, { revoked });
      return;
    }

    if (
      method === AuthHttpRoutes.clients.method &&
      input.url.pathname === AuthHttpRoutes.clients.pathname
    ) {
      const session = yield* input.serverAuth
        .authenticateHttpRequest(authRequest)
        .pipe(Effect.flatMap((authSession) => requireScope(authSession, "provider_status:read")));
      const clients = yield* input.serverAuth.listClientSessions(session.sessionId);
      respondJson(input.respond, 200, clients);
      return;
    }

    if (
      method === AuthHttpRoutes.revokeClient.method &&
      input.url.pathname === AuthHttpRoutes.revokeClient.pathname
    ) {
      const session = yield* authenticateOwnerSession({
        serverAuth: input.serverAuth,
        authRequest,
      });
      const payload = yield* readJsonBody(input.req, "Invalid revoke client payload.").pipe(
        Effect.flatMap((body) =>
          decodeRevokeClientSessionInput(body).pipe(
            Effect.mapError(
              (cause) =>
                new AuthError({
                  message: "Invalid revoke client payload.",
                  status: 400,
                  cause,
                }),
            ),
          ),
        ),
      );
      const revoked = yield* input.serverAuth.revokeClientSession(
        session.sessionId,
        payload.sessionId,
      );
      respondJson(input.respond, 200, { revoked });
      return;
    }

    if (
      method === AuthHttpRoutes.revokeOtherClients.method &&
      input.url.pathname === AuthHttpRoutes.revokeOtherClients.pathname
    ) {
      const session = yield* authenticateOwnerSession({
        serverAuth: input.serverAuth,
        authRequest,
      });
      const revokedCount = yield* input.serverAuth.revokeOtherClientSessions(session.sessionId);
      respondJson(input.respond, 200, { revokedCount });
      return;
    }

    input.respond(404, { "Content-Type": "text/plain" }, "Not Found");
  }).pipe(
    Effect.catch((error) =>
      error instanceof AuthError
        ? Effect.sync(() => respondToAuthError(input.respond, error))
        : Effect.void,
    ),
  );

  yield* route;
  return true;
});
