# JCode Documentation Hub

| Field           | Value                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                                           |
| Type            | Documentation portal and governance contract                                                                     |
| Owner           | Engineering                                                                                                      |
| Audience        | Maintainers, reviewers, operators, and automation agents                                                         |
| Scope           | JCode architecture, operations, security posture, testing strategy, governance, and decision records             |
| Canonical path  | `docs/README.md`                                                                                                 |
| Last reviewed   | 2026-05-22                                                                                                       |
| Review cadence  | Event-driven; review when repo structure, runtime architecture, release process, or agent workflow changes       |
| Source of truth | Runtime source, tests, package scripts, GitHub workflows, `AGENTS.md`, accepted ADRs, and documents listed below |
| Verification    | Source cross-checks plus focused commands named by changed documents                                             |
| Export posture  | Portable Markdown; suitable for future wiki, Notion, Obsidian, ITGlue, or Confluence migration                   |

## Purpose

This hub explains how JCode documentation is organized, which documents are authoritative, and where maintainers or automation agents should start for common changes.

The repository remains the source of truth for docs that must change with code: architecture, runtime contracts, local verification, release runbooks, security posture, and operational checks.

## Documentation Principles

1. **One document, one job.** A document should be an index, policy, runbook, reference, checklist, or ADR, not all of them at once.
2. **Active documents need ownership.** Each active doc should identify owner, audience, scope, review trigger, source of truth, and verification.
3. **Prose must not replace verification.** Tests, scripts, workflows, and runtime source remain the proof; docs should point to them.
4. **Keep root small.** New long-form docs belong in the category directory that owns their job.
5. **Portable Markdown only.** Avoid tool-specific embeds, hidden state, or local absolute paths in durable docs.

## Source-Of-Truth Precedence

When sources disagree, use this order before changing code or docs:

1. Active runtime source, tests, generated contracts, scripts, and CI workflow evidence.
2. Accepted ADRs and architecture references for durable decisions.
3. Runbooks and category indexes for repeatable procedures.
4. Historical notes and repo-scan reports for background context only.

## Start Here

| If you are doing this              | Start here                                                        | Then check                                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Understanding the system           | [Architecture](architecture/README.md)                            | [System Overview](architecture/system-overview.md), [Runtime Boundaries](architecture/runtime-boundaries.md) |
| Running or debugging locally       | [Runbooks](runbooks/README.md)                                    | [Local Development](runbooks/local-development.md), [CI Operations](runbooks/ci-operations.md)               |
| Changing provider/runtime behavior | [Provider Runtime Architecture](architecture/provider-runtime.md) | `apps/server/AGENTS.md`, [Testing Strategy](testing/strategy.md)                                             |
| Preparing a release                | [Release Operations](runbooks/release-operations.md)              | [CI Operations](runbooks/ci-operations.md), [Security Baseline](security/baseline.md)                        |
| Reviewing repo hygiene             | [Governance](governance/README.md)                                | [Repo Governance](governance/repo-governance.md), [Docs Agent Guide](AGENTS.md)                              |

## Category Index

| Category                                   | Use for                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| [Architecture](architecture/README.md)     | System shape, runtime boundaries, provider architecture, and durable design context |
| [ADR](adr/README.md)                       | Accepted architecture decisions and their consequences                              |
| [API and Runtime Contracts](api/README.md) | Runtime event, RPC, WebSocket, and desktop bridge ownership                         |
| [Governance](governance/README.md)         | Branch posture, attribution, contribution policy, and publishable defaults          |
| [Runbooks](runbooks/README.md)             | Repeatable local development, CI, release, and troubleshooting procedures           |
| [Security](security/README.md)             | Local-first security posture, secrets hygiene, and security review expectations     |
| [Testing](testing/README.md)               | Focused verification strategy, browser/manual checks, and CI gate mapping           |

## Structure

```text
docs/
|-- README.md
|-- AGENTS.md
|-- adr/
|-- api/
|-- architecture/
|-- governance/
|-- runbooks/
|-- security/
`-- testing/
```

## Historical Docs

These existing documents remain in place until they are intentionally folded into the indexed structure:

- [JCode Operating Model](jcode-operating-model.md)
- [Local Deploy Notes](local-deploy.md)
- [Release Checklist](release.md)
- [Server Architecture Migration](server-architecture-migration.md)
- [Plan Mode User Input Recap](RECAP-plan-mode-user-input-submit.md)
- [Repo Scan 2026-04-16](repo-scan-2026-04-16/README.md)
