import * as Crypto from "node:crypto";

export const OPENCLAW_MIN_PROTOCOL_VERSION = 4;
export const OPENCLAW_MAX_PROTOCOL_VERSION = 4;
export const OPENCLAW_CLIENT_ID = "gateway-client";
export const OPENCLAW_CLIENT_MODE = "backend";
export const OPENCLAW_CLIENT_DISPLAY_NAME = "JCode";
export const OPENCLAW_CLIENT_VERSION = "jcode";
export const OPENCLAW_CLIENT_PLATFORM = "node";
export const OPENCLAW_SCOPES = ["operator.read", "operator.write"] as const;
export const OPENCLAW_REQUIRED_METHODS = ["chat.history", "chat.send", "chat.abort"] as const;

export type OpenClawScope = (typeof OPENCLAW_SCOPES)[number];
export type OpenClawRequiredMethod = (typeof OPENCLAW_REQUIRED_METHODS)[number];

export interface OpenClawAuthFrame {
  readonly type?: string;
  readonly token?: string;
  readonly password?: string;
  readonly deviceToken?: string;
  readonly bootstrapToken?: string;
}

export interface OpenClawDeviceFrame {
  readonly id: string;
  readonly token?: string;
  readonly publicKey?: string;
  readonly signature?: string;
  readonly signedAt?: string;
  readonly nonce?: string;
}

export interface OpenClawConnectFrameInput {
  readonly auth?: OpenClawAuthFrame;
  readonly device?: OpenClawDeviceFrame;
}

export interface OpenClawConnectParams {
  readonly minProtocol: typeof OPENCLAW_MIN_PROTOCOL_VERSION;
  readonly maxProtocol: typeof OPENCLAW_MAX_PROTOCOL_VERSION;
  readonly client: {
    readonly id: typeof OPENCLAW_CLIENT_ID;
    readonly mode: typeof OPENCLAW_CLIENT_MODE;
    readonly displayName: typeof OPENCLAW_CLIENT_DISPLAY_NAME;
    readonly version: typeof OPENCLAW_CLIENT_VERSION;
    readonly platform: typeof OPENCLAW_CLIENT_PLATFORM;
  };
  readonly role: "operator";
  readonly scopes: typeof OPENCLAW_SCOPES;
  readonly caps: ReadonlyArray<never>;
  readonly commands: ReadonlyArray<never>;
  readonly auth?: OpenClawAuthFrame;
  readonly device?: OpenClawDeviceFrame;
}

export interface OpenClawChallenge {
  readonly nonce: string;
  readonly timestamp?: string;
  readonly ts?: number;
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

function readRecordField(value: unknown, field: string): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const fieldValue = (value as Record<string, unknown>)[field];
  return typeof fieldValue === "object" && fieldValue !== null
    ? (fieldValue as Record<string, unknown>)
    : undefined;
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
    const event = readStringField(frame, "event");
    const challenge =
      type === "event" && event === "connect.challenge" ? readRecordField(frame, "payload") : frame;
    const nonce = readStringField(challenge, "nonce");
    const timestamp = readStringField(challenge, "timestamp");
    const ts =
      typeof challenge === "object" && challenge !== null
        ? (challenge as Record<string, unknown>).ts
        : undefined;
    if (
      !(
        (type === "connect.challenge" || (type === "event" && event === "connect.challenge")) &&
        nonce !== undefined &&
        (timestamp !== undefined || typeof ts === "number")
      )
    ) {
      throw new OpenClawProtocolError(
        "OpenClaw gateway did not provide a valid connect.challenge frame.",
      );
    }
    return {
      nonce,
      ...(timestamp !== undefined ? { timestamp } : {}),
      ...(typeof ts === "number" ? { ts } : {}),
    };
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

export function isOpenClawAuthFailureFrame(frame: unknown): boolean {
  const error = readRecordField(frame, "error");
  const detail = error ?? frame;
  const code = readStringField(detail, "code") ?? "";
  const message = readStringField(detail, "message") ?? "";
  return /auth|unauth|forbid|token|credential/i.test(`${code} ${message}`);
}

function buildConnectAuth(auth: OpenClawAuthFrame): OpenClawAuthFrame {
  return {
    ...(auth.token !== undefined ? { token: auth.token } : {}),
    ...(auth.password !== undefined ? { password: auth.password } : {}),
    ...(auth.deviceToken !== undefined ? { deviceToken: auth.deviceToken } : {}),
    ...(auth.bootstrapToken !== undefined ? { bootstrapToken: auth.bootstrapToken } : {}),
  };
}

export function buildOpenClawConnectParams(
  input: OpenClawConnectFrameInput = {},
): OpenClawConnectParams {
  return {
    minProtocol: OPENCLAW_MIN_PROTOCOL_VERSION,
    maxProtocol: OPENCLAW_MAX_PROTOCOL_VERSION,
    client: {
      id: OPENCLAW_CLIENT_ID,
      mode: OPENCLAW_CLIENT_MODE,
      displayName: OPENCLAW_CLIENT_DISPLAY_NAME,
      version: OPENCLAW_CLIENT_VERSION,
      platform: OPENCLAW_CLIENT_PLATFORM,
    },
    role: "operator",
    scopes: OPENCLAW_SCOPES,
    caps: [],
    commands: [],
    ...(input.auth !== undefined ? { auth: buildConnectAuth(input.auth) } : {}),
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
    input.challenge.timestamp ?? String(input.challenge.ts ?? ""),
  ].join("\n");
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
    timestamp: input.challenge.timestamp ?? String(input.challenge.ts ?? ""),
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
  {
    readonly sessionKey: string;
    readonly message: string;
    readonly deliver: false;
    readonly idempotencyKey: string;
  }
> {
  return {
    method: "chat.send",
    params: {
      sessionKey: input.sessionKey,
      message: input.message,
      deliver: false,
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
