# ADR 0006: Remote Client Runtime — WS RPC Scope Wiring

| Status | Decided    |
| ------ | ---------- |
| Date   | 2026-06-06 |

## Context

ADR 0008 defined scoped capability tokens for remote clients and wired the first HTTP route guard. The WS RPC layer — where real-time cockpit interactions happen — has no scope checks. Any authenticated session (owner or client) can access all ~65 WS RPC methods, including thread reading, approval responding, git operations, terminal commands, and project writes.

Remote clients with scoped tokens should only access methods matching their granted scopes. Owner sessions must continue to bypass all checks with zero overhead.

## Decision

Wire scope guards into the WS RPC layer using a hybrid approach:

1. **Context service upgrade**: Replace the `CurrentRpcAuthSession` context service (which stored only `sessionId`) with the full `AuthenticatedSession` (including `scopes` and `resources`). The WS upgrade handler already produces a full session — propagate it into the RPC context.

2. **Three wrapper functions** alongside the existing `rpcEffect` pattern:
   - `withScope(scope, effect)` — wraps Effect-returning handlers with scope guard
   - `withScopeStream(scope, stream)` — wraps Stream-returning handlers with scope guard
   - `withCommandScope(command, effect)` — inspects `dispatchCommand` type field to determine required scope

3. **Method → Scope mapping**:
   - `thread:read` → subscribeThread, unsubscribeThread, getSnapshot, getShellSnapshot, getTurnDiff, getFullThreadDiff, replayEvents, subscribeShell, unsubscribeShell
   - `approval:respond` → dispatchCommand with type `thread.approval.respond`
   - `user_input:respond` → dispatchCommand with type `thread.user-input.respond`
   - `provider_status:read` → serverGetConfig, subscribeServerProviderStatuses
   - All other methods remain ungated (available to any authenticated session) or owner-only (enforced by `withCommandScope` rejecting non-owner clients for unrecognized command types)

4. **Owner bypass**: Owner sessions have `scopes: undefined`. The `requireScope` guard (from ADR 0008) returns immediately for undefined scopes — zero overhead on owner WebSocket connections.

## Scope Mapping Reference

| Scope                  | Methods                                                                                                                                           | Notes                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `thread:read`          | subscribeThread, unsubscribeThread, getSnapshot, getShellSnapshot, getTurnDiff, getFullThreadDiff, replayEvents, subscribeShell, unsubscribeShell | All read-only thread observation            |
| `approval:respond`     | dispatchCommand (type=thread.approval.respond)                                                                                                    | Approve/deny pending provider actions       |
| `user_input:respond`   | dispatchCommand (type=thread.user-input.respond)                                                                                                  | Answer pending provider user-input requests |
| `provider_status:read` | serverGetConfig, subscribeServerProviderStatuses                                                                                                  | Provider health, rate-limit, config         |

## Consequences

- Remote clients with appropriate scopes can observe thread state, respond to approvals/user-input, and read provider status via WebSocket — enabling mobile/remote approval companions.
- Owner sessions are completely unaffected — all guards bypass when `scopes` is undefined.
- Client sessions without the required scope get `WsRpcError` with a clear message.
- Unguarded methods (git, terminal, project write, etc.) remain available to any authenticated session. Remote clients are always created with explicit scopes by an owner, so unguarded methods are not exposed to remote client sessions — only to owner sessions that connect without a scoped token.
- Resource scoping (project/thread ID filtering) is deferred to a later slice; see [ADR 0008](0008-scoped-remote-client-capability-tokens.md) for the scoped token design.
