# Catppuccin Theme Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a semantic app-depth token layer, tune Catppuccin to official palette roles, and apply the tokens to the high-impact app surfaces visible in the main chat UI.

## File Map

- `apps/web/src/theme/theme.logic.ts`: Add app-depth token derivation and Catppuccin-specific palette mapping.
- `apps/web/src/theme/theme.logic.test.ts`: Add focused tests for Catppuccin app-depth tokens and fallback token availability.
- `apps/web/src/theme/theme.seed.generated.ts`: Update Catppuccin seeds to official Latte/Mocha values when current seed is incomplete or less precise.
- `apps/web/src/index.css`: Add safe fallback values for app-depth variables and bridge shared global tokens.
- `apps/web/src/components/ThemePackEditor.tsx`: Add compact theme-depth preview in Settings.
- `apps/web/src/routes/_chat.tsx`: Use app sidebar surface token if needed by layout shell.
- `apps/web/src/components/Sidebar.tsx`: Apply sidebar/thread selected/hover depth tokens.
- `apps/web/src/components/chat/ChatHeader.tsx`: Apply topbar surface and border depth tokens.
- `apps/web/src/components/chat/MessagesTimeline.tsx`: Apply changed-files card and transcript summary surface tokens.
- `apps/web/src/components/chat/ChangedFilesTree.tsx`: Apply row hover/selected and separator tokens for changed files.
- `apps/web/src/components/ui/toast.tsx`: Apply status surface tokens for toast variants.
- `apps/web/src/components/ChatView.tsx` and/or composer components: Apply composer surface/focus depth tokens where the composer shell is defined.

## Task 1: Add Theme Token Tests

- [ ] Add a failing test in `theme.logic.test.ts` for Catppuccin dark app-depth tokens. Assert specific official Mocha-derived values for canvas/sidebar/card/hover/selected/focus/error/diff tokens.
- [ ] Add a failing test for a non-Catppuccin theme ensuring every app-depth token exists and is non-empty.
- [ ] Run `snip bun run --cwd apps/web test src/theme/theme.logic.test.ts` and confirm failures match missing app-depth tokens.

## Task 2: Implement Theme Token Derivation

- [ ] Add app-depth token names in `theme.logic.ts` as CSS variables returned from `buildThemeCssVariables`.
- [ ] Add a Catppuccin palette helper for Latte/Mocha role values scoped to theme derivation.
- [ ] Add fallback derivation for non-Catppuccin themes using existing computed theme values and color mixing.
- [ ] Update Catppuccin seeds in `theme.seed.generated.ts` only where needed to match official Latte/Mocha base/accent/text/semantic values.
- [ ] Run `snip bun run --cwd apps/web test src/theme/theme.logic.test.ts` and confirm tests pass.

## Task 3: Add Settings Preview

- [ ] Add a compact depth preview component in `ThemePackEditor.tsx` using derived CSS variables from the active card context.
- [ ] Keep existing editable fields unchanged.
- [ ] Verify Settings still renders both light/dark theme cards without adding new required persisted schema fields.

## Task 4: Apply Tokens To Visible Surfaces

- [ ] Update sidebar shell/thread row classes to use `--app-surface-sidebar`, `--app-state-hover`, `--app-state-selected`, and `--app-state-selected-border`.
- [ ] Update chat header/topbar classes to use `--app-surface-topbar` and stronger app border tokens.
- [ ] Update changed-files card/header/rows to use `--app-diff-card-bg`, `--app-diff-card-header-bg`, and state tokens.
- [ ] Update toast styling to use status surface tokens per variant.
- [ ] Update composer shell/focus surface to use `--app-surface-composer` and `--app-state-focus`.

## Task 5: Verification And Manual QA

- [ ] Run focused tests: `snip bun run --cwd apps/web test src/theme/theme.logic.test.ts`.
- [ ] Run `snip bun run --cwd apps/web typecheck`.
- [ ] Run `snip bun run fmt:check -- <touched files>`.
- [ ] Run `lsp_diagnostics` on modified TS/TSX files.
- [ ] Run Aikido full scan on modified first-party code.
- [ ] Use Playwright/browser QA to load the app, switch/apply Catppuccin dark if needed, capture screenshot, and verify actual visible surfaces: sidebar, selected thread, topbar, transcript panel/card, toast/card, changed-files list, and composer have distinct restrained layers.
