# Desktop Agent Guide

## Scope

- `apps/desktop` owns the Electron shell, desktop entry point, preload bridge, packaging config, and smoke tests.
- Main process entry is `src/main.ts`.
- Build output is `dist-electron/` and should not be edited directly.

## Commands

- Dev: `bun run --cwd apps/desktop dev`.
- Build: `bun run --cwd apps/desktop build`.
- Start built desktop shell: `bun run --cwd apps/desktop start`.
- Typecheck: `bun run --cwd apps/desktop typecheck`.
- Tests: `bun run --cwd apps/desktop test`.
- Smoke test: `bun run --cwd apps/desktop smoke-test`.

## Patterns

- Keep desktop behavior aligned with server and web contracts from `@jcode/contracts`.
- Treat preload bridge changes as API changes; verify both main-process build output and consumer expectations.
- Do not hardcode local machine paths or private service URLs into desktop defaults.

## Verification

- For desktop packaging or preload changes, run `bun run build:desktop` from the repo root when feasible.
- CI checks that `apps/desktop/dist-electron/preload.js` contains expected bridge symbols after build.
