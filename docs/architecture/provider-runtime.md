# Provider Runtime Architecture

| Field           | Value                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Status          | Active                                                                                                                   |
| Type            | Architecture reference                                                                                                   |
| Owner           | Engineering                                                                                                              |
| Audience        | Engineers and automation agents changing coding-agent integrations                                                       |
| Scope           | Provider adapter boundaries, OpenCode runtime health, event projection, and completion/error invariants                  |
| Canonical path  | `docs/architecture/provider-runtime.md`                                                                                  |
| Last reviewed   | 2026-05-22                                                                                                               |
| Review cadence  | Event-driven; review when provider adapters, runtime health, event ingestion, or turn lifecycle behavior changes         |
| Source of truth | `apps/server/src/provider`, `apps/server/src/orchestration`, `packages/contracts/src/providerRuntime.ts`, provider tests |
| Verification    | Focused adapter/runtime tests plus Aikido scan for modified first-party server code                                      |

## Purpose

This document captures the shape of JCode's provider runtime layer. It exists to prevent broad UI or notification patches when the real issue is usually an adapter event-state transition.

## Core Flow

```text
Provider process or external provider server
  -> provider adapter in apps/server/src/provider/Layers
  -> ProviderRuntimeEvent stream
  -> orchestration ingestion and projection
  -> web/desktop UI state and notifications
```

## Important Boundaries

| Area                              | Source                                                 |
| --------------------------------- | ------------------------------------------------------ |
| OpenCode adapter                  | `apps/server/src/provider/Layers/OpenCodeAdapter.ts`   |
| OpenCode WSL bootstrap            | `apps/server/src/provider/openCodeRuntimeBootstrap.ts` |
| Provider health/update advisories | `apps/server/src/provider/Layers/ProviderHealth.ts`    |
| Runtime event contracts           | `packages/contracts/src/providerRuntime.ts`            |
| Ingestion/projection              | `apps/server/src/orchestration`                        |

## Invariants

- Provider adapters should emit canonical turn lifecycle events instead of leaking raw provider events directly to the UI.
- Do not suppress runtime errors globally; reproduce the provider event path and add a focused regression.
- OpenCode can run as an external/remote runtime; do not infer external runtime freshness from the local `opencode` CLI.
- Settings may trigger provider runtime bootstrap actions, but the server owns service creation, runtime profile mutation, and runtime health verification.
- Idle/completion behavior must distinguish truly missing assistant output from assistant output that arrived through snapshots, part updates, or newer provider events.

## Settings-Owned Actions, Server-Owned Effects

The Settings UI can expose provider-aware actions such as **Install OpenCode
runtime** and **Repair runtime**, but those actions are only triggers. Server RPC
handlers perform the side effects: detecting support, rendering service files,
calling user systemd, updating OpenCode runtime profiles through
`ServerSettingsService`, and running runtime health checks. Install and repair
are owner-only operations because they mutate local service files and active
provider settings.

For the WSL OpenCode runtime lane, the server creates a loopback-only external
OpenCode profile (`wsl-opencode-service`) that points at
`http://127.0.0.1:4096/`. This is separate from the broader Windows/WSL backend
routing design: it bootstraps one provider runtime service and does not route
projects, terminals, git, or provider sessions across backend boundaries.
