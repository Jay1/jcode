# Runbooks

| Field           | Value                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                                        |
| Type            | Runbook index                                                                                                 |
| Owner           | Operations and Engineering                                                                                    |
| Audience        | Maintainers, release owners, and automation agents                                                            |
| Scope           | Repeatable local development, CI, release, deployment, and troubleshooting procedures                         |
| Canonical path  | `docs/runbooks/README.md`                                                                                     |
| Last reviewed   | 2026-05-22                                                                                                    |
| Review cadence  | Event-driven; review when package scripts, CI workflows, release flow, or local deployment assumptions change |
| Source of truth | `package.json`, workspace package scripts, `.github/workflows`, release docs, and runtime source              |
| Verification    | Run commands named by the changed runbook when feasible; otherwise document why not                           |

## Start Here By Scenario

| If you are doing this              | Start here                                                | Then check                                                                       |
| ---------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Starting local development         | [Local Development Runbook](local-development.md)         | [`../../AGENTS.md`](../../AGENTS.md)                                             |
| Triaging CI                        | [CI Operations Runbook](ci-operations.md)                 | [Testing Strategy](../testing/strategy.md)                                       |
| Preparing a desktop/server release | [Release Operations Runbook](release-operations.md)       | [Release Checklist](../release.md), [Security Baseline](../security/baseline.md) |
| Running local deployment           | [Local Deploy Notes](local-deploy.md)                     | [Repo Governance](../governance/repo-governance.md)                              |
| Opening JCode from another device  | [Remote Access Setup](remote-access.md)                   | [Security Baseline](../security/baseline.md)                                     |
| Updating local stable JCode        | [Update Local Stable JCode](update-local-stable-jcode.md) | [Local Deploy Notes](local-deploy.md)                                            |

## Documents

- [Local Development Runbook](local-development.md)
- [Remote Access Setup](remote-access.md)
- [CI Operations Runbook](ci-operations.md)
- [Release Operations Runbook](release-operations.md)
- [Update Local Stable JCode](update-local-stable-jcode.md)
- [Local Deploy Notes](local-deploy.md)
- [Release Checklist](../release.md)
