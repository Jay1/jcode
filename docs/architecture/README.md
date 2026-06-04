# Architecture Documentation

| Field           | Value                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                                    |
| Type            | Architecture index                                                                                        |
| Owner           | Engineering                                                                                               |
| Audience        | Engineers, reviewers, and automation agents                                                               |
| Scope           | Runtime shape, provider boundaries, app/package responsibilities, and architectural migration references  |
| Canonical path  | `docs/architecture/README.md`                                                                             |
| Last reviewed   | 2026-06-04                                                                                                |
| Review cadence  | Event-driven; review when app boundaries, provider adapters, contracts, or packaging architecture changes |
| Source of truth | `apps/*`, `packages/*`, `scripts/*`, `turbo.json`, and linked architecture docs                           |
| Verification    | Focused tests/builds for touched areas plus source cross-checks for architecture claims                   |

## Start Here By Scenario

| If you are doing this         | Start here                                                                  | Then check                                                                |
| ----------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Getting oriented              | [System Overview](system-overview.md)                                       | [Docs Agent Guide](../AGENTS.md)                                          |
| Checking workspace boundaries | [Runtime Boundaries](runtime-boundaries.md)                                 | [System Overview](system-overview.md)                                     |
| Changing providers            | [Provider Runtime Architecture](provider-runtime.md)                        | [`../../apps/server/AGENTS.md`](../../apps/server/AGENTS.md)              |
| Changing server boundaries    | [Server Architecture Migration Inventory](server-architecture-migration.md) | [Testing Strategy](../testing/strategy.md)                                |
| Changing repo language logic  | [JCode Linguist Repository Profiling](jcode-linguist.md)                    | [ADR 0004: Project Language Icons](../adr/0004-project-language-icons.md) |
| Changing theme surface tokens | [Theme Surface Token Rules](theme-surface-tokens.md)                        | [Appearance Regression Testing](../testing/appearance-regressions.md)     |
| Recording a durable decision  | [ADR Index](../adr/README.md)                                               | [Repo Governance](../governance/repo-governance.md)                       |

## Documents

- [System Overview](system-overview.md)
- [Runtime Boundaries](runtime-boundaries.md)
- [Provider Runtime Architecture](provider-runtime.md)
- [JCode Linguist Repository Profiling](jcode-linguist.md)
- [Theme Surface Token Rules](theme-surface-tokens.md)
- [Server Architecture Migration Inventory](server-architecture-migration.md)
