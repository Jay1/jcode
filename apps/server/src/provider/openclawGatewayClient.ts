import WebSocket, { type RawData } from "ws";

import { Effect } from "effect";

import {
  buildOpenClawConnectFrame,
  type OpenClawAuthFrame,
  type OpenClawChallenge,
  type OpenClawChallengeResponse,
  type OpenClawDeviceFrame,
  type OpenClawRequest,
  isOpenClawAuthFailureFrame,
} from "./openclawGatewayProtocol";

const CONNECT_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 30_000;

export type OpenClawGatewayEvent =
  | {
      readonly type: "assistant.delta";
      readonly runId?: string;
      readonly text?: string;
      readonly delta?: string;
      readonly [key: string]: unknown;
    }
  | {
      readonly type: "assistant.completed";
      readonly runId?: string;
      readonly text?: string;
      readonly [key: string]: unknown;
    }
  | {
      readonly type: "run.completed";
      readonly runId?: string;
      readonly stopReason?: string | null;
      readonly [key: string]: unknown;
    }
  | {
      readonly type: "error";
      readonly runId?: string;
      readonly message?: string;
      readonly [key: string]: unknown;
    };

export interface OpenClawGatewayConnectInput {
  readonly websocketUrl: string;
  readonly redactedGatewayUrl: string;
  readonly auth?: OpenClawAuthFrame;
  readonly device?: OpenClawDeviceFrame;
  readonly respondToChallenge?: (challenge: OpenClawChallenge) => OpenClawChallengeResponse;
}

export interface OpenClawGatewayConnectResult {
  readonly methods?: ReadonlyArray<string>;
  readonly protocolVersion?: number;
}

export interface OpenClawGatewaySendResult {
  readonly runId?: string;
  readonly events?: ReadonlyArray<OpenClawGatewayEvent>;
}

export type OpenClawGatewayRequestResult =
  | OpenClawGatewaySendResult
  | {
      readonly turns?: ReadonlyArray<{
        readonly id: string;
        readonly items: ReadonlyArray<unknown>;
      }>;
    }
  | Record<string, unknown>;

export interface OpenClawGatewayClient {
  readonly connect: (
    input: OpenClawGatewayConnectInput,
  ) => Effect.Effect<OpenClawGatewayConnectResult, unknown>;
  readonly request: (
    request: OpenClawRequest<string, object>,
  ) => Effect.Effect<OpenClawGatewayRequestResult, unknown>;
}

export interface OpenClawHealthProbeResult {
  readonly methods?: ReadonlyArray<string>;
  readonly protocolVersion?: number;
}

export interface OpenClawHealthProbeClient {
  readonly probe: (
    input: OpenClawGatewayConnectInput,
  ) => Effect.Effect<OpenClawHealthProbeResult, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  return typeof field === "string" && field.trim().length > 0 ? field : undefined;
}

function frameType(frame: unknown): string | undefined {
  return isRecord(frame) ? readString(frame, "type") : undefined;
}

function isGatewayEvent(frame: unknown): frame is OpenClawGatewayEvent {
  const type = frameType(frame);
  return (
    type === "assistant.delta" ||
    type === "assistant.completed" ||
    type === "run.completed" ||
    type === "error"
  );
}

function isChallengeFrame(frame: unknown): frame is OpenClawChallenge {
  return (
    isRecord(frame) &&
    frame.type === "connect.challenge" &&
    typeof frame.nonce === "string" &&
    frame.nonce.trim().length > 0 &&
    typeof frame.timestamp === "string" &&
    frame.timestamp.trim().length > 0
  );
}

function rawDataToString(data: RawData): string {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  return Buffer.from(data).toString("utf8");
}

function parseFrame(data: RawData): unknown {
  return JSON.parse(rawDataToString(data)) as unknown;
}

function extractResult(frame: unknown): unknown {
  return isRecord(frame) && "result" in frame ? frame.result : frame;
}

function stringArray(value: unknown): ReadonlyArray<string> | undefined {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : undefined;
}

function extractMethods(frame: unknown): ReadonlyArray<string> | undefined {
  const result = extractResult(frame);
  if (!isRecord(result)) return undefined;
  const direct = stringArray(result.methods);
  if (direct) return direct;
  const features = isRecord(result.features) ? stringArray(result.features.methods) : undefined;
  if (features) return features;
  return isRecord(result.hello) && isRecord(result.hello.features)
    ? stringArray(result.hello.features.methods)
    : undefined;
}

function extractProtocolVersion(frame: unknown): number | undefined {
  const result = extractResult(frame);
  if (!isRecord(result)) return undefined;
  if (typeof result.protocolVersion === "number") return result.protocolVersion;
  if (isRecord(result.protocol) && typeof result.protocol.version === "number") {
    return result.protocol.version;
  }
  return undefined;
}

function errorMessageFromFrame(frame: unknown): string | undefined {
  const result = extractResult(frame);
  if (!isRecord(result)) return undefined;
  const message = readString(result, "message");
  if (message) return scrubOpenClawGatewayDiagnostic(message);
  const error = result.error;
  if (typeof error === "string") return scrubOpenClawGatewayDiagnostic(error);
  if (isRecord(error)) {
    const nestedMessage = readString(error, "message") ?? readString(error, "code");
    return nestedMessage ? scrubOpenClawGatewayDiagnostic(nestedMessage) : undefined;
  }
  return undefined;
}

export function scrubOpenClawGatewayDiagnostic(message: string): string {
  return message
    .replace(/\b(Bearer\s+)[^\s]+/gi, "$1<redacted>")
    .replace(
      /\b(token|password|deviceToken|device-token|authorization|auth)=([^\s&#]+)/gi,
      "$1=<redacted>",
    )
    .replace(
      /\b([a-zA-Z][a-zA-Z\d+.-]*:\/\/)([^\s/@]+@)([^\s?#]+)([^\s]*)/g,
      (_match, scheme, _userinfo, host, rest) => {
        const path = String(rest).split(/[?#]/, 1)[0] ?? "";
        return `${scheme}${host}${path}`;
      },
    );
}

function receiveFrame(
  socket: WebSocket,
  timeoutMs: number,
  redactedGatewayUrl: string,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let done = false;
    const timeout = setTimeout(() => {
      finish({
        error: new Error(
          `Timed out waiting for OpenClaw gateway frame from ${redactedGatewayUrl}.`,
        ),
      });
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("message", onMessage);
      socket.off("error", onError);
      socket.off("close", onClose);
    };
    const finish = (result: { readonly value?: unknown; readonly error?: unknown }) => {
      if (done) return;
      done = true;
      cleanup();
      if ("error" in result) reject(result.error);
      else resolve(result.value);
    };
    const onMessage = (data: RawData) => {
      try {
        finish({ value: parseFrame(data) });
      } catch (cause) {
        finish({ error: cause });
      }
    };
    const onError = (error: Error) => finish({ error });
    const onClose = (code: number, reason: Buffer) => {
      const detail =
        reason.length > 0 ? `: ${scrubOpenClawGatewayDiagnostic(reason.toString("utf8"))}` : "";
      finish({ error: new Error(`OpenClaw gateway closed before responding (${code})${detail}.`) });
    };
    socket.once("message", onMessage);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}

function openSocket(websocketUrl: string, redactedGatewayUrl: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(websocketUrl);
    let done = false;
    const timeout = setTimeout(() => {
      socket.close();
      finish({
        error: new Error(`Timed out connecting to OpenClaw gateway at ${redactedGatewayUrl}.`),
      });
    }, CONNECT_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("open", onOpen);
      socket.off("error", onError);
      socket.off("close", onClose);
    };
    const finish = (result: { readonly socket?: WebSocket; readonly error?: unknown }) => {
      if (done) return;
      done = true;
      cleanup();
      if ("error" in result) reject(result.error);
      else if (result.socket !== undefined) resolve(result.socket);
      else reject(new Error("OpenClaw gateway connection failed."));
    };
    const onOpen = () => finish({ socket });
    const onError = (error: Error) => finish({ error });
    const onClose = (code: number, reason: Buffer) => {
      const detail =
        reason.length > 0 ? `: ${scrubOpenClawGatewayDiagnostic(reason.toString("utf8"))}` : "";
      finish({ error: new Error(`OpenClaw gateway closed during connect (${code})${detail}.`) });
    };
    socket.once("open", onOpen);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}

function sendFrame(socket: WebSocket, frame: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.readyState !== WebSocket.OPEN) {
      reject(new Error("OpenClaw gateway socket is not open."));
      return;
    }
    socket.send(JSON.stringify(frame), (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function completeHandshake(
  socket: WebSocket,
  input: OpenClawGatewayConnectInput,
): Promise<OpenClawGatewayConnectResult> {
  await sendFrame(
    socket,
    buildOpenClawConnectFrame({
      ...(input.auth !== undefined ? { auth: input.auth } : {}),
      ...(input.device !== undefined ? { device: input.device } : {}),
    }),
  );
  let frame = await receiveFrame(socket, CONNECT_TIMEOUT_MS, input.redactedGatewayUrl);
  if (isChallengeFrame(frame)) {
    if (!input.respondToChallenge) {
      throw new Error(
        "OpenClaw gateway requested device challenge but no challenge responder is configured.",
      );
    }
    await sendFrame(socket, input.respondToChallenge(frame));
    frame = await receiveFrame(socket, CONNECT_TIMEOUT_MS, input.redactedGatewayUrl);
  }
  if (isOpenClawAuthFailureFrame(frame)) {
    throw new Error(errorMessageFromFrame(frame) ?? "OpenClaw gateway rejected authentication.");
  }
  if (frameType(frame) === "error") {
    throw new Error(errorMessageFromFrame(frame) ?? "OpenClaw gateway connect failed.");
  }
  const methods = extractMethods(frame);
  const protocolVersion = extractProtocolVersion(frame);
  return {
    ...(methods !== undefined ? { methods } : {}),
    ...(protocolVersion !== undefined ? { protocolVersion } : {}),
  };
}

function normalizeRequestResult(frame: unknown): OpenClawGatewayRequestResult {
  const result = extractResult(frame);
  return isRecord(result) ? result : {};
}

async function requestOverSocket(
  socket: WebSocket,
  redactedGatewayUrl: string,
  request: OpenClawRequest<string, object>,
): Promise<OpenClawGatewayRequestResult> {
  await sendFrame(socket, request);
  if (request.method !== "chat.send") {
    return normalizeRequestResult(
      await receiveFrame(socket, REQUEST_TIMEOUT_MS, redactedGatewayUrl),
    );
  }

  const firstFrame = await receiveFrame(socket, REQUEST_TIMEOUT_MS, redactedGatewayUrl);
  const firstResult = normalizeRequestResult(firstFrame);
  if ("events" in firstResult || "runId" in firstResult) {
    return firstResult;
  }
  if (!isGatewayEvent(firstFrame)) {
    return firstResult;
  }

  const events: OpenClawGatewayEvent[] = [firstFrame];
  while (true) {
    const latest = events[events.length - 1];
    if (latest?.type === "run.completed" || latest?.type === "error") break;
    const frame = await receiveFrame(socket, REQUEST_TIMEOUT_MS, redactedGatewayUrl);
    if (!isGatewayEvent(frame)) break;
    events.push(frame);
  }
  const runId = events.find((event) => typeof event.runId === "string")?.runId;
  return { ...(runId !== undefined ? { runId } : {}), events };
}

export function makeOpenClawGatewayClient(): OpenClawGatewayClient {
  let socket: WebSocket | null = null;
  let redactedGatewayUrl = "OpenClaw gateway";
  return {
    connect: (input) =>
      Effect.tryPromise({
        try: async () => {
          if (socket !== null) {
            socket.close();
            socket = null;
          }
          const nextSocket = await openSocket(input.websocketUrl, input.redactedGatewayUrl);
          const result = await completeHandshake(nextSocket, input);
          socket = nextSocket;
          redactedGatewayUrl = input.redactedGatewayUrl;
          return result;
        },
        catch: (cause) => cause,
      }),
    request: (request) =>
      Effect.tryPromise({
        try: async () => {
          if (socket === null || socket.readyState !== WebSocket.OPEN) {
            throw new Error("OpenClaw gateway is not connected.");
          }
          return await requestOverSocket(socket, redactedGatewayUrl, request);
        },
        catch: (cause) => cause,
      }),
  };
}

export const defaultOpenClawGatewayClient = makeOpenClawGatewayClient();

export const defaultOpenClawHealthProbeClient: OpenClawHealthProbeClient = {
  probe: (input) =>
    Effect.tryPromise({
      try: async () => {
        const socket = await openSocket(input.websocketUrl, input.redactedGatewayUrl);
        try {
          return await completeHandshake(socket, input);
        } finally {
          socket.close();
        }
      },
      catch: (cause) => cause,
    }),
};
