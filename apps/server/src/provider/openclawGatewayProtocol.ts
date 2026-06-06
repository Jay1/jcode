import * as Crypto from "node:crypto";

export const OPENCLAW_MIN_PROTOCOL_VERSION = 4;
export const OPENCLAW_MAX_PROTOCOL_VERSION = 4;
export const OPENCLAW_CLIENT_ID = "gateway-client";
export const OPENCLAW_CLIENT_MODE = "backend";
export const OPENCLAW_CLIENT_DISPLAY_NAME = "JCode";
export const OPENCLAW_SCOPES = ["operator.read", "operator.write"] as const;
export const OPENCLAW_REQUIRED_METHODS = ["chat.history", "chat.send", "chat.abort"] as const;

export type OpenClawScope = (typeof OPENCLAW_SCOPES)[number];
export type OpenClawRequiredMethod = (typeof OPENCLAW_REQUIRED_METHODS)[number];

export interface OpenClawAuthFrame {
  readonly type: string;
  readonly token?: string;
  readonly password?: string;
}

export interface OpenClawDeviceFrame {
  readonly id: string;
  readonly token?: string;
}

export interface OpenClawConnectFrameInput {
  readonly auth?: OpenClawAuthFrame;
  readonly device?: OpenClawDeviceFrame;
}

export interface OpenClawConnectFrame {
  readonly type: "connect";
  readonly minProtocol: typeof OPENCLAW_MIN_PROTOCOL_VERSION;
  readonly maxProtocol: typeof OPENCLAW_MAX_PROTOCOL_VERSION;
  readonly client: {
    readonly id: typeof OPENCLAW_CLIENT_ID;
    readonly mode: typeof OPENCLAW_CLIENT_MODE;
    readonly displayName: typeof OPENCLAW_CLIENT_DISPLAY_NAME;
  };
  readonly role: "operator";
  readonly scopes: typeof OPENCLAW_SCOPES;
  readonly auth?: OpenClawAuthFrame;
  readonly device?: OpenClawDeviceFrame;
}

export interface OpenClawChallenge {
  readonly nonce: string;
  readonly timestamp: string;
}

export interface OpenClawChallengeResponseInput {
  readonly challenge: OpenClawChallenge;
  readonly deviceId: string;
  readonly deviceKey: Uint8Array;
}

export interface OpenClawChallengeResponse {
  readonly type: "connect.challenge-response";
  readonly clientId: typeof OPENCLAW_CLIENT_ID;
  readonly deviceId: string;
  readonly nonce: string;
  readonly timestamp: string;
  readonly signature: string;
}

export interface OpenClawMethodSupport {
  readonly supported: boolean;
  readonly missing: ReadonlyArray<OpenClawRequiredMethod>;
}

export interface OpenClawRequest<TMethod extends string, TParams extends object> {
  readonly method: TMethod;
  readonly params: TParams;
}

export class OpenClawProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenClawProtocolError";
  }
}

function redactedProtocolDetail(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value.split("?")[0]?.split("#")[0] ?? "OpenClaw gateway";
  }
}

function readStringField(value: unknown, field: string): string | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const fieldValue = record[field];
  return typeof fieldValue === "string" && fieldValue.trim().length > 0 ? fieldValue : undefined;
}

export async function waitForOpenClawChallenge(input: {
  readonly receive: () => Promise<unknown>;
  readonly timeoutMs: number;
  readonly redactedGatewayUrl: string;
}): Promise<OpenClawChallenge> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(
        new OpenClawProtocolError(
          `Timed out waiting for OpenClaw connect.challenge from ${redactedProtocolDetail(
            input.redactedGatewayUrl,
          )}.`,
        ),
      );
    }, input.timeoutMs);
  });

  try {
    const frame = await Promise.race([input.receive(), timeoutPromise]);
    const type = readStringField(frame, "type");
    const nonce = readStringField(frame, "nonce");
    const timestamp = readStringField(frame, "timestamp");
    if (type !== "connect.challenge" || nonce === undefined || timestamp === undefined) {
      throw new OpenClawProtocolError(
        "OpenClaw gateway did not provide a valid connect.challenge frame.",
      );
    }
    return { nonce, timestamp };
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

export function isOpenClawAuthFailureFrame(frame: unknown): boolean {
  const code = readStringField(frame, "code") ?? "";
  const message = readStringField(frame, "message") ?? "";
  return /auth|unauth|forbid|token|credential/i.test(`${code} ${message}`);
}

export function buildOpenClawConnectFrame(
  input: OpenClawConnectFrameInput = {},
): OpenClawConnectFrame {
  return {
    type: "connect",
    minProtocol: OPENCLAW_MIN_PROTOCOL_VERSION,
    maxProtocol: OPENCLAW_MAX_PROTOCOL_VERSION,
    client: {
      id: OPENCLAW_CLIENT_ID,
      mode: OPENCLAW_CLIENT_MODE,
      displayName: OPENCLAW_CLIENT_DISPLAY_NAME,
    },
    role: "operator",
    scopes: OPENCLAW_SCOPES,
    ...(input.auth !== undefined ? { auth: input.auth } : {}),
    ...(input.device !== undefined ? { device: input.device } : {}),
  };
}

function challengeSigningPayload(input: OpenClawChallengeResponseInput): string {
  return [
    OPENCLAW_CLIENT_ID,
    OPENCLAW_CLIENT_MODE,
    OPENCLAW_CLIENT_DISPLAY_NAME,
    input.deviceId,
    input.challenge.nonce,
    input.challenge.timestamp,
  ].join("\\n");
}

export function buildOpenClawChallengeResponse(
  input: OpenClawChallengeResponseInput,
): OpenClawChallengeResponse {
  const signature = Crypto.createHmac("sha256", Buffer.from(input.deviceKey))
    .update(challengeSigningPayload(input))
    .digest("base64url");
  return {
    type: "connect.challenge-response",
    clientId: OPENCLAW_CLIENT_ID,
    deviceId: input.deviceId,
    nonce: input.challenge.nonce,
    timestamp: input.challenge.timestamp,
    signature,
  };
}

export function validateOpenClawMethodSupport(
  advertisedMethods: ReadonlyArray<string> | undefined,
): OpenClawMethodSupport {
  if (advertisedMethods === undefined) {
    return { supported: true, missing: [] };
  }
  const advertised = new Set(advertisedMethods);
  const missing = OPENCLAW_REQUIRED_METHODS.filter((method) => !advertised.has(method));
  return { supported: missing.length === 0, missing };
}

export function buildOpenClawHistoryRequest(input: {
  readonly sessionKey: string;
}): OpenClawRequest<"chat.history", { readonly sessionKey: string }> {
  return { method: "chat.history", params: { sessionKey: input.sessionKey } };
}

export function deriveOpenClawIdempotencyKey(input: {
  readonly threadId: string;
  readonly turnId: string;
}): string {
  return `jcode:${input.threadId}:${input.turnId}`;
}

export function buildOpenClawSendRequest(input: {
  readonly sessionKey: string;
  readonly threadId: string;
  readonly turnId: string;
  readonly message: string;
}): OpenClawRequest<
  "chat.send",
  { readonly sessionKey: string; readonly message: string; readonly idempotencyKey: string }
> {
  return {
    method: "chat.send",
    params: {
      sessionKey: input.sessionKey,
      message: input.message,
      idempotencyKey: deriveOpenClawIdempotencyKey(input),
    },
  };
}

export function buildOpenClawAbortRequest(input: {
  readonly sessionKey: string;
  readonly runId?: string;
}): OpenClawRequest<"chat.abort", { readonly sessionKey: string; readonly runId?: string }> {
  return {
    method: "chat.abort",
    params: {
      sessionKey: input.sessionKey,
      ...(input.runId !== undefined ? { runId: input.runId } : {}),
    },
  };
}
