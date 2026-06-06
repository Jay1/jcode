import {
  CommandId,
  MessageId,
  ORCHESTRATION_GOAL_COMPLETION_SENTINEL,
  type OrchestrationEvent,
  type OrchestrationMessage,
  type OrchestrationThread,
  type ThreadId,
  type TurnId,
} from "@jcode/contracts";
import { Cause, Effect, Layer, Option, Stream } from "effect";
import { makeDrainableWorker } from "@jcode/shared/DrainableWorker";

import {
  GoalContinuationReactor,
  type GoalContinuationReactorShape,
} from "../Services/GoalContinuationReactor.ts";
import { OrchestrationEngineService } from "../Services/OrchestrationEngine.ts";
import { ProjectionSnapshotQuery } from "../Services/ProjectionSnapshotQuery.ts";
import { renderGoalContinuationPrompt } from "../goalContinuationPrompt.ts";

type GoalTriggerEvent = Extract<
  OrchestrationEvent,
  { type: "thread.turn-diff-completed" | "thread.session-set" }
>;

function triggerThreadId(event: GoalTriggerEvent): ThreadId {
  return event.payload.threadId;
}

function isGoalTriggerEvent(event: OrchestrationEvent): event is GoalTriggerEvent {
  return event.type === "thread.turn-diff-completed" || event.type === "thread.session-set";
}

function isSessionRunning(thread: OrchestrationThread): boolean {
  return thread.session?.status === "starting" || thread.session?.status === "running";
}

function latestAssistantMessageForTurn(
  thread: OrchestrationThread,
  turnId: TurnId,
): OrchestrationMessage | null {
  return (
    thread.messages
      .filter((message) => message.role === "assistant" && message.turnId === turnId)
      .toSorted(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id),
      )[0] ?? null
  );
}

function hasCompletionSentinel(message: OrchestrationMessage | null): boolean {
  return message?.text.trimEnd().endsWith(ORCHESTRATION_GOAL_COMPLETION_SENTINEL) ?? false;
}

const serverCommandId = (tag: string, threadId: ThreadId, turnId: TurnId): CommandId =>
  CommandId.makeUnsafe(
    `server:goal-continuation:${tag}:${threadId}:${turnId}:${crypto.randomUUID()}`,
  );

const continuationMessageId = (threadId: ThreadId, turnId: TurnId): MessageId =>
  MessageId.makeUnsafe(`goal-continuation:${threadId}:${turnId}:${crypto.randomUUID()}`);

const make = Effect.gen(function* () {
  const orchestrationEngine = yield* OrchestrationEngineService;
  const snapshotQuery = yield* ProjectionSnapshotQuery;
  const handledTurnIds = new Map<string, TurnId>();

  const processTrigger = Effect.fn(function* (event: GoalTriggerEvent) {
    const threadId = triggerThreadId(event);
    const detail = yield* snapshotQuery.getThreadDetailById(threadId);
    if (Option.isNone(detail)) {
      return;
    }

    const thread = detail.value;
    const goal = thread.goal;
    const latestTurn = thread.latestTurn;
    if (!goal || goal.status !== "active" || !latestTurn || latestTurn.state !== "completed") {
      return;
    }
    if (isSessionRunning(thread) || thread.hasPendingApprovals || thread.hasPendingUserInput) {
      return;
    }

    if (
      handledTurnIds.get(thread.id) === latestTurn.turnId ||
      goal.lastContinuationTurnId === latestTurn.turnId
    ) {
      return;
    }

    const completedAt = latestTurn.completedAt ?? event.occurredAt;
    const assistantMessage = latestAssistantMessageForTurn(thread, latestTurn.turnId);
    if (hasCompletionSentinel(assistantMessage)) {
      yield* orchestrationEngine.dispatch({
        type: "thread.goal.complete",
        commandId: serverCommandId("complete", thread.id, latestTurn.turnId),
        threadId: thread.id,
        completedAt,
        createdAt: event.occurredAt,
      });
      handledTurnIds.set(thread.id, latestTurn.turnId);
      return;
    }

    yield* orchestrationEngine.dispatch({
      type: "thread.turn.start",
      commandId: serverCommandId("turn", thread.id, latestTurn.turnId),
      threadId: thread.id,
      message: {
        messageId: continuationMessageId(thread.id, latestTurn.turnId),
        role: "user",
        text: renderGoalContinuationPrompt({
          goal,
          recapText: thread.recap?.text ?? null,
        }),
        attachments: [],
        source: "goal-continuation",
      },
      runtimeMode: thread.runtimeMode,
      interactionMode: thread.interactionMode,
      createdAt: event.occurredAt,
    });
    handledTurnIds.set(thread.id, latestTurn.turnId);
  });

  const processTriggerSafely = (event: GoalTriggerEvent) =>
    processTrigger(event).pipe(
      Effect.catchCause((cause) => {
        if (Cause.hasInterruptsOnly(cause)) {
          return Effect.failCause(cause);
        }
        return Effect.logWarning("goal continuation reactor failed to process event", {
          eventType: event.type,
          threadId: triggerThreadId(event),
          cause: Cause.pretty(cause),
        });
      }),
    );

  const worker = yield* makeDrainableWorker(processTriggerSafely);

  const start: GoalContinuationReactorShape["start"] = Effect.gen(function* () {
    yield* Effect.forkScoped(
      Stream.runForEach(orchestrationEngine.streamDomainEvents, (event) => {
        if (!isGoalTriggerEvent(event)) {
          return Effect.void;
        }
        return worker.enqueue(event);
      }),
    );
  });

  return {
    start,
    drain: worker.drain,
  } satisfies GoalContinuationReactorShape;
});

export const GoalContinuationReactorLive = Layer.effect(GoalContinuationReactor, make);
