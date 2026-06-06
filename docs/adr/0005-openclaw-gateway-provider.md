# ADR 0005: OpenClaw Gateway Integrates As A First-Class Provider

| Field           | Value                                                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status          | Proposed                                                                                                                                                                      |
| Type            | Architecture decision record                                                                                                                                                  |
| Owner           | Engineering                                                                                                                                                                   |
| Audience        | Maintainers, reviewers, and automation agents                                                                                                                                 |
| Scope           | OpenClaw provider integration, gateway chat runtime, Settings provider configuration, provider runtime events, and OpenClaw source reuse                                      |
| Canonical path  | `docs/adr/0005-openclaw-gateway-provider.md`                                                                                                                                  |
| Last reviewed   | 2026-06-05                                                                                                                                                                    |
| Review cadence  | Event-driven; review if OpenClaw gateway protocol changes, JCode adds richer OpenClaw capabilities, or source reuse moves beyond protocol/client/runtime translation patterns |
| Source of truth | `CONTEXT.md`, `docs/superpowers/specs/2026-06-05-openclaw-provider-design.md`, provider contracts, server provider adapters, and OpenClaw gateway protocol source             |
| Verification    | Confirm OpenClaw appears as a provider, gateway secrets remain server-owned, JCode threads map to isolated OpenClaw sessions, and runtime events stay canonical               |

## Context

JCode models coding-agent integrations as Providers. Provider settings, health, discovery, session start, turn sending, and runtime events are already shared across Codex, Claude, OpenCode, Kilo, Cursor, Gemini, and Pi.

OpenClaw exposes chat through a WebSocket Gateway rather than through a simple external web page or local CLI-only runtime. Its gateway protocol includes a `connect.challenge` handshake, operator client roles and scopes, and chat methods such as `chat.history` and `chat.send`.

The tempting implementation choices are not equivalent:

- A Settings "connection" sounds user-friendly but conflicts with JCode's existing Connections settings, which pair clients to the JCode server.
- An external OpenClaw chat launcher would bypass JCode Threads, Provider health, Orchestration, and canonical runtime events.
- Importing OpenClaw's full web chat UI would duplicate JCode's transcript, composer, provider picker, and local-first cockpit boundaries.

## Decision

OpenClaw will integrate as a first-class JCode Provider named `openclaw`, configured under Settings -> Providers and selected from the normal provider picker.

The first version is intentionally narrow:

- Users configure a Gateway URL plus optional token/password authentication.
- JCode accepts `http(s)://` and `ws(s)://` input, normalizes internally to WebSocket, and shows the normalized URL in health details.
- Loopback `ws://` gateways remain valid for local development, but public remote gateways require `wss://`; LAN/tailnet exceptions must be explicit user choices.
- JCode identifies as a minimal operator client using OpenClaw's canonical gateway client id, backend mode, and a `JCode` display name. It requests only `operator.read` and `operator.write` scopes.
- JCode negotiates OpenClaw protocol v4 in v1 and completes the `connect.challenge` device flow when remote scoped access requires it.
- Each JCode Thread maps to an isolated OpenClaw `sessionKey`, recommended as `jcode:<threadId>`.
- The visible target is a single text-only `OpenClaw Gateway` option.
- JCode persists that target as `{ provider: "openclaw", model: "gateway" }`, where `gateway` is a JCode sentinel for the single gateway target rather than an OpenClaw model slug.
- Attachments, agent selection, custom model slugs, slash-command discovery, skill/plugin discovery, approvals, and steering are deferred.
- OpenClaw does not participate in Git text generation or default model selection in v1.

OpenClaw non-secret configuration belongs in server settings. OpenClaw secrets, device private keys, and paired-device tokens belong in a separate server-owned secret file under `ServerConfig.secretsDir`. This creates a new provider-secret storage seam; implementation must define atomic writes, owner-only permissions where supported, clear/rotate behavior, write-only secret update operations, and read responses that expose only secret presence metadata. OpenClaw credentials and device material must be resolved by the server-side adapter and must not be copied into persisted `ProviderStartOptions` or runtime/session payloads.

OpenClaw's MIT-licensed gateway protocol, gateway client, retry, chat history, chat send, chat abort, and stream reconciliation behavior may be inspected and adapted into small JCode-native pieces. Current `@openclaw/*` client packages are private workspace packages, so JCode should not assume npm-installable OpenClaw clients unless publication changes. JCode should not wholesale vendor OpenClaw's web chat UI unless a later ADR changes the cockpit boundary.

## Options Considered

### Option A: External OpenClaw Chat Launcher

| Dimension       | Assessment                                                                         |
| --------------- | ---------------------------------------------------------------------------------- |
| Complexity      | Low                                                                                |
| Cost            | Low initial cost, high product fragmentation                                       |
| JCode fit       | Weak; bypasses Thread, Provider, Orchestration, health, and runtime-event concepts |
| User experience | Familiar to OpenClaw users but inconsistent with JCode provider workflows          |
| Maintainability | Low JCode maintenance, but little control over integrated behavior or diagnostics  |

**Pros:** Fast to ship; minimal gateway protocol work.

**Cons:** Does not make OpenClaw a JCode Provider; cannot preserve JCode thread/session semantics; hides provider health and canonical event handling outside JCode.

### Option B: Settings Connections Entry

| Dimension       | Assessment                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------- |
| Complexity      | Medium                                                                                       |
| Cost            | Moderate; needs a new remote-chat concept                                                    |
| JCode fit       | Weak; JCode Connections currently mean client-to-server pairing, not provider runtime config |
| User experience | Matches the user's word "connection" but creates ambiguous Settings taxonomy                 |
| Maintainability | Risky; future agents could confuse network pairing with provider runtime settings            |

**Pros:** Lets users paste a URL in a Settings area that sounds natural.

**Cons:** Conflicts with existing Settings semantics; would still need provider/runtime plumbing to chat inside JCode.

### Option C: First-Class Gateway Provider

| Dimension       | Assessment                                                                              |
| --------------- | --------------------------------------------------------------------------------------- |
| Complexity      | Medium-high                                                                             |
| Cost            | Higher initial adapter and settings work                                                |
| JCode fit       | Strong; preserves Provider, Thread, Orchestration, health, and runtime-event boundaries |
| User experience | Consistent with existing provider picker and thread chat                                |
| Maintainability | Strong; gateway behavior is isolated behind an adapter and source-aware runtime events  |

**Pros:** Keeps OpenClaw in normal JCode workflows; supports clear health states; allows future capabilities to grow behind the Provider boundary.

**Cons:** Requires gateway client integration, secret storage, health probing, and event translation.

## Trade-Off Analysis

The first-class Provider approach costs more than an external launcher, but it prevents a second chat surface from forming outside JCode's local cockpit model. It also keeps implementation vocabulary aligned with `CONTEXT.md`: OpenClaw is a Provider runtime, not a JCode client Connection.

The narrow v1 capability set is deliberate. Text-only chat through one `OpenClaw Gateway` target proves URL/auth/session/event plumbing before JCode takes on OpenClaw-specific agent selection, attachments, commands, approvals, or model routing.

Source reuse should focus on protocol and runtime behavior, not UI. OpenClaw's web chat code can prevent reimplementing handshake, retry, `chat.history`, `chat.send`, and stream reconciliation details from scratch, but JCode's transcript, composer, provider picker, and health surface remain product boundaries.

The OpenClaw protocol currently validates gateway client ids against a closed enum. JCode should therefore use OpenClaw's canonical backend gateway-client identity on the wire and use `JCode` as display metadata, unless OpenClaw later adds a first-class `jcode` client id.

OpenClaw credentials and device material are resolved inside the server-side adapter or gateway-client host callbacks. They must not be placed in `ProviderStartOptions`, persisted runtime payloads, raw runtime events, browser storage, React Query keys, toasts, or logs.

## Consequences

- OpenClaw becomes part of the normal provider picker and thread chat flow.
- Settings -> Connections remains reserved for pairing clients to the JCode server.
- JCode gains a new server-side secret-storage concern for provider credentials and paired device material.
- Remote OpenClaw access may require persisted device identity, challenge signing, paired-token storage, stale-token clearing, and user-visible rotate/clear-device controls.
- OpenClaw health checks must validate gateway reachability, auth, and required chat methods rather than local CLI freshness, then map gateway-specific states onto existing JCode provider status/authentication states.
- OpenClaw health checks must handle gateways that do not advertise `hello.features.methods`; advertised method lists are authoritative when present, but absent lists require narrow probe calls or an explicit unknown/unsupported state.
- Provider runtime translation must preserve canonical JCode events and keep raw OpenClaw protocol details behind redacted, source-aware raw events such as `openclaw.gateway.event`. The adapter must reconcile OpenClaw stream chunks into JCode text items, completion states, failures, and interruptions instead of exposing protocol frames as chat transcript content.
- JCode turn interruption and session stop flows must map to OpenClaw `chat.abort` when a gateway run is active.
- JCode must keep OpenClaw `sessionKey` values bounded and namespaced so JCode Thread ids cannot collide with unrelated OpenClaw sessions or exceed gateway primitive limits.
- OpenClaw must join Pi as a provider that does not have a default model in v1, so default-model and Git text-generation fallback code must not route to it. It still needs the explicit `gateway` thread model-selection sentinel for persistence.
- OpenClaw v1 must advertise no approvals, no native commands, no skill/plugin discovery, no runtime model list, and no thread compaction/import. If the gateway emits an approval/permission interaction before that capability is designed, JCode should fail clearly rather than silently approve, deny, or drop it.
- Future richer OpenClaw capabilities need explicit design work before they appear in the composer.

## Action Items

1. [ ] Add `openclaw` to provider contracts, provider ordering, status cache ids, and runtime raw-source schema while excluding it from default-model/Git text-generation provider sets.
2. [ ] Add `OpenClawModelSelection` with the single `gateway` model-selection sentinel.
3. [ ] Add OpenClaw server settings for gateway URL and auth mode, plus separate server-owned secret storage for credentials and device material under `ServerConfig.secretsDir`.
4. [ ] Add write-only secret mutations, redacted settings reads, and safeguards that keep OpenClaw credentials out of provider start options and runtime payloads.
5. [ ] Implement OpenClaw Gateway URL normalization and health probing, including loopback `ws://`, public remote `wss://`, and explicit LAN/tailnet exception handling.
6. [ ] Implement `OpenClawAdapter` with protocol v4 negotiation, `connect.challenge`, canonical backend gateway-client identity plus `JCode` display name, device identity signing, paired-token persistence, per-thread bounded `sessionKey`, `chat.history`, `chat.send`, `chat.abort`, and event translation.
7. [ ] Add Settings -> Providers UI for OpenClaw gateway configuration and health, excluding custom model settings for v1.
8. [ ] Add focused tests for contracts, settings migration, secret storage/redaction, URL normalization, protocol negotiation, device identity/challenge handling, provider health, session-key mapping, model-selection persistence, turn interruption, capability flags, and runtime event translation.
9. [ ] Preserve MIT attribution if substantial OpenClaw source is copied or adapted.
