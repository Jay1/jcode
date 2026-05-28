# Upstream Safe Picks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the smallest useful upstream fixes from DPCode/T3Code without destabilizing JCode or mixing unrelated sidebar work.

**Design:** `docs/superpowers/specs/2026-05-28-upstream-safe-picks-design.md`

## File Map

- `apps/web/src/components/ComposerPromptEditor.tsx`: candidate for T3Code #2817 IME Enter guard.
- `apps/web/src/components/ComposerPromptEditor*.test.tsx` or nearest existing composer test: add regression for composing Enter behavior if practical.
- `packages/contracts/src/auth.ts`: candidate for T3Code #2694/#2825 `DateTimeUtcFromString` decoding.
- `packages/contracts/src/auth*.test.ts` or nearest contracts test: add schema decode regression if auth schemas still need it.
- `apps/server/src/provider/providerMaintenanceRunner.ts`: candidate for T3Code #2781 Windows provider-update command behavior if present.
- `apps/server/src/provider/providerMaintenanceRunner.test.ts`: add/update Windows command option regression if matching runner exists.
- `apps/web/src/components/ThreadTerminalDrawer.tsx`: candidate for T3Code #2816 resize rerender reduction if current structure matches.
- `apps/web/src/components/ThreadTerminalDrawer*.test.tsx` or browser/manual QA: cover behavior if changed.
- `apps/web/src/components/GitActionsControl.logic.ts`: only inspect DPCode #113; skip if equivalent guard already exists.
- `docs/superpowers/plans/2026-05-28-upstream-safe-picks.md`: track execution status.

## Preflight

- [ ] Check current status with `GIT_MASTER=1 git status --short --branch`.
- [ ] Preserve existing dirty sidebar files; do not edit them during upstream import.
- [ ] Create an isolated `feature/upstream-safe-picks` workspace or branch before code imports.
- [ ] Re-run `bun run upstream:watch -- --dry-run` if the previous report is stale.
- [ ] Do not force-fetch or clobber T3Code tags; overlapping `v0.0.x` tags are expected.

## Task 1: Composer IME Enter Guard

- [ ] Inspect JCode `apps/web/src/components/ComposerPromptEditor.tsx` around `ComposerCommandKeyPlugin`.
- [ ] Compare T3Code #2817 diff: guard `Enter` when `event.isComposing` or `event.keyCode === 229`.
- [ ] Find an existing composer/editor test harness.
- [ ] Write a failing regression for Enter during composition if the harness can simulate Lexical command handling.
- [ ] If no practical unit harness exists, document the limitation in the plan and prepare browser/manual QA instead.
- [ ] Port the minimal guard to JCode.
- [ ] Run focused web tests for the touched composer area.
- [ ] Run `bun run --cwd apps/web typecheck`.

## Task 2: Auth Date Decoding Compatibility

- [ ] Inspect `packages/contracts/src/auth.ts` for schemas using `Schema.DateTimeUtc` on values that cross JSON/RPC boundaries.
- [ ] If schemas already use string-decoding variants, mark this task skipped with evidence.
- [ ] Otherwise, write a failing decode test for an ISO date string in auth bootstrap/websocket/pairing result schemas.
- [ ] Replace only boundary result fields with `Schema.DateTimeUtcFromString` or the repository's current equivalent.
- [ ] Run focused contracts tests.
- [ ] Run the relevant package typecheck if available.

## Task 3: Windows Provider Update Command Behavior

- [ ] Check whether JCode has `apps/server/src/provider/providerMaintenanceRunner.ts`.
- [ ] If absent or materially different, mark T3Code #2781 skipped.
- [ ] If present, inspect current child-process spawn behavior for Windows `.cmd` shim resolution.
- [ ] Compare T3Code #2781 and decide whether the fix applies directly or needs adaptation.
- [ ] Write/update a focused server test for Windows command options.
- [ ] Port the smallest behavior change.
- [ ] Run focused server provider-maintenance tests and server typecheck if touched.

## Task 4: Terminal Drawer Rerender Reduction

- [ ] Inspect JCode `ThreadTerminalDrawer.tsx` and compare T3Code #2816.
- [ ] If the component shape has diverged, mark skipped.
- [ ] If applicable, identify a minimal state/ref change that preserves UI behavior.
- [ ] Add or run the nearest focused test; otherwise perform browser/manual QA of terminal drawer resize.
- [ ] Port only the rerender reduction, not unrelated refactors.
- [ ] Run focused web tests and typecheck.

## Task 5: Skip/Already-Present Decisions

- [ ] Inspect `GitActionsControl.logic.ts` for DPCode #113 create-PR availability guard.
- [ ] If `resolveCreatePrActionAvailability` already blocks stale PR calls, record as already present and skip.
- [ ] Search for provider-instance dialog equivalents before considering T3Code #2827.
- [ ] If JCode lacks the matching component, record as not applicable and skip.
- [ ] Search for command-palette Add Project path picker equivalents before considering T3Code #2552.
- [ ] If JCode uses sidebar search instead of that command palette, record as not applicable and skip.

## Task 6: Verification And Security

- [ ] Run all focused tests touched by kept imports.
- [ ] Run focused workspace typechecks for touched packages.
- [ ] Run LSP diagnostics on changed code files.
- [ ] Run Aikido scan on changed code files.
- [ ] Run browser/manual QA for any visible UI behavior.
- [ ] Confirm `.jcode/upstream-watch/` and `/tmp` reports are not committed.
- [ ] Confirm unrelated sidebar files remain untouched by upstream import commits.

## Task 7: Follow-Up Backlog

- [ ] Create a separate design/spec for DPCode v0.0.48/v0.0.49 performance work if still desired.
- [ ] Create a separate provider-expansion design/spec before importing Grok/Pi/Hermes work.
- [ ] After imported or intentionally skipped candidates are recorded, decide whether to run `bun run upstream:watch` to advance local cursors.
