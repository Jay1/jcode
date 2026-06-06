# Sentry Theme Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bundled Sentry dark palette with source-backed Sentry product-app dark tokens and keep existing theme contracts intact.

## Files

- `apps/web/src/theme/theme.logic.ts`: update the hand-authored `sentry.dark` depth profile values.
- `apps/web/src/theme/theme.seed.generated.ts`: update the `sentry.dark` seed values used by theme selection and share strings.
- `apps/web/src/theme/theme.logic.test.ts`: update locked palette expectations.
- `apps/web/src/components/ThemeTokens.browser.tsx`: update browser-computed expectation row.

## Steps

- [x] Update the Sentry seed accent, ink, semantic colors, and surface.
- [x] Update the Sentry hand-authored depth palette to match the product token ladder.
- [x] Update unit-test expectations for Sentry's locked depth roles.
- [x] Update browser token fixture expectations for Sentry.
- [x] Run focused theme tests.
- [x] Run focused formatting check on touched files.
