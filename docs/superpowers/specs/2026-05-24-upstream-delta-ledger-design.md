# Upstream Delta Ledger Design

| Field           | Value                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Status          | Implemented                                                                                         |
| Type            | Design specification                                                                                |
| Owner           | Engineering                                                                                         |
| Audience        | Maintainers and automation agents                                                                   |
| Canonical path  | `docs/superpowers/specs/2026-05-24-upstream-delta-ledger-design.md`                                 |
| Last reviewed   | 2026-05-24                                                                                          |
| Review cadence  | Event-driven; review when upstream source strategy or the upstream watch script changes             |
| Source of truth | `scripts/upstream-watch.ts`, `docs/runbooks/upstream-watch.md`, and `docs/jcode-operating-model.md` |

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans before implementation. Keep the workflow ledger-only; do not add branch automation.

**Goal:** Add a first-class local CLI for checking new DPCode and T3Code PR/release activity without re-reviewing all upstream activity each time.

## Context

JCode treats DPCode and T3Code as source material, not automatic merge targets. `docs/jcode-operating-model.md` says upstream work should be reviewed on short-lived feature branches and only useful pieces should be kept. This tool supports that review workflow by making upstream discovery incremental, not by automating imports.

Existing repo automation lives in `scripts/`, is deterministic/non-interactive by default, and is exposed through root `package.json` scripts when useful. Personal state must stay out of committed defaults.

## Recommended Approach

Add a scripts workspace CLI, exposed from the root as `bun run upstream:watch`, that queries the GitHub API or `gh` for configured upstream repositories and prints only deltas since the last local cursor.

Default upstreams:

- `Emanuele-web04/dpcode` as `dpcode`
- `pingdotgg/t3code` as `t3code`

Local state lives under `.jcode/upstream-watch/` and is ignored by git. The tool creates the directory on first run.

## Scope

Included:

- List updated pull requests since the last PR cursor for each upstream.
- List published releases since the last release cursor for each upstream.
- Store local cursors and append local run logs under `.jcode/upstream-watch/`.
- Support a dry-run/read-only mode that prints deltas without advancing cursors.
- Document the workflow in a runbook.

Excluded:

- No automatic branch creation.
- No automatic cherry-picking or merging.
- No committed shared review ledger by default.
- No CI schedule or bot behavior in the first version.

## Delta Semantics

Pull requests are new to the ledger when their `updatedAt` timestamp is newer than the stored PR cursor. This catches newly opened PRs, reopened PRs, merged PRs, and metadata changes.

Releases are new to the ledger when their `publishedAt` timestamp is newer than the stored release cursor. Draft creation and later release-note edits are not part of the default signal.

## Output Shape

The default report is triage-oriented:

- upstream name and repository
- PR number or release tag
- title/name
- state
- updated, merged, or published timestamp
- author
- labels for PRs
- base/head branch for PRs
- URL

Diff stats and file lists are intentionally not part of the default report. They can become optional deeper inspection flags later.

## State Shape

Use simple JSON files under `.jcode/upstream-watch/`:

- `state.json` stores per-upstream cursors, last run time, and schema version.
- `runs/YYYY-MM-DDTHH-mm-ssZ.json` stores the raw summarized delta from each advancing run.

The state schema should be versioned from the start so it can be migrated if needed.

## CLI Behavior

Proposed commands:

```bash
bun run upstream:watch
bun run upstream:watch -- --dry-run
bun run upstream:watch -- --since 2026-05-01T00:00:00Z
```

Default behavior advances cursors after a successful fetch and report write. `--dry-run` does not write state. `--since` overrides cursors for the report and does not advance state unless explicitly combined with a future `--advance` option.

## Authentication And Limits

Use `GH_TOKEN` or `GITHUB_TOKEN` when available. If no token is present, allow unauthenticated public API access but print a warning when rate-limit headers indicate low remaining budget.

The first version should fetch a bounded recent window and stop once results are older than the cursor. It does not need to crawl full repository history.

## Acceptance Criteria

- `bun run upstream:watch -- --dry-run` prints a deterministic report and does not create or modify `.jcode/upstream-watch/`.
- A normal run creates or updates `.jcode/upstream-watch/state.json` and appends one run log.
- A second normal run immediately after the first reports no duplicate PR/release deltas when upstream data has not changed.
- The tool never creates branches, commits, merges, or cherry-picks.
- Focused script tests cover cursor advancement, dry-run behavior, and PR/release filtering semantics.
- Documentation explains that import decisions remain manual and strategy-driven.

## Self-Review

- No placeholder sections remain.
- The design matches the existing operating model: upstreams are source material, not bosses.
- The local state choice respects publishable defaults and avoids committing personal review history.
- The first version is intentionally ledger-only and leaves import planning as a separate human workflow.
