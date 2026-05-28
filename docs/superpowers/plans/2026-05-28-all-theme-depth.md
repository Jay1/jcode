# All Theme Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Catppuccin app-depth token model to every bundled JCode theme while preserving custom-theme fallback behavior.

## File Map

- `apps/web/src/theme/theme.logic.ts`: Add theme-depth profile types, a centralized bundled profile map, shared profile-to-token derivation, and stronger fallback derivation for custom themes.
- `apps/web/src/theme/theme.logic.test.ts`: Add coverage tests for every bundled theme/variant, representative exact-value tests, Catppuccin regression tests, and custom fallback tests.
- `apps/web/src/index.css`: Touch only if visual QA shows an app surface still lacks safe app-depth fallback variables.
- `apps/web/src/components/*`: Avoid component changes unless a visible surface is not wired to existing app-depth tokens.
- `docs/superpowers/specs/2026-05-28-all-theme-depth-design.md`: Source design and acceptance criteria.

## Task 1: Add Failing Theme Coverage Tests

- [ ] Read `CODE_THEME_OPTIONS`, `buildThemeCssVariables`, and `buildAppDepthVariables` in `apps/web/src/theme/theme.logic.ts`.
- [ ] Read the current `buildThemeCssVariables` tests in `apps/web/src/theme/theme.logic.test.ts`.
- [ ] Add a `REQUIRED_APP_DEPTH_TOKENS` test helper listing every emitted `--app-*` depth token that bundled themes must provide.
- [ ] Add a failing test that iterates every `CODE_THEME_OPTIONS` entry and every listed variant, resolves the seed with `getCodeThemeSeed`, calls `buildThemeCssVariables`, and asserts every required token is a non-empty string.
- [ ] Add a failing test that checks each bundled theme/variant has visible separation between canvas, sidebar/topbar, card, card header, and composer.
- [ ] Run `snip bun run --cwd apps/web test src/theme/theme.logic.test.ts` and confirm the failures identify current non-Catppuccin gaps.

## Task 2: Introduce Shared Depth Profile Derivation

- [ ] Add an internal `ThemeDepthProfile` type near `buildAppDepthVariables` in `theme.logic.ts`.
- [ ] Include optional roles for shell surfaces, interaction states, accent hints, chat semantics, status panels, and diff/card panels.
- [ ] Add `buildProfileDepthVariables(pack, variant, resolvedTokens, profile)` to emit the existing app-depth variable names.
- [ ] Keep Catppuccin's current exact output stable by representing its palette through the new profile path or by preserving an equivalent first profile.
- [ ] Keep generic fallback behavior for custom imported themes and future unprofiled themes.
- [ ] Run the focused theme logic test and confirm Catppuccin assertions still pass.

## Task 3: Add Bundled Theme Profiles

- [ ] Add a centralized `THEME_DEPTH_PROFILES` map keyed by `codeThemeId` and variant.
- [ ] Add profiles for every theme listed in `CODE_THEME_OPTIONS`: `absolutely`, `ayu`, `catppuccin`, `codex`, `dp-code`, `dracula`, `everforest`, `github`, `gruvbox`, `linear`, `lobster`, `material`, `matrix`, `monokai`, `night-owl`, `nord`, `notion`, `one`, `oscurange`, `proof`, `raycast`, `rose-pine`, `sentry`, `solarized`, `temple`, `tokyo-night`, `vercel`, and `vscode-plus`.
- [ ] Use each theme seed's `surface`, `ink`, `accent`, and semantic colors as the primary source for profile values.
- [ ] Keep neutral/product themes restrained: Codex, JCode, Linear, Notion, Raycast, Vercel, VS Code Plus.
- [ ] Keep editor-port themes recognizable: GitHub, Gruvbox, Nord, Solarized, Tokyo Night, Rose Pine, Night Owl, One, Dracula, Monokai, Material, Ayu, Everforest.
- [ ] Keep novelty themes distinctive but controlled: Matrix, Lobster, Absolutely, Temple, Sentry, Oscurange, Proof.
- [ ] Run `snip bun run --cwd apps/web test src/theme/theme.logic.test.ts` and make token coverage tests pass.

## Task 4: Add Representative Exact-Value Tests

- [ ] Add exact-value assertions for representative themes: `dp-code`, `codex`, `linear`, `github`, `gruvbox`, `rose-pine`, `tokyo-night`, `vercel`, `vscode-plus`, `matrix`, and `lobster`.
- [ ] Keep existing Catppuccin exact-value assertions intact unless the new profile path intentionally emits identical values.
- [ ] Add a custom non-bundled fallback test using a simple `ChromeTheme` object and a made-up `codeThemeId`.
- [ ] Run `snip bun run --cwd apps/web test src/theme/theme.logic.test.ts` until all theme logic tests pass.
- [ ] Commit the theme logic and test changes atomically if only those files changed.

## Task 5: Audit Surface Wiring

- [ ] Search `apps/web/src` for `--app-surface-*`, `--app-state-*`, `--app-chat-*`, `--app-status-*`, and `--app-diff-*` usage.
- [ ] Identify high-impact visible surfaces still using generic `--card`, `--background`, or `--muted` where an app-depth token already exists.
- [ ] If no missing wiring is found, leave component files untouched.
- [ ] If missing wiring is found, make the smallest CSS/component change needed and run focused verification for that area.
- [ ] Commit any surface-wiring change separately from theme profile logic.

## Task 6: Browser Visual QA

- [ ] Start or reuse the web app via the repo's focused web command.
- [ ] Capture representative themes: one neutral light, one neutral dark, one warm dark, one colorful dark, and one novelty/high-identity theme.
- [ ] Verify sidebar, topbar, transcript canvas, changed-files card, composer, code block, toast/status panel, and Settings preview have visible layer separation.
- [ ] If any profile is too flat or too saturated, adjust only that profile and update tests if exact values change.
- [ ] Record screenshot evidence or describe the visual QA result in the final response.

## Task 7: Final Verification

- [ ] Run `snip bun run --cwd apps/web test src/theme/theme.logic.test.ts`.
- [ ] Run `snip bun run --cwd apps/web typecheck` if TypeScript types changed.
- [ ] Run `snip bun run fmt:check`, or report the exact local tooling blocker if unavailable.
- [ ] Run Aikido scan on modified first-party code files.
- [ ] Check `GIT_MASTER=1 git status --short --branch` and ensure only intended files are changed or committed.
- [ ] Summarize commits, verification, browser QA, and residual risk.
