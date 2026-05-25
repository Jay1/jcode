# Keybindings Settings Implementation Plan

| Field  | Value                                                                             |
| ------ | --------------------------------------------------------------------------------- |
| Status | Draft                                                                             |
| Date   | 2026-05-24                                                                        |
| Design | [Keybindings Settings Design](../specs/2026-05-24-keybindings-settings-design.md) |

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class Settings → Keybindings editor that lets users search, inspect, edit, reset, and troubleshoot shortcuts without opening JSON for routine changes.

## File Structure

- `packages/contracts/src/server.ts`: add reset-keybindings input/result contracts if missing.
- `packages/contracts/src/ws.ts` or the contracts file that defines `WS_METHODS`: add `serverResetKeybindings` only if there is no reset method already.
- `apps/server/src/keybindings.ts`: add a service method for removing a custom binding/resetting all custom bindings if current `upsertKeybindingRule` is not enough.
- `apps/server/src/wsRpc.ts`: expose reset methods through the server RPC group and keep config update stream semantics.
- `apps/server/src/keybindings.test.ts`: cover reset/remove behavior at the service level.
- `apps/web/src/keybindingsCatalog.ts`: new pure catalog of editable built-in commands, labels, descriptions, categories, and whether a command is Phase 1 editable.
- `apps/web/src/keybindingsSettings.ts`: new pure helpers for grouping, filtering, source-state derivation, key recorder validation, and conflict detection.
- `apps/web/src/keybindingsSettings.test.ts`: focused tests for filters, custom/default state, conflict detection, and recorder safety rules.
- `apps/web/src/components/KeybindingsSettingsPanel.tsx`: new Settings panel UI for search, filters, grouped rows, recorder, resets, and open-file escape hatch.
- `apps/web/src/components/KeybindingsSettingsPanel.test.tsx` or focused browser/unit tests if an existing pattern fits: cover the main edit/reset interactions without over-testing styling.
- `apps/web/src/settingsNavigation.ts`: add the `keybindings` settings section.
- `apps/web/src/routes/_chat.settings.tsx`: route `activeSection === "keybindings"` to the new panel, pass server config and editor-opening dependencies, and remove the old primary Advanced keybindings row or demote it to a compact escape hatch.
- `apps/web/src/wsNativeApi.ts`: expose any new server reset method on the native API wrapper.
- `apps/web/src/lib/serverReactQuery.ts`: add mutation helpers only if the panel needs reusable query invalidation logic.

## Implementation Assumptions

- Phase 1 edits built-in static commands only. Project-script commands remain visible/read-only or deferred until script labels and grouping are reliable.
- Extract a standalone `KeybindingsSettingsPanel` immediately; do not make `_chat.settings.tsx` larger than necessary.
- Clearing a shortcut means reset-to-default, not intentional unbind.
- Raw `when` expressions remain read-only in Phase 1.
- Existing `keybindings.json` remains the durable source and advanced escape hatch.

## Acceptance Criteria

- Settings navigation includes **Keybindings** as a first-class section.
- The section shows searchable grouped built-in commands with labels, command ids, active shortcut labels, context conditions, and source states.
- Users can filter all/customized/conflicted commands.
- Users can record a new shortcut for a known built-in command.
- Ordinary letter/number shortcuts require at least one modifier; function/navigation keys can be recorded without modifiers when safe.
- Users see the affected command before saving a conflicting shortcut.
- Users can reset one command back to default.
- Users can reset all custom keybindings back to defaults with confirmation.
- Existing invalid keybinding config issues remain visible and the raw file escape hatch remains available.
- Runtime shortcut behavior continues to use server-provided resolved keybindings.
- Focused tests, web typecheck, scripts/server tests touched by RPC changes, LSP diagnostics, Aikido scan, and manual settings QA pass.

## Tasks

### 1. Map Contracts And Existing RPC Behavior

- [x] Read `packages/contracts/src/keybindings.ts`, `packages/contracts/src/server.ts`, and the contracts file defining `WS_METHODS`.
- [x] Confirm whether `serverUpsertKeybinding` is enough for Phase 1 edits or whether reset/remove RPCs are required.
- [x] Write down the minimal contract additions needed before editing code.
- [x] Commit nothing yet.

### 2. Add Server Reset/Remove Support With TDD

- [x] Write failing tests in `apps/server/src/keybindings.test.ts` for resetting one command to default by removing its custom rule.
- [x] Run the focused server keybindings test and confirm the new test fails for the expected reason.
- [x] Add the minimal `Keybindings` service method needed to remove one custom rule by command.
- [x] Run the focused server keybindings test and confirm it passes.
- [x] Write failing tests for resetting all custom rules if no existing helper covers this.
- [x] Implement the reset-all service method.
- [x] Run the focused server keybindings tests.

### 3. Expose Server RPCs

- [x] Add contract schemas for reset-one/reset-all inputs and results, if needed.
- [x] Add `WS_METHODS` entries, if needed.
- [x] Wire handlers in `apps/server/src/wsRpc.ts`.
- [x] Update `apps/web/src/wsNativeApi.ts` so the web app can call the methods.
- [x] Add or update focused RPC/native API tests if existing test patterns cover server methods.
- [x] Run focused contract/server/web API tests.

### 4. Build A Pure Keybindings Catalog

- [x] Create `apps/web/src/keybindingsCatalog.ts` with editable built-in commands grouped by category.
- [x] Include labels and descriptions aligned with `shortcutsSheet.ts` where possible.
- [x] Mark project-script commands as deferred/read-only for Phase 1.
- [x] Add tests or assertions that every catalog command is a valid `KeybindingCommand`.

### 5. Build Pure Settings Helpers With TDD

- [x] Create `apps/web/src/keybindingsSettings.test.ts`.
- [x] Write failing tests for source-state derivation: default, custom, unavailable, invalid.
- [x] Implement source-state derivation in `apps/web/src/keybindingsSettings.ts`.
- [x] Write failing tests for search and all/customized/conflicted filters.
- [x] Implement filtering.
- [x] Write failing tests for recorder safety rules.
- [x] Implement recorder safety validation.
- [x] Write failing tests for shortcut conflict detection using platform/context-aware semantics.
- [x] Implement conflict detection by reusing existing keybinding helper behavior where possible.
- [x] Run focused web helper tests.

### 6. Add Settings Navigation

- [x] Add `keybindings` to `SETTINGS_SECTION_IDS` in `apps/web/src/settingsNavigation.ts`.
- [x] Add a nav item labeled `Keybindings` with a keyboard/command-oriented icon already available in `lib/icons`.
- [x] Run focused typecheck or LSP diagnostics for settings navigation.

### 7. Build `KeybindingsSettingsPanel`

- [x] Create `apps/web/src/components/KeybindingsSettingsPanel.tsx`.
- [x] Render search input, filter tabs/buttons, grouped command rows, source badges, shortcut labels, context text, and open-file action.
- [x] Use existing `ShortcutKbd`, `Button`, `Input`, tooltip/dialog primitives, and current settings visual language.
- [x] Keep project-script commands read-only or omitted in Phase 1 per design assumptions.
- [x] Add a key recorder interaction that captures keydown, normalizes to a keybinding rule, and shows validation/conflict messages before save.
- [x] Call `api.server.upsertKeybinding` for save.
- [x] Call reset-one/reset-all methods for reset actions.
- [x] Invalidate or update `serverConfigQueryOptions()` data after successful saves/resets.
- [x] Show server config issues and “Open keybindings file” when invalid config exists.

### 8. Integrate Panel Into Settings Route

- [x] Import `KeybindingsSettingsPanel` in `_chat.settings.tsx`.
- [x] Pass server config keybindings, issues, config path, available editors, and open-file callback/dependencies.
- [x] Route `activeSection === "keybindings"` to the new panel.
- [x] Remove the old full Advanced keybindings row or reduce it to a small advanced escape-hatch mention to avoid duplicate primary surfaces.
- [x] Verify settings header/search/navigation still works.

### 9. UI Tests And Manual QA

- [ ] Add a focused component/browser test for search/filter rendering if current test setup supports it without excessive harness work.
- [ ] Add a focused interaction test for save/reset if the native API can be mocked cleanly.
- [x] Run `bun run --cwd apps/web test keybindingsSettings.test.ts` or equivalent focused tests.
- [x] Run `bun run --cwd apps/web typecheck`.
- [x] Run LSP diagnostics for `apps/web/src/components/KeybindingsSettingsPanel.tsx` and `_chat.settings.tsx`.
- [x] Manually inspect Settings → Keybindings in the app if a local dev session is already available; otherwise document that manual QA was not run.

### 10. Security And Completion

- [x] Run Aikido scan on changed first-party code files.
- [x] Run focused formatting checks for touched files.
- [ ] Review `git diff` for accidental generated/router artifacts or local state.
- [x] Update the implementation plan checkboxes as tasks complete.
- [ ] Commit in logical chunks: contracts/server reset support, pure web helpers, UI integration, docs/spec updates.
