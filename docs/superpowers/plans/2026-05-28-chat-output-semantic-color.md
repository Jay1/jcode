# Chat Output Semantic Color Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a conservative, role-token-based semantic color grammar for Catppuccin chat Markdown output so headings, files, tokens, commands, statuses, and errors are easier to scan without making prose colorful.

## File Map

- `apps/web/src/theme/theme.logic.ts`: Add chat semantic role tokens to `buildThemeCssVariables`, with Catppuccin-first palette mapping and neutral fallbacks for other themes.
- `apps/web/src/theme/theme.logic.test.ts`: Lock down Catppuccin chat role token values and non-Catppuccin token availability.
- `apps/web/src/components/ChatMarkdown.tsx`: Add conservative inline-code role classification and role-specific class names while preserving existing Markdown behavior.
- `apps/web/src/components/ChatMarkdown.test.tsx`: Add regression tests for conservative inline-code classification and unchanged unknown inline code.
- `apps/web/src/index.css`: Style chat headings, links, inline-code role chips, and code-block chrome using role tokens.
- `CONTEXT.md`: Already updated with resolved domain language for chat-output scannability and semantic color roles.
- `docs/superpowers/specs/2026-05-28-chat-output-semantic-color-design.md`: Approved design source.

## Acceptance Criteria

- Catppuccin emits role tokens for chat heading, link, file, token, command, success, warning, error, neutral chip, and code-block chrome.
- Non-Catppuccin themes emit non-empty fallback values for the same role tokens.
- Inline code classification is conservative: obvious roles get classes; ambiguous inline code remains neutral.
- Existing Markdown link rewriting, math rendering, generated image handling, code-block rendering, and copy behavior remain intact.
- Visual QA on a screenshot-like assistant response shows headings, paths, theme tokens, statuses, and errors distinguishable at a glance while body text remains neutral.

## Task 1: Add Theme Role Token Tests

- [ ] Add a failing test in `theme.logic.test.ts` for Catppuccin dark chat role tokens.
- [ ] Assert exact values for the most important Catppuccin roles: heading, file/link, token, command, success, warning, error, neutral chip, and code-block surface/border.
- [ ] Add or extend a non-Catppuccin fallback test to require every chat role token to be present and non-empty.
- [ ] Run `snip bun run --cwd apps/web test src/theme/theme.logic.test.ts` and confirm failures are missing chat role tokens.

## Task 2: Implement Chat Role Tokens

- [ ] Add chat role tokens to the variable object returned by `buildThemeCssVariables`.
- [ ] For Catppuccin, map roles from the existing Catppuccin palette: blue for file/link, teal/sky for tokens, mauve for command/heading, green for success, peach/yellow for warning, red for error, and neutral surface layers for unknown chips/code-block chrome.
- [ ] For non-Catppuccin, derive conservative fallback values from existing accent, semantic colors, warning color, foreground, and surface tokens.
- [ ] Keep role token names generic and theme-portable, such as `--app-chat-file`, `--app-chat-token`, and `--app-chat-success-bg`.
- [ ] Run `snip bun run --cwd apps/web test src/theme/theme.logic.test.ts` and confirm the token tests pass.

## Task 3: Add Inline Code Classification Tests

- [ ] Add tests in `ChatMarkdown.test.tsx` for obvious file paths receiving a file role class.
- [ ] Add tests for CSS/theme tokens receiving a token role class.
- [ ] Add tests for obvious commands receiving a command role class.
- [ ] Add tests for success, warning, and error state strings receiving status role classes.
- [ ] Add a negative test proving ambiguous inline code remains neutral.
- [ ] Run `snip bun run --cwd apps/web test src/components/ChatMarkdown.test.tsx` and confirm failures are missing role class behavior.

## Task 4: Implement Conservative Classification

- [ ] Add a small pure helper in `ChatMarkdown.tsx` that maps inline code text to a role string or `null`.
- [ ] Keep detection ordered from highest-risk semantic statuses to lower-risk structural roles.
- [ ] In the Markdown `code` component, apply `chat-markdown-code--<role>` only for inline code; leave fenced code blocks on the existing `pre` path.
- [ ] Preserve the current rendered text exactly; change only class names.
- [ ] Run `snip bun run --cwd apps/web test src/components/ChatMarkdown.test.tsx` and confirm the classification tests pass.

## Task 5: Style Chat Markdown Roles

- [ ] In `index.css`, update `.chat-markdown :not(pre) > code` to use the neutral chat chip role tokens.
- [ ] Add role classes for file, token, command, success, warning, and error chips with subtle text, background, and border treatment.
- [ ] Add restrained heading styling for `.chat-markdown h1` through `h4` using the heading role token.
- [ ] Update `.chat-markdown a` to use the chat link role token.
- [ ] Align code-block background, border, and copy button chrome with chat code-block role tokens while leaving syntax colors unchanged.
- [ ] Run focused tests again to catch class-name regressions.

## Task 6: Verify And QA

- [ ] Run `snip bun run --cwd apps/web test src/theme/theme.logic.test.ts src/components/ChatMarkdown.test.tsx`.
- [ ] Run `snip bun run --cwd apps/web typecheck`.
- [ ] Run `snip bun run fmt:check -- apps/web/src/theme/theme.logic.ts apps/web/src/theme/theme.logic.test.ts apps/web/src/components/ChatMarkdown.tsx apps/web/src/components/ChatMarkdown.test.tsx apps/web/src/index.css CONTEXT.md docs/superpowers/specs/2026-05-28-chat-output-semantic-color-design.md docs/superpowers/plans/2026-05-28-chat-output-semantic-color.md`.
- [ ] Run `lsp_diagnostics` on modified TS/TSX files.
- [ ] Run Aikido full scan on modified first-party code files with complete contents.
- [ ] Manually QA in browser with a screenshot-like Markdown response containing headings, file paths, CSS variables, commands, success, pending, and error statuses.
- [ ] Confirm body text remains neutral and the transcript does not exceed the subtle accent density agreed in `CONTEXT.md`.
