import { randomUUID } from "node:crypto";

import {
  EventId,
  type ProviderRuntimeEvent,
  type ProviderSession,
  RuntimeItemId,
  ThreadId,
  TurnId,
} from "@jcode/contracts";
import { Effect, Layer, Queue, Ref, Stream } from "effect";

import { ServerSecretStore } from "../../auth/Services/ServerSecretStore.ts";
import { ServerSettingsService } from "../../serverSettings.ts";
import {
  ProviderAdapterRequestError,
  ProviderAdapterSessionNotFoundError,
  ProviderAdapterValidationError,
  type ProviderAdapterError,
} from "../Errors.ts";
import {
  buildOpenClawAbortRequest,
  buildOpenClawChallengeResponse,
  buildOpenClawHistoryRequest,
  buildOpenClawSendRequest,
  type OpenClawAuthFrame,
  type OpenClawChallenge,
  type OpenClawChallengeResponse,
  type OpenClawDeviceFrame,
  type OpenClawRequest,
  validateOpenClawMethodSupport,
} from "../openclawGatewayProtocol.ts";
import {
  defaultOpenClawGatewayClient,
  type OpenClawGatewayClient,
  type OpenClawGatewayEvent,
  type OpenClawGatewayRequestResult,
  type OpenClawGatewaySendResult,
} from "../openclawGatewayClient.ts";
import { normalizeOpenClawGatewayUrl, OpenClawGatewayUrlError } from "../openclawGatewayUrl.ts";
import {
  deriveOpenClawDeviceId,
  getOpenClawSecret,
  getOpenClawSecretBytes,
} from "../openclawSecrets.ts";
import { OpenClawAdapter, type OpenClawAdapterShape } from "../Services/OpenClawAdapter.ts";
import type { ProviderThreadSnapshot } from "../Services/ProviderAdapter.ts";

const PROVIDER = "openclaw" as const;

export interface OpenClawAdapterLiveOptions {
  readonly gatewayClient?: OpenClawGatewayClient;
}

interface OpenClawSessionContext {
  readonly session: ProviderSession;
  readonly turns: ReadonlyArray<{ readonly id: TurnId; readonly items: ReadonlyArray<unknown> }>;
  readonly activeRunIdsByTurn: ReadonlyMap<string, string>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function asTurnId(value: string): TurnId {
  return TurnId.makeUnsafe(value);
}

function asRuntimeItemId(value: string): RuntimeItemId {
  return RuntimeItemId.makeUnsafe(value);
}

function sessionGatewayKey(threadId: ThreadId): string {
  return `jcode:${threadId}`;
}

function requestError(
  method: string,
  detail: string,
  cause?: unknown,
): ProviderAdapterRequestError {
  return new ProviderAdapterRequestError({ provider: PROVIDER, method, detail, cause });
}

function validationError(operation: string, issue: string): ProviderAdapterValidationError {
  return new ProviderAdapterValidationError({ provider: PROVIDER, operation, issue });
}

function causeMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message.trim().length > 0) {
    return cause.message.trim();
  }
  return fallback;
}

function redactSensitiveValue(value: unknown, key = ""): unknown {
  const lowerKey = key.toLowerCase();
  if (
    lowerKey.includes("token") ||
    lowerKey.includes("password") ||
    lowerKey.includes("secret") ||
    lowerKey.includes("authorization") ||
    lowerKey.includes("apikey") ||
    lowerKey.includes("api_key")
  ) {
    return "[redacted]";
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        redactSensitiveValue(entryValue, entryKey),
      ]),
    );
  }
  if (typeof value === "string") {
    try {
      const url = new URL(value);
      url.username = "";
      url.password = "";
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return value;
    }
  }
  return value;
}

function buildEventBase(input: {
  readonly threadId: ThreadId;
  readonly turnId?: TurnId;
  readonly itemId?: string;
  readonly raw?: unknown;
}): Pick<
  ProviderRuntimeEvent,
  "eventId" | "provider" | "threadId" | "createdAt" | "turnId" | "itemId" | "raw"
> {
  return {
    eventId: EventId.makeUnsafe(randomUUID()),
    provider: PROVIDER,
    threadId: input.threadId,
    createdAt: nowIso(),
    ...(input.turnId !== undefined ? { turnId: input.turnId } : {}),
    ...(input.itemId !== undefined ? { itemId: asRuntimeItemId(input.itemId) } : {}),
    ...(input.raw !== undefined
      ? { raw: { source: "openclaw.gateway.event", payload: redactSensitiveValue(input.raw) } }
      : {}),
  };
}

function sendResultEvents(
  result: OpenClawGatewayRequestResult,
): ReadonlyArray<OpenClawGatewayEvent> {
  if (typeof result !== "object" || result === null || !("events" in result)) {
    return [];
  }
  const events = (result as OpenClawGatewaySendResult).events;
  return Array.isArray(events) ? events : [];
}

function historyTurns(
  result: OpenClawGatewayRequestResult,
): ReadonlyArray<{ readonly id: TurnId; readonly items: ReadonlyArray<unknown> }> {
  if (typeof result !== "object" || result === null || !("turns" in result)) {
    return [];
  }
  const turns = (result as { readonly turns?: ReadonlyArray<unknown> }).turns;
  if (!Array.isArray(turns)) {
    return [];
  }
  return turns.flatMap((turn) => {
    if (typeof turn !== "object" || turn === null) {
      return [];
    }
    const record = turn as Record<string, unknown>;
    const id = typeof record.id === "string" && record.id.trim().length > 0 ? record.id : undefined;
    if (id === undefined) {
      return [];
    }
    return [
      {
        id: asTurnId(id),
        items: Array.isArray(record.items) ? record.items : [],
      },
    ];
  });
}

export const makeOpenClawAdapterLive = (options: OpenClawAdapterLiveOptions = {}) =>
  Layer.effect(
    OpenClawAdapter,
    Effect.gen(function* () {
      const settingsService = yield* ServerSettingsService;
      const secretStore = yield* ServerSecretStore;
      const gatewayClient = options.gatewayClient ?? defaultOpenClawGatewayClient;
      const runtimeEvents = yield* Queue.unbounded<ProviderRuntimeEvent>();
      const sessionsRef = yield* Ref.make(new Map<string, OpenClawSessionContext>());

      const emit = (event: ProviderRuntimeEvent) =>
        Queue.offer(runtimeEvents, event).pipe(Effect.asVoid);

      const resolveGateway = () =>
        Effect.gen(function* () {
          const settings = yield* settingsService.getSettings.pipe(
            Effect.mapError((cause) =>
              requestError(
                "connect",
                causeMessage(cause, "Failed to load OpenClaw settings."),
                cause,
              ),
            ),
          );
          const gatewayUrl = settings.providers.openclaw.gatewayUrl.trim();
          if (gatewayUrl.length === 0) {
            return yield* Effect.fail(
              requestError("connect", "OpenClaw gateway URL is not configured."),
            );
          }
          const normalized = yield* Effect.try({
            try: () => normalizeOpenClawGatewayUrl(gatewayUrl),
            catch: (cause) =>
              requestError(
                "connect",
                cause instanceof OpenClawGatewayUrlError
                  ? cause.message
                  : "Invalid OpenClaw gateway URL.",
                cause,
              ),
          });

          const authMode = settings.providers.openclaw.authMode;
          const readSecret = (kind: "token" | "password" | "deviceKey" | "deviceToken") =>
            getOpenClawSecret(kind).pipe(
              Effect.provideService(ServerSecretStore, secretStore),
              Effect.mapError((cause) =>
                requestError(
                  "connect",
                  causeMessage(cause, "Failed to read OpenClaw secret metadata."),
                  cause,
                ),
              ),
            );
          const readSecretBytes = (kind: "deviceKey") =>
            getOpenClawSecretBytes(kind).pipe(
              Effect.provideService(ServerSecretStore, secretStore),
              Effect.mapError((cause) =>
                requestError(
                  "connect",
                  causeMessage(cause, "Failed to read OpenClaw secret metadata."),
                  cause,
                ),
              ),
            );
          const token = authMode === "token" ? yield* readSecret("token") : null;
          const password = authMode === "password" ? yield* readSecret("password") : null;
          const deviceKey = authMode === "device" ? yield* readSecretBytes("deviceKey") : null;
          const deviceToken = authMode === "device" ? yield* readSecret("deviceToken") : null;

          const auth: OpenClawAuthFrame | undefined =
            authMode === "token"
              ? token
                ? { type: "token", token }
                : undefined
              : authMode === "password"
                ? password
                  ? { type: "password", password }
                  : undefined
                : undefined;
          const device: OpenClawDeviceFrame | undefined =
            authMode === "device" && deviceKey !== null
              ? {
                  id: deriveOpenClawDeviceId(deviceKey),
                  ...(deviceToken !== null ? { token: deviceToken } : {}),
                }
              : undefined;

          if ((authMode === "token" || authMode === "password") && auth === undefined) {
            return yield* Effect.fail(
              requestError("connect", `OpenClaw ${authMode} secret is not configured.`),
            );
          }
          if (authMode === "device" && device === undefined) {
            return yield* Effect.fail(
              requestError("connect", "OpenClaw device identity is not configured."),
            );
          }

          const respondToChallenge =
            authMode === "device" && deviceKey !== null && device !== undefined
              ? (challenge: OpenClawChallenge) =>
                  buildOpenClawChallengeResponse({
                    challenge,
                    deviceId: device.id,
                    deviceKey,
                  })
              : undefined;

          return { normalized, auth, device, respondToChallenge };
        });

      const requestGateway = (request: OpenClawRequest<string, object>) =>
        gatewayClient
          .request(request)
          .pipe(
            Effect.mapError((cause) =>
              requestError(request.method, causeMessage(cause, `${request.method} failed.`), cause),
            ),
          );

      const adapter: OpenClawAdapterShape = {
        provider: PROVIDER,
        capabilities: { sessionModelSwitch: "unsupported" },
        startSession: (input) =>
          Effect.gen(function* () {
            if (input.provider !== undefined && input.provider !== PROVIDER) {
              return yield* Effect.fail(
                validationError(
                  "startSession",
                  `Expected provider ${PROVIDER}, received ${input.provider}.`,
                ),
              );
            }
            if (
              input.modelSelection !== undefined &&
              (input.modelSelection.provider !== PROVIDER ||
                input.modelSelection.model !== "gateway")
            ) {
              return yield* Effect.fail(
                validationError(
                  "startSession",
                  "OpenClaw sessions must use the gateway model sentinel.",
                ),
              );
            }

            const { normalized, auth, device, respondToChallenge } = yield* resolveGateway();
            const connectResult = yield* gatewayClient
              .connect({
                websocketUrl: normalized.websocketUrl,
                redactedGatewayUrl: normalized.redactedUrl,
                ...(auth !== undefined ? { auth } : {}),
                ...(device !== undefined ? { device } : {}),
                ...(respondToChallenge !== undefined ? { respondToChallenge } : {}),
              })
              .pipe(
                Effect.mapError((cause) =>
                  requestError(
                    "connect",
                    causeMessage(cause, "OpenClaw gateway connection failed."),
                    cause,
                  ),
                ),
              );
            const support = validateOpenClawMethodSupport(connectResult.methods);
            if (!support.supported) {
              return yield* Effect.fail(
                requestError(
                  "connect",
                  `OpenClaw gateway is missing required methods: ${support.missing.join(", ")}.`,
                ),
              );
            }
            const history = yield* requestGateway(
              buildOpenClawHistoryRequest({ sessionKey: sessionGatewayKey(input.threadId) }),
            );
            const now = nowIso();
            const session: ProviderSession = {
              provider: PROVIDER,
              status: "ready",
              runtimeMode: input.runtimeMode,
              threadId: input.threadId,
              model: "gateway",
              ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
              ...(input.resumeCursor !== undefined ? { resumeCursor: input.resumeCursor } : {}),
              createdAt: now,
              updatedAt: now,
            };
            yield* Ref.update(sessionsRef, (sessions) =>
              new Map(sessions).set(input.threadId, {
                session,
                turns: historyTurns(history),
                activeRunIdsByTurn: new Map(),
              }),
            );
            return session;
          }),
        sendTurn: (input) =>
          Effect.gen(function* () {
            if (input.attachments !== undefined && input.attachments.length > 0) {
              return yield* Effect.fail(
                validationError("sendTurn", "OpenClaw v1 does not support attachments."),
              );
            }
            if (input.skills !== undefined && input.skills.length > 0) {
              return yield* Effect.fail(
                validationError("sendTurn", "OpenClaw v1 does not support skill mentions."),
              );
            }
            if (input.mentions !== undefined && input.mentions.length > 0) {
              return yield* Effect.fail(
                validationError("sendTurn", "OpenClaw v1 does not support provider mentions."),
              );
            }
            if (input.modelSelection !== undefined && input.modelSelection.provider !== PROVIDER) {
              return yield* Effect.fail(
                validationError(
                  "sendTurn",
                  `Expected provider ${PROVIDER}, received ${input.modelSelection.provider}.`,
                ),
              );
            }
            if (input.input === undefined || input.input.trim().length === 0) {
              return yield* Effect.fail(
                validationError("sendTurn", "OpenClaw turns require text input."),
              );
            }
            const sessions = yield* Ref.get(sessionsRef);
            if (!sessions.has(input.threadId)) {
              return yield* Effect.fail(
                new ProviderAdapterSessionNotFoundError({
                  provider: PROVIDER,
                  threadId: input.threadId,
                }),
              );
            }

            const turnId = asTurnId(`openclaw-turn-${randomUUID()}`);
            yield* emit({
              ...buildEventBase({ threadId: input.threadId, turnId }),
              type: "turn.started",
              payload: { model: "gateway" },
            });

            const result = yield* requestGateway(
              buildOpenClawSendRequest({
                sessionKey: sessionGatewayKey(input.threadId),
                threadId: input.threadId,
                turnId,
                message: input.input,
              }),
            );
            const gatewayEvents = sendResultEvents(result);
            const runId =
              ("runId" in result && typeof result.runId === "string" ? result.runId : undefined) ??
              gatewayEvents.find((event) => typeof event.runId === "string")?.runId;
            yield* Ref.update(sessionsRef, (currentSessions) => {
              const context = currentSessions.get(input.threadId);
              if (context === undefined) {
                return currentSessions;
              }
              const activeRunIdsByTurn = new Map(context.activeRunIdsByTurn);
              if (runId !== undefined) {
                activeRunIdsByTurn.set(turnId, runId);
              }
              const nextTurns = [
                ...context.turns,
                { id: turnId, items: [{ role: "user", text: input.input }] },
              ];
              return new Map(currentSessions).set(input.threadId, {
                ...context,
                turns: nextTurns,
                activeRunIdsByTurn,
              });
            });
            for (const event of gatewayEvents) {
              switch (event.type) {
                case "assistant.delta": {
                  const delta = event.text ?? event.delta ?? "";
                  if (delta.length > 0) {
                    yield* emit({
                      ...buildEventBase({ threadId: input.threadId, turnId, raw: event }),
                      type: "content.delta",
                      payload: { streamKind: "assistant_text", delta },
                    });
                  }
                  break;
                }
                case "assistant.completed": {
                  yield* emit({
                    ...buildEventBase({
                      threadId: input.threadId,
                      turnId,
                      itemId: `openclaw-assistant-${event.runId ?? turnId}`,
                      raw: event,
                    }),
                    type: "item.completed",
                    payload: {
                      itemType: "assistant_message",
                      status: "completed",
                      data: { text: event.text ?? "" },
                    },
                  });
                  break;
                }
                case "run.completed": {
                  yield* emit({
                    ...buildEventBase({ threadId: input.threadId, turnId, raw: event }),
                    type: "turn.completed",
                    payload: { state: "completed", stopReason: event.stopReason ?? null },
                  });
                  break;
                }
                case "error": {
                  const message = event.message ?? "OpenClaw gateway error.";
                  yield* emit({
                    ...buildEventBase({ threadId: input.threadId, turnId, raw: event }),
                    type: "runtime.error",
                    payload: { message, class: "provider_error" },
                  });
                  yield* emit({
                    ...buildEventBase({ threadId: input.threadId, turnId, raw: event }),
                    type: "turn.completed",
                    payload: { state: "failed", errorMessage: message },
                  });
                  break;
                }
              }
            }
            return { threadId: input.threadId, turnId };
          }),
        interruptTurn: (threadId, turnId) =>
          Ref.get(sessionsRef).pipe(
            Effect.flatMap((sessions) => {
              const runId = turnId
                ? sessions.get(threadId)?.activeRunIdsByTurn.get(turnId)
                : undefined;
              return requestGateway(
                buildOpenClawAbortRequest({
                  sessionKey: sessionGatewayKey(threadId),
                  ...(runId !== undefined ? { runId } : {}),
                }),
              );
            }),
            Effect.asVoid,
          ),
        respondToRequest: () =>
          Effect.fail(
            validationError("respondToRequest", "OpenClaw v1 does not support approvals."),
          ),
        respondToUserInput: () =>
          Effect.fail(
            validationError(
              "respondToUserInput",
              "OpenClaw v1 does not support structured user input.",
            ),
          ),
        stopSession: (threadId) =>
          requestGateway(
            buildOpenClawAbortRequest({ sessionKey: sessionGatewayKey(threadId) }),
          ).pipe(
            Effect.tap(() =>
              Ref.update(sessionsRef, (sessions) => {
                const next = new Map(sessions);
                next.delete(threadId);
                return next;
              }),
            ),
            Effect.asVoid,
          ),
        listSessions: () =>
          Ref.get(sessionsRef).pipe(
            Effect.map((sessions) => Array.from(sessions.values(), (context) => context.session)),
          ),
        hasSession: (threadId) =>
          Ref.get(sessionsRef).pipe(Effect.map((sessions) => sessions.has(threadId))),
        readThread: (threadId): Effect.Effect<ProviderThreadSnapshot, ProviderAdapterError> =>
          Ref.get(sessionsRef).pipe(
            Effect.flatMap((sessions) => {
              const context = sessions.get(threadId);
              if (context === undefined) {
                return Effect.fail(
                  new ProviderAdapterSessionNotFoundError({ provider: PROVIDER, threadId }),
                );
              }
              return Effect.succeed({ threadId, turns: context.turns });
            }),
          ),
        rollbackThread: () =>
          Effect.fail(validationError("rollbackThread", "OpenClaw v1 does not support rollback.")),
        stopAll: () =>
          Ref.get(sessionsRef).pipe(
            Effect.flatMap((sessions) =>
              Effect.forEach(
                Array.from(sessions.keys()),
                (threadId) => adapter.stopSession(ThreadId.makeUnsafe(threadId)),
                { discard: true },
              ),
            ),
            Effect.asVoid,
          ),
        streamEvents: Stream.fromQueue(runtimeEvents),
      };

      return adapter;
    }),
  );
