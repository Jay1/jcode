# JCode System Overview

| Field           | Value                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                                     |
| Type            | Architecture reference                                                                                     |
| Owner           | Engineering                                                                                                |
| Audience        | Engineers, reviewers, and automation agents                                                                |
| Scope           | High-level JCode monorepo shape, runtime boundaries, and primary apps/packages                             |
| Canonical path  | `docs/architecture/system-overview.md`                                                                     |
| Last reviewed   | 2026-05-22                                                                                                 |
| Review cadence  | Event-driven; review when workspace shape, app boundaries, package exports, or runtime entry points change |
| Source of truth | `package.json`, `turbo.json`, `apps/*/package.json`, `packages/*/package.json`, and `AGENTS.md`            |
| Verification    | Cross-check package scripts and workspace paths; run focused builds/tests when changing runtime claims     |

## Purpose

This document orients maintainers and agents to JCode's runtime shape. It is not a generated module graph, complete API reference, or roadmap.

## Runtime Shape

```text
Browser / Electron renderer
  -> apps/web React UI
  -> apps/server local HTTP/WebSocket runtime
  -> provider adapters and orchestration state
  -> local workspace, terminal, git, persistence, and agent runtime integrations

Electron main process
  -> apps/desktop shell and preload bridge
  -> bundled server/web outputs for desktop distribution
```

## Workspaces

| Workspace             | Responsibility                                                                               | Primary commands                                         |
| --------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `apps/server`         | Local server, provider adapters, orchestration, persistence, terminal/workspace integrations | `bun run --cwd apps/server test`, `build`, `typecheck`   |
| `apps/web`            | Vite React UI and browser tests                                                              | `bun run --cwd apps/web test`, `build`, `test:browser`   |
| `apps/desktop`        | Electron shell, preload bridge, desktop packaging smoke checks                               | `bun run --cwd apps/desktop build`, `test`, `smoke-test` |
| `apps/marketing`      | Astro marketing site                                                                         | `bun run --cwd apps/marketing build`, `typecheck`        |
| `packages/contracts`  | Cross-app contract and RPC types                                                             | `bun run --cwd packages/contracts test`, `build`         |
| `packages/shared`     | Shared pure utilities and domain helpers                                                     | `bun run --cwd packages/shared test`                     |
| `packages/effect-acp` | ACP client/agent/protocol support                                                            | `bun run --cwd packages/effect-acp test`, `generate`     |
| `scripts`             | Dev runner, release, desktop artifact, and automation scripts                                | `bun run --cwd scripts test`, `typecheck`                |

## Architecture Rules

- Keep provider-specific behavior behind server provider/runtime boundaries.
- Keep cross-process and web/server contracts in `packages/contracts` when shared by multiple apps.
- Prefer focused workspace commands while developing; use root CI commands only when explicitly needed.
- Do not edit generated build output under `dist/` or `dist-electron/` directly.
