# Composer Message History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add current-thread Up/Down composer history navigation without changing server contracts.

## Files

- `apps/web/src/composer-logic.ts`: Add pure helpers for filtering sent native user messages and resolving history navigation state.
- `apps/web/src/composer-logic.test.ts`: Add red/green unit tests for history derivation and Up/Down boundary behavior.
- `apps/web/src/components/ChatView.tsx`: Wire helper into the existing composer command-key path and reset navigation state on edits, clears, and thread switches.

## Tasks

- [ ] Add failing tests in `composer-logic.test.ts` for deriving native user message history.
- [ ] Run `bun run --cwd apps/web test src/composer-logic.test.ts` and confirm the new tests fail for missing exports.
- [ ] Implement the minimal history derivation helper in `composer-logic.ts`.
- [ ] Run the focused composer logic test and confirm it passes.
- [ ] Add failing tests for resolving Up/Down navigation state, including draft restoration after newest entry.
- [ ] Run the focused composer logic test and confirm the new tests fail.
- [ ] Implement the minimal navigation resolver in `composer-logic.ts`.
- [ ] Run the focused composer logic test and confirm it passes.
- [ ] Wire `ChatView.tsx` to derive current-thread message history from persisted `activeThread.messages` only.
- [ ] In `onComposerCommandKeyRef.current`, intercept `ArrowUp` and `ArrowDown` only when no command menu is active and the cursor is at the expected boundary.
- [ ] Apply selected history text through existing prompt state, update trigger/cursor state, and focus the editor at end.
- [ ] Reset history navigation when the user edits the prompt, when the composer clears, and when `threadId` changes.
- [ ] Run `bun run --cwd apps/web test src/composer-logic.test.ts`.
- [ ] Run `bunx oxfmt@0.52.0 --check apps/web/src/composer-logic.ts apps/web/src/composer-logic.test.ts apps/web/src/components/ChatView.tsx docs/superpowers/specs/2026-06-02-composer-message-history-design.md docs/superpowers/plans/2026-06-02-composer-message-history.md`.
- [ ] Run a focused web typecheck if the TypeScript surface changed enough to require it: `bun run --cwd apps/web typecheck`.
- [ ] Manually or browser-verify that Up recalls the last current-thread prompt, repeated Up walks older prompts, Down walks newer prompts, and Down after newest restores the pre-navigation draft.
