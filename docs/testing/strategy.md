# Testing Strategy

| Field           | Value                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                               |
| Type            | Testing reference                                                                                    |
| Owner           | Engineering                                                                                          |
| Audience        | Engineers, reviewers, and automation agents                                                          |
| Scope           | How to choose focused tests, root gates, browser checks, and manual verification for JCode changes   |
| Canonical path  | `docs/testing/strategy.md`                                                                           |
| Last reviewed   | 2026-06-01                                                                                           |
| Review cadence  | Event-driven; review when package scripts, CI gates, test framework, or browser verification changes |
| Source of truth | Root and workspace `package.json`, CI workflow, colocated tests                                      |
| Verification    | Use the narrowest command that proves the claim; broaden only when the changed surface requires it   |

## Test Layers

| Layer                    | Command shape                                     | Use when                                                         |
| ------------------------ | ------------------------------------------------- | ---------------------------------------------------------------- |
| Focused unit/integration | `bun run --cwd <workspace> test src/path.test.ts` | Most code changes                                                |
| Workspace build          | `bun run --cwd <workspace> build`                 | Build output, bundling, generated assets                         |
| Workspace typecheck      | `bun run --cwd <workspace> typecheck`             | Type/API surface changes when LSP is unavailable or insufficient |
| Browser tests            | `bun run --cwd apps/web test:browser`             | UI behavior needing browser runtime evidence                     |
| Desktop pipeline         | `bun run build:desktop`                           | Desktop shell, preload, updater, or packaged output changes      |
| Focused format check     | `bunx oxfmt@0.52.0 --check <files>`               | Before pushing touched source or docs files                      |
| Root CI gates            | Root scripts from `package.json`                  | Release readiness or explicit user request                       |

## Local-Safe Commands

The full CI commands remain canonical before merging, release preparation, or any claim that the whole repository is green. Use `bun run fmt:check`, `bun run test`, `bun run test:browser`, `bun run test:all`, and coverage commands when you need CI-equivalent evidence.

Use the local-safe variants when you need workstation-friendly verification that avoids saturating CPU, browser, or formatter parallelism:

| Command                                     | Use when                                            | Throttles                                                                                 |
| ------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `bun run test:local`                        | Running root tests during local development         | Turbo package concurrency, Vitest workers, concurrent tests, and Vitest file parallelism  |
| `bun run test:browser:local`                | Running web browser tests on a workstation          | Turbo package concurrency, Vitest workers, concurrent tests, and browser file parallelism |
| `bun run test:all:local`                    | Running both local-safe unit and browser test gates | The same local-safe unit and browser limits                                               |
| `bun run fmt:check:local`                   | Checking formatting without using all CPU threads   | `oxfmt` worker threads                                                                    |
| `bun run --cwd apps/web test:browser:local` | Checking only the web browser test workspace        | Vitest workers, concurrent tests, and browser file parallelism                            |

These commands are meant to reduce workstation lag, screen flicker, and other application pressure. They do not replace the full CI commands when the change needs merge or release-level confidence.

## Rules

- Add a focused regression before fixing non-trivial bugs.
- Verify the failing state first when using TDD.
- Include a formatter check in pre-push verification. For small changes, check touched files with `bunx oxfmt@0.52.0 --check <files>`; use `bun run fmt:check` when the change is broad or CI already failed formatting.
- Do not claim completion from type checks alone; run the behavior-specific test or manual verification.
- Document blocked LSP diagnostics when `.mise.toml` trust prevents language server startup.

## Focused References

- [Appearance Regression Testing](appearance-regressions.md) covers the settings-to-token-to-rendered-surface contracts for UI fonts, Code fonts, chat prose, inline code, and the JCode wordmark.
