# ADR 0005: Remote Clients Use Scoped Capability Tokens

| Field           | Value                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status          | Accepted                                                                                                                                                            |
| Type            | Architecture decision record                                                                                                                                        |
| Owner           | Engineering                                                                                                                                                         |
| Audience        | Maintainers, reviewers, and automation agents                                                                                                                       |
| Scope           | Remote Client Runtime authentication, capability scopes, pairing/session semantics, observe-and-approve clients, and the Server Auth Boundary                       |
| Canonical path  | `docs/adr/0005-scoped-remote-client-capability-tokens.md`                                                                                                           |
| Last reviewed   | 2026-06-05                                                                                                                                                          |
| Review cadence  | Event-driven; review when remote clients gain mutation capabilities, the Server Auth Boundary changes, or JCode becomes a hosted multi-tenant product               |
| Source of truth | `CONTEXT.md`, `docs/adr/0001-local-coding-agent-cockpit.md`, `docs/security/dev-automation-access.md`, `packages/contracts/src/auth.ts`, and `apps/server/src/auth` |
| Verification    | Confirm remote access paths do not reuse the dev automation access grant and focused server/auth tests cover any new capability-token routes                        |

## Context

JCode is a local-first coding-agent cockpit. ADR 0001 keeps the product boundary on local utility, fast recovery, explicit runtime boundaries, and safe public defaults rather than hosted multi-tenant behavior.

The current auth contracts already distinguish server auth policy, bootstrap methods, session methods, and session roles in `packages/contracts/src/auth.ts`. The dev automation access grant is intentionally narrower: it exists for trusted loopback browser automation and must not become a general remote-client access path.

The upstream roadmap now includes a Remote Client Runtime. The first capability set is observe-and-approve: trusted non-primary clients can view selected cockpit state, answer pending user-input requests, and approve or deny pending actions. They cannot initially submit freeform new turns, run git actions, mutate projects, or reach full cockpit parity.

That capability set changes the Server Auth Boundary. A phone, remote browser, or lightweight approval companion should not receive the same broad owner session as the primary local cockpit unless a later ADR accepts that risk.

## Decision

Remote clients will authenticate through owner-issued capability tokens with explicit scopes.

The first scoped token model should support only observe-and-approve capabilities. Candidate scopes include:

- `thread:read` for selected thread/project state needed by a companion client;
- `approval:respond` for approve/deny decisions on pending provider actions;
- `user_input:respond` for answering pending provider elicitation/user-input requests;
- `provider_status:read` for health, rate-limit, and active-session status required to understand pending work.

Remote clients must not reuse the dev automation access grant. That grant remains loopback-only, opt-in, and limited to trusted local browser automation.

Capability tokens should be owner-issued through an explicit pairing or management flow. Each token should record its scopes, client identity metadata, expiration/revocation state, and the selected resources it can observe or control.

## Options Considered

### Option A: Scoped Owner-Issued Capability Tokens

| Dimension        | Assessment                                                                |
| ---------------- | ------------------------------------------------------------------------- |
| Complexity       | Medium                                                                    |
| Security posture | Strongest fit for observe-and-approve remote clients                      |
| Product fit      | Preserves local-first cockpit while enabling trusted companion clients    |
| Reversibility    | Medium; token shape and scope names become durable auth boundary concepts |

**Pros**

- Matches the narrow first capability set.
- Keeps remote clients distinct from primary owner browser sessions.
- Gives future mobile, remote browser, and approval companions a shared trust model.
- Makes expansion to mutation scopes an explicit later decision.

**Cons**

- Requires new contracts, persistence, server checks, and UI for issuing/revoking tokens.
- Adds scope semantics that must be kept consistent across HTTP, WebSocket, and orchestration routes.

### Option B: Reuse Normal Browser Owner Sessions

| Dimension        | Assessment                                                        |
| ---------------- | ----------------------------------------------------------------- |
| Complexity       | Low initial implementation                                        |
| Security posture | Too broad for first remote clients                                |
| Product fit      | Blurs primary cockpit and companion-client responsibilities       |
| Reversibility    | Harder once remote clients depend on broad owner-session behavior |

**Pros**

- Minimal new auth model.
- Reuses existing session methods.

**Cons**

- Gives remote clients more authority than observe-and-approve requires.
- Makes it harder to reason about remote-reachable deployments.
- Risks weakening the Server Auth Boundary before the Remote Client Runtime is mature.

### Option C: One-Time Pairing Without Durable Tokens

| Dimension        | Assessment                              |
| ---------------- | --------------------------------------- |
| Complexity       | Medium                                  |
| Security posture | Narrow, but operationally noisy         |
| Product fit      | Poor for persistent approval companions |
| Reversibility    | Medium                                  |

**Pros**

- Limits long-lived credential risk.
- Keeps early experiments small.

**Cons**

- Annoying for a companion client that should survive restarts.
- Does not model capability differences cleanly.
- Still needs scope semantics if more than read-only access exists.

### Option D: Defer Auth Until After Prototype

| Dimension        | Assessment                                               |
| ---------------- | -------------------------------------------------------- |
| Complexity       | Low now, high later                                      |
| Security posture | Unacceptable for remote-reachable behavior               |
| Product fit      | Conflicts with JCode's local-first security posture      |
| Reversibility    | Poor if prototype behavior leaks into committed defaults |

**Pros**

- Fastest way to explore UI mechanics.

**Cons**

- Creates the wrong pressure: feature code starts depending on undefined trust boundaries.
- Increases the risk that dev automation or owner sessions are reused inappropriately.

## Consequences

- Remote Client Runtime implementation must start with contracts and auth semantics, not UI-only client work.
- Observe-and-approve clients need routes and push channels that check token scopes before exposing thread, approval, user-input, or provider-status data.
- Any later expansion to freeform turns, git actions, project mutation, or full cockpit parity should require either an ADR update or a follow-on ADR.
- Dev automation access docs remain correct: the grant is not a remote-client auth path.

## Action Items

1. Define capability-token contract types, scope literals, and client metadata fields.
2. Design persistence for issued tokens, expiration, revocation, and selected resource grants.
3. Add server auth checks that can authorize by scope and resource, separate from owner cookie sessions.
4. Add focused tests proving remote clients cannot use the dev automation grant and cannot exceed their scopes.
5. Design the owner-facing token issuance and revocation surface before enabling any remote client by default.
