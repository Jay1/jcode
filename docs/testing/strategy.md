# Testing Strategy

| Field | Value |
| --- | --- |
| Status | Active |
| Type | Testing reference |
| Owner | Engineering |
| Audience | Engineers, reviewers, and automation agents |
| Scope | How to choose focused tests, root gates, browser checks, and manual verification for JCode changes |
| Canonical path | `docs/testing/strategy.md` |
| Last reviewed | 2026-05-22 |
| Review cadence | Event-driven; review when package scripts, CI gates, test framework, or browser verification changes |
| Source of truth | Root and workspace `package.json`, CI workflow, colocated tests |
| Verification | Use the narrowest command that proves the claim; broaden only when the changed surface requires it |

## Test Layers

| Layer | Command shape | Use when |
| --- | --- | --- |
| Focused unit/integration | `bun run --cwd <workspace> test src/path.test.ts` | Most code changes |
| Workspace build | `bun run --cwd <workspace> build` | Build output, bundling, generated assets |
| Workspace typecheck | `bun run --cwd <workspace> typecheck` | Type/API surface changes when LSP is unavailable or insufficient |
| Browser tests | `bun run --cwd apps/web test:browser` | UI behavior needing browser runtime evidence |
| Desktop pipeline | `bun run build:desktop` | Desktop shell, preload, updater, or packaged output changes |
| Root CI gates | Root scripts from `package.json` | Release readiness or explicit user request |

## Rules

- Add a focused regression before fixing non-trivial bugs.
- Verify the failing state first when using TDD.
- Do not claim completion from type checks alone; run the behavior-specific test or manual verification.
- Document blocked LSP diagnostics when `.mise.toml` trust prevents language server startup.
