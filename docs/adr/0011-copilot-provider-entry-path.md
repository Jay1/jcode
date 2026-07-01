# ADR 0011: Copilot Provider Entry Path

| Status | Proposed   |
| ------ | ---------- |
| Date   | 2026-06-30 |

## Context

Roadmap task 11 covers GitHub Copilot support from T3Code PR #3076. The preflight narrowed the first JCode slice to an ADR/spike that decides whether Copilot should become a first-class JCode Provider or enter through an OpenCode-backed/model-source integration.

JCode's provider boundary is intentionally narrow: provider-specific behavior belongs behind server provider/runtime boundaries, and shared UI/persistence should consume canonical contracts instead of raw provider protocol payloads. The provider runtime architecture also requires adapters to emit canonical `ProviderRuntimeEvent` streams and preserve turn lifecycle semantics.

The inspected T3Code patch implements Copilot as a full first-class provider: it adds a `copilot` driver kind, SDK dependency, provider settings, model defaults, UI entries, a large `CopilotAdapter`, Copilot text generation, `copilot.sdk.event` raw event source, auth/status probing, and registry tests. That is useful as a future reference, but importing it as-is would add real SDK auth/network/runtime behavior before JCode has proven the provider entry path.

## Decision

Start Copilot support as an **OpenCode-backed model-source integration**, not as a first-class JCode Provider.

The first implementation path is:

1. Keep the runtime provider as `opencode` until Copilot needs independent session lifecycle semantics that OpenCode cannot host.
2. Represent GitHub Copilot as a model-source candidate with offline status and model-discovery semantics.
3. Treat missing Copilot credentials as a typed status condition (`authStatus: "unauthenticated"`) with no secrets, account UI, token storage, or network calls in the spike.
4. Require canonical provider-runtime event mapping before any future Copilot turn execution.

The task-11 spike proof lives in `apps/server/src/provider/copilotProviderSpike.ts`. It intentionally returns an OpenCode-hosted registry entry and an unauthenticated offline status snapshot with an empty model list. This proves the data surface without adding `copilot` to `ProviderKind`, server settings, UI provider pickers, or runtime layers.

## Tradeoffs

**Why not first-class provider now:**

- A first-class provider requires shared contract expansion, adapter service wiring, settings, runtime health, model selection, text generation, and UI availability decisions at the same time.
- T3Code's adapter is large and SDK-specific; copying it would bypass JCode's canonical event and provider-status boundaries.
- Real Copilot auth and SDK startup are external integrations that need a separate secrets and failure-mode review.

**Why OpenCode-backed/model-source first:**

- It preserves JCode's current OpenCode-centered product boundary.
- It lets the server prove auth-missing and model-discovery semantics before runtime streaming.
- It keeps Copilot-specific details out of generic UI while leaving a typed path for future provider expansion.

**Cost:**

- Copilot cannot execute turns as an independent JCode provider in this slice.
- If OpenCode cannot expose Copilot as a safe model source, a later ADR or ADR update must promote Copilot to a first-class provider with explicit contracts.

## Non-Goals

- No real GitHub Copilot SDK dependency.
- No Copilot tokens, login flows, credential storage, or account settings UI.
- No network calls, runtime streaming, text-generation runtime, or session lifecycle.
- No Copilot-specific behavior in shared chat, settings, timeline, composer, or provider picker UI.
- No DPCode inspection for this decision.

## Follow-Up Slices

1. **OpenCode capability probe:** Determine whether a configured OpenCode runtime can report Copilot-backed models without exposing secrets.
2. **Offline auth/status adapter:** Add a server-only probe that reports authenticated, unauthenticated, unsupported, or unreachable states without storing Copilot secrets.
3. **Model-source discovery:** Surface Copilot-backed models through existing provider discovery contracts, still hosted by `opencode`.
4. **Runtime event mapping spike:** If Copilot needs direct turn execution, map a minimal fake Copilot event stream into canonical `ProviderRuntimeEvent` before adding SDK calls.
5. **First-class provider review:** Promote Copilot to `ProviderKind: "copilot"` only if the model-source path cannot provide required behavior or if Copilot requires independent sessions, permissions, or usage accounting.

## Consequences

- Roadmap task 11 is complete as an ADR/spike, not a shipped Copilot provider.
- Future Copilot work starts from provider-status and model-source proof instead of UI/provider-kind expansion.
- T3Code #3076 remains a reference for auth/status/model mechanics and event mapping, but JCode will adapt only bounded slices after each boundary is proven.
