# OpenClaw Provider Design

## Summary

Add OpenClaw as a first-class JCode Provider backed by a user-configured OpenClaw Gateway URL. Users configure the gateway in Settings, pick `OpenClaw` from the normal provider picker, and chat with OpenClaw inside standard JCode Threads.

## Context

JCode already models coding-agent integrations as Providers. The shared contracts define provider settings, provider discovery, provider health, provider runtime events, and provider start/send-turn flows. The web Settings route already has a Providers section with provider-specific configuration rows, and the server adapter registry binds provider kinds such as Codex, Claude, OpenCode, Kilo, Cursor, Gemini, and Pi to concrete provider adapters.

OpenClaw exposes a WebSocket Gateway rather than a local CLI-only provider. Current OpenClaw docs/source describe a WebSocket handshake with `connect.challenge`, operator roles and scopes, and chat methods such as `chat.history` and `chat.send`. A JCode integration should therefore bridge OpenClaw Gateway chat into JCode's Provider abstraction instead of launching an external OpenClaw UI.

## Goals

- Add `openclaw` as a provider kind across contracts, settings, provider health, discovery, runtime events, and provider picker surfaces.
- Let users configure an OpenClaw Gateway URL and optional secret from Settings.
- Let users select OpenClaw in the normal JCode provider picker and chat inside a JCode Thread.
- Map each JCode Thread to an isolated OpenClaw `sessionKey` so OpenClaw conversations do not collapse into a shared `main` session.
- Keep v1 narrow: text chat through the gateway with one visible target named `OpenClaw Gateway`.
- Reuse OpenClaw's open-source gateway client/protocol behavior where it fits JCode's Provider boundary, without importing OpenClaw's full web chat UI.

## Non-Goals

- No external OpenClaw chat launcher in v1.
- No OpenClaw-specific standalone Settings section separate from Providers.
- No attachment support in v1.
- No OpenClaw agent picker in v1.
- No slash-command, skill, plugin, approval, steering, or advanced gateway-method discovery in v1.
- No automatic remote network exposure. The user-provided gateway URL must remain explicit.
- No use of OpenClaw as a Git text-generation/default-model provider in v1.
- No persistence of OpenClaw credentials, paired-device tokens, or device private keys in provider start options, runtime payloads, app settings responses, browser storage, logs, or raw runtime events.

## Recommended Approach

Implement OpenClaw as a full Provider adapter.

This approach keeps OpenClaw inside the existing JCode concepts:

- `Provider`: `openclaw` becomes selectable like `opencode`, `codex`, and `pi`.
- `Thread`: a JCode Thread maps to a stable OpenClaw gateway `sessionKey`.
- `Orchestration`: user turns flow through the normal provider service and runtime event stream.
- `ModelSelection`: v1 uses an explicit `openclaw` model-selection shape whose only valid model is the sentinel target `gateway`. This keeps thread persistence concrete while making clear that `gateway` is not an OpenClaw model slug.
- `Settings`: the OpenClaw gateway configuration lives in the existing Providers settings surface.
- `Provider Health`: gateway reachability and auth are reported alongside other provider statuses.

Rejected alternatives:

- External launcher: simplest visually, but bypasses JCode Thread, Provider, Orchestration, event-log, and health semantics.
- Connections-only URL entry: fits the word "connection" but conflicts with JCode's current Connections settings, which are about pairing clients to this JCode server rather than configuring provider runtimes.

## Settings Design

OpenClaw should appear under Settings -> Providers with a dedicated gateway card. It can borrow the URL-backed layout patterns used by OpenCode/Kilo, but it must not reuse their password-backed settings flow as-is because OpenClaw secrets and paired-device material use write-only server-side storage.

Fields:

- Gateway URL: required for v1. Placeholder: `ws://127.0.0.1:18789`. Accept `http(s)://` and `ws(s)://` input, normalize internally to WebSocket, and show the normalized URL in health details.
- Authentication mode: `None / local pairing`, `Token`, or `Password`.
- Secret: masked input shown only for token/password modes. Store this outside the main server settings JSON.
- Enable provider: follows the existing provider settings default of enabled unless hidden/disabled by user settings.
- Check connection: verifies gateway reachability, handshake, auth, and required chat methods.

URL normalization:

```text
http://127.0.0.1:18789 -> ws://127.0.0.1:18789
https://example.com    -> wss://example.com
ws://127.0.0.1:18789   -> ws://127.0.0.1:18789
```

OpenClaw's gateway client blocks public remote `ws://` targets. JCode should preserve that policy: loopback `ws://` is allowed for local gateways, while public remote gateways must use `wss://`. LAN or tailnet exceptions need explicit user configuration and should be treated as remote exposure decisions, not automatic discovery.

The Settings card should show a compact health line:

- `ready`: gateway is reachable, authenticated, and advertises required chat methods.
- `pairing needed`: gateway answered but did not accept the stored/local identity.
- `unauthenticated`: token/password is missing or rejected.
- `unreachable`: the URL cannot be reached or the WebSocket handshake fails.
- `unsupported`: gateway does not advertise the required chat methods.

Map those states onto JCode's existing provider status shape instead of inventing a separate UI contract: `ready` reports a ready/authenticated status, `pairing needed` and `unauthenticated` report warning/error with unauthenticated auth state, `unreachable` reports error with unknown auth state, and `unsupported` reports warning/error with a method-capability message.

The UI should not expose raw protocol frames. It may mention "Gateway URL" because that is the user-owned OpenClaw concept being configured.

## Runtime Design

Add an `OpenClawAdapter` that implements the existing provider adapter contract.

Adapter responsibilities:

- Connect to the configured OpenClaw Gateway URL over WebSocket.
- Use OpenClaw protocol v4 for v1 (`minProtocol: 4`, `maxProtocol: 4`) and fail clearly if the gateway negotiates outside that range.
- Complete the OpenClaw `connect.challenge` handshake as an operator client by waiting for the gateway nonce, signing it with the persisted device identity when required, and timing out cleanly if the challenge flow does not complete.
- Use OpenClaw's canonical gateway client identity on the wire: client id `gateway-client`, mode `backend`, and a human-readable display name such as `JCode`. The OpenClaw protocol currently validates client ids against a closed enum, so `jcode` should be a display name unless OpenClaw adds `jcode` as a protocol id.
- Request only the scopes needed for v1: `operator.read` and `operator.write`.
- Persist any OpenClaw device identity/token material server-side, not in browser local storage. Remote scoped access requires a device identity in addition to token/password auth except for OpenClaw's special local backend cases; JCode must create or load the device key, persist paired-device tokens, clear stale tokens after auth failures, and expose a rotate/clear-device action.
- Translate `startSession` into gateway readiness plus initial `chat.history` for the JCode Thread's session key.
- Translate `sendTurn` into `chat.send` with only v1-supported text fields: `sessionKey`, `message`, and a stable `idempotencyKey`. Do not forward advanced OpenClaw fields such as `agentId`, `sessionId`, attachments, `thinking`, or fast-mode controls until a later ADR defines how they map to JCode.
- Translate gateway chat deltas/finals/errors into JCode `ProviderRuntimeEvent` values. The adapter must maintain enough per-turn state to reconcile streamed OpenClaw chunks into canonical JCode text items, completion states, failures, and interruption/cancellation events without exposing raw protocol payloads as transcript content.
- Translate JCode `interruptTurn` and relevant session stop flows into OpenClaw `chat.abort` with the active `sessionKey` and, when available, the active OpenClaw `runId`.
- Close or idle-stop gateway sessions according to the existing ProviderService lifecycle.

The adapter should use OpenClaw's gateway client/package behavior when practical. The current OpenClaw gateway client exposes host callbacks for device identity, token storage, logging, TLS formatting, and redaction; JCode should implement those host callbacks instead of duplicating handshake and reconnect logic. Current `@openclaw/*` client packages are private workspace packages, so implementation should not assume they can be installed from npm. If they remain private/unpublished, adapt the smallest needed source with MIT attribution or implement the raw WebSocket protocol directly rather than vendoring the full OpenClaw UI.

Health probing should not assume every gateway advertises `hello.features.methods`. Treat advertised methods as authoritative when present; when the list is absent, perform narrow probe calls or report a clear `unsupported`/`unknown` state rather than assuming all methods are available. Required v1 gateway methods are `chat.history`, `chat.send`, and `chat.abort`.

The first runtime-event raw source should be explicit, for example `openclaw.gateway.event`, so logs remain source-aware like `opencode.sdk.event` and `pi.sdk.event`. Raw OpenClaw event payloads must be redacted before storage or emission, and any raw-event schema addition should be tested with the event sources that the adapter can actually emit.

## OpenClaw Source Reuse

OpenClaw's web gateway chat code is open source and MIT licensed, so implementation should inspect and adapt it before rebuilding gateway behavior from scratch.

Good reuse candidates:

- Protocol schemas and validation behavior from OpenClaw gateway protocol packages.
- Gateway client handshake, reconnect, request/response, and auth callback patterns.
- Chat history retry behavior around startup/unavailable gateway states.
- `chat.history` and `chat.send` tests as fixtures for request shapes and error handling.
- `chat.abort` behavior as the fixture for JCode turn interruption and stop flows.
- Stream reconciliation ideas that help translate OpenClaw gateway events into JCode `ProviderRuntimeEvent` values.

Do not wholesale import OpenClaw's web chat UI. JCode's chat transcript, composer, provider picker, health banners, Thread model, and Orchestration state are product boundaries that should stay JCode-native. Any copied or substantially adapted OpenClaw source must preserve MIT attribution in the appropriate repository credits/notices.

## Thread Mapping

Each JCode Thread should map to a stable OpenClaw `sessionKey` derived from the JCode Thread id.

Recommended shape:

```text
jcode:<threadId>
```

Runtime calls use that key:

```text
chat.history({ sessionKey: "jcode:<threadId>", limit: 100 })
chat.send({ sessionKey: "jcode:<threadId>", message, idempotencyKey })
```

This keeps OpenClaw conversations isolated per JCode Thread and avoids mixing all JCode work into OpenClaw's default `main` or `global` session.

The derived `sessionKey` must stay within OpenClaw's primitive limits and avoid collisions. If a raw JCode Thread id can exceed the gateway limit, hash or shorten the suffix while preserving a deterministic `jcode:` namespace.

## V1 Capabilities

OpenClaw v1 should expose one target in JCode:

```text
OpenClaw Gateway
```

Capabilities:

- Text input only.
- One persisted JCode model-selection target: `{ provider: "openclaw", model: "gateway" }`. The UI label remains `OpenClaw Gateway`, and `gateway` is a JCode routing sentinel rather than a configurable OpenClaw model.
- No runtime model list.
- No skill discovery.
- No native slash-command discovery.
- No plugin discovery.
- No OpenClaw approval forwarding. JCode approval-mode UI may still exist globally, but OpenClaw v1 must advertise no approval capability and fail clearly if the gateway asks for an approval or permission interaction that JCode cannot represent yet.
- No thread compaction or import unless a later OpenClaw method maps cleanly to JCode's provider contracts.

The provider picker should display OpenClaw only when it is enabled and not hidden by provider visibility settings. If the gateway is not configured or unhealthy, selecting OpenClaw should surface the same provider health/banner pattern used by other providers rather than sending a turn that cannot succeed.

## Contract And Code Seams

Likely implementation areas:

- `packages/contracts/src/orchestration.ts`: add `openclaw` to `ProviderKind` and `ModelSelection` using a fixed gateway-routing model value such as `gateway`.
- `packages/contracts/src/providerDiscovery.ts`: add OpenClaw settings/start options and composer capability schemas. OpenClaw start options must contain only non-secret launch context; credentials and device tokens resolve server-side inside the adapter.
- `packages/contracts/src/settings.ts`: add `OpenClawServerProviderSettings` under `ServerSettings.providers`.
- `packages/contracts/src/providerRuntime.ts`: add `openclaw.gateway.event` raw source.
- `packages/contracts/src/model.ts` and `packages/shared/src/model.ts`: keep OpenClaw out of default model and model-resolution paths unless a later design adds explicit model routing. Today Pi is the only provider without a default model; OpenClaw should join that non-default-model category for v1 while still preserving thread persistence through the `gateway` model-selection sentinel.
- `apps/server/src/provider/Layers/ProviderAdapterRegistry.ts`: register `OpenClawAdapter`.
- `apps/server/src/provider/Layers/ProviderHealth.ts`: add OpenClaw gateway health probing.
- `apps/server/src/config.ts`: use the existing `ServerConfig.secretsDir` for OpenClaw provider secret storage.
- `apps/server/src/provider/providerStatusCache.ts`: include OpenClaw in provider status ordering/cache ids.
- `apps/web/src/appSettings.ts`: add OpenClaw URL/auth settings migration and app settings mapping without reflecting secret values back to the browser.
- `apps/web/src/routes/_chat.settings.tsx`: add the dedicated OpenClaw provider settings card and provider picker handling. Do not include OpenClaw in custom model settings for v1.
- `apps/web/src/session-logic.ts` and provider ordering helpers: include OpenClaw in provider options/order.

## Security And Privacy

- Secrets must stay server-authoritative and must not appear in React Query keys, URLs, logs, toasts, provider start options, persisted runtime payloads, app settings responses, or provider runtime raw-event payloads.
- Browser local storage may keep UI-only preferences, but OpenClaw tokens, passwords, device private keys, and paired-device tokens belong to a server-owned secret file under `ServerConfig.secretsDir`.
- The OpenClaw secret store is a new provider-secret abstraction, not an existing JCode service. It should create `secretsDir` when needed, write atomically, use owner-only permissions where the platform supports them, and expose explicit clear/rotate behavior for auth-mode changes.
- Settings reads should expose only redacted state such as `authMode`, `hasSecret`, and `paired`; settings writes should use write-only secret mutations such as set secret, clear secret, and rotate device identity. Do not round-trip secret values through app settings responses.
- The main server settings JSON should keep only non-secret OpenClaw configuration such as gateway URL, auth mode, and provider enabled/visibility state.
- The gateway URL must be user-provided and visible, because it defines the boundary JCode connects to.
- Gateway URLs and gateway-client errors must be redacted before logs or provider runtime raw events. In particular, strip userinfo and sensitive query parameters such as `token`, `password`, `client_secret`, and similar credential names.
- JCode should not silently expose or tunnel OpenClaw gateways. Remote/LAN/tailnet use is an explicit user configuration decision.
- Health errors should redact credentials and include actionable connection/auth state.

## Acceptance Criteria

- OpenClaw appears as a provider in Settings and the provider picker.
- A user can enter an OpenClaw Gateway URL and optional token/password in Settings.
- `http(s)://` and `ws(s)://` gateway inputs normalize to the WebSocket URL used by the adapter.
- OpenClaw Thread state uses `ModelSelection` provider `openclaw` with the fixed `gateway` routing target, while default-model and custom-model paths exclude OpenClaw.
- Public remote gateways require `wss://`; loopback `ws://` remains valid for local gateways.
- The adapter negotiates OpenClaw protocol v4 and handles `connect.challenge` device signing, paired-token persistence, stale-token clearing, and device rotation.
- `Check connection` reports clear ready/auth/unreachable/unsupported states without leaking secrets.
- JCode connects as a recognizable minimal operator client using OpenClaw's canonical gateway client id plus a `JCode` display name, with `operator.read` and `operator.write` scopes.
- Starting a JCode Thread with OpenClaw creates or resumes the corresponding OpenClaw gateway session key.
- Sending a text turn through OpenClaw produces JCode chat output through normal provider runtime events.
- Interrupting a running JCode turn calls OpenClaw `chat.abort` and emits canonical interrupted/aborted runtime events.
- Separate JCode Threads do not share OpenClaw chat history.
- Provider status cache, provider ordering, app settings migration, and query keys handle OpenClaw without secret leakage.
- OpenClaw does not appear in Settings -> Models -> Custom models for v1.
- OpenClaw does not become a Git text-generation/default-model provider in v1.
- Focused tests cover contracts, settings mapping, provider status ordering, secret-store read/write/clear/redaction, URL normalization, health probing, adapter session-key mapping, model-selection persistence for the `gateway` sentinel, `chat.history`, `chat.send`, `chat.abort`, capability flags, and runtime event translation.
- OpenClaw source reuse is limited to protocol/client/runtime translation patterns unless a later design explicitly approves UI-level reuse.

## Future Considerations

- Agent selection via OpenClaw `agentId` once the desired UX is clear.
- Attachments and image support if OpenClaw gateway attachment schemas map safely to JCode attachments.
- Gateway method discovery to unlock commands, slash commands, approvals, steering, or richer composer capabilities.
- Importing or linking existing OpenClaw sessions into JCode Threads.
- A dedicated runtime health/details panel once OpenClaw exposes enough metadata to justify it.

## Open Questions

- None for v1 spec. New questions should be captured during implementation planning if a concrete code seam contradicts this design.
