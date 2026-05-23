# React Doctor Refactor Backlog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the existing `apps/web` React Doctor backlog safely, starting with the remaining error-level diagnostics and then addressing warning clusters in behavior-preserving slices.

## Current Baseline

- Latest command: `bunx react-doctor apps/web --yes --fail-on none --json --json-compact --offline`.
- Current total: `699` diagnostics.
- Current severity split: `50` errors and `649` warnings.
- Current errors: all `only-export-components`.
- Highest warning rules: `unused-export` (`104`), `js-combine-iterations` (`63`), `no-adjust-state-on-prop-change` (`52`), `no-event-handler` (`36`), `no-multi-comp` (`32`), `no-chain-state-updates` (`25`), `unused-file` (`23`), `no-derived-state` (`22`), `exhaustive-deps` (`22`), and `no-render-in-render` (`20`).
- Highest-volume files: `src/components/ChatView.tsx`, `src/components/Sidebar.tsx`, `src/routes/_chat.$threadId.tsx`, `src/routes/_chat.settings.tsx`, `src/components/SidebarSearchPalette.tsx`, `src/lib/icons.tsx`, `src/routes/__root.tsx`, `src/components/ui/menu.tsx`, `src/components/ChatMarkdown.tsx`, and `src/components/DiffPanel.tsx`.

## File Structure

- `package.json`: keep existing `react-doctor`, `react-doctor:changed`, and root `test` integration unless a later docs check proves the CLI needs a better changed-file invocation.
- `apps/web/src/routes/*.tsx`: keep TanStack Router route modules thin. Route files should export `Route` and delegate UI, route helpers, validators, and constants to sibling files.
- `apps/web/src/routes/*.route.ts` or `apps/web/src/routes/*.logic.ts`: place route-specific loaders, search validators, params helpers, and pure route logic here when extraction is needed.
- `apps/web/src/routes/*.view.tsx`: place route component trees here when extraction is needed. These files should export React components only where possible.
- `apps/web/src/components/**/*.logic.ts`: place pure helpers currently exported from component modules.
- `apps/web/src/components/**/*.types.ts`: place exported type-only contracts when a component module currently mixes runtime components and shared types.
- `apps/web/src/components/**/*.constants.ts`: place exported constants that are imported outside their component module.
- `apps/web/src/components/**/*.view.tsx`: place extracted subcomponents from giant or multi-component files when they are not broadly reusable.
- `apps/web/src/notifications/taskCompletion.logic.ts`: place notification payload formatting, constants, or helper exports currently mixed into `taskCompletion.tsx`.
- `apps/web/src/lib/icons.tsx`: split generated or hand-maintained icon exports only after reference checks prove which exports are unused or should move.
- `docs/superpowers/plans/2026-05-23-react-doctor-refactor-backlog.md`: this execution plan.

## Rules Of Engagement

- Do not edit generated router artifacts or anything under `dist/`.
- Do not delete an export or file solely because React Doctor reports it unused; confirm with `grep`, TypeScript, and where useful LSP references.
- Do not combine unrelated warning families in one commit-sized chunk.
- Prefer moving helpers and constants over changing behavior.
- Prefer pure logic extraction plus focused tests before changing component state or effect semantics.
- Keep route refactors behavior-preserving. If TanStack Router requires an export shape that conflicts with React Doctor, document and configure a narrow exception rather than contorting route files.

## Phase 1: Refresh The Diagnostic Baseline

- [x] Run `bunx react-doctor apps/web --yes --fail-on none --json --json-compact --offline > /tmp/opencode/react-doctor-current.json`.
- [x] Parse `/tmp/opencode/react-doctor-current.json` into counts by severity, rule, and file.
- [x] Save the parsed summary in the work log or final implementation notes.
- [x] Confirm the error set is still exclusively `only-export-components` before starting Phase 2.
- [ ] If new `rules-of-hooks` or other correctness errors appear, stop Phase 2 and fix those first.

## Phase 2: Clear Non-Route `only-export-components` Errors

- [x] Inspect `apps/web/src/components/chat-drop-overlay/ChatPaneDropOverlay.tsx` and identify each exported non-component at the reported lines.
- [x] Move reusable pure helpers from `ChatPaneDropOverlay.tsx` into `ChatPaneDropOverlay.logic.ts`.
- [x] Update imports in `ChatPaneDropOverlay.tsx` and `ChatPaneDropOverlay.test.tsx`.
- [x] Run `bun run --cwd apps/web test src/components/chat-drop-overlay/ChatPaneDropOverlay.test.tsx`.
- [x] Inspect `apps/web/src/components/chat/ComposerCommandMenu.tsx` and identify the reported exported helper.
- [x] Move `ComposerCommandMenu.tsx` exported non-component logic into `ComposerCommandMenu.logic.ts`.
- [x] Add or update a focused logic test if the moved helper has branching behavior.
- [x] Inspect `apps/web/src/components/Sidebar.tsx` and identify the reported exported helper or type.
- [x] Move runtime helper exports from `Sidebar.tsx` into `Sidebar.logic.ts`; move type-only exports into `Sidebar.types.ts` if needed.
- [x] Run existing `Sidebar` focused tests, especially `Sidebar.logic.test.ts` and `Sidebar.uiState.test.ts`.
- [x] Inspect `apps/web/src/components/chat/ProviderModelPicker.tsx` and identify exported constants such as provider option lists.
- [x] Move exported constants from `ProviderModelPicker.tsx` into `ProviderModelPicker.constants.ts` or existing provider registry files if that is the established location.
- [x] Run `bun run --cwd apps/web test src/components/chat/composerProviderRegistry.test.tsx` if provider selection behavior is touched.
- [x] Inspect `apps/web/src/components/chat/MentionChipIcon.tsx` and move exported non-component values into `MentionChipIcon.logic.ts` or `MentionChipIcon.types.ts`.
- [x] Inspect `apps/web/src/components/chat/ChatTranscriptPane.browser.tsx`.
- [x] If the browser wrapper only exists to lazy-load or gate browser APIs, move local React components into `ChatTranscriptPane.tsx` or `ChatTranscriptPane.view.tsx` and keep the browser file as a thin component-only export.
- [x] Inspect `apps/web/src/components/chat/TraitsPicker.browser.tsx`.
- [x] Move local components or helpers from `TraitsPicker.browser.tsx` into `TraitsPicker.tsx`, `TraitsPicker.view.tsx`, or `TraitsPicker.logic.ts` according to responsibility.
- [x] Inspect `apps/web/src/notifications/taskCompletion.tsx`.
- [x] Move notification helper exports into `taskCompletion.logic.ts` and keep the `.tsx` file component-only if it renders React UI.
- [x] Run `bunx react-doctor apps/web --yes --fail-on none --json --json-compact --offline` and verify non-route `only-export-components` errors are cleared.
- [x] Run `bun run --cwd apps/web typecheck`.
- [x] Run focused tests for every touched component or logic file.

## Phase 3: Handle Route Module `only-export-components`

- [x] Inspect each route file with current errors: `_chat.$threadId.tsx`, `__root.tsx`, `_chat.settings.tsx`, `_chat.tsx`, `_chat.index.tsx`, `_chat.workspace.$workspaceId.tsx`, `_chat.workspace.index.tsx`, and `pair.tsx`.
- [ ] In progress: For each route, list exports and classify them as required TanStack Router exports, route UI components, loader/search logic, constants, or types.
- [ ] For `_chat.$threadId.tsx`, move route UI into `_chat.$threadId.view.tsx` and pure route helpers into `_chat.$threadId.logic.ts`.
- [ ] Update `_chat.$threadId.tsx` so it imports the route view and helper functions and exports only what TanStack Router requires.
- [ ] Run focused tests that cover chat thread loading, if present.
- [ ] For `__root.tsx`, move root layout UI into `__root.view.tsx` and pure helpers into `__root.logic.ts`.
- [ ] Verify global providers, error boundaries, and devtools behavior still mount correctly.
- [x] For `_chat.settings.tsx`, move settings page UI into a route-ignored settings view file.
- [x] Run focused settings tests if present; otherwise use typecheck plus manual browser verification.
- [x] For `_chat.tsx`, `_chat.index.tsx`, workspace route files, and `pair.tsx`, repeat the thin-route-module extraction pattern.
- [ ] Run React Doctor again and record remaining route `only-export-components` diagnostics.
- [ ] If route files still report `only-export-components` solely because of the required exported `Route` constant, research React Doctor config support for narrow rule ignores.
- [ ] If React Doctor supports ignores, add the narrowest possible ignore for `only-export-components` on `apps/web/src/routes/**/*.tsx` and document why TanStack Router route modules are exempt.
- [ ] If React Doctor does not support ignores, document route false positives in the plan notes and keep full scan report-only.
- [ ] Run `bun run --cwd apps/web typecheck`.
- [ ] Run `bun run --cwd apps/web test` or the closest focused route/component test set.

## Phase 4: Remove Confirmed Dead Exports And Files

- [ ] Generate a list of `unused-export` and `unused-file` diagnostics from the current React Doctor JSON.
- [ ] Exclude generated files and route artifacts from deletion candidates.
- [ ] For each candidate export, check code references with `grep` and LSP references before editing.
- [ ] Remove private dead exports by converting them to unexported declarations when still used locally.
- [ ] Delete truly unused files only after confirming they are not dynamically imported, referenced by route generation, or used by tests/story-like tooling.
- [ ] Run `bun run --cwd apps/web typecheck` after each small deletion batch.
- [ ] Run focused tests for affected areas.
- [ ] Run React Doctor and record the new `unused-export` and `unused-file` counts.

## Phase 5: Mechanical Performance Warnings

- [ ] Address `js-combine-iterations` in files with clear adjacent array passes and no side effects.
- [ ] Address `js-set-map-lookups` where repeated array searches can become a local `Set` or `Map` without changing ordering semantics.
- [ ] Address `async-await-in-loop` only when operations are independent and safe to parallelize.
- [ ] Address `async-defer-await` where removing eager `await` does not alter error timing or loading behavior.
- [ ] Keep each change local to one file or one feature area.
- [ ] Add or update pure logic tests when transforming data processing code.
- [ ] Run focused tests after each warning family batch.
- [ ] Run React Doctor and record count changes for the mechanical warning rules.

## Phase 6: Component Extraction For Large Files

- [ ] Start with `src/components/ChatView.tsx` because it has the highest diagnostic count.
- [ ] Identify seams in `ChatView.tsx`: data loading, session lifecycle state, composer state, panel layout, terminal/browser panel state, and rendering-only subtrees.
- [ ] Extract pure helper logic from `ChatView.tsx` into `ChatView.logic.ts` first.
- [ ] Add focused tests for any newly extracted ChatView logic with non-trivial branching.
- [ ] Extract rendering-only subcomponents from `ChatView.tsx` into colocated `ChatView.*.tsx` files only after logic extraction is stable.
- [ ] Keep state ownership in `ChatView.tsx` until tests prove it is safe to move into hooks.
- [ ] Repeat the same approach for `src/components/Sidebar.tsx`.
- [ ] Repeat the same approach for `src/components/SidebarSearchPalette.tsx`.
- [ ] Repeat the same approach for `src/components/DiffPanel.tsx`.
- [ ] Run focused tests after each extraction.
- [ ] Run browser verification for visible layout or interaction changes.
- [ ] Run React Doctor and record changes for `no-giant-component` and `no-multi-comp`.

## Phase 7: State And Effect Semantics

- [ ] Triage `no-adjust-state-on-prop-change`, `no-derived-state`, `no-derived-state-effect`, `no-chain-state-updates`, `no-cascading-set-state`, `exhaustive-deps`, `no-event-handler`, and `no-render-in-render` together per file.
- [ ] Start with `ChatView.tsx` only after Phase 6 has reduced its size enough to reason about safely.
- [ ] For each state diagnostic, classify whether the state is derived display state, user-editable draft state, cached external state, or imperative integration state.
- [ ] Replace derived state with direct derivation during render only when it is pure and cheap.
- [ ] Replace prop-change synchronization with reducer actions only when state is genuinely user-editable or cross-eventful.
- [ ] Use refs only for imperative handles and previous-value tracking that does not affect rendering.
- [ ] Fix `exhaustive-deps` warnings by making dependencies correct, not by suppressing them.
- [ ] For event handlers, use normal callbacks for user events and `useEffectEvent` only for effect-owned callbacks where React 19 semantics are intended.
- [ ] Add regression tests around any state transition that changes behavior risk.
- [ ] Run focused tests and manual browser QA after each file.
- [ ] Run React Doctor and record changes for state and effect rules.

## Phase 8: UI, A11y, And Design Warnings

- [ ] Triage accessibility warnings such as `control-has-associated-label` and `prefer-tag-over-role` before visual design warnings.
- [ ] Fix unlabeled controls with visible labels, `aria-label`, or `aria-labelledby` according to the existing component style.
- [ ] Replace redundant roles with semantic elements where behavior remains equivalent.
- [ ] Address design warnings such as redundant padding/size axes only in touched components and only when snapshots or visual QA confirm no regression.
- [ ] Run browser verification for visible UI changes.
- [ ] Run relevant focused tests and React Doctor after each UI/a11y batch.

## Phase 9: Integration And Enforcement Tightening

- [ ] Once error count is zero or only documented route exceptions remain, run `bun run react-doctor` and save the summary.
- [ ] Run `bun run react-doctor:changed` and confirm it exits successfully on the refactor branch.
- [ ] Decide whether `react-doctor:changed` should fail on `warning` or `error` based on how much warning backlog remains in touched files.
- [ ] If warning backlog remains in high-churn files, keep changed-file gating but document known residual warnings and owner rationale.
- [ ] If warning count is low and stable, keep `--fail-on warning` as currently configured.
- [ ] Run `bun run --cwd apps/web typecheck`.
- [ ] Run focused unit tests for touched areas.
- [ ] Run `bun run --cwd apps/web test` when the touched area is broad enough to justify the full web test suite.
- [ ] Run root `bun run test` once at the end if runtime is acceptable, because the root script includes the React Doctor changed-file gate.
- [ ] Run `git diff --check`.
- [ ] Run Aikido SAST/secrets scan on all modified first-party code files.

## Suggested Work Slices

- [ ] Slice 1: Clear non-route `only-export-components` errors.
- [ ] Slice 2: Thin TanStack route files and decide whether route exceptions are required.
- [ ] Slice 3: Remove confirmed dead exports/files.
- [ ] Slice 4: Apply mechanical data-processing performance fixes.
- [ ] Slice 5: Split `ChatView.tsx` into smaller logic and view units.
- [ ] Slice 6: Split `Sidebar.tsx`, `SidebarSearchPalette.tsx`, and `DiffPanel.tsx`.
- [ ] Slice 7: Fix state/effect warnings in the now-smaller high-risk components.
- [ ] Slice 8: Fix accessibility and low-risk design warnings.
- [ ] Slice 9: Revisit integration thresholds and document remaining exceptions.

## Final Verification Checklist

- [ ] `bunx react-doctor apps/web --yes --fail-on none --json --json-compact --offline` produces the expected reduced summary.
- [ ] `bun run react-doctor:changed` passes or has a documented reason for any residual changed-file warning.
- [ ] `bun run --cwd apps/web typecheck` passes.
- [ ] Focused tests for every touched area pass.
- [ ] `bun run --cwd apps/web test` passes if the change touched shared UI, routes, or high-risk state logic.
- [ ] Browser/manual QA covers any visible UI behavior changes.
- [ ] `git diff --check` passes.
- [ ] Aikido scan reports no issues for modified first-party code.

## Notes For Implementers

- The safest first milestone is zero non-route error diagnostics. Do not start broad warning cleanup until that milestone is complete.
- Route files are special because TanStack Router requires route-module exports. Extract route views and logic first; only add a scoped exception if the required `Route` export remains the only conflict.
- `ChatView.tsx` has the largest warning volume and should not be rewritten in one pass. Extract pure logic first, then rendering-only subtrees, then state/effect semantics.
- Existing focused tests are more valuable than broad snapshots for this work. Add small logic tests when moving code creates new pure seams.
- Do not commit automatically unless explicitly requested.
