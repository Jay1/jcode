# Runtime Boundaries

| Field           | Value                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                                                  |
| Type            | Architecture reference                                                                                                  |
| Owner           | Engineering                                                                                                             |
| Audience        | Maintainers, reviewers, and automation agents                                                                           |
| Scope           | JCode app/package boundaries and the runtime responsibilities of server, web, desktop, marketing, packages, and scripts |
| Canonical path  | `docs/architecture/runtime-boundaries.md`                                                                               |
| Last reviewed   | 2026-05-22                                                                                                              |
| Review cadence  | Event-driven; review when workspace boundaries, provider adapters, or app entry points change                           |
| Source of truth | `package.json`, `turbo.json`, `apps/*/package.json`, `packages/*/package.json`, root and area `AGENTS.md` files         |
| Verification    | Focused build/test command for the changed workspace plus source cross-checks                                           |

## Purpose

This document maps the main runtime boundaries in JCode. It is not a generated dependency graph or full API reference; source and tests remain authoritative.

## Workspaces

| Workspace             | Responsibility                                                                               | Entry points                                 | Verification anchor                      |
| --------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------- |
| `apps/server`         | Local server, provider adapters, orchestration, persistence, terminal and workspace services | `src/index.ts`, `src/main.ts`                | `bun run --cwd apps/server test <path>`  |
| `apps/web`            | Vite React UI, chat cockpit, WebSocket/native bridge clients, browser tests                  | `src/main.tsx`, `src/router.ts`              | `bun run --cwd apps/web test <path>`     |
| `apps/desktop`        | Electron shell, desktop main process, preload bridge, packaging smoke checks                 | `src/main.ts`                                | `bun run --cwd apps/desktop build`       |
| `apps/marketing`      | Astro marketing site and public metadata                                                     | `src/pages/index.astro`                      | `bun run --cwd apps/marketing build`     |
| `packages/contracts`  | Shared RPC, runtime, terminal, provider, and orchestration contracts                         | `src/index.ts`                               | `bun run --cwd packages/contracts test`  |
| `packages/shared`     | Shared pure utilities and domain helpers                                                     | `src/*` exports                              | `bun run --cwd packages/shared test`     |
| `packages/effect-acp` | ACP client/agent/protocol support and generated schema bindings                              | `src/client.ts`, `src/agent.ts`              | `bun run --cwd packages/effect-acp test` |
| `scripts`             | Dev runner, release artifact builders, version helpers, smoke checks                         | `dev-runner.ts`, `build-desktop-artifact.ts` | `bun run --cwd scripts test`             |

## Runtime Flow

```text
Desktop shell or browser
  -> Web UI
  -> Server HTTP/WebSocket runtime
  -> Provider adapters and local tools
  -> Persistence, workspace, terminal, and runtime health services
```

## Change Rules

- Contract changes are cross-cutting; verify at least one affected consumer.
- Provider adapter changes must preserve event ordering and turn lifecycle invariants.
- Desktop preload or bridge changes should be treated as API changes.
- Marketing copy and README positioning should stay consistent.
