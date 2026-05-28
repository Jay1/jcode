# Upstream Delta Ledger Implementation Plan

| Field     | Value                                     |
| --------- | ----------------------------------------- |
| Title     | Upstream Delta Ledger Implementation Plan |
| Author    | Engineering                               |
| Date      | 2026-05-24                                |
| Status    | Implemented                               |
| Version   | 1.0                                       |
| Reviewers | Maintainers                               |
| Tags      | upstream, automation, local-ledger        |

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-only lineage delta ledger CLI for reviewing new DPCode and T3Code PR/release activity without rechecking all lineage-project history.

## File Structure

- `scripts/upstream-watch.ts`: CLI entrypoint plus testable delta filtering, state persistence, report formatting, and GitHub API client helpers.
- `scripts/upstream-watch.test.ts`: focused tests for cursor filtering, dry-run behavior, and cursor advancement.
- `package.json`: root `upstream:watch` script.
- `.gitignore`: ignore local `.jcode/upstream-watch/` state.
- `docs/runbooks/upstream-watch.md`: usage and workflow runbook.

## Acceptance Criteria

- `bun run upstream:watch -- --dry-run` prints a report and does not write `.jcode/upstream-watch/`.
- A normal run writes `.jcode/upstream-watch/state.json` and one run log.
- A second normal run over unchanged upstream data reports no duplicate deltas.
- The tool never creates branches, commits, merges, or cherry-picks.
- Focused script tests cover PR/release filtering, dry-run no-write behavior, and cursor advancement.
- Docs explain that adaptation decisions remain manual and JCode-directed.

## Tasks

- [x] Write failing tests for PR/release cursor filtering in `scripts/upstream-watch.test.ts`.
- [x] Write failing tests for dry-run no-write behavior and normal-run state advancement.
- [x] Implement minimal ledger logic and CLI in `scripts/upstream-watch.ts`.
- [x] Wire `bun run upstream:watch` in root `package.json` and ignore `.jcode/upstream-watch/`.
- [x] Add `docs/runbooks/upstream-watch.md`.
- [x] Verify with focused tests, scripts typecheck, manual dry-run QA, Aikido scan, and git status.
- [x] Commit implementation.
