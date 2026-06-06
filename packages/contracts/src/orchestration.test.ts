import assert from "node:assert/strict";
import { it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import {
  ClientOrchestrationCommand,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  DEFAULT_RUNTIME_MODE,
  ModelSelection,
  OrchestrationCommand,
  OrchestrationEvent,
  OrchestrationGoal,
  OrchestrationGetTurnDiffInput,
  OrchestrationLatestTurn,
  OrchestrationMessage,
  OrchestrationReadModel,
  ProviderKind,
  ProjectIconMetadata,
  ProjectCreatedPayload,
  ProjectMetaUpdatedPayload,
  OrchestrationProposedPlan,
  OrchestrationSession,
  ProjectCreateCommand,
  ThreadMetaUpdatedPayload,
  ThreadTurnStartCommand,
  ThreadCreatedPayload,
  ThreadTurnDiff,
  ThreadTurnStartRequestedPayload,
} from "./orchestration";

const decodeTurnDiffInput = Schema.decodeUnknownEffect(OrchestrationGetTurnDiffInput);
const decodeThreadTurnDiff = Schema.decodeUnknownEffect(ThreadTurnDiff);
const decodeProjectCreateCommand = Schema.decodeUnknownEffect(ProjectCreateCommand);
const decodeProjectIconMetadata = Schema.decodeUnknownEffect(ProjectIconMetadata);
const decodeProjectCreatedPayload = Schema.decodeUnknownEffect(ProjectCreatedPayload);
const decodeProjectMetaUpdatedPayload = Schema.decodeUnknownEffect(ProjectMetaUpdatedPayload);
const decodeThreadTurnStartCommand = Schema.decodeUnknownEffect(ThreadTurnStartCommand);
const decodeThreadTurnStartRequestedPayload = Schema.decodeUnknownEffect(
  ThreadTurnStartRequestedPayload,
);
const decodeOrchestrationLatestTurn = Schema.decodeUnknownEffect(OrchestrationLatestTurn);
const decodeOrchestrationProposedPlan = Schema.decodeUnknownEffect(OrchestrationProposedPlan);
const decodeOrchestrationSession = Schema.decodeUnknownEffect(OrchestrationSession);
const decodeOrchestrationGoal = Schema.decodeUnknownEffect(OrchestrationGoal);
const decodeOrchestrationMessage = Schema.decodeUnknownEffect(OrchestrationMessage);
const decodeThreadCreatedPayload = Schema.decodeUnknownEffect(ThreadCreatedPayload);
const decodeThreadMetaUpdatedPayload = Schema.decodeUnknownEffect(ThreadMetaUpdatedPayload);
const decodeProviderKind = Schema.decodeUnknownEffect(ProviderKind);
const decodeModelSelection = Schema.decodeUnknownEffect(ModelSelection);
const decodeClientOrchestrationCommand = Schema.decodeUnknownEffect(ClientOrchestrationCommand);
const decodeOrchestrationCommand = Schema.decodeUnknownEffect(OrchestrationCommand);
const decodeOrchestrationEvent = Schema.decodeUnknownEffect(OrchestrationEvent);

it.effect("accepts OpenClaw as a provider kind", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeProviderKind("openclaw");

    assert.equal(parsed, "openclaw");
  }),
);

it.effect("accepts the OpenClaw gateway model-selection sentinel", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeModelSelection({ provider: "openclaw", model: "gateway" });

    assert.equal(parsed.provider, "openclaw");
    assert.equal(parsed.model, "gateway");
it.effect("decodes persistent thread goal state", () =>
  Effect.gen(function* () {
    const goal = yield* decodeOrchestrationGoal({
      objective: "Ship durable thread goals",
      status: "active",
      createdAt: "2026-06-06T00:00:00.000Z",
      updatedAt: "2026-06-06T00:00:00.000Z",
      createdByMessageId: null,
      completedAt: null,
      lastContinuationTurnId: null,
      turnCount: 0,
      blockedReason: null,
    });

    assert.strictEqual(goal.objective, "Ship durable thread goals");
    assert.strictEqual(goal.status, "active");
  }),
);

it.effect("accepts goal-continuation user messages", () =>
  Effect.gen(function* () {
    const message = yield* decodeOrchestrationMessage({
      id: "goal-continuation:message-1",
      role: "user",
      text: "Continue toward the active goal.",
      turnId: null,
      streaming: false,
      source: "goal-continuation",
      createdAt: "2026-06-06T00:00:00.000Z",
      updatedAt: "2026-06-06T00:00:00.000Z",
    });

    assert.strictEqual(message.source, "goal-continuation");
  }),
);

it.effect("decodes goal lifecycle commands and events", () =>
  Effect.gen(function* () {
    const cases = [
      {
        command: {
          type: "thread.goal.set",
          commandId: "command-goal-set",
          threadId: "thread-1",
          objective: "Finish the release checklist",
          createdByMessageId: null,
          createdAt: "2026-06-06T00:00:00.000Z",
        },
        eventType: "thread.goal-set",
        payload: {
          threadId: "thread-1",
          objective: "Finish the release checklist",
          createdByMessageId: null,
          createdAt: "2026-06-06T00:00:00.000Z",
          updatedAt: "2026-06-06T00:00:00.000Z",
        },
      },
      {
        command: {
          type: "thread.goal.pause",
          commandId: "command-goal-pause",
          threadId: "thread-1",
          reason: "Waiting for user approval",
          createdAt: "2026-06-06T00:01:00.000Z",
        },
        eventType: "thread.goal-paused",
        payload: {
          threadId: "thread-1",
          reason: "Waiting for user approval",
          updatedAt: "2026-06-06T00:01:00.000Z",
        },
      },
      {
        command: {
          type: "thread.goal.resume",
          commandId: "command-goal-resume",
          threadId: "thread-1",
          createdAt: "2026-06-06T00:02:00.000Z",
        },
        eventType: "thread.goal-resumed",
        payload: {
          threadId: "thread-1",
          updatedAt: "2026-06-06T00:02:00.000Z",
        },
      },
      {
        command: {
          type: "thread.goal.complete",
          commandId: "command-goal-complete",
          threadId: "thread-1",
          completedAt: "2026-06-06T00:03:00.000Z",
          createdAt: "2026-06-06T00:03:00.000Z",
        },
        eventType: "thread.goal-completed",
        payload: {
          threadId: "thread-1",
          completedAt: "2026-06-06T00:03:00.000Z",
          updatedAt: "2026-06-06T00:03:00.000Z",
        },
      },
      {
        command: {
          type: "thread.goal.clear",
          commandId: "command-goal-clear",
          threadId: "thread-1",
          createdAt: "2026-06-06T00:04:00.000Z",
        },
        eventType: "thread.goal-cleared",
        payload: {
          threadId: "thread-1",
          updatedAt: "2026-06-06T00:04:00.000Z",
        },
      },
    ] as const;

    for (const [index, testCase] of cases.entries()) {
      const command = yield* decodeOrchestrationCommand(testCase.command);
      const event = yield* decodeOrchestrationEvent({
        sequence: index + 1,
        eventId: `event-goal-${index}`,
        aggregateKind: "thread",
        aggregateId: "thread-1",
        type: testCase.eventType,
        payload: testCase.payload,
        occurredAt: "2026-06-06T00:00:00.000Z",
        commandId: testCase.command.commandId,
        causationEventId: null,
        correlationId: testCase.command.commandId,
        metadata: {},
      });

      assert.strictEqual(command.type, testCase.command.type);
      assert.strictEqual(event.type, testCase.eventType);
    }
  }),
);

it.effect("preserves thread activity payloads through the RPC JSON codec", () =>
  Effect.gen(function* () {
    const codec = Schema.toCodecJson(OrchestrationReadModel);
    const readModel = {
      snapshotSequence: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      projects: [],
      threads: [
        {
          id: "thread-1",
          codexThreadId: null,
          projectId: "project-1",
          title: "Thread 1",
          modelSelection: {
            provider: "codex",
            model: "gpt-5.5",
          },
          interactionMode: "default",
          runtimeMode: "full-access",
          envMode: "local",
          branch: null,
          worktreePath: null,
          associatedWorktreePath: null,
          associatedWorktreeBranch: null,
          associatedWorktreeRef: null,
          createBranchFlowCompleted: false,
          parentThreadId: null,
          subagentAgentId: null,
          subagentNickname: null,
          subagentRole: null,
          forkSourceThreadId: null,
          sidechatSourceThreadId: null,
          lastKnownPr: null,
          handoff: null,
          latestTurn: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          archivedAt: null,
          deletedAt: null,
          messages: [],
          proposedPlans: [],
          activities: [
            {
              id: "activity-1",
              tone: "tool",
              kind: "tool.completed",
              summary: "Ran command",
              payload: {
                itemType: "command_execution",
                data: {
                  item: {
                    command: "git status --short",
                  },
                },
              },
              turnId: null,
              sequence: 1,
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          checkpoints: [],
          session: null,
        },
      ],
    };

    const encoded = yield* Schema.encodeUnknownEffect(codec)(readModel);
    const decoded = yield* Schema.decodeUnknownEffect(codec)(encoded);
    const activity = decoded.threads[0]?.activities[0];

    assert.deepStrictEqual(activity?.payload, {
      itemType: "command_execution",
      data: {
        item: {
          command: "git status --short",
        },
      },
    });
  }),
);

it.effect("preserves Pi model selections when decoding model selections", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeModelSelection({
      provider: "pi",
      model: "openai/gpt-5.5",
    });

    assert.deepStrictEqual(parsed, {
      provider: "pi",
      model: "openai/gpt-5.5",
    });
  }),
);

it.effect("preserves Pi model selections through the JSON codec", () =>
  Effect.gen(function* () {
    const codec = Schema.fromJsonString(ModelSelection);
    const encoded = yield* Schema.encodeEffect(codec)({
      provider: "pi",
      model: "openai/gpt-5.5",
    });
    const parsed = yield* Schema.decodeUnknownEffect(codec)(encoded);

    assert.deepStrictEqual(parsed, {
      provider: "pi",
      model: "openai/gpt-5.5",
    });
  }),
);

it.effect("parses turn diff input when fromTurnCount <= toTurnCount", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeTurnDiffInput({
      threadId: "thread-1",
      fromTurnCount: 1,
      toTurnCount: 2,
    });
    assert.strictEqual(parsed.fromTurnCount, 1);
    assert.strictEqual(parsed.toTurnCount, 2);
  }),
);

it.effect("rejects turn diff input when fromTurnCount > toTurnCount", () =>
  Effect.gen(function* () {
    const result = yield* Effect.exit(
      decodeTurnDiffInput({
        threadId: "thread-1",
        fromTurnCount: 3,
        toTurnCount: 2,
      }),
    );
    assert.strictEqual(result._tag, "Failure");
  }),
);

it.effect("rejects thread turn diff when fromTurnCount > toTurnCount", () =>
  Effect.gen(function* () {
    const result = yield* Effect.exit(
      decodeThreadTurnDiff({
        threadId: "thread-1",
        fromTurnCount: 3,
        toTurnCount: 2,
        diff: "patch",
      }),
    );
    assert.strictEqual(result._tag, "Failure");
  }),
);

it.effect("keeps generic conversation rollback internal-only", () =>
  Effect.gen(function* () {
    const rollbackCommand = {
      type: "thread.conversation.rollback",
      commandId: "cmd-rollback",
      threadId: "thread-1",
      messageId: "message-1",
      numTurns: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const clientResult = yield* Effect.exit(decodeClientOrchestrationCommand(rollbackCommand));
    assert.strictEqual(clientResult._tag, "Failure");

    const parsedInternal = yield* decodeOrchestrationCommand(rollbackCommand);
    assert.strictEqual(parsedInternal.type, "thread.conversation.rollback");
  }),
);

it.effect("trims branded ids and command string fields at decode boundaries", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeProjectCreateCommand({
      type: "project.create",
      commandId: " cmd-1 ",
      projectId: " project-1 ",
      title: " Project Title ",
      workspaceRoot: " /tmp/workspace ",
      defaultModelSelection: {
        provider: "codex",
        model: " gpt-5.2 ",
      },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    assert.strictEqual(parsed.commandId, "cmd-1");
    assert.strictEqual(parsed.projectId, "project-1");
    assert.strictEqual(parsed.title, "Project Title");
    assert.strictEqual(parsed.workspaceRoot, "/tmp/workspace");
    assert.deepStrictEqual(parsed.defaultModelSelection, {
      provider: "codex",
      model: "gpt-5.2",
    });
  }),
);

it.effect("decodes project icon metadata", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeProjectIconMetadata({
      iconId: "typescript",
      label: "TypeScript",
    });

    assert.deepStrictEqual(parsed, {
      iconId: "typescript",
      label: "TypeScript",
    });
  }),
);

it.effect("decodes historical project.created payloads with a default provider", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeProjectCreatedPayload({
      projectId: "project-1",
      title: "Project Title",
      workspaceRoot: "/tmp/workspace",
      defaultModelSelection: {
        provider: "codex",
        model: "gpt-5.4",
      },
      scripts: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.strictEqual(parsed.defaultModelSelection?.provider, "codex");
    assert.strictEqual(parsed.iconMetadata, null);
  }),
);

it.effect("decodes project.created payloads with icon metadata", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeProjectCreatedPayload({
      projectId: "project-1",
      kind: "project",
      title: "Project Title",
      workspaceRoot: "/tmp/workspace",
      defaultModelSelection: null,
      scripts: [],
      iconMetadata: {
        iconId: "vue",
        label: "Vue",
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    assert.deepStrictEqual(parsed.iconMetadata, {
      iconId: "vue",
      label: "Vue",
    });
  }),
);

it.effect("decodes project.meta-updated payloads with explicit default provider", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeProjectMetaUpdatedPayload({
      projectId: "project-1",
      defaultModelSelection: {
        provider: "claudeAgent",
        model: "claude-opus-4-6",
      },
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.strictEqual(parsed.defaultModelSelection?.provider, "claudeAgent");
  }),
);

it.effect("decodes project.meta-updated payloads with icon metadata", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeProjectMetaUpdatedPayload({
      projectId: "project-1",
      iconMetadata: {
        iconId: "typescript",
        label: "TypeScript",
      },
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    assert.deepStrictEqual(parsed.iconMetadata, {
      iconId: "typescript",
      label: "TypeScript",
    });
  }),
);

it.effect("rejects command fields that become empty after trim", () =>
  Effect.gen(function* () {
    const result = yield* Effect.exit(
      decodeProjectCreateCommand({
        type: "project.create",
        commandId: "cmd-1",
        projectId: "project-1",
        title: "  ",
        workspaceRoot: "/tmp/workspace",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    assert.strictEqual(result._tag, "Failure");
  }),
);

it.effect("decodes thread.turn.start defaults for provider, runtime mode, and dispatch mode", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeThreadTurnStartCommand({
      type: "thread.turn.start",
      commandId: "cmd-turn-1",
      threadId: "thread-1",
      message: {
        messageId: "msg-1",
        role: "user",
        text: "hello",
        attachments: [],
      },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    assert.strictEqual(parsed.modelSelection, undefined);
    assert.strictEqual(parsed.runtimeMode, DEFAULT_RUNTIME_MODE);
    assert.strictEqual(parsed.interactionMode, DEFAULT_PROVIDER_INTERACTION_MODE);
    assert.strictEqual(parsed.dispatchMode, "queue");
  }),
);

it.effect("preserves explicit provider and runtime mode in thread.turn.start", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeThreadTurnStartCommand({
      type: "thread.turn.start",
      commandId: "cmd-turn-2",
      threadId: "thread-1",
      message: {
        messageId: "msg-2",
        role: "user",
        text: "hello",
        attachments: [],
      },
      modelSelection: {
        provider: "codex",
        model: "gpt-5.4",
      },
      runtimeMode: "full-access",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    assert.strictEqual(parsed.modelSelection?.provider, "codex");
    assert.strictEqual(parsed.runtimeMode, "full-access");
    assert.strictEqual(parsed.interactionMode, DEFAULT_PROVIDER_INTERACTION_MODE);
  }),
);

it.effect("decodes thread.created runtime mode for historical events", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeThreadCreatedPayload({
      threadId: "thread-1",
      projectId: "project-1",
      title: "Thread title",
      modelSelection: {
        provider: "codex",
        model: "gpt-5.4",
      },
      interactionMode: "default",
      branch: null,
      worktreePath: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    assert.strictEqual(parsed.runtimeMode, DEFAULT_RUNTIME_MODE);
    assert.strictEqual(parsed.modelSelection.provider, "codex");
  }),
);

it.effect("decodes thread archive and unarchive commands", () =>
  Effect.gen(function* () {
    const archive = yield* decodeOrchestrationCommand({
      type: "thread.archive",
      commandId: "cmd-archive-1",
      threadId: "thread-1",
    });
    const unarchive = yield* decodeOrchestrationCommand({
      type: "thread.unarchive",
      commandId: "cmd-unarchive-1",
      threadId: "thread-1",
    });

    assert.strictEqual(archive.type, "thread.archive");
    assert.strictEqual(unarchive.type, "thread.unarchive");
  }),
);

it.effect("decodes thread archived and unarchived events", () =>
  Effect.gen(function* () {
    const archived = yield* decodeOrchestrationEvent({
      sequence: 1,
      eventId: "event-archive-1",
      aggregateKind: "thread",
      aggregateId: "thread-1",
      type: "thread.archived",
      occurredAt: "2026-01-01T00:00:00.000Z",
      commandId: "cmd-archive-1",
      causationEventId: null,
      correlationId: "cmd-archive-1",
      metadata: {},
      payload: {
        threadId: "thread-1",
        archivedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const unarchived = yield* decodeOrchestrationEvent({
      sequence: 2,
      eventId: "event-unarchive-1",
      aggregateKind: "thread",
      aggregateId: "thread-1",
      type: "thread.unarchived",
      occurredAt: "2026-01-02T00:00:00.000Z",
      commandId: "cmd-unarchive-1",
      causationEventId: null,
      correlationId: "cmd-unarchive-1",
      metadata: {},
      payload: {
        threadId: "thread-1",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });

    assert.strictEqual(archived.type, "thread.archived");
    assert.strictEqual(archived.payload.archivedAt, "2026-01-01T00:00:00.000Z");
    assert.strictEqual(unarchived.type, "thread.unarchived");
    assert.strictEqual(unarchived.payload.updatedAt, "2026-01-02T00:00:00.000Z");
  }),
);

it.effect("decodes thread.meta-updated payloads with explicit provider", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeThreadMetaUpdatedPayload({
      threadId: "thread-1",
      modelSelection: {
        provider: "claudeAgent",
        model: "claude-opus-4-6",
      },
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.strictEqual(parsed.modelSelection?.provider, "claudeAgent");
  }),
);

it.effect("accepts provider-scoped model options in thread.turn.start", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeThreadTurnStartCommand({
      type: "thread.turn.start",
      commandId: "cmd-turn-options",
      threadId: "thread-1",
      message: {
        messageId: "msg-options",
        role: "user",
        text: "hello",
        attachments: [],
      },
      modelSelection: {
        provider: "codex",
        model: "gpt-5.3-codex",
        options: {
          reasoningEffort: "high",
          fastMode: true,
        },
      },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    assert.strictEqual(parsed.modelSelection?.provider, "codex");
    assert.strictEqual(parsed.modelSelection?.options?.reasoningEffort, "high");
    assert.strictEqual(parsed.modelSelection?.options?.fastMode, true);
  }),
);

it.effect("accepts a source proposed plan reference in thread.turn.start", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeThreadTurnStartCommand({
      type: "thread.turn.start",
      commandId: "cmd-turn-source-plan",
      threadId: "thread-2",
      message: {
        messageId: "msg-source-plan",
        role: "user",
        text: "implement this",
        attachments: [],
      },
      sourceProposedPlan: {
        threadId: "thread-1",
        planId: "plan-1",
      },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    assert.deepStrictEqual(parsed.sourceProposedPlan, {
      threadId: "thread-1",
      planId: "plan-1",
    });
  }),
);

it.effect(
  "decodes thread.turn-start-requested defaults for provider, runtime mode, and interaction mode",
  () =>
    Effect.gen(function* () {
      const parsed = yield* decodeThreadTurnStartRequestedPayload({
        threadId: "thread-1",
        messageId: "msg-1",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      assert.strictEqual(parsed.modelSelection, undefined);
      assert.strictEqual(parsed.runtimeMode, DEFAULT_RUNTIME_MODE);
      assert.strictEqual(parsed.interactionMode, DEFAULT_PROVIDER_INTERACTION_MODE);
      assert.strictEqual(parsed.dispatchMode, "queue");
      assert.strictEqual(parsed.sourceProposedPlan, undefined);
    }),
);

it.effect("decodes thread.turn-start-requested source proposed plan metadata when present", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeThreadTurnStartRequestedPayload({
      threadId: "thread-2",
      messageId: "msg-2",
      sourceProposedPlan: {
        threadId: "thread-1",
        planId: "plan-1",
      },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    assert.deepStrictEqual(parsed.sourceProposedPlan, {
      threadId: "thread-1",
      planId: "plan-1",
    });
  }),
);

it.effect("decodes latest turn source proposed plan metadata when present", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeOrchestrationLatestTurn({
      turnId: "turn-2",
      state: "running",
      requestedAt: "2026-01-01T00:00:00.000Z",
      startedAt: "2026-01-01T00:00:01.000Z",
      completedAt: null,
      assistantMessageId: null,
      sourceProposedPlan: {
        threadId: "thread-1",
        planId: "plan-1",
      },
    });
    assert.deepStrictEqual(parsed.sourceProposedPlan, {
      threadId: "thread-1",
      planId: "plan-1",
    });
  }),
);

it.effect("decodes orchestration session runtime mode defaults", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeOrchestrationSession({
      threadId: "thread-1",
      status: "idle",
      providerName: null,
      providerSessionId: null,
      providerThreadId: null,
      activeTurnId: null,
      lastError: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.strictEqual(parsed.runtimeMode, DEFAULT_RUNTIME_MODE);
  }),
);

it.effect("defaults proposed plan implementation metadata for historical rows", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeOrchestrationProposedPlan({
      id: "plan-1",
      turnId: "turn-1",
      planMarkdown: "# Plan",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.strictEqual(parsed.implementedAt, null);
    assert.strictEqual(parsed.implementationThreadId, null);
  }),
);

it.effect("preserves proposed plan implementation metadata when present", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeOrchestrationProposedPlan({
      id: "plan-2",
      turnId: "turn-2",
      planMarkdown: "# Plan",
      implementedAt: "2026-01-02T00:00:00.000Z",
      implementationThreadId: "thread-2",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    assert.strictEqual(parsed.implementedAt, "2026-01-02T00:00:00.000Z");
    assert.strictEqual(parsed.implementationThreadId, "thread-2");
  }),
);

it.effect("preserves user-input answer values through the RPC JSON codec", () =>
  Effect.gen(function* () {
    const codec = Schema.toCodecJson(ClientOrchestrationCommand);
    const wire = {
      type: "thread.user-input.respond",
      commandId: "cmd-1",
      threadId: "thread-1",
      requestId: "req-1",
      answers: {
        single: "Purple",
        multi: ["Reading", "Coding"],
        skipped: null,
      },
      createdAt: "2026-05-19T16:14:28.202Z",
    };
    const decoded = yield* Schema.decodeUnknownEffect(codec)(wire);
    assert.deepStrictEqual(
      (decoded as Extract<typeof decoded, { type: "thread.user-input.respond" }>).answers,
      {
        single: "Purple",
        multi: ["Reading", "Coding"],
        skipped: null,
      },
    );
  }),
);
