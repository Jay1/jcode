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

## Release Preparation Trigger

When the user says “prepare a new release for me”, treat it as release-prep work, not as permission to publish immediately.

- Read `docs/release.md`, `docs/runbooks/release-operations.md`, and `docs/adr/0002-release-notes-and-latest-package-retention.md` before changing release files.
- Determine the intended next version from package versions, recent commits, and user guidance; ask one short question if the version or release type is ambiguous.
- Add or update `docs/releases/vX.Y.Z.md` using the compact release-note style: title, one-sentence summary, three to five highlights, optional important fixes, and optional upgrade note.
- Run `bun run release:notes -- --write` to regenerate `apps/web/src/whatsNew/entries.ts`.
- Verify with `bun run release:notes -- --check --version X.Y.Z` plus focused tests for touched release scripts when release tooling changed.
- Do not create or push `vX.Y.Z` tags, publish GitHub Releases, or delete old release assets unless the user explicitly asks to release/publish/tag.
- If the user explicitly asks to publish, use `.github/workflows/release.yml`: tag pushes `vX.Y.Z` trigger the release, and manual dispatch accepts a `version` input.

## Upstream Watch

- DPCode and T3Code are historical lineage and optional external reference points, not JCode's product philosophy or automatic merge targets.
- Any adapted external idea must become a small, JCode-native change with focused verification.
- Use `bun run upstream:watch -- --dry-run` to preview new upstream PR/release deltas without advancing local cursors.
- Use `bun run upstream:watch` to record a local cursor after reviewing the report.
- Upstream watch state lives under `.jcode/upstream-watch/` and must not be committed.
- See `docs/runbooks/upstream-watch.md` and `CONTEXT.md` for the upstream delta ledger semantics.

## Area Guides

- Server runtime and providers: see `apps/server/AGENTS.md`.
- Web UI: see `apps/web/AGENTS.md`.
- Desktop shell and packaging: see `apps/desktop/AGENTS.md`.
- Marketing site: see `apps/marketing/AGENTS.md`.
- Shared packages: see `packages/AGENTS.md`.
- Repo scripts and release helpers: see `scripts/AGENTS.md`.
