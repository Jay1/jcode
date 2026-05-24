# Upstream Watch Runbook

| Field           | Value                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                            |
| Type            | Operational runbook                                                                               |
| Owner           | Engineering                                                                                       |
| Audience        | Maintainers and automation agents                                                                 |
| Scope           | Local DPCode/T3Code PR and release delta checks                                                   |
| Canonical path  | `docs/runbooks/upstream-watch.md`                                                                 |
| Last reviewed   | 2026-05-24                                                                                        |
| Review cadence  | Event-driven; review when upstream source strategy or the upstream watch script changes           |
| Source of truth | `scripts/upstream-watch.ts`, `docs/jcode-operating-model.md`, and `.jcode/upstream-watch/`        |
| Verification    | Run `bun run --cwd scripts test upstream-watch.test.ts` and `bun run upstream:watch -- --dry-run` |

## Purpose

JCode treats DPCode and T3Code as source material, not automatic merge targets. The upstream watch command keeps a local ledger of recently seen upstream PR and release activity so maintainers can review only deltas.

The command does not create branches, merge, cherry-pick, or commit. Import decisions remain manual and strategy-driven.

## Commands

```bash
bun run upstream:watch
bun run upstream:watch -- --dry-run
bun run upstream:watch -- --since 2026-05-01T00:00:00Z
```

Use `--dry-run` to preview current deltas without writing local state. Use `--since` to inspect a one-off window without advancing the local cursor.

## Local State

State lives under `.jcode/upstream-watch/` and is ignored by git.

- `state.json` stores per-upstream PR and release cursors.
- `runs/*.json` stores local run logs for advancing runs.

Do not commit these files unless you intentionally create a separate human-written summary.

## Review Flow

1. Run `bun run upstream:watch -- --dry-run` to preview current deltas.
2. Run `bun run upstream:watch` when you want to advance the local cursor.
3. Read the report for updated PRs and newly published releases.
4. Decide manually which upstream work deserves deeper inspection.
5. Use short-lived `feature/*` branches for any selected import work.
