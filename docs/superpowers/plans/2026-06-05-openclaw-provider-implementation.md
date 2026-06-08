# OpenClaw Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OpenClaw as a first-class JCode Provider that connects to an OpenClaw Gateway from Settings -> Providers, keeps credentials server-owned, and chats inside normal JCode Threads.

## Source Documents

- `docs/superpowers/specs/2026-06-05-openclaw-provider-design.md`
- `docs/adr/0005-openclaw-gateway-provider.md`
- `CONTEXT.md`

## Hard Constraints

- OpenClaw is a JCode `Provider`, not a Settings -> Connections entry.
- V1 is text-only with one visible target: `OpenClaw Gateway`.
- Persist the Thread model selection as `{ provider: "openclaw", model: "gateway" }`.
- Keep OpenClaw out of default-model, Git text-generation, runtime model-list, and custom-model flows.
- Do not put OpenClaw secrets, paired-device tokens, or private keys into `ServerSettings`, `ProviderStartOptions`, provider runtime payloads, browser state, React Query keys, toasts, logs, or raw runtime events.
- Use server-owned secret storage under `ServerConfig.secretsDir`; prefer the existing `ServerSecretStore` abstraction instead of creating a second low-level file store.
- Use OpenClaw protocol v4 for v1.
- Use OpenClaw wire identity `client.id = "gateway-client"`, backend mode, display name `JCode`, role `operator`, scopes `operator.read` and `operator.write`.
- Handle `connect.challenge`, device identity, paired-token persistence, stale-token clearing, and rotate/clear-device operations.
- Allow loopback `ws://`; require public remote `wss://`; make LAN/tailnet insecure WebSocket exceptions explicit user decisions.
- Treat current `@openclaw/*` packages as private workspace packages. Adapt minimal MIT-licensed source or implement raw WebSocket protocol unless package publication changes.
- If the gateway emits approval/permission requests in v1, fail clearly; do not auto-approve, auto-deny, or silently drop.

## File Responsibilities

### Contracts And Shared Types

- `packages/contracts/src/orchestration.ts`: add `openclaw` to `ProviderKind`; add `OpenClawModelSelection` with fixed `model: "gateway"`; include it in `ModelSelection`.
- `packages/contracts/src/model.ts`: add OpenClaw display/model metadata only if needed for UI labels; exclude OpenClaw from `ProviderWithDefaultModel` and `DEFAULT_MODEL_BY_PROVIDER`.
- `packages/shared/src/model.ts`: keep model resolution safe for providers without defaults; verify OpenClaw does not fall through to default model helpers.
- `packages/shared/src/serverSettings.ts`: update text-generation model patch behavior so provider switches do not try `DEFAULT_MODEL_BY_PROVIDER.openclaw`.
- `packages/contracts/src/providerDiscovery.ts`: add `openclaw` to discovery/provider capability kinds; add OpenClaw non-secret provider start options if needed, but no secret fields.
- `packages/contracts/src/settings.ts`: add `OpenClawServerProviderSettings` under `ServerSettings.providers` for non-secret settings only: enabled, gateway URL, auth mode, explicit remote-insecure allowance if implemented, and redacted metadata flags if exposed by settings responses.
- `packages/contracts/src/providerRuntime.ts`: add raw source `openclaw.gateway.event`.
- `packages/contracts/src/server.ts`: use existing provider status/auth status unless a redacted OpenClaw secret-status response is added.

### Server Settings, Secrets, And Health

- `apps/server/src/auth/Layers/ServerSecretStore.ts`: reuse this service for named OpenClaw secrets. It already creates `secretsDir`, chmods directory/files, writes via temp file, and renames atomically.
- `apps/server/src/auth/Services/ServerSecretStore.ts`: extend only if OpenClaw needs higher-level helpers; otherwise keep low-level API unchanged.
- `apps/server/src/serverSettings.ts`: persist only non-secret OpenClaw settings in `settings.json`.
- `apps/server/src/provider/Layers/ProviderHealth.ts`: add OpenClaw gateway health probe with states for ready, pairing needed, unauthenticated, unreachable, unsupported, and protocol mismatch. Map those to existing `ServerProviderStatus` values.
- `apps/server/src/provider/providerStatusCache.ts`: add `openclaw` to provider status cache ids/order.
- New server helper candidate, `apps/server/src/provider/openclawGatewayUrl.ts`: normalize `http(s)` to `ws(s)`, enforce loopback/public remote policy, redact URL userinfo/query secrets.
- New server helper candidate, `apps/server/src/provider/openclawSecrets.ts`: centralize secret names, redacted metadata, set/clear/rotate operations, stale-token clearing, and device identity access through `ServerSecretStore`.

### Server Adapter And Protocol

- `apps/server/src/provider/Services/OpenClawAdapter.ts`: add service tag/interface following other provider adapter service files.
- `apps/server/src/provider/Layers/OpenClawAdapter.ts`: implement the adapter and protocol client/reducer.
- `apps/server/src/provider/Layers/ProviderAdapterRegistry.ts`: register `OpenClawAdapter`.
- `apps/server/src/provider/runtimeLayer.ts`: wire the OpenClaw adapter layer and dependencies.
- `apps/server/src/provider/Errors.ts`: reuse existing validation/request/session errors unless OpenClaw needs a specific tagged error for URL/auth/protocol detail.
- `apps/server/src/provider/Layers/EventNdjsonLogger.ts`: do not change unless redaction support needs a central helper; raw OpenClaw payloads should already be redacted before logging.

OpenClaw adapter responsibilities:

- `capabilities`: `sessionModelSwitch: "unsupported"`, no runtime model list, no native commands, no skills/plugins, no turn steering.
- `startSession`: resolve non-secret settings and server-side secrets; normalize URL; connect WebSocket; negotiate protocol v4; complete `connect.challenge`; verify methods; call `chat.history`; produce a `ProviderSession` with provider `openclaw` and provider thread/session refs using `jcode:<threadId>` or a bounded deterministic variant.
- `sendTurn`: send `chat.send` with `sessionKey`, `message`, and stable idempotency key. Do not forward attachments, `agentId`, `thinking`, or fast-mode fields in v1.
- `interruptTurn`: call `chat.abort` with active `sessionKey` and known `runId` when available.
- `stopSession`: abort active run if needed, close WebSocket/session state, emit stopped/interrupted events consistently.
- `respondToRequest` and `respondToUserInput`: fail clearly as unsupported in v1.
- `readThread`: return snapshots based on current adapter state/history; keep implementation minimal until import/external thread support is designed.
- `rollbackThread`, `forkThread`, `listModels`, `listCommands`, `listSkills`, `listPlugins`, `listAgents`: unsupported or empty according to existing adapter conventions.
- `streamEvents`: emit canonical `ProviderRuntimeEvent` values and optional redacted raw events with source `openclaw.gateway.event`.

Protocol source details to preserve:

- `PROTOCOL_VERSION = 4`, `MIN_CLIENT_PROTOCOL_VERSION = 4`.
- Initial connect frame includes `minProtocol`, `maxProtocol`, `client`, `role`, `scopes`, `auth`, and optional `device`.
- Challenge event is `connect.challenge` with nonce/timestamp; device signing must bind the nonce and client identity.
- Required methods: `chat.history`, `chat.send`, `chat.abort`.
- `chat.send` must use stable per-turn `idempotencyKey`.
- Gateway streaming is event-based, not response-stream based; implement a reducer over chat events and terminal states.

### Web Settings And Picker

- `apps/web/src/appSettings.ts`: map OpenClaw non-secret settings only; no secret values in app settings; exclude OpenClaw from custom model helpers and Git text-generation options.
- `apps/web/src/routes/_chat.settings.tsx`: add a dedicated OpenClaw gateway provider card. Borrow layout, not the OpenCode/Kilo password-backed data shape.
- `apps/web/src/providerOrdering.ts`: add OpenClaw to default ordering and hidden-provider normalization.
- `apps/web/src/session-logic.ts`: add `OpenClaw` to provider picker options.
- Icon handling: add or reuse a simple provider icon in `apps/web/src/components/Icons` only if needed by Settings/picker conventions.
- Provider start/options helpers, likely `apps/web/src/lib/providerOptions.ts`: ensure OpenClaw provider start options contain no secrets.
- WebSocket/native API transport files: update only if new server methods are required for write-only secret mutation or device rotation.

## Implementation Steps

### Phase 1: Contracts And Shared Settings

- [ ] Write failing contract tests for decoding `ProviderKind` and `ModelSelection` with `{ provider: "openclaw", model: "gateway" }`.
- [ ] Add `openclaw` to `ProviderKind` and add `OpenClawModelSelection` to `ModelSelection`.
- [ ] Run focused contracts tests and confirm the new contract tests pass.
- [ ] Write failing tests proving OpenClaw is excluded from default-model maps and Git text-generation model defaults.
- [ ] Update `ProviderWithDefaultModel`, `DEFAULT_MODEL_BY_PROVIDER`, display/model helpers, and shared model resolution so OpenClaw behaves like a non-default-model provider while preserving the gateway sentinel.
- [ ] Update `packages/shared/src/serverSettings.ts` tests so text-generation settings cannot switch into OpenClaw and do not index `DEFAULT_MODEL_BY_PROVIDER.openclaw`.
- [ ] Add `openclaw` to provider discovery kinds and composer capability contracts.
- [ ] Add OpenClaw non-secret settings schema and patch schema under `ServerSettings.providers`.
- [ ] Add `openclaw.gateway.event` to `RuntimeEventRawSource`.
- [ ] Run focused package tests for contracts/shared changes.

### Phase 2: Server Secret And URL Helpers

- [ ] Write failing tests for OpenClaw secret metadata: set token/password, read redacted presence, clear token/password, rotate/clear device identity, stale-token clearing.
- [ ] Implement `openclawSecrets` on top of `ServerSecretStore`; use deterministic names such as `provider.openclaw.token`, `provider.openclaw.password`, `provider.openclaw.device-key`, and `provider.openclaw.device-token`.
- [ ] Write failing tests for URL normalization and redaction: `http -> ws`, `https -> wss`, loopback `ws` allowed, public remote `ws` rejected, userinfo/query secrets stripped from logs/details.
- [ ] Implement `openclawGatewayUrl` helpers.
- [ ] Add server settings tests proving OpenClaw secrets do not appear in `settings.json`, settings update payloads, or app settings mappings.
- [ ] Run focused server/auth/settings helper tests.

### Phase 3: Gateway Protocol Client

- [ ] Write unit tests for connect-frame creation: protocol v4, `gateway-client`, backend mode, display name `JCode`, role `operator`, scopes `operator.read` and `operator.write`.
- [ ] Write unit tests for `connect.challenge` handling: waits for nonce, signs with device identity, times out with redacted error, clears stale paired token on auth failure.
- [ ] Write unit tests for method support handling: advertised `hello-ok.features.methods` accepted when required methods exist, unsupported when missing, fallback/probe behavior when methods list is absent.
- [ ] Write unit tests for chat request shapes: `chat.history`, `chat.send` with stable idempotency key, `chat.abort` with session key and optional run id.
- [ ] Implement minimal WebSocket/protocol helper or adapted OpenClaw source in `OpenClawAdapter.ts` or a small colocated protocol helper file.
- [ ] Add MIT attribution/notice updates if any OpenClaw source is copied or substantially adapted.

### Phase 4: OpenClaw Adapter

- [ ] Write adapter tests using a fake gateway/protocol harness for `startSession` happy path: settings + secret resolution, handshake, method verification, `chat.history`, and `ProviderSession` output.
- [ ] Write adapter tests proving `sendTurn` emits canonical assistant text/completion events from gateway chat events.
- [ ] Write adapter tests proving gateway errors emit canonical failed runtime events with redacted raw payloads.
- [ ] Write adapter tests proving `interruptTurn`/`stopSession` call `chat.abort` and emit interrupted/cancelled state.
- [ ] Write adapter tests proving approvals/user-input responses fail clearly as unsupported.
- [ ] Implement `Services/OpenClawAdapter.ts` service tag.
- [ ] Implement `Layers/OpenClawAdapter.ts` with session map, event queue, lifecycle, event reducer, and unsupported capability methods.
- [ ] Add redaction tests for raw `openclaw.gateway.event` payloads.
- [ ] Register the adapter in `ProviderAdapterRegistry` and `runtimeLayer`.
- [ ] Run focused provider adapter/registry tests.

### Phase 5: Provider Health And Status

- [ ] Write health tests for unconfigured, ready, pairing needed, unauthenticated, unreachable, unsupported methods, protocol mismatch, and public `ws://` rejection.
- [ ] Implement OpenClaw health probing in `ProviderHealth` using the URL/protocol helpers and redacted status messages.
- [ ] Add `openclaw` to `providerStatusCache` order and cache ids; add ordering/cache tests.
- [ ] Verify status payloads never include credentials, signed device payloads, tokens, or raw URL userinfo/query secrets.

### Phase 6: Web Settings And Provider Picker

- [ ] Write app settings tests for OpenClaw non-secret mapping, no secret reflection, hidden provider normalization, and provider start options excluding OpenClaw credentials.
- [ ] Update `appSettings.ts` for OpenClaw non-secret fields and exclusions from custom model/Git text-generation settings.
- [ ] Write provider-order tests proving OpenClaw appears in default order and normalizes hidden/order arrays.
- [ ] Update `providerOrdering.ts` and `session-logic.ts` to include OpenClaw.
- [ ] Write focused Settings UI tests if the route has existing test coverage; otherwise keep UI changes small and verify with typecheck/manual browser pass during execution.
- [ ] Add a dedicated OpenClaw gateway card in `_chat.settings.tsx` with URL, auth mode, masked secret write action, clear/rotate actions, and connection status.
- [ ] Ensure secret input writes only through server mutation and is never populated from settings responses.
- [ ] Run focused web tests for app settings, provider ordering, provider options, and session logic.

### Phase 7: End-To-End Verification And Cleanup

- [ ] Run `bunx oxfmt@0.52.0 --check <touched files>` for all touched source/docs files.
- [ ] Run `bun run --cwd packages/contracts test` or narrower contract tests if available.
- [ ] Run `bun run --cwd packages/shared test` or narrower shared tests if available.
- [ ] Run focused server tests for OpenClaw secrets, URL helpers, adapter, health, and provider registry.
- [ ] Run focused web tests for app settings, provider ordering, provider options, and session logic.
- [ ] Run `bun run --cwd apps/server typecheck` after server implementation compiles.
- [ ] Run `bun run --cwd apps/web typecheck` after web implementation compiles.
- [ ] Use `safe-run --profile test -- <command>` or `safe-run --profile build -- <command>` for broad test/typecheck commands if widening beyond focused checks.
- [ ] Manual/browser verification with dev automation access: Settings -> Providers shows OpenClaw, URL normalization/status works, secrets are write-only, OpenClaw appears in provider picker, unhealthy provider blocks turns with a clear banner.
- [ ] If a fake or local OpenClaw gateway is available, run a manual chat smoke test: configure loopback URL, start an OpenClaw Thread, send text, interrupt a running turn, and verify per-thread history isolation.

## Negative Test Checklist

- [ ] Secret set values do not appear in settings JSON.
- [ ] Secret set values do not appear in browser app settings, React Query keys, toasts, provider start options, provider runtime payloads, or event logs.
- [ ] URL userinfo and sensitive query params are stripped from logs/status messages.
- [ ] Public remote `ws://` fails before connecting; loopback `ws://` succeeds.
- [ ] Missing `chat.history`, `chat.send`, or `chat.abort` reports unsupported.
- [ ] Protocol range outside v4 reports protocol mismatch.
- [ ] Failed auth clears stale paired token without deleting the device private key unless rotate/clear-device is requested.
- [ ] Gateway approval/permission event fails clearly in v1.
- [ ] OpenClaw cannot be selected for Git text generation or custom model settings.

## Completion Criteria

- `openclaw` appears in contracts, server provider registry/health, Settings -> Providers, and provider picker.
- Configuring an OpenClaw Gateway URL and auth metadata is possible without exposing secret values on read.
- Starting an OpenClaw Thread uses the `gateway` model-selection sentinel and maps to a bounded `jcode:` OpenClaw `sessionKey`.
- `chat.history`, `chat.send`, and `chat.abort` are translated into canonical JCode runtime behavior.
- Health checks cover URL, protocol, auth/pairing, and required methods.
- Focused tests and typechecks for touched packages/apps pass.
- No adapted OpenClaw source lacks MIT attribution.
