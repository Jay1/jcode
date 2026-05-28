# All Theme Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every theme shipping with JCode curated app-depth tokens while preserving Catppuccin behavior and custom-theme fallback support.

## File Map

- `docs/superpowers/specs/2026-05-28-all-theme-depth-design.md`: Approved design and acceptance criteria.
- `apps/web/src/theme/theme.logic.ts`: Add the bundled theme-depth profile model, shared profile derivation, all bundled theme profiles, and improved fallback behavior.
- `apps/web/src/theme/theme.logic.test.ts`: Add TDD coverage for profile completeness, token completeness, representative exact values, Catppuccin stability, and custom-theme fallback.
- `apps/web/src/components/ThemePackEditor.tsx`: Touch only if Settings preview needs a missing app-depth role after browser QA.
- `apps/web/src/index.css`: Touch only if a visible app surface still lacks a fallback CSS variable after browser QA.

## Task 1: Add Coverage Tests First

- [ ] Read `apps/web/src/theme/theme.logic.ts` around `CODE_THEME_OPTIONS`, `buildThemeCssVariables`, `buildAppDepthVariables`, and `CATPPUCCIN_PALETTE`.
- [ ] Read `apps/web/src/theme/theme.logic.test.ts` around the existing `buildThemeCssVariables` tests.
- [ ] Add an exported or test-visible app-depth token name list only if needed; otherwise keep the token list local to tests.
- [ ] Add a failing test that iterates every `CODE_THEME_OPTIONS` entry and every listed variant, loads its seed with `getCodeThemeSeed`, calls `buildThemeCssVariables`, and asserts each app-depth token is present and non-empty.
- [ ] Add a failing test that asserts every bundled theme/variant has visible separation between at least canvas, card, card header, and composer tokens.
- [ ] Add a custom imported theme fallback test using a minimal `ThemePack` with `codeThemeId: "custom"` and assert complete app-depth token coverage.
- [ ] Run `snip bun run --cwd apps/web test src/theme/theme.logic.test.ts` and confirm the new tests fail only for missing/insufficient non-Catppuccin depth behavior.

## Task 2: Introduce Theme Depth Profiles

- [ ] In `theme.logic.ts`, add a small `ThemeDepthProfile` type near theme derivation.
- [ ] Add a `THEME_DEPTH_PROFILES` map keyed by `codeThemeId`, then by `ThemeVariant`.
- [ ] Include `catppuccin` in the profile path without changing its emitted values.
- [ ] Replace the Catppuccin-only branch in `buildAppDepthVariables` with a profile lookup and shared `buildProfileAppDepthVariables` helper.
- [ ] Keep the existing generic branch as `buildFallbackAppDepthVariables` for custom themes and future gaps.
- [ ] Run `snip bun run --cwd apps/web test src/theme/theme.logic.test.ts` and confirm Catppuccin tests still pass while broader coverage still fails until profiles are added.

## Task 3: Add Profiles For All Bundled Themes

- [ ] Add dark and light profiles for `absolutely` where both variants exist.
- [ ] Add the dark profile for `ayu`.
- [ ] Add light and dark profiles for `codex`.
- [ ] Add light and dark profiles for `dp-code`.
- [ ] Add the dark profile for `dracula`.
- [ ] Add light and dark profiles for `everforest`.
- [ ] Add light and dark profiles for `github`.
- [ ] Add light and dark profiles for `gruvbox`.
- [ ] Add light and dark profiles for `linear`.
- [ ] Add the dark profile for `lobster`.
- [ ] Add the dark profile for `material`.
- [ ] Add the dark profile for `matrix`.
- [ ] Add the dark profile for `monokai`.
- [ ] Add the dark profile for `night-owl`.
- [ ] Add the dark profile for `nord`.
- [ ] Add light and dark profiles for `notion`.
- [ ] Add light and dark profiles for `one`.
- [ ] Add the dark profile for `oscurange`.
- [ ] Add the light profile for `proof`.
- [ ] Add light and dark profiles for `raycast`.
- [ ] Add light and dark profiles for `rose-pine`.
- [ ] Add the dark profile for `sentry`.
- [ ] Add light and dark profiles for `solarized`.
- [ ] Add the dark profile for `temple`.
- [ ] Add the dark profile for `tokyo-night`.
- [ ] Add light and dark profiles for `vercel`.
- [ ] Add light and dark profiles for `vscode-plus`.
- [ ] Keep profiles compact: prefer role colors and shared alpha defaults over spelling every CSS variable manually.
- [ ] Run `snip bun run --cwd apps/web test src/theme/theme.logic.test.ts` and confirm all coverage tests pass.

## Task 4: Lock Representative Exact Values

- [ ] Add exact-value assertions for `dp-code` dark and light.
- [ ] Add exact-value assertions for `codex` dark and light.
- [ ] Add exact-value assertions for `linear` dark.
- [ ] Add exact-value assertions for `github` light and dark.
- [ ] Add exact-value assertions for `gruvbox` dark.
- [ ] Add exact-value assertions for `rose-pine` dark.
- [ ] Add exact-value assertions for `tokyo-night` dark.
- [ ] Add exact-value assertions for `vercel` light and dark.
- [ ] Add exact-value assertions for `vscode-plus` light and dark.
- [ ] Add exact-value assertions for `matrix` dark and `lobster` dark.
- [ ] Run `snip bun run --cwd apps/web test src/theme/theme.logic.test.ts` and confirm the representative values pass.

## Task 5: Focused Verification

- [ ] Run `snip bun run --cwd apps/web test src/theme/theme.logic.test.ts`.
- [ ] Run `snip bun run --cwd apps/web typecheck`.
- [ ] If dependencies are installed and `oxfmt` is available, run `snip bun run fmt:check apps/web/src/theme/theme.logic.ts apps/web/src/theme/theme.logic.test.ts docs/superpowers/specs/2026-05-28-all-theme-depth-design.md docs/superpowers/plans/2026-05-28-all-theme-depth.md`; otherwise record the formatter availability blocker.
- [ ] Run Aikido scan on modified first-party code files.

## Task 6: Browser QA

- [ ] Start the web app with the project-standard dev command if it is not already running.
- [ ] Use browser testing to capture or inspect one neutral light theme, one neutral dark theme, one warm dark theme, one colorful dark theme, and one novelty dark theme.
- [ ] Confirm sidebar, topbar, transcript canvas, changed-files card, composer, code block, toast/status panel, and Settings preview show visible layer separation.
- [ ] If a visible surface lacks depth because it does not consume app-depth variables, make the smallest CSS/component token wiring change and repeat focused verification.

## Task 7: Commit Implementation

- [ ] Inspect `GIT_MASTER=1 git status`, `GIT_MASTER=1 git diff --stat`, and the focused diff.
- [ ] Split commits if more than two files changed across unrelated concerns.
- [ ] Commit tests and theme logic together only if splitting would leave tests failing.
- [ ] Include any CSS/preview wiring as a separate commit if it is independent from theme derivation.
- [ ] Report verification evidence and any remaining visual QA caveats.
