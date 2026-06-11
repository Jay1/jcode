# Remote Client Runtime — WS RPC Scope Wiring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire scope guards into the WS RPC layer so that scoped remote clients can only access methods their capability tokens allow. Owner sessions bypass all checks.

**Upstream source:** No direct upstream implementation. JCode-native design using existing scope guard infrastructure from ADR 0005.

**Prerequisite now complete:** Remote Client Scoped Auth (ADR 0005, Accepted) — `requireScope`/`requireAnyScope` guards, `AuthenticatedSession.scopes`/`resources`, four v1 scopes committed.

**Branch:** `jcode/t3code-upstream-roadmap`

## Architecture Decision

**Approach: Hybrid (Option C) — full session in context + `withScope` wrapper**

Rationale:

- The WS RPC layer already has a `rpcEffect` wrapper (line 424-425) that maps handler errors. A `withScope` wrapper fits naturally alongside it.
- `CurrentRpcAuthSession` currently only stores `sessionId`. Replace it with the full `AuthenticatedSession` (including `scopes`/`resources`).
- Each guarded handler wraps with `withScope("thread:read", handler)` — explicit at registration site, composable, impossible to silently bypass.
- Owner sessions (scopes undefined) bypass ALL scope checks with zero overhead — the `requireScope` guard already handles this.
- Unguarded methods (available to all authenticated sessions) simply don't use `withScope`.

## Scope → Method Mapping

### thread:read

- `ORCHESTRATION_WS_METHODS.subscribeThread` — stream thread events
- `ORCHESTRATION_WS_METHODS.unsubscribeThread` — stop thread stream
- `ORCHESTRATION_WS_METHODS.getSnapshot` — full orchestration snapshot
- `ORCHESTRATION_WS_METHODS.getShellSnapshot` — shell snapshot
- `ORCHESTRATION_WS_METHODS.getTurnDiff` — turn diff
- `ORCHESTRATION_WS_METHODS.getFullThreadDiff` — full thread diff
- `ORCHESTRATION_WS_METHODS.replayEvents` — replay orchestration events
- `ORCHESTRATION_WS_METHODS.subscribeShell` — stream shell events
- `ORCHESTRATION_WS_METHODS.unsubscribeShell` — stop shell stream

### approval:respond

- `ORCHESTRATION_WS_METHODS.dispatchCommand` — BUT ONLY for `thread.approval.respond` command type. Other dispatch commands require owner role.

### user_input:respond

- `ORCHESTRATION_WS_METHODS.dispatchCommand` — BUT ONLY for `thread.user-input.respond` command type.

### provider_status:read

- `WS_METHODS.subscribeServerProviderStatuses` — stream provider status
- `WS_METHODS.serverGetConfig` — server config (includes provider info)

### Unguarded (available to all authenticated sessions)

- `WS_METHODS.serverGetProviderUsageSnapshot` — usage data (not sensitive for observe clients)
- `WS_METHODS.serverDiagnostics` — diagnostics (not sensitive for observe clients)

### Owner-only (no scope, must be owner role)

- `ORCHESTRATION_WS_METHODS.importThread` — thread import (owner-level action that modifies server state)
- All git methods (`gitPull`, `gitStatus`, `gitCheckout`, etc.)
- All terminal methods (`terminalOpen`, `terminalWrite`, etc.)
- Project write methods (`projectsWriteFile`)
- `WS_METHODS.shellOpenInEditor`
- `ORCHESTRATION_WS_METHODS.repairState`
- Thread mutation commands via dispatch (create, delete, archive, turn start, etc.)

## Files to Change

### 1. `apps/server/src/wsRpc.ts`

- **Replace `CurrentRpcAuthSession`**: Store full `AuthenticatedSession` instead of just `sessionId`.
- **Add `withScope` helper**: Wraps an RPC handler with scope guard check. Gets session from context service, calls `requireScope`, returns 403 on failure.
- **Add `withCommandScope` helper**: For `dispatchCommand` — inspects the command type and checks the appropriate scope.
- **Guard handlers**: Wrap each method handler with the appropriate scope wrapper at registration site.

### 2. `apps/server/src/auth/Services/scopeGuard.ts`

- No changes needed — `requireScope` and `requireAnyScope` already exist and handle owner bypass.

### 3. `apps/server/src/auth/http.ts`

- No changes needed — HTTP route scope guard already wired.

## Wave Plan

### Wave 1: Context Service Upgrade

- [ ] Replace `CurrentRpcAuthSession` shape from `{ sessionId }` to full `AuthenticatedSession`
- [ ] Update `wsRpc.ts` line 1009-1014 to provide full session in `Effect.provideService`
- [ ] Update all consumers of `CurrentRpcAuthSession` to use `.sessionId` accessor (should be minimal — used for session listing only)

### Wave 2: Scope Guard Wrappers

- [ ] Create `withScope(scope, handler)` helper that reads session from context, calls `requireScope`, wraps in rpcEffect-style error mapping
- [ ] Create `withAnyScope(scopes, handler)` for methods needing multiple scopes
- [ ] Create `withCommandScope(handler)` for `dispatchCommand` — inspects command type to determine required scope

### Wave 3: Wire Observe Methods (thread:read)

- [ ] Wrap `subscribeThread`, `unsubscribeThread` with `withScope("thread:read", ...)`
- [ ] Wrap `getSnapshot`, `getShellSnapshot` with `withScope("thread:read", ...)`
- [ ] Wrap `getTurnDiff`, `getFullThreadDiff` with `withScope("thread:read", ...)`
- [ ] Wrap `replayEvents` with `withScope("thread:read", ...)`
- [ ] Wrap `subscribeShell`, `unsubscribeShell` with `withScope("thread:read", ...)`

### Wave 4: Wire Approve/Respond Methods

- [ ] Wrap `dispatchCommand` with `withCommandScope(...)` that checks:
  - `thread.approval.respond` → `approval:respond`
  - `thread.user-input.respond` → `user_input:respond`
  - All other command types → owner-only (reject with 403 for client sessions)

### Wave 5: Wire Provider Status Methods

- [ ] Wrap `subscribeServerProviderStatuses` with `withScope("provider_status:read", ...)`
- [ ] Wrap `serverGetConfig` with `withScope("provider_status:read", ...)`

### Wave 6: Documentation

- [x] Write ADR 0006: Remote Client Runtime WS Scope Wiring (see [ADR 0006](../../adr/0006-remote-client-runtime-ws-rpc-scope-wiring.md))
- [ ] Update `CONTEXT.md` with runtime scope wiring decisions

## Verification

- LSP diagnostics clean on all changed files
- `bunx oxfmt@0.52.0 --check` on changed files
- Existing WS RPC behavior unchanged for owner sessions (scopes undefined = all access)
- Client sessions without required scope get 403 on guarded methods
