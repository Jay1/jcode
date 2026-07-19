import { MessageId, ProjectId, ThreadId } from "@jcode/contracts";
import { assert, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { SqlitePersistenceMemory } from "./Sqlite.ts";
import { ProjectionProjectRepositoryLive } from "./ProjectionProjects.ts";
import { ProjectionThreadRepositoryLive } from "./ProjectionThreads.ts";
import { ProjectionProjectRepository } from "../Services/ProjectionProjects.ts";
import {
  ProjectionThreadRepository,
  type ProjectionThread,
} from "../Services/ProjectionThreads.ts";

const makePinnedThread = (
  threadId: ThreadId,
  deletedAt: ProjectionThread["deletedAt"] = null,
): ProjectionThread => ({
  threadId,
  projectId: ProjectId.makeUnsafe("project-pinned-membership"),
  title: `Pinned membership ${threadId}`,
  modelSelection: { provider: "codex", model: "gpt-5-codex" },
  runtimeMode: "full-access",
  interactionMode: "default",
  envMode: "local",
  branch: null,
  worktreePath: null,
  associatedWorktreePath: null,
  associatedWorktreeBranch: null,
  associatedWorktreeRef: null,
  createBranchFlowCompleted: false,
  isPinned: true,
  lastKnownPr: null,
  latestTurnId: null,
  handoff: null,
  latestUserMessageAt: null,
  pendingApprovalCount: 0,
  pendingUserInputCount: 0,
  hasActionableProposedPlan: 0,
  createdAt: "2026-07-18T00:00:00.000Z",
  updatedAt: "2026-07-18T00:00:00.000Z",
  deletedAt,
});

const projectionRepositoriesLayer = it.layer(
  Layer.mergeAll(
    ProjectionProjectRepositoryLive.pipe(Layer.provideMerge(SqlitePersistenceMemory)),
    ProjectionThreadRepositoryLive.pipe(Layer.provideMerge(SqlitePersistenceMemory)),
    SqlitePersistenceMemory,
  ),
);

projectionRepositoriesLayer("Projection repositories", (it) => {
  it.effect("preserves migration 036 pinned defaults through repository round-trips", () =>
    Effect.gen(function* () {
      // Given: migration 036 is applied and a thread omits the optional pinned field.
      const threads = yield* ProjectionThreadRepository;
      const sql = yield* SqlClient.SqlClient;
      const threadId = ThreadId.makeUnsafe("thread-pinned-default");

      // When: the thread is stored through the existing repository.
      yield* threads.upsert({
        threadId,
        projectId: ProjectId.makeUnsafe("project-pinned-default"),
        title: "Pinned default thread",
        modelSelection: { provider: "codex", model: "gpt-5-codex" },
        runtimeMode: "full-access",
        interactionMode: "default",
        envMode: "local",
        branch: null,
        worktreePath: null,
        associatedWorktreePath: null,
        associatedWorktreeBranch: null,
        associatedWorktreeRef: null,
        createBranchFlowCompleted: false,
        lastKnownPr: null,
        latestTurnId: null,
        handoff: null,
        latestUserMessageAt: null,
        pendingApprovalCount: 0,
        pendingUserInputCount: 0,
        hasActionableProposedPlan: 0,
        createdAt: "2026-07-18T00:00:00.000Z",
        updatedAt: "2026-07-18T00:00:00.000Z",
        deletedAt: null,
      });

      // Then: the schema default and decoded repository value remain false/zero.
      const columns = yield* sql<{ readonly dfltValue: string | null }>`
        SELECT dflt_value AS "dfltValue"
        FROM pragma_table_info('projection_threads')
        WHERE name = 'is_pinned'
      `;
      const stored = yield* sql<{ readonly isPinned: number }>`
        SELECT is_pinned AS "isPinned"
        FROM projection_threads
        WHERE thread_id = ${threadId}
      `;
      const persisted = yield* threads.getById({ threadId });

      assert.strictEqual(columns[0]?.dfltValue, "0");
      assert.strictEqual(stored[0]?.isPinned, 0);
      assert.strictEqual(Option.getOrNull(persisted)?.isPinned, false);
    }),
  );

  it.effect("replaces stale pin flags with exactly the live canonical membership", () =>
    Effect.gen(function* () {
      // Given: three stale pinned flags, including a deleted thread.
      const threads = yield* ProjectionThreadRepository;
      const sql = yield* SqlClient.SqlClient;
      const staleId = ThreadId.makeUnsafe("thread-pin-stale");
      const liveId = ThreadId.makeUnsafe("thread-pin-live");
      const deletedId = ThreadId.makeUnsafe("thread-pin-deleted");
      yield* threads.upsert(makePinnedThread(staleId));
      yield* threads.upsert(makePinnedThread(liveId));
      yield* threads.upsert(makePinnedThread(deletedId, "2026-07-18T00:01:00.000Z"));

      // When: canonical membership contains one live and one deleted thread.
      yield* threads.replacePinnedMembership({ threadIds: [liveId, deletedId] });

      // Then: only the live member remains pinned and every stale flag is cleared.
      const rows = yield* sql<{ readonly threadId: string; readonly isPinned: number }>`
        SELECT thread_id AS "threadId", is_pinned AS "isPinned"
        FROM projection_threads
        WHERE thread_id IN (${staleId}, ${liveId}, ${deletedId})
        ORDER BY thread_id
      `;
      assert.deepStrictEqual(rows, [
        { threadId: "thread-pin-deleted", isPinned: 0 },
        { threadId: "thread-pin-live", isPinned: 1 },
        { threadId: "thread-pin-stale", isPinned: 0 },
      ]);
    }),
  );

  it.effect("clears every pin flag when canonical membership is empty", () =>
    Effect.gen(function* () {
      // Given: two live threads have stale pinned flags.
      const threads = yield* ProjectionThreadRepository;
      const sql = yield* SqlClient.SqlClient;
      const firstId = ThreadId.makeUnsafe("thread-pin-empty-a");
      const secondId = ThreadId.makeUnsafe("thread-pin-empty-b");
      yield* threads.upsert(makePinnedThread(firstId));
      yield* threads.upsert(makePinnedThread(secondId));

      // When: canonical membership is empty.
      yield* threads.replacePinnedMembership({ threadIds: [] });

      // Then: no projected thread remains pinned.
      const rows = yield* sql<{ readonly pinnedCount: number }>`
        SELECT COUNT(*) AS "pinnedCount"
        FROM projection_threads
        WHERE is_pinned <> 0
      `;
      assert.strictEqual(rows[0]?.pinnedCount, 0);
    }),
  );

  it.effect("stores SQL NULL for missing project model options", () =>
    Effect.gen(function* () {
      const projects = yield* ProjectionProjectRepository;
      const sql = yield* SqlClient.SqlClient;

      yield* projects.upsert({
        projectId: ProjectId.makeUnsafe("project-null-options"),
        kind: "project",
        title: "Null options project",
        workspaceRoot: "/tmp/project-null-options",
        defaultModelSelection: {
          provider: "codex",
          model: "gpt-5.4",
        },
        scripts: [],
        createdAt: "2026-03-24T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
        deletedAt: null,
      });

      const rows = yield* sql<{
        readonly defaultModelSelection: string | null;
      }>`
        SELECT default_model_selection_json AS "defaultModelSelection"
        FROM projection_projects
        WHERE project_id = 'project-null-options'
      `;
      const row = rows[0];
      if (!row) {
        return yield* Effect.fail(new Error("Expected projection_projects row to exist."));
      }

      assert.strictEqual(
        row.defaultModelSelection,
        JSON.stringify({
          provider: "codex",
          model: "gpt-5.4",
        }),
      );

      const persisted = yield* projects.getById({
        projectId: ProjectId.makeUnsafe("project-null-options"),
      });
      assert.deepStrictEqual(Option.getOrNull(persisted)?.defaultModelSelection, {
        provider: "codex",
        model: "gpt-5.4",
      });
    }),
  );

  it.effect("stores JSON for thread model options", () =>
    Effect.gen(function* () {
      const threads = yield* ProjectionThreadRepository;
      const sql = yield* SqlClient.SqlClient;

      yield* threads.upsert({
        threadId: ThreadId.makeUnsafe("thread-null-options"),
        projectId: ProjectId.makeUnsafe("project-null-options"),
        title: "Null options thread",
        modelSelection: {
          provider: "claudeAgent",
          model: "claude-opus-4-6",
        },
        runtimeMode: "full-access",
        interactionMode: "default",
        envMode: "local",
        branch: null,
        worktreePath: null,
        associatedWorktreePath: null,
        associatedWorktreeBranch: null,
        associatedWorktreeRef: null,
        createBranchFlowCompleted: false,
        lastKnownPr: null,
        latestTurnId: null,
        handoff: null,
        latestUserMessageAt: null,
        pendingApprovalCount: 0,
        pendingUserInputCount: 0,
        hasActionableProposedPlan: 0,
        createdAt: "2026-03-24T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
        deletedAt: null,
      });

      const rows = yield* sql<{
        readonly modelSelection: string | null;
      }>`
        SELECT model_selection_json AS "modelSelection"
        FROM projection_threads
        WHERE thread_id = 'thread-null-options'
      `;
      const row = rows[0];
      if (!row) {
        return yield* Effect.fail(new Error("Expected projection_threads row to exist."));
      }

      assert.strictEqual(
        row.modelSelection,
        JSON.stringify({
          provider: "claudeAgent",
          model: "claude-opus-4-6",
        }),
      );

      const persisted = yield* threads.getById({
        threadId: ThreadId.makeUnsafe("thread-null-options"),
      });
      assert.deepStrictEqual(Option.getOrNull(persisted)?.modelSelection, {
        provider: "claudeAgent",
        model: "claude-opus-4-6",
      });
    }),
  );

  it.effect("stores JSON for thread recap state", () =>
    Effect.gen(function* () {
      const threads = yield* ProjectionThreadRepository;
      const sql = yield* SqlClient.SqlClient;

      const recap = {
        text: "Working on the recap persistence slice.",
        coveredMessageId: MessageId.makeUnsafe("message-2"),
        sourceSignature: "sig-123",
        generatedAt: "2026-06-06T00:00:00.000Z",
      };

      yield* threads.upsert({
        threadId: ThreadId.makeUnsafe("thread-recap-json"),
        projectId: ProjectId.makeUnsafe("project-recap-json"),
        title: "Recap thread",
        modelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        runtimeMode: "full-access",
        interactionMode: "default",
        envMode: "local",
        branch: null,
        worktreePath: null,
        associatedWorktreePath: null,
        associatedWorktreeBranch: null,
        associatedWorktreeRef: null,
        createBranchFlowCompleted: false,
        lastKnownPr: null,
        latestTurnId: null,
        handoff: null,
        latestUserMessageAt: null,
        pendingApprovalCount: 0,
        pendingUserInputCount: 0,
        hasActionableProposedPlan: 0,
        recap,
        createdAt: "2026-06-06T00:00:00.000Z",
        updatedAt: "2026-06-06T00:00:00.000Z",
        deletedAt: null,
      });

      const rows = yield* sql<{
        readonly recapJson: string | null;
      }>`
        SELECT recap_json AS "recapJson"
        FROM projection_threads
        WHERE thread_id = 'thread-recap-json'
      `;
      assert.strictEqual(rows[0]?.recapJson, JSON.stringify(recap));

      const persisted = yield* threads.getById({
        threadId: ThreadId.makeUnsafe("thread-recap-json"),
      });
      assert.deepStrictEqual(Option.getOrNull(persisted)?.recap, recap);
    }),
  );

  it.effect("stores JSON for projected thread goal state", () =>
    Effect.gen(function* () {
      const threads = yield* ProjectionThreadRepository;
      const sql = yield* SqlClient.SqlClient;

      const goal = {
        objective: "Ship projected goal persistence",
        status: "active" as const,
        createdByMessageId: MessageId.makeUnsafe("message-goal-created"),
        createdAt: "2026-06-06T00:00:00.000Z",
        updatedAt: "2026-06-06T00:00:01.000Z",
        completedAt: null,
        lastContinuationTurnId: null,
        turnCount: 2,
        blockedReason: null,
      };

      yield* threads.upsert({
        threadId: ThreadId.makeUnsafe("thread-goal-json"),
        projectId: ProjectId.makeUnsafe("project-goal-json"),
        title: "Goal thread",
        modelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        runtimeMode: "full-access",
        interactionMode: "default",
        envMode: "local",
        branch: null,
        worktreePath: null,
        associatedWorktreePath: null,
        associatedWorktreeBranch: null,
        associatedWorktreeRef: null,
        createBranchFlowCompleted: false,
        lastKnownPr: null,
        latestTurnId: null,
        handoff: null,
        latestUserMessageAt: null,
        pendingApprovalCount: 0,
        pendingUserInputCount: 0,
        hasActionableProposedPlan: 0,
        recap: null,
        goal,
        createdAt: "2026-06-06T00:00:00.000Z",
        updatedAt: "2026-06-06T00:00:01.000Z",
        deletedAt: null,
      });

      const rows = yield* sql<{
        readonly goalJson: string | null;
      }>`
        SELECT goal_json AS "goalJson"
        FROM projection_threads
        WHERE thread_id = 'thread-goal-json'
      `;
      assert.deepStrictEqual(JSON.parse(rows[0]?.goalJson ?? "null"), goal);

      const persisted = yield* threads.getById({
        threadId: ThreadId.makeUnsafe("thread-goal-json"),
      });
      assert.deepStrictEqual(Option.getOrNull(persisted)?.goal, goal);
    }),
  );
});
