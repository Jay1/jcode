/**
 * DevinAdapterLive — Devin CLI (`devin acp`) via ACP.
 *
 * @module DevinAdapterLive
 */
import * as nodePath from "node:path";

import {
  ApprovalRequestId,
  EventId,
  type ProviderApprovalDecision,
  type ProviderListModelsResult,
  type ProviderRuntimeEvent,
  type ProviderSendTurnInput,
  type ProviderSession,
  type ProviderSessionStartInput,
  type ProviderTurnStartResult,
  type ProviderUserInputAnswers,
  RuntimeRequestId,
  type ThreadId,
  TurnId,
} from "@jcode/contracts";
import { Cause, Deferred, Effect, Exit, Fiber, Layer, PubSub, Scope, Stream } from "effect";
import { ChildProcessSpawner } from "effect/unstable/process";
import type * as EffectAcpSchema from "effect-acp/schema";

import { resolveAttachmentPath } from "../../attachmentStore.ts";
import { ServerConfig, type ServerConfigShape } from "../../config.ts";
import {
  ProviderAdapterProcessError,
  ProviderAdapterRequestError,
  ProviderAdapterSessionNotFoundError,
  ProviderAdapterValidationError,
} from "../Errors.ts";
import { acpPermissionOutcome, mapAcpToAdapterError } from "../acp/AcpAdapterSupport.ts";
import { type AcpSessionRuntimeShape } from "../acp/AcpSessionRuntime.ts";
import {
  makeAcpAssistantItemEvent,
  makeAcpContentDeltaEvent,
  makeAcpPlanUpdatedEvent,
  makeAcpRequestOpenedEvent,
  makeAcpRequestResolvedEvent,
  makeAcpTokenUsageEvent,
  makeAcpToolCallEvent,
} from "../acp/AcpCoreRuntimeEvents.ts";
import { parsePermissionRequest } from "../acp/AcpRuntimeModel.ts";
import { makeAcpNativeLoggers } from "../acp/AcpNativeLogging.ts";
import { makeDevinAcpRuntime, type DevinAcpRuntimeSettings } from "../acp/DevinAcpSupport.ts";
import { DevinAdapter, type DevinAdapterShape } from "../Services/DevinAdapter.ts";
import type { ProviderThreadSnapshot } from "../Services/ProviderAdapter.ts";
import { type EventNdjsonLogger, makeEventNdjsonLogger } from "./EventNdjsonLogger.ts";

const PROVIDER = "devin" as const;

// --- Helpers ---

function resolveSessionCwd(
  inputCwd: string | undefined,
  serverConfig: ServerConfigShape,
): string | undefined {
  const requestedCwd = inputCwd?.trim();
  if (requestedCwd) {
    return nodePath.resolve(requestedCwd);
  }
  const fallbackCwd = serverConfig.cwd.trim() || serverConfig.homeDir.trim();
  return fallbackCwd ? nodePath.resolve(fallbackCwd) : undefined;
}

function selectAutoApprovedPermissionOption(
  request: EffectAcpSchema.RequestPermissionRequest,
): string | undefined {
  const allowAlwaysOption = request.options.find((option) => option.kind === "allow_always");
  if (typeof allowAlwaysOption?.optionId === "string" && allowAlwaysOption.optionId.trim()) {
    return allowAlwaysOption.optionId.trim();
  }

  const allowOnceOption = request.options.find((option) => option.kind === "allow_once");
  if (typeof allowOnceOption?.optionId === "string" && allowOnceOption.optionId.trim()) {
    return allowOnceOption.optionId.trim();
  }

  return undefined;
}

function readAcpUsdCost(cost: EffectAcpSchema.Cost | null | undefined): number | undefined {
  if (!cost || cost.currency.toUpperCase() !== "USD" || !Number.isFinite(cost.amount)) {
    return undefined;
  }
  return cost.amount >= 0 ? cost.amount : undefined;
}

function settlePendingApprovalsAsCancelled(
  pendingApprovals: ReadonlyMap<ApprovalRequestId, PendingApproval>,
): Effect.Effect<void> {
  const pendingEntries = Array.from(pendingApprovals.values());
  return Effect.forEach(
    pendingEntries,
    (pending) => Deferred.succeed(pending.decision, "cancel").pipe(Effect.ignore),
    { discard: true },
  );
}

function settlePendingUserInputsAsEmptyAnswers(
  pendingUserInputs: ReadonlyMap<ApprovalRequestId, PendingUserInput>,
): Effect.Effect<void> {
  const pendingEntries = Array.from(pendingUserInputs.values());
  return Effect.forEach(
    pendingEntries,
    (pending) => Deferred.succeed(pending.answers, {}).pipe(Effect.ignore),
    { discard: true },
  );
}

// --- Session context ---

interface PendingApproval {
  readonly decision: Deferred.Deferred<ProviderApprovalDecision>;
  readonly kind: string | "unknown";
}

interface PendingUserInput {
  readonly answers: Deferred.Deferred<ProviderUserInputAnswers>;
}

interface DevinSessionContext {
  readonly threadId: ThreadId;
  session: ProviderSession;
  readonly scope: Scope.Closeable;
  readonly acp: AcpSessionRuntimeShape;
  notificationFiber: Fiber.Fiber<void, never> | undefined;
  readonly pendingApprovals: Map<ApprovalRequestId, PendingApproval>;
  readonly pendingUserInputs: Map<ApprovalRequestId, PendingUserInput>;
  readonly turns: Array<{ id: TurnId; items: Array<unknown> }>;
  latestSessionCostUsd: number | undefined;
  activeTurnId: TurnId | undefined;
  activePromptFiber: Fiber.Fiber<void, never> | undefined;
  stopped: boolean;
}

// --- Adapter factory ---

export interface DevinAdapterLiveOptions {
  readonly nativeEventLogPath?: string;
  readonly nativeEventLogger?: EventNdjsonLogger;
}

function makeDevinAdapter(options?: DevinAdapterLiveOptions) {
  return Effect.gen(function* () {
    const serverConfig = yield* Effect.service(ServerConfig);
    const childProcessSpawner = yield* Effect.service(ChildProcessSpawner.ChildProcessSpawner);
    const devinSettings: DevinAcpRuntimeSettings | undefined = undefined;
    const nativeEventLogger =
      options?.nativeEventLogger ??
      (options?.nativeEventLogPath !== undefined
        ? yield* makeEventNdjsonLogger(options.nativeEventLogPath, { stream: "native" })
        : undefined);

    const sessions = new Map<ThreadId, DevinSessionContext>();
    const runtimeEventPubSub = yield* PubSub.unbounded<ProviderRuntimeEvent>();

    const makeEventStamp = Effect.sync(() => ({
      eventId: EventId.makeUnsafe(crypto.randomUUID()),
      createdAt: new Date().toISOString(),
    }));

    const offerRuntimeEvent = (event: ProviderRuntimeEvent) =>
      PubSub.publish(runtimeEventPubSub, event);

    const logNative = (
      threadId: ThreadId,
      method: string,
      payload: unknown,
      source: string = "acp.jsonrpc",
    ) =>
      Effect.sync(() => {
        if (!nativeEventLogger) return;
        void nativeEventLogger
          .write(
            {
              observedAt: new Date().toISOString(),
              event: {
                id: crypto.randomUUID(),
                kind: source === "acp.jsonrpc" ? "protocol" : "request",
                provider: PROVIDER,
                createdAt: new Date().toISOString(),
                threadId,
                payload: { method, ...(payload as Record<string, unknown>) },
              },
            },
            threadId,
          )
          .pipe(Effect.runFork);
      });

    const requireSession = (
      threadId: ThreadId,
    ): Effect.Effect<DevinSessionContext, ProviderAdapterSessionNotFoundError> =>
      Effect.sync(() => sessions.get(threadId)).pipe(
        Effect.flatMap((ctx) =>
          ctx
            ? Effect.succeed(ctx)
            : Effect.fail(
                new ProviderAdapterSessionNotFoundError({
                  provider: PROVIDER,
                  threadId,
                }),
              ),
        ),
      );

    const stopSessionInternal = (ctx: DevinSessionContext) =>
      Effect.gen(function* () {
        if (ctx.stopped) return;
        ctx.stopped = true;
        yield* settlePendingApprovalsAsCancelled(ctx.pendingApprovals);
        yield* settlePendingUserInputsAsEmptyAnswers(ctx.pendingUserInputs);
        if (ctx.notificationFiber) {
          yield* Fiber.interrupt(ctx.notificationFiber);
        }
        yield* Effect.ignore(Scope.close(ctx.scope, Exit.void));
        sessions.delete(ctx.threadId);
        yield* offerRuntimeEvent({
          type: "session.exited",
          ...(yield* makeEventStamp),
          provider: PROVIDER,
          threadId: ctx.threadId,
          payload: { exitKind: "graceful" },
        });
      });

    // --- startSession ---

    const startSession: DevinAdapterShape["startSession"] = (input) =>
      Effect.gen(function* () {
        if (input.provider !== undefined && input.provider !== PROVIDER) {
          return yield* new ProviderAdapterValidationError({
            provider: PROVIDER,
            operation: "startSession",
            issue: `Expected provider '${PROVIDER}' but received '${input.provider}'.`,
          });
        }

        const cwd = resolveSessionCwd(input.cwd, serverConfig);
        if (cwd === undefined) {
          return yield* new ProviderAdapterValidationError({
            provider: PROVIDER,
            operation: "startSession",
            issue: "cwd is required and no server cwd fallback is available.",
          });
        }

        const existing = sessions.get(input.threadId);
        if (existing && !existing.stopped) {
          yield* stopSessionInternal(existing);
        }

        const pendingApprovals = new Map<ApprovalRequestId, PendingApproval>();
        const pendingUserInputs = new Map<ApprovalRequestId, PendingUserInput>();
        const sessionScope = yield* Scope.make("sequential");
        let sessionScopeTransferred = false;
        yield* Effect.addFinalizer(() =>
          sessionScopeTransferred ? Effect.void : Scope.close(sessionScope, Exit.void),
        );

        let ctx!: DevinSessionContext;

        const acpNativeLoggers = makeAcpNativeLoggers({
          nativeEventLogger,
          provider: PROVIDER,
          threadId: input.threadId,
        });

        const acp = yield* makeDevinAcpRuntime({
          devinSettings,
          childProcessSpawner,
          cwd,
          clientInfo: { name: "jcode", version: "0.0.0" },
          ...acpNativeLoggers,
        }).pipe(
          Effect.provideService(Scope.Scope, sessionScope),
          Effect.mapError(
            (cause) =>
              new ProviderAdapterProcessError({
                provider: PROVIDER,
                threadId: input.threadId,
                detail: cause.message,
                cause,
              }),
          ),
        );

        // Register ACP request handlers before start
        yield* acp.handleRequestPermission((params) =>
          Effect.gen(function* () {
            yield* logNative(input.threadId, "session/request_permission", params);

            if (input.runtimeMode === "full-access") {
              const autoApprovedOptionId = selectAutoApprovedPermissionOption(params);
              if (autoApprovedOptionId !== undefined) {
                return {
                  outcome: {
                    outcome: "selected" as const,
                    optionId: autoApprovedOptionId,
                  },
                };
              }
            }

            const permissionRequest = parsePermissionRequest(params);
            const requestId = ApprovalRequestId.makeUnsafe(crypto.randomUUID());
            const runtimeRequestId = RuntimeRequestId.makeUnsafe(requestId);
            const decision = yield* Deferred.make<ProviderApprovalDecision>();
            pendingApprovals.set(requestId, {
              decision,
              kind: permissionRequest.kind,
            });
            yield* offerRuntimeEvent(
              makeAcpRequestOpenedEvent({
                stamp: yield* makeEventStamp,
                provider: PROVIDER,
                threadId: input.threadId,
                turnId: ctx?.activeTurnId,
                requestId: runtimeRequestId,
                permissionRequest,
                detail: permissionRequest.detail ?? JSON.stringify(params).slice(0, 2000),
                args: params,
                source: "acp.jsonrpc",
                method: "session/request_permission",
                rawPayload: params,
              }),
            );
            const outcome = yield* Deferred.await(decision);
            ctx?.pendingApprovals.delete(requestId);
            yield* offerRuntimeEvent(
              makeAcpRequestResolvedEvent({
                stamp: yield* makeEventStamp,
                provider: PROVIDER,
                threadId: input.threadId,
                turnId: ctx?.activeTurnId,
                requestId: runtimeRequestId,
                permissionRequest,
                decision: outcome,
              }),
            );
            return {
              outcome: {
                outcome: "selected" as const,
                optionId: acpPermissionOutcome(outcome),
              },
            };
          }),
        );

        yield* acp.handleElicitation((params) =>
          Effect.gen(function* () {
            yield* logNative(input.threadId, "session/elicit", params);
            const requestId = ApprovalRequestId.makeUnsafe(crypto.randomUUID());
            const runtimeRequestId = RuntimeRequestId.makeUnsafe(requestId);
            const answers = yield* Deferred.make<ProviderUserInputAnswers>();
            pendingUserInputs.set(requestId, { answers });
            yield* offerRuntimeEvent({
              type: "user-input.requested",
              ...(yield* makeEventStamp),
              provider: PROVIDER,
              threadId: input.threadId,
              turnId: ctx?.activeTurnId,
              requestId: runtimeRequestId,
              payload: {
                questions: [
                  {
                    id: "answer",
                    header: "Input",
                    question: params.message,
                    options: [],
                  },
                ],
              },
            });
            const result = yield* Deferred.await(answers);
            ctx?.pendingUserInputs.delete(requestId);
            return { action: { action: "accept" as const } };
          }),
        );

        // Start the ACP session
        const started = yield* acp.start().pipe(
          Effect.mapError(
            (cause) =>
              new ProviderAdapterProcessError({
                provider: PROVIDER,
                threadId: input.threadId,
                detail: cause.message,
                cause,
              }),
          ),
        );

        const now = new Date().toISOString();
        const session: ProviderSession = {
          provider: PROVIDER,
          status: "ready",
          runtimeMode: input.runtimeMode,
          cwd,
          threadId: input.threadId,
          createdAt: now,
          updatedAt: now,
        };

        ctx = {
          threadId: input.threadId,
          session,
          scope: sessionScope,
          acp,
          notificationFiber: undefined,
          pendingApprovals,
          pendingUserInputs,
          turns: [],
          latestSessionCostUsd: undefined,
          activeTurnId: undefined,
          activePromptFiber: undefined,
          stopped: false,
        };

        // Start notification fiber
        const nf = yield* Stream.runDrain(
          Stream.mapEffect(acp.getEvents(), (event) =>
            Effect.gen(function* () {
              switch (event._tag) {
                case "ModeChanged":
                  return;
                case "AssistantItemStarted":
                  yield* offerRuntimeEvent(
                    makeAcpAssistantItemEvent({
                      stamp: yield* makeEventStamp,
                      provider: PROVIDER,
                      threadId: ctx.threadId,
                      turnId: ctx.activeTurnId,
                      itemId: event.itemId,
                      lifecycle: "item.started",
                    }),
                  );
                  return;
                case "AssistantItemCompleted":
                  yield* offerRuntimeEvent(
                    makeAcpAssistantItemEvent({
                      stamp: yield* makeEventStamp,
                      provider: PROVIDER,
                      threadId: ctx.threadId,
                      turnId: ctx.activeTurnId,
                      itemId: event.itemId,
                      lifecycle: "item.completed",
                    }),
                  );
                  return;
                case "PlanUpdated":
                  yield* logNative(ctx.threadId, "session/update", event.rawPayload);
                  yield* offerRuntimeEvent(
                    makeAcpPlanUpdatedEvent({
                      stamp: yield* makeEventStamp,
                      provider: PROVIDER,
                      threadId: ctx.threadId,
                      turnId: ctx.activeTurnId,
                      payload: event.payload,
                      source: "acp.jsonrpc",
                      method: "session/update",
                      rawPayload: event.rawPayload,
                    }),
                  );
                  return;
                case "ToolCallUpdated":
                  yield* logNative(ctx.threadId, "session/update", event.rawPayload);
                  yield* offerRuntimeEvent(
                    makeAcpToolCallEvent({
                      stamp: yield* makeEventStamp,
                      provider: PROVIDER,
                      threadId: ctx.threadId,
                      turnId: ctx.activeTurnId,
                      toolCall: event.toolCall,
                      rawPayload: event.rawPayload,
                    }),
                  );
                  return;
                case "ContentDelta":
                  yield* offerRuntimeEvent(
                    makeAcpContentDeltaEvent({
                      stamp: yield* makeEventStamp,
                      provider: PROVIDER,
                      threadId: ctx.threadId,
                      turnId: ctx.activeTurnId ?? undefined,
                      ...(event.itemId != null ? { itemId: event.itemId } : {}),
                      text: event.text,
                      ...(event.streamKind != null ? { streamKind: event.streamKind } : {}),
                      rawPayload: event.rawPayload as unknown,
                    }),
                  );
                  return;
                case "UsageUpdated":
                  yield* offerRuntimeEvent(
                    makeAcpTokenUsageEvent({
                      stamp: yield* makeEventStamp,
                      provider: PROVIDER,
                      threadId: ctx.threadId,
                      turnId: ctx.activeTurnId,
                      usage: event.usage,
                      rawPayload: event.rawPayload ?? undefined,
                    }),
                  );
                  {
                    const sessionCostUsd = readAcpUsdCost(event.cost);
                    if (sessionCostUsd !== undefined) {
                      ctx.latestSessionCostUsd = sessionCostUsd;
                    }
                  }
                  return;
                default:
                  return;
              }
            }),
          ),
        ).pipe(Effect.forkIn(sessionScope));
        ctx.notificationFiber = nf;

        sessionScopeTransferred = true;
        sessions.set(input.threadId, ctx);

        yield* offerRuntimeEvent({
          type: "session.started",
          ...(yield* makeEventStamp),
          provider: PROVIDER,
          threadId: input.threadId,
          payload: {},
        });

        return session;
      }).pipe(Effect.scoped);

    // --- sendTurn ---

    const sendTurn: DevinAdapterShape["sendTurn"] = (input) =>
      Effect.gen(function* () {
        const ctx = yield* requireSession(input.threadId);
        const turnId = TurnId.makeUnsafe(crypto.randomUUID());

        const promptParts: Array<EffectAcpSchema.ContentBlock> = [];
        if (input.input?.trim()) {
          promptParts.push({
            type: "text",
            text: input.input.trim(),
          });
        }
        if (input.attachments && input.attachments.length > 0) {
          for (const attachment of input.attachments) {
            if (attachment.type !== "image") {
              return yield* new ProviderAdapterValidationError({
                provider: PROVIDER,
                operation: "sendTurn",
                issue: "Devin only supports image attachments for provider prompts.",
              });
            }
            const attachmentPath = resolveAttachmentPath({
              attachmentsDir: serverConfig.attachmentsDir,
              attachment,
            });
            if (!attachmentPath) {
              return yield* new ProviderAdapterRequestError({
                provider: PROVIDER,
                method: "session/prompt",
                detail: `Invalid attachment id '${attachment.id}'.`,
              });
            }
            const imageStat = yield* Effect.tryPromise({
              try: () => import("node:fs/promises").then((fs) => fs.stat(attachmentPath)),
              catch: (cause) =>
                new ProviderAdapterRequestError({
                  provider: PROVIDER,
                  method: "session/prompt",
                  detail: `Failed to stat attachment '${attachment.id}': ${String(cause)}`,
                }),
            });
            if (imageStat.size > 10 * 1024 * 1024) {
              return yield* new ProviderAdapterRequestError({
                provider: PROVIDER,
                method: "session/prompt",
                detail: `Image attachment '${attachment.id}' is too large (${imageStat.size} bytes, max 10MB).`,
              });
            }
            // Read image file as base64 data URI for ACP image content block
            const imageBuffer = yield* Effect.tryPromise({
              try: () => import("node:fs/promises").then((fs) => fs.readFile(attachmentPath)),
              catch: (cause) =>
                new ProviderAdapterRequestError({
                  provider: PROVIDER,
                  method: "session/prompt",
                  detail: `Failed to read attachment '${attachment.id}': ${String(cause)}`,
                }),
            });
            const ext = nodePath.extname(attachmentPath).toLowerCase();
            const mimeType =
              ext === ".png"
                ? "image/png"
                : ext === ".gif"
                  ? "image/gif"
                  : ext === ".webp"
                    ? "image/webp"
                    : "image/jpeg";
            promptParts.push({
              type: "image",
              data: `data:${mimeType};base64,${imageBuffer.toString("base64")}`,
              mimeType,
            });
          }
        }

        if (promptParts.length === 0) {
          return yield* new ProviderAdapterValidationError({
            provider: PROVIDER,
            operation: "sendTurn",
            issue: "Prompt content is required.",
          });
        }

        const activeTurnId = turnId;
        ctx.activeTurnId = activeTurnId;
        ctx.session = {
          ...ctx.session,
          activeTurnId,
          updatedAt: new Date().toISOString(),
        };

        const promptFiber = yield* Effect.gen(function* () {
          yield* ctx.acp
            .prompt({ prompt: promptParts })
            .pipe(
              Effect.mapError((error) =>
                mapAcpToAdapterError(PROVIDER, input.threadId, "session/prompt", error),
              ),
            );
        }).pipe(
          Effect.catchCause((cause) =>
            Effect.gen(function* () {
              const error = Cause.squash(cause);
              const errorObj = error as Record<string, unknown> | undefined;
              const errorTag = errorObj?._tag ? String(errorObj._tag) : "Error";
              const errorMessage =
                errorObj && "message" in errorObj ? String(errorObj.message) : Cause.pretty(cause);
              yield* offerRuntimeEvent({
                type: "runtime.error",
                ...(yield* makeEventStamp),
                provider: PROVIDER,
                threadId: input.threadId,
                turnId: activeTurnId,
                payload: {
                  message: `${errorTag}: ${errorMessage}`,
                },
              });
            }),
          ),
          Effect.tap(() =>
            Effect.sync(() => {
              if (ctx.activeTurnId === activeTurnId) {
                ctx.activeTurnId = undefined;
                ctx.activePromptFiber = undefined;
                const { activeTurnId: _a, ...restored } = ctx.session;
                ctx.session = { ...restored, updatedAt: new Date().toISOString() };
              }
              ctx.turns.push({ id: turnId, items: [] });
            }),
          ),
          Effect.forkIn(ctx.scope),
        );
        ctx.activePromptFiber = promptFiber;

        return {
          threadId: input.threadId,
          turnId,
        };
      });

    // --- interruptTurn ---

    const interruptTurn = (
      threadId: ThreadId,
    ): Effect.Effect<void, ProviderAdapterSessionNotFoundError> =>
      Effect.gen(function* () {
        const ctx = yield* requireSession(threadId);
        yield* settlePendingApprovalsAsCancelled(ctx.pendingApprovals);
        yield* settlePendingUserInputsAsEmptyAnswers(ctx.pendingUserInputs);
        const activePromptFiber = ctx.activePromptFiber;
        yield* Effect.ignore(
          ctx.acp.cancel.pipe(
            Effect.mapError((error) =>
              mapAcpToAdapterError(PROVIDER, threadId, "session/cancel", error),
            ),
          ),
        );
        if (activePromptFiber) {
          yield* Fiber.interrupt(activePromptFiber);
        }
      });

    // --- respondToRequest ---

    const respondToRequest: DevinAdapterShape["respondToRequest"] = (
      threadId,
      requestId,
      decision,
    ) =>
      Effect.gen(function* () {
        const ctx = yield* requireSession(threadId);
        const pending = ctx.pendingApprovals.get(requestId);
        if (!pending) {
          return yield* new ProviderAdapterRequestError({
            provider: PROVIDER,
            method: "session/request_permission",
            detail: `Unknown pending approval request: ${requestId}`,
          });
        }
        yield* Deferred.succeed(pending.decision, decision);
      });

    // --- respondToUserInput ---

    const respondToUserInput: DevinAdapterShape["respondToUserInput"] = (
      threadId,
      requestId,
      answers,
    ) =>
      Effect.gen(function* () {
        const ctx = yield* requireSession(threadId);
        const pending = ctx.pendingUserInputs.get(requestId);
        if (!pending) {
          return yield* new ProviderAdapterRequestError({
            provider: PROVIDER,
            method: "session/elicit",
            detail: `Unknown pending user-input request: ${requestId}`,
          });
        }
        yield* Deferred.succeed(pending.answers, answers);
      });

    // --- stopSession ---

    const stopSession: DevinAdapterShape["stopSession"] = (threadId) =>
      Effect.gen(function* () {
        const ctx = yield* requireSession(threadId);
        yield* stopSessionInternal(ctx);
      });

    // --- listSessions ---

    const listSessions = (): Effect.Effect<ReadonlyArray<ProviderSession>> =>
      Effect.sync(() => Array.from(sessions.values()).map((ctx) => ctx.session));

    // --- hasSession ---

    const hasSession = (threadId: ThreadId): Effect.Effect<boolean> =>
      Effect.sync(() => sessions.has(threadId));

    // --- readThread ---

    const readThread = (
      threadId: ThreadId,
    ): Effect.Effect<ProviderThreadSnapshot, ProviderAdapterSessionNotFoundError> =>
      Effect.gen(function* () {
        const ctx = yield* requireSession(threadId);
        return { threadId, turns: ctx.turns };
      });

    // --- rollbackThread ---

    const rollbackThread = (
      threadId: ThreadId,
      numTurns: number,
    ): Effect.Effect<ProviderThreadSnapshot, ProviderAdapterSessionNotFoundError> =>
      Effect.gen(function* () {
        const ctx = yield* requireSession(threadId);
        const toRemove = Math.min(numTurns, ctx.turns.length);
        ctx.turns.splice(ctx.turns.length - toRemove, toRemove);
        return { threadId, turns: ctx.turns };
      });

    // --- stopAll ---

    const stopAll = (): Effect.Effect<void> =>
      Effect.gen(function* () {
        const activeCtxs = Array.from(sessions.values());
        yield* Effect.forEach(activeCtxs, (ctx) => stopSessionInternal(ctx).pipe(Effect.ignore), {
          discard: true,
        });
      });

    // --- streamEvents ---

    const streamEvents: Stream.Stream<ProviderRuntimeEvent> = Stream.fromPubSub(runtimeEventPubSub);

    // --- listModels ---

    const listModels = (
      _input: unknown,
    ): Effect.Effect<ProviderListModelsResult, ProviderAdapterSessionNotFoundError> =>
      // Devin does not expose a model list through ACP standard calls.
      // Return empty discovery; model selection is handled through Devin's own UI.
      Effect.succeed({ models: [], discovered: false });

    return {
      provider: PROVIDER,
      capabilities: {
        sessionModelSwitch: "restart-session" as const,
        supportsTurnSteering: false,
        supportsRuntimeModelList: true,
      },
      startSession,
      sendTurn,
      interruptTurn,
      respondToRequest,
      respondToUserInput,
      stopSession,
      listSessions,
      hasSession,
      readThread,
      rollbackThread,
      stopAll,
      streamEvents,
      listModels,
    } satisfies DevinAdapterShape;
  });
}

export const DevinAdapterLive = makeDevinAdapterLive();

export function makeDevinAdapterLive(options?: DevinAdapterLiveOptions) {
  return Layer.effect(DevinAdapter, makeDevinAdapter(options));
}
