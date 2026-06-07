import {
  ApprovalRequestId,
  type ProviderApprovalDecision,
  type ProviderListModelsResult,
  type ProviderRuntimeEvent,
  type ProviderSession,
  type ProviderSessionStartInput,
  type ProviderSendTurnInput,
  type ProviderTurnStartResult,
  type ProviderUserInputAnswers,
  type ThreadId,
  TurnId,
} from "@jcode/contracts";
import { Effect, Layer, PubSub, Stream } from "effect";

import { ServerConfig } from "../../config.ts";
import { ProviderAdapterSessionNotFoundError, ProviderAdapterValidationError } from "../Errors.ts";
import { DevinAdapter } from "../Services/DevinAdapter.ts";
import type { ProviderThreadSnapshot } from "../Services/ProviderAdapter.ts";
import { type EventNdjsonLogger, makeEventNdjsonLogger } from "./EventNdjsonLogger.ts";

export interface DevinAdapterLiveOptions {
  readonly nativeEventLogPath?: string;
  readonly nativeEventLogger?: EventNdjsonLogger;
}

const PROVIDER = "devin" as const;

export function makeDevinAdapterLive(options?: DevinAdapterLiveOptions) {
  return Effect.gen(function* () {
    const serverConfig = yield* Effect.service(ServerConfig);
    const nativeEventLogger =
      options?.nativeEventLogger ??
      (options?.nativeEventLogPath !== undefined
        ? yield* makeEventNdjsonLogger(options.nativeEventLogPath, { stream: "native" })
        : undefined);

    void nativeEventLogger;
    void serverConfig;

    const sessions = new Map<ThreadId, ProviderSession>();
    const runtimeEventPubSub = yield* PubSub.unbounded<ProviderRuntimeEvent>();

    const startSession = (
      _input: ProviderSessionStartInput,
    ): Effect.Effect<ProviderSession, ProviderAdapterValidationError> =>
      Effect.dieMessage("Not implemented: DevinAdapter.startSession");

    const sendTurn = (
      _input: ProviderSendTurnInput,
    ): Effect.Effect<ProviderTurnStartResult, ProviderAdapterSessionNotFoundError> =>
      Effect.dieMessage("Not implemented: DevinAdapter.sendTurn");

    const interruptTurn = (
      _threadId: ThreadId,
      _turnId?: TurnId,
      _providerThreadId?: string,
    ): Effect.Effect<void, ProviderAdapterSessionNotFoundError> =>
      Effect.dieMessage("Not implemented: DevinAdapter.interruptTurn");

    const respondToRequest = (
      _threadId: ThreadId,
      _requestId: ApprovalRequestId,
      _decision: ProviderApprovalDecision,
    ): Effect.Effect<void, ProviderAdapterSessionNotFoundError> =>
      Effect.dieMessage("Not implemented: DevinAdapter.respondToRequest");

    const respondToUserInput = (
      _threadId: ThreadId,
      _requestId: ApprovalRequestId,
      _answers: ProviderUserInputAnswers,
    ): Effect.Effect<void, ProviderAdapterSessionNotFoundError> =>
      Effect.dieMessage("Not implemented: DevinAdapter.respondToUserInput");

    const stopSession = (
      _threadId: ThreadId,
    ): Effect.Effect<void, ProviderAdapterSessionNotFoundError> =>
      Effect.dieMessage("Not implemented: DevinAdapter.stopSession");

    const listSessions = (): Effect.Effect<ReadonlyArray<ProviderSession>> =>
      Effect.sync(() => Array.from(sessions.values()));

    const hasSession = (threadId: ThreadId): Effect.Effect<boolean> =>
      Effect.sync(() => sessions.has(threadId));

    const readThread = (
      _threadId: ThreadId,
    ): Effect.Effect<ProviderThreadSnapshot, ProviderAdapterSessionNotFoundError> =>
      Effect.dieMessage("Not implemented: DevinAdapter.readThread");

    const rollbackThread = (
      _threadId: ThreadId,
      _numTurns: number,
    ): Effect.Effect<ProviderThreadSnapshot, ProviderAdapterSessionNotFoundError> =>
      Effect.dieMessage("Not implemented: DevinAdapter.rollbackThread");

    const stopAll = (): Effect.Effect<void> =>
      Effect.sync(() => {
        sessions.clear();
      });

    const streamEvents: Stream.Stream<ProviderRuntimeEvent> = Stream.fromPubSub(runtimeEventPubSub);

    const listModels = (
      _input: unknown,
    ): Effect.Effect<ProviderListModelsResult, ProviderAdapterSessionNotFoundError> =>
      Effect.dieMessage("Not implemented: DevinAdapter.listModels");

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
    } satisfies DevinAdapter["Type"];
  });
}

export const DevinAdapterLive = Layer.effect(DevinAdapter, makeDevinAdapterLive());
