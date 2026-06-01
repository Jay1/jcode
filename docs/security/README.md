# Security Documentation

| Field           | Value                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                                                       |
| Type            | Security reference index                                                                                                     |
| Owner           | Security and Engineering                                                                                                     |
| Audience        | Maintainers, reviewers, release owners, and automation agents                                                                |
| Scope           | Publishable defaults, local runtime exposure, secrets hygiene, dependency posture, and provider/runtime boundaries           |
| Canonical path  | `docs/security/README.md`                                                                                                    |
| Last reviewed   | 2026-05-22                                                                                                                   |
| Review cadence  | Event-driven; review when runtime exposure, auth defaults, dependency policy, release workflow, or provider handling changes |
| Source of truth | Runtime source, `.gitignore`, package manifests, workflows, release docs, and security docs listed below                     |
| Verification    | Security scan modified first-party code, inspect publishable defaults, and cross-check docs against source                   |

## Start Here By Scenario

| If you are doing this               | Start here                                                           | Then check                                                   |
| ----------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------ |
| Reviewing baseline posture          | [Security Baseline](baseline.md)                                     | [Repo Governance](../governance/repo-governance.md)          |
| Using local browser automation auth | [Dev Automation Access Grant](dev-automation-access.md)              | [`../../AGENTS.md`](../../AGENTS.md)                         |
| Changing provider/runtime handling  | [Provider Runtime Architecture](../architecture/provider-runtime.md) | [`../../apps/server/AGENTS.md`](../../apps/server/AGENTS.md) |
| Preparing release or publishing     | [Release Checklist](../release.md)                                   | [CI Operations Runbook](../runbooks/ci-operations.md)        |

## Documents

- [Security Baseline](baseline.md)
- [Dev Automation Access Grant](dev-automation-access.md)
