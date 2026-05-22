# Runtime Events

| Field           | Value                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                                                      |
| Type            | API reference                                                                                                               |
| Owner           | Engineering                                                                                                                 |
| Audience        | Maintainers, reviewers, frontend/server developers, and automation agents                                                   |
| Scope           | Canonical runtime event ownership and verification anchors                                                                  |
| Canonical path  | `docs/api/runtime-events.md`                                                                                                |
| Last reviewed   | 2026-05-22                                                                                                                  |
| Review cadence  | Event-driven; review when provider runtime events, projector behavior, or WebSocket payloads change                         |
| Source of truth | `packages/contracts/src/providerRuntime.ts`, `apps/server/src/provider`, `apps/server/src/orchestration`, and web consumers |
| Verification    | Run focused contract/server/web tests for changed event shapes or ordering                                                  |

## Purpose

Runtime events connect provider adapters, server orchestration, persisted projections, and web UI consumers. This document points to ownership and verification anchors; it is not a generated schema reference.

## Ownership Map

| Concern                     | Source                                      |
| --------------------------- | ------------------------------------------- |
| Event type definitions      | `packages/contracts/src/providerRuntime.ts` |
| Provider adapter emission   | `apps/server/src/provider`                  |
| Orchestration/projection    | `apps/server/src/orchestration`             |
| Web consumption             | `apps/web/src`                              |
| Desktop bridge expectations | `apps/desktop/src` and `packages/contracts` |

## Change Rules

- Preserve event ordering and turn lifecycle semantics.
- Add focused regressions for provider/runtime bugs.
- When changing exported event shapes, verify at least one affected consumer.
- Do not introduce UI-only assumptions into server contract definitions.
