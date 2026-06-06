# Persistent Goal Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a JCode-native Persistent Goal Mode that lets a user set a durable objective on a thread and lets JCode safely continue completed turns toward that goal until the model declares completion or the user pauses/clears it.

**Upstream source:** Synara PR #142, head `da52fa34183d69bc3d21c3746f5ead29b5ba86e2`, adapted from Codex/pi-goal.

**Prerequisite now complete:** Thread Recaps are durable, hydrated, visible, and auto-refreshed via commits `fd122e65a`, `55bd4cbb3`, and `957ae8dbd`.

**Branch:** `jcode/t3code-upstream-roadmap`

## Design Summary

- Use Synara's event-sourced shape, adapted to JCode: one optional `OrchestrationGoal` on each thread.
- Use command/event lifecycle operations: set, pause, resume, complete, clear.
- Use a hidden user message source, `goal-continuation`, and `thread.turn.start` to keep using the existing provider start path.
- Use a same-model completion audit and completion sentinel, not a separate evaluator model and not provider-specific tool injection.
- Use Thread Recap/current-state context in the hidden continuation prompt to reduce repeated work.
- Keep v1 guardrails conservative: continue only after completed turns, skip while a provider session is running, handle each completed turn once, pause/stop when blocked by user input or approvals, and do not implement token-budget enforcement until JCode has reliable cross-provider usage accounting.

## File Map

- `packages/contracts/src/orchestration.ts`: Add `OrchestrationGoal`, sentinel constant, goal commands/events, optional `goal` on `OrchestrationThread` and `OrchestrationThreadShell`, and `goal-continuation` message source.
- `packages/contracts/src/ws.ts`: Usually no direct changes unless command schemas require exported method wiring updates.
- `packages/contracts/src/ipc.ts`: Usually no direct changes because goal lifecycle uses existing `orchestration.dispatchCommand`.
- `apps/server/src/orchestration/decider.ts`: Validate and emit `thread.goal-*` events; support `thread.turn.start` messages with `source: "goal-continuation"`.
- `apps/server/src/orchestration/commandInvariants.ts`: Add reusable goal/thread invariant helpers only if keeping the decider readable requires it.
- `apps/server/src/orchestration/projector.ts`: Fold goal events into the in-memory read model used by decider command validation.
- `apps/server/src/orchestration/Layers/ProjectionPipeline.ts`: Fold goal events into `ProjectionThread` rows.
- `apps/server/src/persistence/Migrations/040_ProjectionThreadsGoal.ts`: Add nullable `goal_json` to `projection_threads`.
- `apps/server/src/persistence/Migrations.ts`: Register migration 40.
- `apps/server/src/persistence/Services/ProjectionThreads.ts`: Add nullable `goal` to `ProjectionThread`.
- `apps/server/src/persistence/Layers/ProjectionThreads.ts`: Encode/decode `goal_json` in insert/update/get/list.
- `apps/server/src/orchestration/Layers/ProjectionSnapshotQuery.ts`: Hydrate `goal` into thread shells and details.
- `apps/server/src/orchestration/goalContinuationPrompt.ts`: Port Synara's prompt renderer, substituting JCode names and including durable Thread Recap context.
- `apps/server/src/orchestration/Layers/GoalContinuationReactor.ts`: New reactor that subscribes to domain events, re-reads projection details, detects completion sentinel, and dispatches continuation turns.
- `apps/server/src/orchestration/Services/GoalContinuationReactor.ts`: Service interface for start lifecycle.
- `apps/server/src/orchestration/Layers/OrchestrationReactor.ts`: Start the goal continuation reactor alongside provider/checkpoint reactors.
- `apps/server/src/serverLayers.ts`: Provide `GoalContinuationReactorLive` with the same runtime services layer as other orchestration reactors.
- `apps/web/src/composerSlashCommands.ts`: Add `/goal` to built-in slash command definitions.
- `apps/web/src/hooks/useComposerSlashCommands.ts`: Parse `/goal`, `/goal pause`, `/goal resume`, `/goal clear`, `/goal status` into existing dispatch calls or local UI actions.
- `apps/web/src/components/chat/GoalIndicator.tsx`: Add compact status chip adapted from Synara without emoji-only semantics.
- `apps/web/src/components/ChatView.tsx`: Mount `GoalIndicator` near composer/header and wire goal slash command actions.
- Tests to update/add:
  - `packages/contracts/src/orchestration.test.ts` or colocated contract tests if present.
  - `apps/server/src/orchestration/decider*.test.ts`.
  - `apps/server/src/orchestration/projector.test.ts`.
  - `apps/server/src/persistence/Layers/ProjectionRepositories.test.ts`.
  - `apps/server/src/orchestration/Layers/ProjectionSnapshotQuery.test.ts`.
  - `apps/server/src/orchestration/Layers/GoalContinuationReactor.test.ts`.
  - `apps/web/src/composerSlashCommands.test.ts` or existing composer slash tests.
  - `apps/web/src/components/chat/GoalIndicator.test.tsx` only if the repo already has component tests; otherwise cover logic via browser or existing ChatView tests.

## Implementation Tasks

### 1. Contract Model and Failing Tests

- [x] Read the relevant sections of `packages/contracts/src/orchestration.ts`: message source, thread schemas, command schemas, event payloads, `OrchestrationCommand`, `OrchestrationEventType`, and `OrchestrationEvent`.
- [x] Add failing contract tests for decoding a thread shell/detail with `goal` and a `goal-continuation` message source.
- [x] Add `ORCHESTRATION_GOAL_COMPLETION_SENTINEL`, e.g. `JCODE_GOAL_COMPLETE`, as an exported contract constant.
- [x] Add `OrchestrationGoalStatus` literals: `active`, `paused`, `complete`, `cleared`, `blocked` if needed by tests.
- [x] Add `OrchestrationGoal` fields for v1:
  - `objective: TrimmedNonEmptyString`
  - `status`
  - `createdAt`, `updatedAt`
  - `createdByMessageId: MessageId | null`
  - `completedAt: IsoDateTime | null`
  - `lastContinuationTurnId: TurnId | null`
  - `turnCount: NonNegativeInt`
  - `blockedReason: string | null`
- [x] Add optional `goal` to `OrchestrationThread` and `OrchestrationThreadShell` with decoding default `null`.
- [x] Extend `OrchestrationMessageSource` with `goal-continuation`.
- [x] Add goal commands:
  - `thread.goal.set`
  - `thread.goal.pause`
  - `thread.goal.resume`
  - `thread.goal.complete`
  - `thread.goal.clear`
- [x] Add goal event types and payload schemas:
  - `thread.goal-set`
  - `thread.goal-paused`
  - `thread.goal-resumed`
  - `thread.goal-completed`
  - `thread.goal-cleared`
  - optional `thread.goal-blocked` only if reactor tests require durable blocked state in v1.
- [x] Run focused contract tests and verify the new tests fail for missing schemas.
- [x] Implement the contract schemas minimally.
- [x] Run the focused contract tests again.
- [x] Commit contracts as `feat(goal): add orchestration goal contracts`.

### 2. Decider Lifecycle Events

- [x] Add failing tests in `apps/server/src/orchestration/decider*.test.ts` for `thread.goal.set` on an existing thread.
- [x] Add failing tests for pausing/resuming/completing/clearing when a goal exists.
- [x] Add failing tests for invalid transitions:
  - pause without active goal rejects.
  - resume without paused goal rejects.
  - complete without active/paused goal rejects.
  - set with empty objective rejects through schema or invariant.
- [x] Implement decider cases that emit goal events with `updatedAt`/`occurredAt` from `nowIso()`.
- [x] Ensure `thread.turn.start` accepts a `message.source` of `goal-continuation`; do not special-case provider dispatch in the decider.
- [x] Run focused decider tests and fix only the minimal code needed.
- [x] Commit as `feat(goal): add goal lifecycle decisions`.

### 3. In-Memory Projector Goal Folding

- [x] Add failing tests in `apps/server/src/orchestration/projector.test.ts` proving goal events update `thread.goal` in the read model.
- [x] Implement goal folding in `apps/server/src/orchestration/projector.ts`.
- [x] Ensure clear either sets `status: "cleared"` or removes/hides goal consistently with contract and UI expectations. Prefer retaining a cleared goal in events but projecting `goal: null` if the UI should hide it.
- [x] Run focused projector tests.
- [x] Commit as `feat(goal): project goal state in memory`.

### 4. SQLite Projection Persistence and Hydration

- [x] Add migration test for nullable `goal_json` on `projection_threads`.
- [x] Add `apps/server/src/persistence/Migrations/040_ProjectionThreadsGoal.ts`.
- [x] Register migration 40 in `apps/server/src/persistence/Migrations.ts`.
- [x] Add `goal` to `ProjectionThread` schema.
- [x] Map `goal_json` in `apps/server/src/persistence/Layers/ProjectionThreads.ts` insert/update/get/list.
- [x] Extend `ProjectionRepositories.test.ts` with a goal JSON round-trip test.
- [x] Add failing `ProjectionSnapshotQuery.test.ts` assertions for shell/detail goal hydration.
- [x] Add projection pipeline folding for goal events in `ProjectionPipeline.ts`.
- [x] Run focused migration/repository/projection snapshot tests where the local environment allows; record existing dependency blockers exactly if they persist.
- [x] Commit as `feat(goal): persist projected goal state`.

### 5. Continuation Prompt Renderer

- [x] Add `apps/server/src/orchestration/goalContinuationPrompt.test.ts`.
- [x] Test that the renderer:
  - Escapes objective text as untrusted data.
  - Includes current recap text when available.
  - Includes the completion audit checklist.
  - Includes the exact sentinel and says nothing should follow it.
- [x] Port Synara's `renderGoalContinuationPrompt()` into `apps/server/src/orchestration/goalContinuationPrompt.ts` with JCode names.
- [x] Include Thread Recap context as a `Current thread recap:` section if `thread.recap?.text` exists.
- [x] Run focused prompt tests.
- [x] Commit as `feat(goal): add continuation prompt renderer`.

### 6. Goal Continuation Reactor

- [x] Add `apps/server/src/orchestration/Services/GoalContinuationReactor.ts` with a `start` effect interface matching existing reactor service patterns.
- [x] Add `apps/server/src/orchestration/Layers/GoalContinuationReactor.test.ts` with service fakes for `OrchestrationEngineService` and `ProjectionSnapshotQuery`.
- [x] Test no-op cases first:
  - no thread detail.
  - no goal.
  - goal not active.
  - latest turn not completed.
  - session still running.
  - pending approval or user input exists.
- [x] Test completion sentinel handling:
  - latest assistant message for the completed turn ends with sentinel.
  - reactor dispatches `thread.goal.complete` once for that turn.
- [x] Test continuation handling:
  - active goal, completed turn, no sentinel, no pending blockers.
  - reactor dispatches `thread.turn.start` with a generated user message, `source: "goal-continuation"`, and text from `renderGoalContinuationPrompt()`.
- [x] Test idempotency: repeated trigger events for the same completed turn do not dispatch duplicate continuation turns.
- [x] Implement `GoalContinuationReactorLive`, adapting Synara's event trigger set:
  - React to `thread.turn-diff-completed` and `thread.session-set`.
  - Re-read `getThreadDetailById(threadId)` every time.
  - Use an in-memory `lastHandledTurnId` map for v1.
  - Generate server command IDs with a `server:goal-continuation:` prefix.
  - Generate continuation message IDs with a `goal-continuation:` prefix.
- [x] Wire `GoalContinuationReactorLive` into `OrchestrationReactorLive` and `serverLayers.ts`.
- [x] Run focused reactor tests and LSP diagnostics.
- [x] Commit as `feat(goal): continue active goals after completed turns`.

### 7. Web Slash Commands and Goal Indicator

- [x] Add `/goal` to `BUILT_IN_COMPOSER_SLASH_COMMANDS` and command definitions in `apps/web/src/composerSlashCommands.ts`.
- [x] Add parser tests for:
  - `/goal Build the thing` -> set.
  - `/goal pause` -> pause.
  - `/goal resume` -> resume.
  - `/goal clear` -> clear.
  - `/goal status` -> status UI/no dispatch.
- [x] Implement slash handling in `apps/web/src/hooks/useComposerSlashCommands.ts` or `ChatView.tsx`, following the existing `/fast`, `/fork`, and `/status` command patterns.
- [x] Dispatch goal commands through `api.orchestration.dispatchCommand` with `newCommandId()`.
- [x] Add `apps/web/src/components/chat/GoalIndicator.tsx`, adapted from Synara but using text-accessible UI rather than relying on emoji.
- [x] Mount `GoalIndicator` near the composer controls or header where active thread status chips already live.
- [x] Ensure `/goal status` displays current status via toast or existing status surface without sending a provider turn.
- [x] Run focused web logic tests where dependencies allow; otherwise capture `vitest` blocker exactly.
- [x] Commit as `feat(goal): add goal slash command UI`.

### 8. Verification and Review

- [ ] Run focused shared/contracts tests touched by goal schemas.
- [ ] Run focused server tests:
  - decider goal tests.
  - projector goal tests.
  - projection repository/snapshot tests.
  - goal prompt tests.
  - goal reactor tests.
- [ ] Run focused web tests for slash command parsing and indicator logic.
- [ ] Run `bunx oxfmt@0.52.0 --check <touched files>`.
- [ ] Run LSP diagnostics on touched files.
- [ ] If local dependency blockers persist, record exact errors and rely on LSP plus runnable focused tests only; do not claim blocked suites pass.
- [ ] Use `requesting-code-review` or `/review-work` after implementation because this feature spans contracts, event sourcing, server reactors, and UI.

## Risks and Guardrails

- **Duplicate continuation turns:** Reactor must record handled turn IDs only after dispatching completion or continuation. Tests must cover repeated trigger events.
- **Race with projection hydration:** Reactor must re-read projection detail and require a completed latest turn plus assistant message text before detecting sentinel or continuing.
- **Provider busy state:** Reactor must not dispatch when `thread.session` indicates running work.
- **User blockers:** V1 should not continue through pending approvals or user input requests. If a goal is blocked, either no-op or emit a durable blocked state only if UI needs it.
- **Prompt injection:** Treat objective as user-provided data, escape XML-ish delimiters, and keep the continuation prompt framed as internal hidden context.
- **Runaway loops:** V1 must require one completed turn per continuation, dedupe per latest turn, and avoid timer-based polling.
- **Token budgets:** Defer token budget enforcement unless usage extraction is reliable across JCode provider activities. Do not add fake budget accounting.
- **Visibility:** Hide `goal-continuation` messages from ordinary transcript display only if product design requires invisibility. If hidden display needs schema support, plan a separate display flag instead of overloading `source` semantics.

## Completion Criteria

- User can set/pause/resume/clear a thread goal through `/goal` commands.
- Active thread snapshots include durable goal state after refresh/restart.
- Completed turns automatically continue once toward active goals unless the model emits the completion sentinel or a guardrail blocks continuation.
- The same model decides completion via the sentinel line after a completion audit.
- Thread Recap context appears in continuation prompts when available.
- Focused tests cover command lifecycle, projection hydration, prompt rendering, reactor decisions, and slash command parsing.
