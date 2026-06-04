# API And Runtime Contracts

| Field           | Value                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                                         |
| Type            | API and contract index                                                                                         |
| Owner           | Engineering                                                                                                    |
| Audience        | Maintainers, reviewers, frontend/server developers, and automation agents                                      |
| Scope           | JCode runtime event contracts, RPC shapes, WebSocket/native bridge expectations, and shared contract ownership |
| Canonical path  | `docs/api/README.md`                                                                                           |
| Last reviewed   | 2026-05-22                                                                                                     |
| Review cadence  | Event-driven; review when contracts, runtime events, WebSocket behavior, or desktop bridge behavior changes    |
| Source of truth | `packages/contracts`, `apps/server`, `apps/web`, `apps/desktop`, and API docs listed below                     |
| Verification    | Contract package tests plus at least one affected consumer when exported shapes change                         |

## Documents

- [Keybindings](keybindings.md)
- [Runtime Events](runtime-events.md)

## Ownership

`packages/contracts` is the shared source for exported runtime and RPC shapes. Server, web, desktop, and scripts should consume those contracts rather than redefining compatible structures by hand.
