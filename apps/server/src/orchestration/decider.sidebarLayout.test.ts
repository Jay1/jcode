import {
  CommandId,
  OrchestrationReadModel,
  ProjectId,
  SIDEBAR_LAYOUT_ID,
  ThreadId,
  type OrchestrationCommand,
} from "@jcode/contracts";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { decideOrchestrationCommand } from "./decider.ts";

const occurredAt = "2026-07-18T12:00:00.000Z";
const projectId = ProjectId.makeUnsafe;
const threadId = ThreadId.makeUnsafe;
const commandId = CommandId.makeUnsafe;

function makeReadModel(input: {
  readonly initialized?: boolean;
  readonly projectOrder?: readonly string[];
  readonly pinnedThreadOrder?: readonly string[];
}) {
  return Schema.decodeUnknownSync(OrchestrationReadModel)({
    snapshotSequence: input.initialized === true ? 20 : 4,
    sidebarLayout:
      input.initialized === true
        ? {
            projectOrder: (input.projectOrder ?? ["project-a", "project-b"]).map((id) =>
              projectId(id),
            ),
            pinnedThreadOrder: (input.pinnedThreadOrder ?? ["thread-a"]).map((id) => threadId(id)),
            revision: 20,
            updatedAt: occurredAt,
          }
        : null,
    projects: [
      {
        id: projectId("project-a"),
        kind: "project",
        title: "Project A",
        workspaceRoot: "/tmp/project-a",
        defaultModelSelection: null,
        scripts: [],
        iconMetadata: null,
        createdAt: "2026-07-18T10:00:00.000Z",
        updatedAt: occurredAt,
        deletedAt: null,
      },
      {
        id: projectId("project-b"),
        kind: "project",
        title: "Project B",
        workspaceRoot: "/tmp/project-b",
        defaultModelSelection: null,
        scripts: [],
        iconMetadata: null,
        createdAt: "2026-07-18T11:00:00.000Z",
        updatedAt: occurredAt,
        deletedAt: null,
      },
    ],
    threads: [
      {
        id: threadId("thread-a"),
        projectId: projectId("project-a"),
        title: "Thread A",
        modelSelection: { provider: "codex", model: "gpt-5" },
        runtimeMode: "approval-required",
        branch: null,
        worktreePath: null,
        isPinned: true,
        latestTurn: null,
        createdAt: "2026-07-18T10:00:00.000Z",
        updatedAt: occurredAt,
        deletedAt: null,
        messages: [],
        activities: [],
        checkpoints: [],
        session: null,
      },
      {
        id: threadId("thread-b"),
        projectId: projectId("project-b"),
        title: "Thread B",
        modelSelection: { provider: "codex", model: "gpt-5" },
        runtimeMode: "approval-required",
        branch: null,
        worktreePath: null,
        isPinned: false,
        latestTurn: null,
        createdAt: "2026-07-18T11:00:00.000Z",
        updatedAt: occurredAt,
        deletedAt: null,
        messages: [],
        activities: [],
        checkpoints: [],
        session: null,
      },
    ],
    updatedAt: occurredAt,
  });
}

async function decide(command: OrchestrationCommand, initialized = true) {
  return Effect.runPromise(
    decideOrchestrationCommand({ command, readModel: makeReadModel({ initialized }) }),
  );
}

describe("sidebar layout decider", () => {
  it("initializes canonical order once and preserves existing server pins", async () => {
    // Given
    const command: OrchestrationCommand = {
      type: "sidebar-layout.initialize",
      commandId: commandId("layout-initialize"),
      projectOrder: [projectId("project-b")],
      pinnedThreadOrder: [threadId("thread-b")],
    };

    // When
    const event = await decide(command, false);

    // Then
    expect(event).toEqual(
      expect.objectContaining({
        type: "sidebar-layout.updated",
        aggregateKind: "sidebar-layout",
        aggregateId: SIDEBAR_LAYOUT_ID,
        commandId: command.commandId,
        payload: {
          projectOrder: [projectId("project-b"), projectId("project-a")],
          pinnedThreadOrder: [threadId("thread-b"), threadId("thread-a")],
          updatedAt: expect.any(String),
        },
      }),
    );
  });

  it("emits the existing canonical order for a losing initialization", async () => {
    // Given
    const command: OrchestrationCommand = {
      type: "sidebar-layout.initialize",
      commandId: commandId("layout-initialize-losing"),
      projectOrder: [projectId("project-b")],
      pinnedThreadOrder: [threadId("thread-b")],
    };

    // When
    const event = await decide(command);

    // Then
    expect(event).toEqual(
      expect.objectContaining({
        type: "sidebar-layout.updated",
        payload: {
          projectOrder: [projectId("project-a"), projectId("project-b")],
          pinnedThreadOrder: [threadId("thread-a")],
          updatedAt: expect.any(String),
        },
      }),
    );
  });

  it.each([
    {
      name: "moves a project",
      command: {
        type: "sidebar-layout.project.move",
        commandId: commandId("layout-project-move"),
        projectId: projectId("project-b"),
        beforeProjectId: projectId("project-a"),
      } satisfies OrchestrationCommand,
      projectOrder: [projectId("project-b"), projectId("project-a")],
      pinnedThreadOrder: [threadId("thread-a")],
    },
    {
      name: "pins a thread",
      command: {
        type: "sidebar-layout.thread.pin",
        commandId: commandId("layout-thread-pin"),
        threadId: threadId("thread-b"),
        beforeThreadId: threadId("thread-a"),
      } satisfies OrchestrationCommand,
      projectOrder: [projectId("project-a"), projectId("project-b")],
      pinnedThreadOrder: [threadId("thread-b"), threadId("thread-a")],
    },
    {
      name: "unpins a thread",
      command: {
        type: "sidebar-layout.thread.unpin",
        commandId: commandId("layout-thread-unpin"),
        threadId: threadId("thread-a"),
      } satisfies OrchestrationCommand,
      projectOrder: [projectId("project-a"), projectId("project-b")],
      pinnedThreadOrder: [],
    },
    {
      name: "moves a pinned thread",
      command: {
        type: "sidebar-layout.pinned-thread.move",
        commandId: commandId("layout-pinned-thread-move"),
        threadId: threadId("thread-b"),
        beforeThreadId: threadId("thread-a"),
      } satisfies OrchestrationCommand,
      projectOrder: [projectId("project-a"), projectId("project-b")],
      pinnedThreadOrder: [threadId("thread-b"), threadId("thread-a")],
      readModel: makeReadModel({
        initialized: true,
        pinnedThreadOrder: ["thread-a", "thread-b"],
      }),
    },
  ])("$name and emits the full canonical layout", async (testCase) => {
    // Given
    const readModel = testCase.readModel ?? makeReadModel({ initialized: true });

    // When
    const event = await Effect.runPromise(
      decideOrchestrationCommand({ command: testCase.command, readModel }),
    );

    // Then
    expect(event).toEqual(
      expect.objectContaining({
        type: "sidebar-layout.updated",
        payload: {
          projectOrder: testCase.projectOrder,
          pinnedThreadOrder: testCase.pinnedThreadOrder,
          updatedAt: expect.any(String),
        },
      }),
    );
  });
});
