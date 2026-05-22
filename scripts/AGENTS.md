# Scripts Agent Guide

## Scope

- `scripts` contains repo automation for dev orchestration, desktop artifacts, release smoke checks, version updates, and shared script libraries.
- Important files include `dev-runner.ts`, `build-desktop-artifact.ts`, `release-smoke.ts`, and `lib/*`.

## Commands

- Tests: `bun run --cwd scripts test` or focused `bun run --cwd scripts test scripts/path.test.ts`.
- Typecheck: `bun run --cwd scripts typecheck`.
- Dev runner dry run: `node scripts/dev-runner.ts <command> --print-only` when validating command resolution without spawning Turbo.

## Patterns

- Keep scripts deterministic and non-interactive for CI unless explicitly building a local developer command.
- Preserve existing environment-variable resolution and command-printing behavior in `dev-runner.ts`.
- Do not add release side effects to tests; use smoke or dry-run paths.

## Verification

- For script behavior changes, run the specific script test and, when possible, one dry-run/manual command showing the resolved output.
