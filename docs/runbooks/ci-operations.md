# CI Operations Runbook

| Field           | Value                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                                     |
| Type            | Operational runbook                                                                                        |
| Owner           | Operations and Engineering                                                                                 |
| Audience        | Maintainers, release owners, reviewers, and automation agents                                              |
| Scope           | GitHub Actions quality gates, release smoke, browser tests, desktop build verification, and failure triage |
| Canonical path  | `docs/runbooks/ci-operations.md`                                                                           |
| Last reviewed   | 2026-06-01                                                                                                 |
| Review cadence  | Event-driven; review when workflows, package scripts, build outputs, or release checks change              |
| Source of truth | `.github/workflows/ci.yml`, `.github/workflows/release.yml`, root `package.json`, workspace scripts        |
| Verification    | Match changed workflow/script docs to the relevant local command or GitHub Actions evidence                |

## Source-Of-Truth Map

| Area                   | Source                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Main CI                | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)                         |
| Release workflow       | [`.github/workflows/release.yml`](../../.github/workflows/release.yml)               |
| Root scripts           | [`../../package.json`](../../package.json)                                           |
| Desktop release smoke  | [`../../scripts/release-smoke.ts`](../../scripts/release-smoke.ts)                   |
| Desktop artifact build | [`../../scripts/build-desktop-artifact.ts`](../../scripts/build-desktop-artifact.ts) |

## CI Gates

The main CI workflow runs on pull requests and pushes to `main`. It runs formatting, lint, typecheck, tests, browser tests, desktop build, and preload bundle verification.

| Gate                  | GitHub Actions step          | Local command                                                                                                                               |
| --------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependency install    | Install dependencies         | `bun install --frozen-lockfile`                                                                                                             |
| Formatting            | Format                       | `bun run fmt:check`                                                                                                                         |
| Lint                  | Lint                         | `bun run lint`                                                                                                                              |
| TypeScript            | Typecheck                    | `bun run typecheck`                                                                                                                         |
| Unit/integration      | Test                         | `bun run test`                                                                                                                              |
| Browser runtime setup | Install browser test runtime | `cd apps/web && bunx playwright install --with-deps chromium`                                                                               |
| Browser tests         | Browser test                 | `bun run --cwd apps/web test:browser`                                                                                                       |
| Desktop build         | Build desktop pipeline       | `bun run build:desktop`                                                                                                                     |
| Package smoke         | Build desktop package smoke  | `bun run dist:desktop:artifact -- --platform linux --target AppImage --arch x64 --skip-build --output-dir /tmp/jcode-desktop-package-smoke` |
| Preload verification  | Verify preload bundle output | Check `apps/desktop/dist-electron/preload.js` exists and contains bridge markers                                                            |
| Release smoke         | Release Smoke workflow       | `node scripts/release-smoke.ts` and `bun scripts/release-notes.ts --check`                                                                  |

## Pre-Push Smoothing

Before pushing a pull request update, run the narrowest command that covers the files you touched and include formatting in that set. Formatting is the first main CI gate, so missing it turns small PRs red before behavioral checks run.

For a few touched TypeScript, TSX, JavaScript, JSON, or Markdown files:

```sh
bunx oxfmt@0.52.0 --check <touched-files>
```

If that reports files, format only the files you touched:

```sh
bunx oxfmt@0.52.0 <touched-files>
```

Use the full root formatter gate when many files changed, generated formatting is unclear, or GitHub Actions already failed at the Format step:

```sh
bun run fmt:check
```

Do not use root `bun run fmt` as a routine pre-push step. It can rewrite unrelated files and make small CI fixes harder to review.

## Triage Procedure

1. Identify the failing job and step from GitHub Actions.
2. Reproduce with the closest local command from `package.json` or the workspace package script.
3. If the first failed step is Format, run `bunx oxfmt@0.52.0 <files>` on the files listed by CI, then verify with `bun run fmt:check` or a narrow `bunx oxfmt@0.52.0 --check <files>`.
4. Prefer focused fixes and focused verification before broad root gates.
5. If local test or typecheck commands fail with missing packages in a fresh worktree, run `bun install --frozen-lockfile` before treating the failure as code-related.
6. If the failure depends on generated output, rebuild the owning workspace rather than editing output files directly.
