# Testing Documentation

| Field           | Value                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                                               |
| Type            | Testing index                                                                                                        |
| Owner           | Engineering                                                                                                          |
| Audience        | Engineers, reviewers, and automation agents                                                                          |
| Scope           | Focused test strategy, browser/manual verification, workspace test commands, and quality gate expectations           |
| Canonical path  | `docs/testing/README.md`                                                                                             |
| Last reviewed   | 2026-05-31                                                                                                           |
| Review cadence  | Event-driven; review when test tooling, workspace scripts, browser tests, Appearance contracts, or CI gates change   |
| Source of truth | Workspace package scripts, `.github/workflows/ci.yml`, vitest configs, Appearance contracts, and tests beside source |
| Verification    | Run commands named by changed docs where feasible                                                                    |

## Start Here By Scenario

| If you are doing this                  | Start here                                                 | Then check                                             |
| -------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| Planning verification                  | [Testing Strategy](strategy.md)                            | [`../../AGENTS.md`](../../AGENTS.md)                   |
| Working on CI gates                    | [CI Operations Runbook](../runbooks/ci-operations.md)      | Root `package.json`                                    |
| Changing UI behavior                   | [Testing Strategy](strategy.md)                            | [`../../apps/web/AGENTS.md`](../../apps/web/AGENTS.md) |
| Changing Appearance fonts/theme tokens | [Appearance Regression Testing](appearance-regressions.md) | [`../../apps/web/AGENTS.md`](../../apps/web/AGENTS.md) |

## Documents

- [Testing Strategy](strategy.md)
- [Appearance Regression Testing](appearance-regressions.md)
- [Appearance Regression Testing](appearance-regressions.md)
