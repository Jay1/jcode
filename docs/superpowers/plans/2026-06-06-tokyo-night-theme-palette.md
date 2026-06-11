# Tokyo Night Theme Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace JCode's bundled Tokyo Night dark palette with faithful upstream `tokyo-night-vscode-theme` Night values.

## Files

- `apps/web/src/theme/theme.logic.ts`: update hand-authored Tokyo Night app-depth roles.
- `apps/web/src/theme/theme.seed.generated.ts`: update Tokyo Night seed accent, ink, surface, and semantic colors.
- `apps/web/src/theme/theme.logic.test.ts`: update Tokyo Night locked expectations.
- `apps/web/src/components/ThemeTokens.browser.tsx`: update browser token expectations.

## Steps

- [x] Update Tokyo Night seed values from upstream Night palette.
- [x] Update Tokyo Night app-depth hand-authored palette.
- [x] Update unit and browser test expectations.
- [x] Run focused theme tests.
- [x] Run focused formatting checks.
