import {
  CheckpointRef,
  CommandId,
  CorrelationId,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  EventId,
  MessageId,
  ORCHESTRATION_GOAL_COMPLETION_SENTINEL,
  ProjectId,
  ThreadId,
  TurnId,
  type OrchestrationCommand,
  type OrchestrationEvent,
  type OrchestrationThread,
} from "@jcode/contracts";
import { Effect, Exit, Layer, ManagedRuntime, Option, PubSub, Scope, Stream } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { GoalContinuationReactorLive } from "./GoalContinuationReactor.ts";
import { OrchestrationCommandInternalError } from "../Errors.ts";
import { GoalContinuationReactor } from "../Services/GoalContinuationReactor.ts";
import { OrchestrationEngineService } from "../Services/OrchestrationEngine.ts";
import { ProjectionSnapshotQuery } from "../Services/ProjectionSnapshotQuery.ts";

const projectId = ProjectId.makeUnsafe("project-goal-reactor");
const threadId = ThreadId.makeUnsafe("thread-goal-reactor");
const turnId = TurnId.makeUnsafe("turn-goal-reactor");
const assistantMessageId = MessageId.makeUnsafe("message-goal-reactor-assistant");
const now = "2026-06-06T00:00:00.000Z";

function makeTriggerEvent(id: string = "evt-goal-reactor-trigger"): OrchestrationEvent {
  return {
    sequence: 1,
    eventId: EventId.makeUnsafe(id),
    aggregateKind: "thread",
    aggregateId: threadId,
    type: "thread.turn-diff-completed",
    occurredAt: now,
    commandId: CommandId.makeUnsafe(`cmd-${id}`),
    causationEventId: null,
    correlationId: CorrelationId.makeUnsafe(`cmd-${id}`),
    metadata: {},
    payload: {
      threadId,
      turnId,
      checkpointTurnCount: 1,
      checkpointRef: CheckpointRef.makeUnsafe("checkpoint-goal-reactor"),
      status: "ready",
      files: [],
      assistantMessageId,
      completedAt: now,
    },
  };
}

function makeThread(overrides: Partial<OrchestrationThread> = {}): OrchestrationThread {
  return {
    id: threadId,
    projectId,
    title: "Goal Reactor Thread",
    modelSelection: {
      provider: "codex",
      model: "gpt-5-codex",
    },
    runtimeMode: "full-access",
    interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
    envMode: "local",
    branch: null,
    worktreePath: null,
    associatedWorktreePath: null,
    associatedWorktreeBranch: null,
    associatedWorktreeRef: null,
    createBranchFlowCompleted: false,
    isPinned: false,
    parentThreadId: null,
    subagentAgentId: null,
    subagentNickname: null,
    subagentRole: null,
    forkSourceThreadId: null,
    sidechatSourceThreadId: null,
    lastKnownPr: null,
    goal: {
      objective: "Finish persistent goal mode",
      status: "active",
      createdAt: now,
      updatedAt: now,
      createdByMessageId: null,
      completedAt: null,
      lastContinuationTurnId: null,
      turnCount: 0,
      blockedReason: null,
    },
    recap: {
      text: "Contracts and projection slices are done.",
      coveredMessageId: assistantMessageId,
      sourceSignature: "sig-goal-reactor",
      generatedAt: now,
    },
    latestTurn: {
      turnId,
      state: "completed",
      requestedAt: now,
      startedAt: now,
      completedAt: now,
      assistantMessageId,
      sourceProposedPlan: undefined,
    },
    latestUserMessageAt: now,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    deletedAt: null,
    handoff: null,
    messages: [
      {
        id: assistantMessageId,
        role: "assistant",
        text: "Need another continuation step.",
        attachments: [],
        turnId,
        streaming: false,
        source: "native",
        createdAt: now,
        updatedAt: now,
      },
    ],
    proposedPlans: [],
    activities: [],
    checkpoints: [],
    session: {
      threadId,
      status: "ready",
      providerName: "codex",
      runtimeMode: "full-access",
      activeTurnId: null,
      lastError: null,
      updatedAt: now,
    },
    ...overrides,
  };
}

async function createHarness(
  threadState: { current: Option.Option<OrchestrationThread> },
  options: { readonly failDispatchCount?: number } = {},
) {
  const dispatched: OrchestrationCommand[] = [];
  let remainingDispatchFailures = options.failDispatchCount ?? 0;
  const eventPubSub = await Effect.runPromise(PubSub.unbounded<OrchestrationEvent>());
  const layer = GoalContinuationReactorLive.pipe(
    Layer.provideMerge(
      Layer.succeed(OrchestrationEngineService, {
        getReadModel: () => Effect.die("unused"),
        readEvents: () => Stream.empty,
        dispatch: (command) => {
          if (remainingDispatchFailures > 0) {
            remainingDispatchFailures -= 1;
            return Effect.fail(
              new OrchestrationCommandInternalError({
                commandId: command.commandId,
                commandType: command.type,
                detail: "dispatch failed",
              }),
            );
          }
          return Effect.sync(() => {
            dispatched.push(command);
            return { sequence: dispatched.length };
          });
        },
        repairState: () => Effect.die("unused"),
        streamDomainEvents: Stream.fromPubSub(eventPubSub),
      }),
    ),
    Layer.provideMerge(
      Layer.succeed(ProjectionSnapshotQuery, {
        getSnapshot: () => Effect.die("unused"),
        getCounts: () => Effect.die("unused"),
        getShellSnapshot: () => Effect.die("unused"),
        getActiveProjectByWorkspaceRoot: () => Effect.die("unused"),
        getProjectShellById: () => Effect.die("unused"),
        getFirstActiveThreadIdByProjectId: () => Effect.die("unused"),
        getThreadCheckpointContext: () => Effect.die("unused"),
        getFullThreadDiffContext: () => Effect.die("unused"),
        getThreadShellById: () => Effect.die("unused"),
        getThreadDetailById: () => Effect.succeed(threadState.current),
        getThreadDetailSnapshotById: () => Effect.die("unused"),
      }),
    ),
  );
  const runtime = ManagedRuntime.make(layer);
  const reactor = await runtime.runPromise(Effect.service(GoalContinuationReactor));
  const scope = await Effect.runPromise(Scope.make("sequential"));
  await Effect.runPromise(reactor.start.pipe(Scope.provide(scope)));
  await Effect.runPromise(Effect.yieldNow);
  await Effect.runPromise(Effect.yieldNow);
  await Effect.runPromise(Effect.yieldNow);

  return {
    runtime,
    reactor,
    dispatched,
    publish: (event: OrchestrationEvent) =>
      Effect.runPromise(PubSub.publish(eventPubSub, event).pipe(Effect.asVoid)),
    async drain() {
      await runtime.runPromise(reactor.drain);
    },
    async dispose() {
      await Effect.runPromise(Scope.close(scope, Exit.void));
      await runtime.dispose();
    },
  };
}

describe("GoalContinuationReactor", () => {
  let harness: Awaited<ReturnType<typeof createHarness>> | null = null;

  afterEach(async () => {
    await harness?.dispose();
    harness = null;
  });

  it("does nothing when there is no active completable goal state", async () => {
    for (const thread of [
      Option.none<OrchestrationThread>(),
      Option.some(makeThread({ goal: null })),
      Option.some(makeThread({ goal: { ...makeThread().goal!, status: "paused" } })),
      Option.some(
        makeThread({
          goal: { ...makeThread().goal!, lastContinuationTurnId: turnId },
        }),
      ),
      Option.some(makeThread({ latestTurn: { ...makeThread().latestTurn!, state: "running" } })),
      Option.some(makeThread({ hasPendingApprovals: true })),
      Option.some(makeThread({ hasPendingUserInput: true })),
      Option.some(
        makeThread({
          session: {
            ...makeThread().session!,
            status: "running",
            activeTurnId: turnId,
          },
        }),
      ),
    ]) {
      harness = await createHarness({ current: thread });
      await harness.publish(makeTriggerEvent());
      await harness.drain();
      expect(harness.dispatched).toEqual([]);
      await harness.dispose();
      harness = null;
    }
  });

  it("dispatches goal completion when the latest assistant message ends with the sentinel", async () => {
    harness = await createHarness({
      current: Option.some(
        makeThread({
          messages: [
            {
              ...makeThread().messages[0]!,
              text: `All set.\n${ORCHESTRATION_GOAL_COMPLETION_SENTINEL}`,
            },
          ],
        }),
      ),
    });

    await harness.publish(makeTriggerEvent());
    await harness.drain();

    expect(harness.dispatched).toHaveLength(1);
    expect(harness.dispatched[0]).toMatchObject({
      type: "thread.goal.complete",
      threadId,
      completedAt: now,
    });
  });

  it("dispatches a goal-continuation turn when the goal can continue", async () => {
    harness = await createHarness({ current: Option.some(makeThread()) });

    await harness.publish(makeTriggerEvent());
    await harness.drain();

    expect(harness.dispatched).toHaveLength(1);
    expect(harness.dispatched[0]).toMatchObject({
      type: "thread.turn.start",
      threadId,
      message: {
        role: "user",
        attachments: [],
        source: "goal-continuation",
      },
      runtimeMode: "full-access",
      interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
    });
    if (harness.dispatched[0]?.type !== "thread.turn.start") {
      throw new Error("expected continuation turn start command");
    }
    expect(harness.dispatched[0].message.text).toContain("Finish persistent goal mode");
    expect(harness.dispatched[0].message.text).toContain("Current thread recap:");
  });

  it("does not dispatch duplicate continuations for the same completed turn", async () => {
    harness = await createHarness({ current: Option.some(makeThread()) });

    await harness.publish(makeTriggerEvent("evt-goal-reactor-trigger-1"));
    await harness.publish(makeTriggerEvent("evt-goal-reactor-trigger-2"));
    await harness.drain();

    expect(harness.dispatched).toHaveLength(1);
  });

  it("retries a completed turn when dispatch failed before marking it handled", async () => {
    harness = await createHarness({ current: Option.some(makeThread()) }, { failDispatchCount: 1 });

    await harness.publish(makeTriggerEvent("evt-goal-reactor-trigger-fails"));
    await harness.drain();
    expect(harness.dispatched).toHaveLength(0);

    await harness.publish(makeTriggerEvent("evt-goal-reactor-trigger-retries"));
    await harness.drain();

    expect(harness.dispatched).toHaveLength(1);
    expect(harness.dispatched[0]).toMatchObject({
      type: "thread.turn.start",
      threadId,
    });
  });
});
