# Thread Recap Auto Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Thread Recaps durable, visible, and automatically refreshed for active threads so Persistent Goal Mode can rely on stable current-state context.

**Design:** `docs/superpowers/specs/2026-06-06-thread-recap-auto-refresh-design.md`

**Branch:** `jcode/t3code-upstream-roadmap`

**Prior commits:**

- `12ac6ffcd feat(thread-recap): add Thread Recap vertical slice adapted from Synara`
- `49685f4d2 docs: design thread recap auto refresh`

## File Map

- `apps/server/src/persistence/Migrations/039_ProjectionThreadsRecap.ts`: Add nullable `recap_json` to `projection_threads`.
- `apps/server/src/persistence/Migrations.ts`: Register migration 39.
- `apps/server/src/persistence/Services/ProjectionThreads.ts`: Add nullable `recap` field to `ProjectionThread`.
- `apps/server/src/persistence/Layers/ProjectionThreads.ts`: Map `recap_json` in insert/update/select paths.
- `apps/server/src/orchestration/Layers/ProjectionSnapshotQuery.ts`: Hydrate `recap` into detail and shell snapshots.
- `apps/server/src/wsRpc.ts`: Derive recap source server-side, persist generated recap, return result.
- `packages/contracts/src/server.ts`: Widen recap RPC result only if implementation needs to return full `ThreadRecap`; otherwise leave unchanged.
- `packages/contracts/src/ipc.ts` and `apps/web/src/wsNativeApi.ts`: Update only if the RPC result shape changes.
- `apps/web/src/hooks/useThreadRecap.ts`: Prefer server-derived/persisted recap and refresh snapshot after mutation.
- `apps/web/src/components/ThreadRecapPanel.tsx`: Keep manual refresh UI compact and stable.
- `apps/web/src/components/ChatView.tsx`: Mount `ThreadRecapPanel` near active thread controls/header.
- `apps/web/src/hooks/useAutoThreadRecapRefresh.ts`: New hook for conservative active-thread automatic refresh policy.
- Tests beside existing patterns:
  - `apps/server/src/persistence/Migrations/039_ProjectionThreadsRecap.test.ts` if migration tests use per-migration files.
  - Existing repository/snapshot tests if they already cover projection thread hydration.
  - `apps/web/src/hooks/useAutoThreadRecapRefresh.test.ts` or colocated logic test if hooks are hard to test directly.

## Implementation Tasks

### 1. Inspect Existing Persistence and Snapshot Tests

- [ ] Read migration tests around `032_ReconcileLegacyT3SchemaImport.test.ts` and any projection thread repository tests.
- [ ] Read `ProjectionSnapshotQuery.test.ts` for shell/detail hydration expectations.
- [ ] Identify the smallest existing test file to extend for `recap_json` hydration.
- [ ] Run the chosen baseline tests before editing, or record if they cannot run due missing dependencies.

### 2. Add Failing Persistence Tests

- [ ] Add a migration test proving legacy `projection_threads` rows migrate with `recap_json` nullable.
- [ ] Add a repository or snapshot test proving a stored `ThreadRecap` round-trips from `projection_threads` into `OrchestrationThread.recap`.
- [ ] Run the focused tests and confirm they fail for the expected missing column/mapping.

### 3. Implement Recap Storage

- [ ] Add `039_ProjectionThreadsRecap.ts` with `ALTER TABLE projection_threads ADD COLUMN recap_json TEXT` guarded consistently with existing migrations.
- [ ] Register migration 39 in `Migrations.ts` imports and `migrationEntries`.
- [ ] Add `recap: Schema.NullOr(ThreadRecap)` to `ProjectionThread` in `Services/ProjectionThreads.ts`.
- [ ] Add `recap: Schema.NullOr(Schema.fromJsonString(ThreadRecap))` or equivalent nullable mapping in `Layers/ProjectionThreads.ts`.
- [ ] Insert/select/update `recap_json` in all repository SQL paths.
- [ ] Re-run focused migration/repository tests until they pass.

### 4. Hydrate Recap in Snapshots

- [ ] Extend `ProjectionSnapshotQuery` row decoding/detail assembly to include `recap`.
- [ ] Ensure shell snapshots also include `recap`, because `OrchestrationThreadShell` already has that optional field.
- [ ] Re-run focused snapshot tests until they pass.

### 5. Persist Recap From Server RPC

- [ ] Inspect `server.generateThreadRecap` handler in `apps/server/src/wsRpc.ts`.
- [ ] Load the current thread detail from `ProjectionSnapshotQuery` by `threadId`.
- [ ] Server-derive source with `deriveThreadRecapSource()` from projected messages/activities and previous recap.
- [ ] Keep client-provided `newMaterial/currentState` only as a fallback if necessary for compatibility.
- [ ] After `textGeneration.generateThreadRecap()`, build full `ThreadRecap` with `text`, `coveredMessageId`, `sourceSignature`, and `generatedAt`.
- [ ] Persist it through `ProjectionThreadRepository.upsert()` or a focused update method if the repository exposes/needs one.
- [ ] Prefer preserving existing RPC result `{ recap: string }` unless the hook needs the full object immediately.
- [ ] Add a focused server test if an existing wsRpc test harness exists; otherwise cover persistence through repository/snapshot tests and note the gap.

### 6. Mount the Recap Panel

- [ ] Inspect `ChatView.tsx` active thread header/control layout.
- [ ] Import `ThreadRecapPanel`.
- [ ] Mount it near the active thread controls/header, not inside the transcript timeline.
- [ ] Pass the active thread object expected by `useThreadRecap`.
- [ ] Verify it does not render for missing thread.

### 7. Add Automatic Refresh Policy

- [ ] Extract auto-refresh policy into a small hook, likely `useAutoThreadRecapRefresh.ts`, so `ChatView.tsx` does not gain complex effect logic.
- [ ] Inputs: active thread, native API, enabled flag, debounce interval, and refresh callback or query invalidation callback.
- [ ] Trigger when opening active thread with no recap and enough material.
- [ ] Trigger after a turn settles when thread session is not running and source signature differs.
- [ ] Skip hidden/non-user-facing material by reusing `deriveThreadRecapSource()`.
- [ ] Prevent concurrent refreshes per thread.
- [ ] Debounce refresh attempts.
- [ ] Surface failures via existing panel/manual refresh path, not global toast.

### 8. Add Automatic Refresh Tests

- [ ] Write pure policy tests if the hook can expose a helper such as `shouldAutoRefreshThreadRecap()`.
- [ ] Cover no recap + enough material => refresh.
- [ ] Cover running session => skip.
- [ ] Cover no new material/signature match => skip.
- [ ] Cover in-flight refresh => skip.
- [ ] Run the focused web tests or `bun test` fallback if Vitest is unavailable in this worktree.

### 9. Focused Verification

- [ ] Run `bun test packages/shared/src/threadRecapSource.test.ts`.
- [ ] Run focused server migration/projection tests touched by the implementation.
- [ ] Run focused web hook/policy tests.
- [ ] Run `safe-run --profile build -- bun run --cwd apps/server typecheck` and record pre-existing `bun`/`node` type errors if unchanged.
- [ ] Run focused web/package typecheck if available.
- [ ] Run `bunx oxfmt@0.52.0 --check <touched files>`.

### 10. Commit

- [ ] Inspect `GIT_MASTER=1 git status`, `GIT_MASTER=1 git diff`, and `GIT_MASTER=1 git diff --staged --stat`.
- [ ] Split commits if implementation spans independent concerns:
  - Persistence/schema/hydration.
  - Server RPC persistence behavior.
  - Web mounting/automatic refresh.
- [ ] Commit with concise messages matching repo style.

## Acceptance Criteria

- Generated recaps persist across reloads.
- Thread detail and shell snapshots include recap data.
- The active thread UI exposes current-state recap without transcript clutter.
- Manual refresh still works.
- Automatic refresh updates active-thread recaps after meaningful new material and settled turns.
- Automatic refresh does not run during active provider sessions or when no new material exists.
- Focused tests pass, formatting is clean, and any typecheck failures are verified as pre-existing.
