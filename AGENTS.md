# JCode Agent Guide

## Project Shape

- JCode is a Bun/TypeScript monorepo for a local coding-agent cockpit.
- Workspaces live under `apps/*`, `packages/*`, and `scripts`.
- Primary apps are `apps/server`, `apps/web`, `apps/desktop`, and `apps/marketing`.
- Shared libraries are `packages/contracts`, `packages/shared`, and `packages/effect-acp`.

## Commands

- Install with `bun install`.
- Use focused commands while developing: `bun run --cwd <workspace> test <path>`, `bun run --cwd <workspace> build`, or `bun run --cwd <workspace> typecheck`.
- Root CI runs `bun run fmt:check`, `bun run lint`, `bun run typecheck`, `bun run test`, browser tests, and `bun run build:desktop`.
- Do not run repo-wide `bun run fmt`, `bun run lint`, or `bun run typecheck` unless explicitly requested; prefer focused verification for touched areas.

## Environment

- Tool versions are pinned in `.mise.toml`: Node `24.13.1`, Bun `1.3.9`.
- If LSP or tooling exits with a mise trust error, report that `.mise.toml` is untrusted instead of changing trust settings automatically.
- Keep committed defaults publishable: no tokens, owner pairing links, private tailnet URLs, or machine-specific service files.

## Code Style

- TypeScript is strict with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `noImplicitOverride` from `tsconfig.base.json`.
- The repo uses ESM modules.
- Prefer small, surgical changes and colocated tests.
- Do not mix unrelated concerns in one change.

## Git And Repo Hygiene

- `main` is the stable branch; use short-lived `feature/*` branches for risky changes.
- Preserve MIT attribution in `LICENSE` and `CREDITS.md`.
- Do not commit local agent/editor state such as `.sisyphus/`, `.brainstorm/`, `.vscode/`, or `.playwright-mcp/`.
- If using git commands in OpenCode with the git-master skill active, prefix every git invocation with `GIT_MASTER=1`.

## Area Guides

- Server runtime and providers: see `apps/server/AGENTS.md`.
- Web UI: see `apps/web/AGENTS.md`.
- Desktop shell and packaging: see `apps/desktop/AGENTS.md`.
- Marketing site: see `apps/marketing/AGENTS.md`.
- Shared packages: see `packages/AGENTS.md`.
- Repo scripts and release helpers: see `scripts/AGENTS.md`.
