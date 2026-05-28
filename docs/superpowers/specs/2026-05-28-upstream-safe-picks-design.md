# Upstream Safe Picks Design

## Context

JCode treats DPCode and T3Code as source material, not merge targets. The upstream watch dry run on 2026-05-28 found new DPCode and T3Code pull requests and releases, including DPCode v0.0.48/v0.0.49 and T3Code v0.0.24/nightly activity.

The current checkout is on `main` with unrelated sidebar visual changes. Import work should happen in an isolated `feature/*` branch or worktree and should not bulk-merge either upstream.

## Goal

Import the highest-confidence upstream improvements that are useful for JCode, small enough to validate quickly, and compatible with JCode's local-first cockpit model.

## Non-Goals

- Do not merge `upstream-dpcode/main` or `upstream-t3code/main` wholesale.
- Do not import broad provider expansions such as Grok, Pi, or Hermes in this first pass.
- Do not import DPCode's large orchestration, snapshot, and diff-performance sweep in this first pass.
- Do not advance `.jcode/upstream-watch` cursors until selected work has been reviewed and either imported or intentionally skipped.

## Candidate Approaches

### Focused Safe Picks

Manually port small fixes that map cleanly onto current JCode files and can be tested independently. This is the recommended first pass.

Benefits: low risk, fast feedback, keeps JCode stable.

Risk: leaves larger performance wins for a later pass.

### DPCode Performance Sweep

Inspect and port DPCode v0.0.48/v0.0.49 work around diff loading, startup hot paths, snapshot caps, and runtime payload memory pressure.

Benefits: potentially high runtime value.

Risk: large server/orchestration surface with many changed files and migrations; should be its own branch and spec.

### Provider Expansion

Inspect Grok/Pi/Hermes and related provider runtime changes.

Benefits: new model/provider capabilities.

Risk: high integration surface and unclear immediate value compared to cockpit reliability fixes.

## Selected Design

Use `Focused Safe Picks` for the first import batch.

Initial candidates:

- T3Code #2817: prevent Enter from submitting during IME composition in `ComposerPromptEditor.tsx`.
- T3Code #2694/#2825: decode auth/session date fields from JSON strings if JCode's contracts still use raw `DateTimeUtc` schemas.
- T3Code #2781: fix Windows provider-update command behavior if JCode still has the same provider maintenance runner.
- T3Code #2816: reduce terminal drawer resize rerenders if the current `ThreadTerminalDrawer.tsx` structure matches closely.
- T3Code #2827: provider instance dialog render optimization only if JCode has an equivalent component; otherwise skip.
- DPCode #113: create-PR availability guard only if JCode has not already implemented equivalent logic.

Explicitly defer:

- DPCode #129 / v0.0.49 diff loading and startup hot paths.
- DPCode #126/#127 / v0.0.48 snapshot and runtime payload caps.
- DPCode #128 Grok provider support.
- Large T3Code UI surfaces absent from JCode, such as Add Project command palette tab completion when matching command-palette files are absent.

## Acceptance Criteria

- Each imported fix has a focused test or a documented reason no direct test is practical.
- Imports are manual ports or small cherry-picks, never a broad upstream merge.
- Unrelated sidebar changes on `main` are preserved and not mixed into upstream import commits.
- Focused verification runs for touched workspaces.
- Aikido scans run on changed code files before completion.

## Review Notes

- The dry-run upstream report is local evidence and should not be committed.
- T3Code tag fetches can collide with JCode tags; do not force-update tags.
- DPCode's larger performance work remains valuable but should be handled with a dedicated migration-style plan.
