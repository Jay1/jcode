# All Theme Depth Design

| Field           | Value                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Status          | Approved                                                                                                |
| Type            | Design specification                                                                                    |
| Owner           | Engineering                                                                                             |
| Audience        | Maintainers and automation agents                                                                       |
| Canonical path  | `docs/superpowers/specs/2026-05-28-all-theme-depth-design.md`                                           |
| Last reviewed   | 2026-05-28                                                                                              |
| Review cadence  | Event-driven; review when bundled themes, app-depth tokens, or high-impact shell surfaces change        |
| Source of truth | JCode theme seed catalog, Catppuccin depth implementation, theme logic tests, and screenshot review     |

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans before implementation. For implementation, use frontend-design, test-driven-development, webapp-testing, verification-before-completion, and aikido-security.

**Goal:** Give every theme shipping with JCode the same level of app-surface depth that Catppuccin received, without introducing per-component theme hacks or breaking custom imported themes.

## Context

Catppuccin proved the app-depth token model: `theme.logic.ts` can emit richer app-facing CSS variables while components consume stable semantic tokens such as `--app-surface-sidebar`, `--app-state-selected`, `--app-diff-card-bg`, and chat semantic aliases. The app now has the token wiring needed for sidebar, topbar, changed-files, cards, toast, composer, code blocks, and Settings previews.

The remaining bundled themes still mostly use the generic fallback derivation. That fallback is safe, but it does not capture each theme's recognizable palette structure. JCode ships many themes with distinct visual intent, including neutral themes, GitHub-style light themes, warm terminal-inspired themes, saturated novelty themes, and editor-port themes.

## Problem

- Catppuccin has hand-tuned depth while other bundled themes can still look flatter across shell surfaces.
- A full per-component theme switch would be brittle and hard to maintain.
- Custom imported themes must continue to work with fallback derivation.
- Every shipped theme and variant needs coverage so future catalog additions cannot silently skip app-depth tokens.

## Approaches Considered

### Generic Fallback Only

Improve the fallback math once and let every non-Catppuccin theme inherit it.

- Pros: small change, low maintenance, naturally supports custom themes.
- Cons: preserves broad sameness and misses theme-specific palette identity.

### Fully Hand-Tune Every Surface For Every Theme

Add exact per-theme token values for each depth token.

- Pros: highest visual control.
- Cons: large table, easy to drift, hard to review, and likely to become a theme-specific maintenance burden.

### Recommended: Tiered Theme Depth Profiles

Add centralized theme depth profiles for every bundled theme. Profiles provide compact palette roles, and shared derivation emits the final app-depth variables.

- Pros: all themes improve, theme identity is preserved, component CSS remains stable, and custom themes keep fallback support.
- Cons: requires careful test coverage and visual QA for representative extremes.

## Design

Use the existing Catppuccin app-depth token contract as the stable output. Replace the Catppuccin-only special case with a profile lookup:

1. If a bundled theme has a profile for the active variant, derive app-depth variables from that profile.
2. If a bundled theme has no exact variant profile, use the generic fallback.
3. If a custom imported theme is active, use the generic fallback.

Profiles should live in `apps/web/src/theme/theme.logic.ts` near theme derivation for now. Do not create a separate generated file unless the profile map becomes too large to review comfortably.

### Profile Shape

Each profile should describe palette roles, not component names where possible:

- Base layers: `canvas`, `sidebar`, `topbar`, `panel`, `card`, `cardHeader`, `composer`.
- Interaction roles: `hover`, `selected`, `selectedBorder`, `focus`.
- Semantic roles: `success`, `error`, `warning`, `link`, `command`, `token`, `codeBackground`, `codeBorder`.
- Optional alpha controls for selected state, status panels, and chat chips.

The final CSS variables remain the existing app-depth names:

- `--app-surface-canvas`, `--app-surface-sidebar`, `--app-surface-topbar`, `--app-surface-panel`, `--app-surface-card`, `--app-surface-card-header`, `--app-surface-composer`.
- `--app-state-hover`, `--app-state-selected`, `--app-state-selected-border`, `--app-state-focus`.
- `--app-status-error-bg`, `--app-status-error-border`, `--app-status-warning-bg`, `--app-status-warning-border`.
- `--app-diff-card-bg`, `--app-diff-card-header-bg`.
- `--app-chat-*` semantic tokens.
- `--app-accent-soft`, `--app-accent-muted`, `--app-accent-strong`.

### Bundled Theme Coverage

Cover every entry in `CODE_THEME_OPTIONS` and each listed variant:

- `absolutely`, `ayu`, `catppuccin`, `codex`, `dp-code`, `dracula`, `everforest`, `github`, `gruvbox`, `linear`, `lobster`, `material`, `matrix`, `monokai`, `night-owl`, `nord`, `notion`, `one`, `oscurange`, `proof`, `raycast`, `rose-pine`, `sentry`, `solarized`, `temple`, `tokyo-night`, `vercel`, and `vscode-plus`.

Profile intent should follow each theme's existing seed values:

- Neutral themes such as Codex, Linear, Vercel, Notion, and VS Code Plus should stay restrained with luminance depth and minimal accent fill.
- Editor-port themes such as GitHub, Gruvbox, Nord, Solarized, Tokyo Night, Rose Pine, Night Owl, One, Dracula, Monokai, Material, Ayu, and Everforest should preserve their recognizable background and accent roles.
- Novelty or saturated themes such as Matrix, Lobster, Absolutely, Temple, Sentry, Oscurange, and Raycast should keep their personality while reducing full-screen accent wash.
- `dp-code` remains the JCode house theme and should receive the same surface polish as the best neutral themes.

### Fallback Derivation

Strengthen the fallback derivation for custom themes and any future seed gaps:

- Dark themes should separate canvas, sidebar/topbar, panel/card, card header, and composer through small luminance steps from `surface` and `ink`.
- Light themes should use subtle ink mixing and white/surface mixing so cards and chrome remain distinct without gray haze.
- Accent and semantic panels should use alpha overlays from `accent`, `diffAdded`, and `diffRemoved`.
- Fallback must never return empty strings for app-depth tokens.

## Tests

Add focused tests in `apps/web/src/theme/theme.logic.test.ts`:

- Iterate over `CODE_THEME_OPTIONS`, get each available seed, and assert every app-depth token exists and is non-empty.
- Assert every bundled theme/variant has a profile or explicitly exercises fallback coverage.
- Assert a representative subset has stable expected values: `dp-code`, `codex`, `linear`, `github`, `gruvbox`, `rose-pine`, `tokyo-night`, `vercel`, `vscode-plus`, `matrix`, and `lobster`.
- Keep existing Catppuccin assertions intact so its palette does not regress.
- Add fallback custom-theme assertions for surface separation and token completeness.

## Visual QA

Use browser screenshots after implementation for a small representative matrix instead of checking all themes manually:

- Light neutral: `vercel` or `github` light.
- Dark neutral: `linear`, `codex`, or `dp-code` dark.
- Warm dark: `gruvbox` or `rose-pine` dark.
- Cool dark: `tokyo-night`, `nord`, or `night-owl` dark.
- Saturated novelty: `matrix` or `lobster` dark.

Review sidebar, topbar, transcript canvas, changed-files card, composer, code block, toast/status panel, and Settings theme preview in each screenshot.

## Non-Goals

- No new theme marketplace or share-string format.
- No component-level `codeThemeId` checks outside theme derivation.
- No redesign of app layout or typography controls.
- No syntax-highlighting theme rewrite.
- No requirement to manually screenshot every theme before shipping.

## Acceptance Criteria

- Every theme shipping with JCode emits complete app-depth tokens for every available variant.
- Catppuccin depth values remain stable unless intentionally adjusted by tests.
- Representative themes have deterministic expected profile values in tests.
- Custom/imported themes continue to use a complete fallback derivation.
- High-impact app surfaces remain wired through semantic app-depth tokens, not theme-specific component checks.
- Browser QA confirms visibly distinct shell layers across representative light, dark, warm, cool, and saturated themes.
