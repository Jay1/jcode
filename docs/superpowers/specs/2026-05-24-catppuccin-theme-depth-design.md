# Catppuccin Theme Depth Design

| Field           | Value                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| Status          | Approved                                                                                                     |
| Type            | Design specification                                                                                         |
| Owner           | Engineering                                                                                                  |
| Audience        | Maintainers and automation agents                                                                            |
| Canonical path  | `docs/superpowers/specs/2026-05-24-catppuccin-theme-depth-design.md`                                         |
| Last reviewed   | 2026-05-24                                                                                                   |
| Review cadence  | Event-driven; review when adding richer theme levers or porting depth to another bundled community theme     |
| Source of truth | Catppuccin palette/style guide, JCode theme logic, screenshot review, and existing web component conventions |

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans before implementation. For implementation, use frontend-design, test-driven-development, webapp-testing, verification-before-completion, and aikido-security.

**Goal:** Make Catppuccin feel like a high-quality client-facing app theme by adding restrained semantic depth tokens and applying them to the visible shell surfaces that currently collapse into one flat color.

## Context

The current theme model is intentionally compact: a theme has `surface`, `ink`, `accent`, `contrast`, fonts, translucency, and three semantic colors. `apps/web/src/theme/theme.logic.ts` derives most UI tokens from those few fields. That keeps Settings simple, but it also means the sidebar, main transcript canvas, top bar, cards, toast, changed-files list, and composer can share nearly identical dark tones.

Catppuccin has enough official palette structure to do better without making the UI noisy. Its style guide separates background pane, secondary panes, surface elements, overlays, text, subtext, and accents. The VS Code port also shows a useful pattern: app chrome is mostly neutral surface layering, with accent colors reserved for focus, active state, git/diff/status, and selected affordances.

## Problems To Solve

- The screenshot shows too many app surfaces at nearly the same luminance.
- Active thread, selected tabs, changed-files rows, toast, top bar, and composer need clearer hierarchy.
- Settings exposes only shallow levers, so richer theme quality has no stable app token model to build on.
- Any improvement must stay restrained: no rainbow UI, no per-component hardcoded palette spread, and no one-off Catppuccin-only CSS hacks.

## Design

Add a semantic app-depth token layer derived from the existing theme pack. Catppuccin gets the first hand-tuned mapping using Latte and Mocha palette roles. Other themes keep compatible derived fallbacks from existing `surface`, `ink`, `accent`, `contrast`, and semantic colors.

### Token Groups

- Shell surfaces: `--app-surface-canvas`, `--app-surface-sidebar`, `--app-surface-topbar`, `--app-surface-panel`, `--app-surface-card`, `--app-surface-card-header`, `--app-surface-composer`.
- Interaction states: `--app-state-hover`, `--app-state-selected`, `--app-state-selected-border`, `--app-state-focus`.
- Semantic panels: `--app-status-error-bg`, `--app-status-error-border`, `--app-status-warning-bg`, `--app-diff-card-bg`, `--app-diff-card-header-bg`.
- Accent hints: `--app-accent-soft`, `--app-accent-muted`, `--app-accent-strong`.

These tokens are app-facing aliases. They should be generated in `theme.logic.ts` and emitted through `useTheme.ts` like existing CSS variables.

### Catppuccin Mapping

Use official roles, not arbitrary color choices:

- Dark Catppuccin should align to Mocha: `crust` for app canvas, `mantle` for sidebar/topbar, `base` for cards/composer, `surface0/1` for hover/selected, `overlay0/1` for borders, `text/subtext` for content, `mauve` for primary accent, `lavender/blue` for focus/information, `green/red/yellow/peach` for diff/status.
- Light Catppuccin should align to Latte: `base` for app canvas, `mantle/crust` for secondary panes where useful, `surface0/1` for cards and hover, `mauve/blue` for active/focus, and same semantic status roles.

### Surface Wiring

Apply new tokens to high-impact visible surfaces:

- Sidebar shell and selected/hover thread rows.
- Top chat header and toolbar buttons.
- Transcript canvas and major assistant summary cards.
- Changed-files card header and rows.
- Toast root and error/warning/success variants.
- Composer container/focus border.
- Settings theme preview/editor so users can see/edit richer distinctions.

### Settings Levers

First implementation should not add a large custom theme editor overhaul. It should expose enough evidence in Settings to validate the richer system:

- Keep existing controls for accent/background/foreground/contrast.
- Add a compact preview strip/card that displays the derived depth ladder for the active pack.
- Avoid adding many new editable fields until Catppuccin proves the token model.

## Non-Goals

- No complete redesign of app layout.
- No new theme marketplace/import format.
- No full editor syntax theme rewrite.
- No porting every bundled theme in this first pass.
- No hardcoded component-level Catppuccin checks outside theme derivation.

## Acceptance Criteria

- Catppuccin dark and light seeds use official palette values for base surfaces and semantic colors.
- `buildThemeCssVariables` emits app-depth tokens with deterministic values.
- Existing default/non-Catppuccin themes continue to produce valid app-depth tokens.
- Screenshot-visible surfaces have visibly distinct layers in Catppuccin without excessive accent color.
- Settings shows a useful theme depth preview.
- Focused unit tests cover Catppuccin depth tokens and fallback derivation.
- Browser QA captures the app in Catppuccin dark and verifies sidebar, topbar, toast/card/composer surfaces are visually distinct.
