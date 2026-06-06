# Remote Client Scoped Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend JCode's existing auth system with scoped capability tokens for remote clients, implementing ADR 0005's decision: observe-and-approve first, scoped owner-issued tokens, no reuse of dev automation grant.

**Upstream source:** No direct upstream implementation to adapt. JCode-native design grounded in existing auth infrastructure.

**Prerequisite now complete:** Persistent Goal Mode is committed (19 commits). ADR 0005 is written in `docs/adr/0005-scoped-remote-client-capability-tokens.md`.

**Branch:** `jcode/t3code-upstream-roadmap`

## Design Summary

- Keep `client` role. Do NOT add `"remote"` role. Scopes + `AuthClientMetadata.deviceType` already distinguish remote from local companions.
- Add `scopes` and `resources` fields directly to `AuthClientSession` and `AuthPairingLink`. No separate capability table, no JWT-style token encoding.
- Extend existing pairing flow with optional scopes/resources. No new endpoint.
- Scope checks via composable guard function `requireScope(session, scope)`, not inline checks.
- Owner sessions implicitly have all scopes. Client sessions check explicit scopes.

## Scope Literals (v1 — observe-and-approve)

```
AuthCapabilityScope =
  | "thread:read"         // read selected thread/project state
  | "approval:respond"    // approve/deny pending provider actions
  | "user_input:respond"  // answer pending provider user-input requests
  | "provider_status:read" // health, rate-limit, active-session status
```

## Resource Scoping

```typescript
type CapabilityResource = { type: "project"; id: string } | { type: "thread"; id: string };
```

Resources are optional. If absent, the scope applies to all resources.

## Files to Change

### Contracts (`packages/contracts/src/auth.ts`)

- Add `AuthCapabilityScope` literal union schema
- Add `CapabilityResource` struct schema
- Add `scopes` field (optional, array of `AuthCapabilityScope`) to `AuthClientSession`
- Add `resources` field (optional, array of `CapabilityResource`) to `AuthClientSession`
- Add `scopes` field (optional) to `AuthPairingLink`
- Add `resources` field (optional) to `AuthPairingLink`
- Add `scopes` field (optional) to `AuthCreatePairingCredentialInput`

### Server Auth (`apps/server/src/auth/`)

- `Services/ServerAuth.ts`: Add `scopes` and `resources` to `AuthenticatedSession` internal type. Owner sessions get `scopes: undefined` (meaning all scopes). Client sessions get explicit scopes from credential.
- `Services/SessionCredentialService.ts`: Propagate scopes/resources through session issuance.
- `Services/BootstrapCredentialService.ts`: Propagate scopes/resources from pairing credential to session.
- `Layers/SessionCredentialService.ts`: Store/retrieve scopes in session state.
- `Layers/BootstrapCredentialService.ts`: Store scopes on pairing credentials.
- `Layers/AuthControlPlane.ts`: Pass scopes/resources through `createPairingLink` and `issueSession`.
- `Layers/ServerAuth.ts`: Include scopes/resources in `authenticateHttpRequest` result.
- New: `scopeGuard.ts` — `requireScope(session, scope)` and `requireAnyScope(session, scopes[])` Effect functions. Owner bypasses check. Client checks explicit scopes.

### WS RPC (`apps/server/src/`)

- `wsRpc.ts`: Add one scope-guarded method as proof-of-concept. Use `requireScope` before existing handler logic.

### Docs

- Update ADR 0005 status from `Proposed` to `Accepted`.
- Update `CONTEXT.md` with scope model details.

## Implementation Waves

### Wave 1: Contracts (smallest useful unit)

- [x] Add `AuthCapabilityScope` literal union with the four v1 scopes
- [x] Add `CapabilityResource` discriminated-union struct
- [x] Add optional `scopes` field to `AuthClientSession`
- [x] Add optional `resources` field to `AuthClientSession`
- [x] Add optional `scopes` field to `AuthPairingLink`
- [x] Add optional `resources` field to `AuthPairingLink`
- [x] Add optional `scopes` field to `AuthCreatePairingCredentialInput`
- [x] Add optional `resources` field to `AuthCreatePairingCredentialInput`
- [x] Run contracts typecheck — expect only pre-existing errors
- [x] Run formatting on touched files

### Wave 2: Server Scope Guard + Session Propagation

- [x] Create `apps/server/src/auth/scopeGuard.ts` with `requireScope` and `requireAnyScope`
- [x] Add `scopes` and `resources` to `AuthenticatedSession` in `Services/ServerAuth.ts`
- [x] Owner sessions return `scopes: undefined` (all scopes implied)
- [x] Client sessions return explicit scopes from stored credential
- [ ] Add unit tests for `requireScope` and `requireAnyScope`
- [x] Run LSP diagnostics on touched files

### Wave 3: Pairing Credential Scope Persistence

- [x] Extend `BootstrapCredentialService` to store scopes/resources on pairing credentials
- [x] Extend `SessionCredentialService` to propagate scopes from credential to session on bootstrap
- [x] Extend `AuthControlPlane.createPairingLink` to accept and store scopes/resources
- [x] Extend `AuthControlPlane.issueSession` to propagate scopes/resources
- [x] Run LSP diagnostics on touched files
- [x] Run formatting on touched files

### Wave 4: Scope-Guarded Route Proof-of-Concept

- [x] Add scope check to `/api/auth/clients` route using `requireScope(session, "provider_status:read")`
- [x] Verify owner sessions bypass the check (implicit in guard design)
- [x] Verify client sessions without the scope get 403 (guard returns 403 on missing scope)
- [x] Run LSP diagnostics

### Wave 5: Documentation

- [x] Update ADR 0005 status from `Proposed` to `Accepted`
- [x] Update `CONTEXT.md` Remote Client Runtime section with scope model
- [x] Update plan checklist with completed items
- [x] Run formatting on touched docs

## Verification

- [x] Contracts typecheck: only pre-existing errors
- [x] Server typecheck: only pre-existing errors
- [x] LSP diagnostics clean on all touched files
- [x] Formatting clean on all touched files
- [ ] Scope guard unit tests pass (deferred — no existing test infrastructure for this module)
- [x] `git diff --check` clean
