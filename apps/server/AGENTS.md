# Server Agent Guide

## Scope

- `apps/server` owns the local HTTP/WebSocket server, provider adapters, orchestration, persistence, workspace access, terminal management, and server-side runtime health.
- Public entry points are `src/index.ts` and `src/main.ts`.
- Build output is `dist/` and must not be edited directly.

## Commands

- Dev: `bun run --cwd apps/server dev`.
- Build: `bun run --cwd apps/server build`.
- Typecheck: `bun run --cwd apps/server typecheck`.
- Tests: `bun run --cwd apps/server test` or focused `bun run --cwd apps/server test src/path/to/file.test.ts`.

## Patterns

- Runtime services are organized under `src/**/Layers` and `src/**/Services`.
- Provider adapters emit canonical `ProviderRuntimeEvent` streams; preserve existing event ordering and turn lifecycle invariants.
- Persistence changes should include migration tests under `src/persistence/Migrations` when schema behavior changes.
- Prefer focused regression tests beside the behavior being changed.

## Provider Runtime Notes

- OpenCode integration lives mainly in `src/provider/Layers/OpenCodeAdapter.ts` and runtime health logic near `src/provider`.
- Do not suppress provider errors globally; first identify the event/state path and add a targeted regression.
- External OpenCode runtimes can differ from the local `opencode` CLI, so do not infer remote runtime update state from the local binary.

## Verification

- For provider changes, run the relevant adapter/runtime test file directly.
- For route or persistence changes, run the narrow route/repository/migration test first, then broaden only when needed.
- LSP diagnostics may be blocked by untrusted `.mise.toml`; document the blocker if it occurs.
