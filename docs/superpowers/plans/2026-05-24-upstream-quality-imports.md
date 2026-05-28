# Lineage Quality Adaptations Implementation Plan

| Field           | Value                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Canonical path  | `docs/superpowers/plans/2026-05-24-upstream-quality-imports.md`                                                                  |
| Source of truth | [`docs/superpowers/specs/2026-05-24-upstream-quality-imports-design.md`](../specs/2026-05-24-upstream-quality-imports-design.md) |

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt three high-value lineage-project ideas into JCode with local tests and minimal, idiomatic changes.

## File Structure

- [`docs/superpowers/specs/2026-05-24-upstream-quality-imports-design.md`](../specs/2026-05-24-upstream-quality-imports-design.md): approved design for the adaptation tranche.
- `docs/superpowers/plans/2026-05-24-upstream-quality-imports.md`: this implementation plan.
- `apps/web/src/hooks/useTheme.ts`: theme mode resolution and DOM synchronization seam.
- `apps/web/src/hooks/useTheme.test.ts` or existing theme hook/runtime test file: focused tests for repeated theme sync no-op behavior.
- `apps/server/src/provider/Layers/ProviderHealth.ts`: provider update command execution seam.
- `apps/server/src/provider/Layers/ProviderHealth.test.ts`: focused tests that update commands run through a shell on Windows.
- `apps/server/src/checkpointing/Layers/CheckpointDiffQuery.ts`: checkpoint diff query seam for narrow hot-path improvement.
- `apps/server/src/checkpointing/Layers/CheckpointDiffQuery.test.ts`: focused tests for scoped diff reads and stable checkpoint lookup behavior.
- `apps/web/src/components/DiffPanel.tsx`: only touch if server-side diff seam cannot fully address the hot path.

## Tasks

- [ ] Create or update a focused theme sync test that fails because repeated identical theme application rewrites DOM state.
- [ ] Run the focused theme test and confirm the failure is the expected repeated-write assertion.
- [ ] Implement the smallest theme sync no-op cache in `useTheme.ts` or a helper extracted from it.
- [ ] Run the focused theme test and confirm it passes.
- [ ] Create or update a focused provider update test for Windows shell execution.
- [ ] Run the focused provider test and confirm the expected shell assertion.
- [ ] Implement the provider update Windows-shell adaptation in `ProviderHealth.ts` if the test shows it is missing, without changing update locking or result reporting.
- [ ] Run the focused provider test and confirm it passes.
- [ ] Inspect `CheckpointDiffQuery` current tests and choose one narrow DPCode #129 hot-path behavior that is locally testable.
- [ ] Create or update a focused checkpoint diff test that fails for the chosen hot-path behavior.
- [ ] Run the focused checkpoint diff test and confirm the expected failure.
- [ ] Implement the smallest checkpoint/diff adaptation needed to pass the test.
- [ ] Run the focused checkpoint diff test and confirm it passes.
- [ ] Run focused workspace tests for all touched areas.
- [ ] Run the existing workspace scripts: `bun run --cwd apps/web typecheck` (`apps/web/package.json`) and `bun run --cwd apps/server typecheck` (`apps/server/package.json`).
- [ ] Run the root formatter check with touched files passed through to `oxfmt --check`: `bun run fmt:check -- <touched files>`.
- [ ] Run LSP diagnostics for touched TypeScript files through the editor/OpenCode LSP diagnostics tool; this is a manual IDE-agent verification step, not a repo script.
- [ ] Run the external Aikido MCP `aikido_full_scan` on modified first-party code; the repo does not commit Aikido configuration.

## Acceptance Criteria

- [ ] Reapplying the same theme inputs is a no-op while real theme changes still apply.
- [ ] Provider update commands run through a shell on Windows.
- [ ] One narrow diff/checkpoint hot-path improvement is implemented and tested.
- [ ] No upstream branch is merged wholesale or copied 1:1 without local adaptation.
- [ ] All focused verification and security checks pass or are reported with exact evidence.

## Notes

- Keep the slices independently revertible.
- Stop and defer the DPCode diff slice if it expands beyond a narrow tested seam.
- Prefer strengthening existing JCode tests when an upstream idea is already implemented.
