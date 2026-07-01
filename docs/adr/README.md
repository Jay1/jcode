# Architecture Decision Records

| Field           | Value                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                                           |
| Type            | ADR index                                                                                                        |
| Owner           | Engineering                                                                                                      |
| Audience        | Engineers, reviewers, maintainers, and automation agents                                                         |
| Scope           | Durable architecture decisions for JCode boundaries, runtime posture, release strategy, and provider integration |
| Canonical path  | `docs/adr/README.md`                                                                                             |
| Last reviewed   | 2026-06-30                                                                                                       |
| Review cadence  | Event-driven; add or update ADRs when a decision changes how future work should be done                          |
| Source of truth | ADR files, linked architecture docs, and runtime source                                                          |
| Verification    | Cross-check ADR claims against current source and tests before relying on them                                   |

## Records

| ADR                                                        | Status   | Topic                                        |
| ---------------------------------------------------------- | -------- | -------------------------------------------- |
| [0001](0001-local-coding-agent-cockpit.md)                 | Accepted | JCode as a local coding-agent cockpit        |
| [0002](0002-release-notes-and-latest-package-retention.md) | Accepted | Release notes and latest-package retention   |
| [0003](0003-settings-native-skill-library.md)              | Accepted | Settings-native provider-aware Skill Library |
| [0004](0004-project-language-icons.md)                     | Proposed | Project language icons as metadata           |
| [0005](0005-openclaw-gateway-provider.md)                  | Accepted | OpenClaw Gateway as a first-class Provider   |
| [0008](0008-scoped-remote-client-capability-tokens.md)     | Accepted | Scoped remote client capability tokens       |
| [0006](0006-remote-client-runtime-ws-rpc-scope-wiring.md)  | Decided  | Remote Client Runtime WS RPC Scope Wiring    |
| [0007](0007-parallel-windows-wsl-backend-routing.md)       | Proposed | Parallel Windows + WSL Backend Routing       |
| [0009](0009-copilot-provider-entry-path.md)                | Proposed | Copilot provider entry path                  |

## When To Add An ADR

Add an ADR when a decision creates a durable constraint, rejects an obvious alternative, or explains why future agents should not revisit the same trade-off without new facts.
