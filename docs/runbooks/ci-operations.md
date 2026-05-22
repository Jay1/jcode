# CI Operations Runbook

| Field | Value |
| --- | --- |
| Status | Active |
| Type | Operational runbook |
| Owner | Operations and Engineering |
| Audience | Maintainers, release owners, reviewers, and automation agents |
| Scope | GitHub Actions quality gates, release smoke, browser tests, desktop build verification, and failure triage |
| Canonical path | `docs/runbooks/ci-operations.md` |
| Last reviewed | 2026-05-22 |
| Review cadence | Event-driven; review when workflows, package scripts, build outputs, or release checks change |
| Source of truth | `.github/workflows/ci.yml`, `.github/workflows/release.yml`, root `package.json`, workspace scripts |
| Verification | Match changed workflow/script docs to the relevant local command or GitHub Actions evidence |

## Source-Of-Truth Map

| Area | Source |
| --- | --- |
| Main CI | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) |
| Release workflow | [`.github/workflows/release.yml`](../../.github/workflows/release.yml) |
| Root scripts | [`../../package.json`](../../package.json) |
| Desktop release smoke | [`../../scripts/release-smoke.ts`](../../scripts/release-smoke.ts) |
| Desktop artifact build | [`../../scripts/build-desktop-artifact.ts`](../../scripts/build-desktop-artifact.ts) |

## CI Gates

The main CI workflow runs on pull requests and pushes to `main`. It runs formatting, lint, typecheck, tests, browser tests, desktop build, and preload bundle verification.

## Triage Procedure

1. Identify the failing job and step from GitHub Actions.
2. Reproduce with the closest local command from `package.json` or the workspace package script.
3. Prefer focused fixes and focused verification before broad root gates.
4. If the failure depends on generated output, rebuild the owning workspace rather than editing output files directly.
