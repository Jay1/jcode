# Local Development Runbook

| Field | Value |
| --- | --- |
| Status | Active |
| Type | Operational runbook |
| Owner | Engineering |
| Audience | Maintainers and automation agents working locally |
| Scope | Local setup, focused workspace commands, dev server entry points, and common verification paths |
| Canonical path | `docs/runbooks/local-development.md` |
| Last reviewed | 2026-05-22 |
| Review cadence | Event-driven; review when package scripts, tool versions, dev runner behavior, or workspace layout changes |
| Source of truth | `package.json`, `.mise.toml`, workspace package scripts, `scripts/dev-runner.ts`, `AGENTS.md` |
| Verification | Run the exact focused command relevant to the changed area; do not run repo-wide gates unless requested |

## Prerequisites

- Bun and Node versions are pinned in `.mise.toml`.
- Install dependencies with `bun install`.
- If tooling fails because `.mise.toml` is untrusted, report the blocker instead of changing trust settings automatically.

## Common Commands

| Goal | Command |
| --- | --- |
| Start all local dev surfaces | `bun run dev` |
| Start server only | `bun run dev:server` |
| Start web only | `bun run dev:web` |
| Start desktop dev shell | `bun run dev:desktop` |
| Start marketing site | `bun run dev:marketing` |
| Run focused server test | `bun run --cwd apps/server test src/path/to/file.test.ts` |
| Run focused web test | `bun run --cwd apps/web test src/path/to/file.test.ts` |
| Build desktop pipeline | `bun run build:desktop` |

## Procedure

1. Confirm the area guide for the workspace you are touching.
2. Run the narrowest useful test before and after behavior changes.
3. Use manual/browser verification for visible UI or runtime behavior.
4. Keep local state such as `.sisyphus/`, `.brainstorm/`, `.vscode/`, and `.playwright-mcp/` out of commits.
