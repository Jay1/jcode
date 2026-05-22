# Architecture Decision Records

| Field           | Value                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                                           |
| Type            | ADR index                                                                                                        |
| Owner           | Engineering                                                                                                      |
| Audience        | Engineers, reviewers, maintainers, and automation agents                                                         |
| Scope           | Durable architecture decisions for JCode boundaries, runtime posture, release strategy, and provider integration |
| Canonical path  | `docs/adr/README.md`                                                                                             |
| Last reviewed   | 2026-05-22                                                                                                       |
| Review cadence  | Event-driven; add or update ADRs when a decision changes how future work should be done                          |
| Source of truth | ADR files, linked architecture docs, and runtime source                                                          |
| Verification    | Cross-check ADR claims against current source and tests before relying on them                                   |

## Records

| ADR                                        | Status   | Topic                                 |
| ------------------------------------------ | -------- | ------------------------------------- |
| [0001](0001-local-coding-agent-cockpit.md) | Accepted | JCode as a local coding-agent cockpit |

## When To Add An ADR

Add an ADR when a decision creates a durable constraint, rejects an obvious alternative, or explains why future agents should not revisit the same trade-off without new facts.
