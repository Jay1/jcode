import {
  CommandId,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  EventId,
  MessageId,
  ProjectId,
  ThreadId,
} from "@jcode/contracts";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { decideOrchestrationCommand } from "./decider.ts";
import { createEmptyReadModel, projectEvent } from "./projector.ts";

const PROJECT_ID = ProjectId.makeUnsafe("project-goal");
const THREAD_ID = ThreadId.makeUnsafe("thread-goal");
const MESSAGE_ID = MessageId.makeUnsafe("message-goal-create");

const asCommandId = (value: string) => CommandId.makeUnsafe(value);
const asEventId = (value: string) => EventId.makeUnsafe(value);

async function createThreadReadModel(now: string) {
  const withProject = await Effect.runPromise(
    projectEvent(createEmptyReadModel(now), {
      sequence: 1,
      eventId: asEventId("evt-project-goal"),
      aggregateKind: "project",
      aggregateId: PROJECT_ID,
      type: "project.created",
      occurredAt: now,
      commandId: asCommandId("cmd-project-goal"),
      causationEventId: null,
      correlationId: asCommandId("cmd-project-goal"),
      metadata: {},
      payload: {
        projectId: PROJECT_ID,
        title: "Goal Project",
        workspaceRoot: "/tmp/goal-project",
        defaultModelSelection: null,
        scripts: [],
        createdAt: now,
        updatedAt: now,
      },
    }),
  );

  return Effect.runPromise(
    projectEvent(withProject, {
      sequence: 2,
      eventId: asEventId("evt-thread-goal"),
      aggregateKind: "thread",
      aggregateId: THREAD_ID,
      type: "thread.created",
      occurredAt: now,
      commandId: asCommandId("cmd-thread-goal"),
      causationEventId: null,
      correlationId: asCommandId("cmd-thread-goal"),
      metadata: {},
      payload: {
        threadId: THREAD_ID,
        projectId: PROJECT_ID,
        title: "Goal Thread",
        modelSelection: {
          provider: "codex",
          model: "gpt-5.5",
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
        handoff: null,
        createdAt: now,
        updatedAt: now,
      },
    }),
  );
}

describe("decider goal lifecycle", () => {
  it("emits goal lifecycle events from goal commands", async () => {
    const now = "2026-06-06T00:00:00.000Z";
    const readModel = await createThreadReadModel(now);
    const cases = [
      {
        command: {
          type: "thread.goal.set",
          commandId: asCommandId("cmd-goal-set"),
          threadId: THREAD_ID,
          objective: "Ship persistent goal mode",
          createdByMessageId: MESSAGE_ID,
          createdAt: now,
        },
        type: "thread.goal-set",
        payload: {
          threadId: THREAD_ID,
          objective: "Ship persistent goal mode",
          createdByMessageId: MESSAGE_ID,
          createdAt: now,
          updatedAt: now,
        },
      },
      {
        command: {
          type: "thread.goal.pause",
          commandId: asCommandId("cmd-goal-pause"),
          threadId: THREAD_ID,
          reason: "Waiting for approval",
          createdAt: now,
        },
        type: "thread.goal-paused",
        payload: {
          threadId: THREAD_ID,
          reason: "Waiting for approval",
          updatedAt: now,
        },
      },
      {
        command: {
          type: "thread.goal.resume",
          commandId: asCommandId("cmd-goal-resume"),
          threadId: THREAD_ID,
          createdAt: now,
        },
        type: "thread.goal-resumed",
        payload: {
          threadId: THREAD_ID,
          updatedAt: now,
        },
      },
      {
        command: {
          type: "thread.goal.complete",
          commandId: asCommandId("cmd-goal-complete"),
          threadId: THREAD_ID,
          completedAt: now,
          createdAt: now,
        },
        type: "thread.goal-completed",
        payload: {
          threadId: THREAD_ID,
          completedAt: now,
          updatedAt: now,
        },
      },
      {
        command: {
          type: "thread.goal.clear",
          commandId: asCommandId("cmd-goal-clear"),
          threadId: THREAD_ID,
          createdAt: now,
        },
        type: "thread.goal-cleared",
        payload: {
          threadId: THREAD_ID,
          updatedAt: now,
        },
      },
    ] as const;

    for (const testCase of cases) {
      const result = await Effect.runPromise(
        decideOrchestrationCommand({
          command: testCase.command,
          readModel,
        }),
      );
      const event = Array.isArray(result) ? result[0] : result;

      expect(event.type).toBe(testCase.type);
      expect(event.payload).toEqual(testCase.payload);
      expect(event.aggregateKind).toBe("thread");
      expect(event.aggregateId).toBe(THREAD_ID);
      expect(event.commandId).toBe(testCase.command.commandId);
    }
  });
});
