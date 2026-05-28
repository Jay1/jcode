# ADR 0001: JCode Is A Local Coding-Agent Cockpit

| Field           | Value                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Status          | Accepted                                                                                          |
| Type            | Architecture decision record                                                                      |
| Owner           | Engineering                                                                                       |
| Audience        | Maintainers, reviewers, and automation agents                                                     |
| Scope           | Product/runtime boundary for JCode as a local cockpit rather than a hosted SaaS product           |
| Canonical path  | `docs/adr/0001-local-coding-agent-cockpit.md`                                                     |
| Last reviewed   | 2026-05-22                                                                                        |
| Review cadence  | Event-driven; review if JCode becomes a public hosted product or changes runtime trust boundaries |
| Source of truth | `README.md`, `docs/jcode-operating-model.md`, `apps/server`, `apps/web`, `apps/desktop`           |
| Verification    | Confirm runtime/defaults remain local-first and publishable                                       |

## Context

JCode is built around local coding-agent workflow. It packages a web UI, local server, desktop shell, and provider integrations into a cockpit for managing coding-agent sessions.

## Decision

JCode remains a local-first coding-agent cockpit. Its committed defaults should optimize for local utility, fast recovery, and safe public repository hygiene rather than hosted multi-tenant product assumptions.

## Consequences

- Local runtime boundaries and external provider runtime behavior must be explicit in server/provider code.
- Release and desktop packaging docs should distinguish local development, desktop distribution, and server package publishing.
- Security docs should focus on publishable defaults, local exposure, provider boundaries, and secrets hygiene.
- Public marketing and README copy should stay concise and avoid implying enterprise or hosted-product guarantees.
