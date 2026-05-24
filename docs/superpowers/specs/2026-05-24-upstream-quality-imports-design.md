# Upstream Quality Imports Design

| Field           | Value                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Status          | Draft                                                                                          |
| Type            | Design specification                                                                           |
| Owner           | Engineering                                                                                    |
| Audience        | Maintainers and automation agents                                                              |
| Canonical path  | `docs/superpowers/specs/2026-05-24-upstream-quality-imports-design.md`                         |
| Last reviewed   | 2026-05-24                                                                                     |
| Review cadence  | Event-driven; review when DPCode/T3Code import candidates or JCode quality priorities change   |
| Source of truth | `docs/jcode-operating-model.md`, `.jcode/upstream-watch/state.json`, and fetched upstream refs |

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans before implementation. Treat DPCode and T3Code as source material; do not merge or cherry-pick upstream wholesale.

**Goal:** Import the best recent DPCode and T3Code ideas into JCode with high quality, adapting the ideas to JCode seams instead of copying upstream 1:1.

## Context

JCode is synced to `origin/main` after PR #3 and has local upstream watch state recorded for DPCode and T3Code deltas. Recent upstream discovery highlighted:

- DPCode `v0.0.49` and PR #129: diff loading, startup hot paths, projection snapshot query, checkpoint diff query, runtime ingestion, and thread retention improvements.
- T3Code #2760: provider-scoped reasoning/model option preservation.
- T3Code #2779: idempotent theme DOM synchronization.
- T3Code #2781: provider update commands running through a shell on Windows.
- T3Code #2794/#2792/#2780/#2791: render-health, settings navigation, shell snapshot, and Effect idiom work.

Direct inspection found that JCode already has substantial provider-scoped model option preservation tests and behavior in `apps/web/src/composerDraftStore.ts` and `apps/web/src/composerDraftStore.test.ts`, so T3Code #2760 is not the best first import.

## Recommended Import Tranche

| Priority | Source       | Idea                                        | JCode seam                                                                     | Why now                                                |
| -------- | ------------ | ------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| 1        | T3Code #2779 | Idempotent theme DOM synchronization        | `apps/web/src/hooks/useTheme.ts` or adjacent theme runtime helper              | Low risk, removes repeated startup/browser-resume work |
| 2        | T3Code #2781 | Provider update commands use Windows shell  | `apps/server/src/provider/Layers/ProviderHealth.ts`                            | Robustness improvement for Windows updater execution   |
| 3        | DPCode #129  | Targeted diff/checkpoint hot-path reduction | `CheckpointDiffQuery`, `ProjectionSnapshotQuery`, `DiffPanel`, retention seams | High value, but import only a narrow tested subset     |

## Explicit Non-Goals

- Do not merge upstream branches into `main`.
- Do not cherry-pick complete DPCode/T3Code commits without review.
- Do not import provider surface area such as Grok or Hermes in this tranche.
- Do not add React Scan recordings/artifacts as product code.
- Do not rework the whole checkpoint/projection architecture in one change.

## Design

### Slice 1: Idempotent Theme Sync

Add or extend focused tests around theme application so repeated calls with the same `{theme, systemDark}` do not rewrite DOM attributes, color-scheme style, or local storage. Keep the public hook/interface unchanged.

Expected behavior:

- Initial theme application still updates the DOM.
- Changing explicit theme or system dark state still updates the DOM.
- Reapplying the same effective inputs is a no-op.

### Slice 2: Provider Update Windows Shell

Add a server/provider test that runs a provider update command while `process.platform` is `win32`. Then adapt `ProviderHealth` only if needed so update commands execute through a shell on Windows without changing non-Windows command execution.

Expected behavior:

- Provider update commands use `shell: true` on Windows.
- Provider update commands preserve existing non-Windows shell behavior.
- Existing provider update locking and result reporting stays unchanged.
- Failures continue to surface through existing provider update messages.

### Slice 3: Narrow Diff Hot-Path Import

Use DPCode #129 as source material, but import only the smallest local improvement that can be proven with tests. Candidate adaptations:

- Avoid broad checkpoint/diff reads when a selected turn or conversation range is already known.
- Reuse projection snapshot query results through a deeper server-side query seam.
- Keep `DiffPanel` query inputs stable so UI refetches are limited to actual range changes.

Expected behavior:

- Existing diff results remain identical for selected-turn and whole-conversation views.
- Query/cache inputs are stable and scoped.
- New tests cover the targeted hot path before implementation.

## Quality Bar

- Every production change starts with a failing focused test.
- Prefer one small local adaptation per source idea.
- Keep interfaces stable unless the test proves an interface change is needed.
- Preserve JCode naming, contracts, and publishable defaults.
- Run focused tests/typechecks, LSP diagnostics, formatting checks, and Aikido scan for modified first-party code.

## Acceptance Criteria

- [ ] Theme sync repeated-input no-op behavior is tested and implemented.
- [ ] Provider update commands run with resolved provider environment and are tested.
- [ ] One narrow DPCode #129 diff/checkpoint hot-path improvement is tested and implemented.
- [ ] No upstream branch is merged wholesale.
- [ ] No unrelated provider/product surface area is introduced.
- [ ] Verification evidence is captured before completion.

## Open Implementation Notes

- If Slice 3 proves too broad during implementation, stop after Slices 1 and 2 and record DPCode #129 as a separate follow-up.
- If a candidate is already implemented in JCode, add or strengthen tests instead of duplicating upstream structure.
- Keep each slice independently revertible.
