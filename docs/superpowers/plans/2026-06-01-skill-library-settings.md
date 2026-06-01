# Skill Library Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings-native Skill Library that shows installed provider skills with a featured rail, dense searchable inventory, source filters, and read-only v1 management seams.

## Files

- `apps/web/src/settingsNavigation.ts`: add the `skills` settings section.
- `apps/web/src/settingsNavigation.test.ts`: prove the new section is normalized and represented in nav.
- `apps/web/src/lib/skillLibrary.ts`: pure helpers for provider-tagged skill rows, search filtering, counts, and featured selection.
- `apps/web/src/lib/skillLibrary.test.ts`: TDD coverage for aggregation/filtering behavior.
- `apps/web/src/components/SkillLibrarySettingsPanel.tsx`: dedicated Settings panel using provider discovery queries and dense UI.
- `apps/web/src/routes/_chat.settings.tsx`: wire the panel into `/settings`.
- `docs/superpowers/specs/2026-06-01-skill-library-design.md`: already updated; change only if implementation reveals a spec mismatch.

## Steps

- [ ] Write failing settings navigation test for the new `skills` section.
- [ ] Add `skills` nav id/item and verify the settings navigation test passes.
- [ ] Write failing helper tests for aggregating provider skill rows, provider counts, search matching, and featured rows.
- [ ] Implement `skillLibrary.ts` helpers and verify helper tests pass.
- [ ] Create `SkillLibrarySettingsPanel` using existing provider discovery React Query helpers.
- [ ] Wire `skills` into `_chat.settings.tsx` active panel rendering.
- [ ] Run focused unit tests for new helper/nav tests.
- [ ] Run `bun run --cwd apps/web typecheck`.
- [ ] Run browser/manual verification for `/settings?section=skills` once the UI compiles.
