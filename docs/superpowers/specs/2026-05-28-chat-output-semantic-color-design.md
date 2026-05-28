# Chat Output Semantic Color Design

| Field           | Value                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| Status          | Approved                                                                                                             |
| Type            | Design specification                                                                                                 |
| Owner           | Engineering                                                                                                          |
| Audience        | Maintainers and automation agents                                                                                    |
| Canonical path  | `docs/superpowers/specs/2026-05-28-chat-output-semantic-color-design.md`                                             |
| Last reviewed   | 2026-05-28                                                                                                           |
| Review cadence  | Event-driven; review when porting semantic chat-color roles to another bundled theme or changing Markdown output     |
| Source of truth | Screenshot review, `CONTEXT.md`, `apps/web/src/components/ChatMarkdown.tsx`, and `apps/web/src/theme/theme.logic.ts` |

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans before implementation. For implementation, use frontend-design, test-driven-development, webapp-testing, verification-before-completion, and aikido-security.

**Goal:** Improve Catppuccin chat-output scannability by adding subtle semantic color roles to Markdown output without making ordinary prose colorful or noisy.

## Context

The Catppuccin theme-depth pass improved shell surfaces: sidebar, topbar, composer, changed-files cards, toasts, and Settings preview. The attached visual review shows the remaining flatness is inside assistant output: headings, paths, CSS variables, commands, statuses, and errors all read as similar neutral text or gray inline-code chips.

JCode already renders assistant Markdown through `ChatMarkdown.tsx` and shared CSS in `index.css`. Inline code is currently styled uniformly, links use generic accent tokens, and code blocks use the existing highlighter theme path. This design improves the chat transcript layer while preserving the existing compact theme model.

## Decisions

- Optimize chat-output scannability first and Catppuccin palette faithfulness second.
- Use subtle accents only: headings, links, inline-code roles, and statuses may receive color; body text remains calm.
- Color inline code chips by detected meaning when the pattern is obvious.
- Use conservative detection. Unknown inline code remains neutral.
- Prove the grammar on Catppuccin first, but define a role-token cookbook so other themes can map their palettes later.
- Keep existing code-block syntax highlighting for this pass; only align code-block container chrome with the Catppuccin surface system.

## Role Cookbook

Semantic roles are stable. Themes map palette values into these roles rather than adding component-specific theme forks.

| Role         | Meaning                                               | Catppuccin direction  |
| ------------ | ----------------------------------------------------- | --------------------- |
| Chat heading | Section labels and Markdown headings                  | Mauve or blue         |
| Chat link    | External links and navigational references            | Blue                  |
| Chat file    | File paths and route-like references                  | Blue                  |
| Chat token   | CSS variables, theme tokens, environment-like symbols | Teal or sky           |
| Chat command | Shell commands and executable snippets                | Lavender/mauve        |
| Chat success | Passed, completed, not blocked, success states        | Green                 |
| Chat warning | Pending, in progress, caution states                  | Yellow or peach       |
| Chat error   | Failed, blocked, task not found, error states         | Red                   |
| Chat neutral | Unknown inline code                                   | Existing neutral chip |

## Detection Rules

Classification must be conservative and deterministic.

- File paths: classify only obvious paths with separators or known extensions, such as `apps/web/src/index.css`, `src/theme/theme.logic.ts`, `_chat.$threadId.tsx`, or `README.md`.
- Theme tokens: classify only obvious CSS/custom-property tokens like `--app-surface-canvas`, `--color-border-light`, or `var(--app-state-hover)`.
- Commands: classify only obvious command snippets such as `snip bun run ...`, `bun run ...`, `git status`, `npm run ...`, or `python3 ...`.
- Success: classify exact or near-exact status values such as `passed`, `completed`, `green`, `not blocked`, or `86 passed`.
- Warning: classify exact or near-exact state values such as `pending`, `in_progress`, `in progress`, or `blocked?` only when not clearly an error.
- Error: classify exact or near-exact failure strings such as `failed`, `error`, `blocked`, `task not found`, or `red`.
- Otherwise, render as neutral inline code.

## Visual Boundaries

- Body paragraphs, ordinary list text, and long explanations stay neutral.
- A typical paragraph or list block should show only two to three accent colors unless the content itself contains many statuses.
- Color should come from low-alpha backgrounds, borders, and text accents, not saturated full blocks.
- Headings should gain subtle hierarchy, not decorative banners.
- Code-block containers may use Catppuccin-aligned surfaces and copy-button chrome, but syntax highlighting remains unchanged in this pass.

## Acceptance Criteria

- In a screenshot-like assistant response, headings, file paths, theme tokens, statuses, and errors are distinguishable at a glance.
- Ordinary prose remains neutral and readable.
- Unknown inline code remains neutral.
- Catppuccin has a complete role-token mapping for chat-output roles.
- The implementation path leaves a reusable cookbook for porting roles to other themes.
- Existing Markdown behavior, local file links, math rendering, image rendering, and code-block copy behavior remain intact.

## Non-Goals

- Do not add a Settings toggle in this pass.
- Do not rewrite the full Markdown renderer.
- Do not switch syntax highlighting themes yet.
- Do not apply heavy transcript cards or colorful section bands.
- Do not color all themes until Catppuccin proves the role grammar.
