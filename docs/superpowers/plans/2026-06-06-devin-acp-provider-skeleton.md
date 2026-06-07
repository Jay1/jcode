# Devin ACP Provider Runtime Skeleton — Implementation Plan

## Overview

Add Devin as a new ACP-based provider in JCode. Devin exposes itself as an ACP agent via `devin acp` CLI. JCode connects as an ACP client using the existing `packages/effect-acp` infrastructure.

## Reference Pattern

Cursor adapter (`CursorAcpSupport.ts` → `AcpSessionRuntime` → `AcpClient`) is the closest template. Gemini uses custom JSON-RPC, which is NOT the pattern we want — Devin speaks standard ACP.

## Implementation Slices

### Slice 1: Contracts — Add `devin` ProviderKind + Model Selection

**Files:**

- `packages/contracts/src/orchestration.ts` — Add `"devin"` to `ProviderKind` literal union
- `packages/contracts/src/orchestration.ts` — Add `DevinModelSelection` schema (provider: "devin", model: string)
- `packages/contracts/src/orchestration.ts` — Add to `ModelSelection` union
- `packages/contracts/src/orchestration.ts` — Add `MODEL_OPTIONS_BY_PROVIDER` entry for Devin

**Tests:** Existing orchestration decode tests should cover the new literal.

### Slice 2: Server — DevinAcpSupport Module

**Files:**

- `apps/server/src/provider/acp/DevinAcpSupport.ts` — NEW
  - `buildDevinAcpSpawnInput(settings, cwd)` → `AcpSpawnInput` — builds `devin acp` command
  - `makeDevinAcpRuntime(input)` → Effect building `AcpSessionRuntimeShape` — wraps `AcpSessionRuntime.layer`
  - `DEVIN_AUTH_METHOD_ID = "devin_api_key"` — Devin uses API key auth
  - `DevinAcpRuntimeSettings` type — optional binaryPath, apiKey env var name, apiEndpoint

**Pattern:** Copy from `CursorAcpSupport.ts`, simplify (no Cursor-specific model picker capabilities, no cursor settings extension).

### Slice 3: Server — DevinAdapter Service + Layer

**Files:**

- `apps/server/src/provider/Services/DevinAdapter.ts` — NEW — ServiceMap service tag
- `apps/server/src/provider/Layers/DevinAdapter.ts` — NEW — `makeDevinAdapterLive()` factory

**ProviderAdapter implementation:**

- `startSession(input)` → spawn `devin acp`, initialize ACP, return session
- `sendTurn(input)` → send prompt via ACP `session/prompt`
- `interruptTurn(input)` → send cancel via ACP `session/cancel`
- `listModels()` → use cached model aliases from ACP initialize response
- `dispose()` → terminate ACP process
- Events → use `AcpCoreRuntimeEvents` helpers to emit canonical events from ACP notifications
- Permissions → delegate to `handleRequestPermission` via ACP permission protocol
- User input → delegate to `handleElicitation` via ACP elicitation protocol

**Capabilities:**

```typescript
{
  sessionModelSwitch: "restart-session",
  supportsTurnSteering: false,
  supportsRuntimeModelList: true,
}
```

### Slice 4: Server — Wire Into Provider Runtime

**Files:**

- `apps/server/src/provider/runtimeLayer.ts` — Add `devinAdapterLayer` and register in `ProviderAdapterRegistryLive`
- `apps/server/src/provider/acp/AcpCoreRuntimeEvents.ts` — Add `"devin"` to provider event helpers if needed

### Slice 5: Server — Devin CLI Probe + Discovery

**Files:**

- `apps/server/src/provider/devinAcpProbe.ts` — NEW — Probe for `devin` binary availability
  - `probeDevinCli()` → checks if `devin` command exists and reports version

### Slice 6: Web — Model Selection Support

**Files:**

- `apps/web/...` — Add Devin to provider model selection UI (if needed, minimal)

## What Devin Does NOT Need (deferred)

- **Custom ACP extensions** — Devin uses standard ACP, no Cursor-style plan/todo extensions
- **Session file persistence** — ACP handles resume via `resumeSessionId`
- **Custom tool call mapping** — Standard ACP tool calls map to canonical events
- **Custom approval flow** — Standard ACP permission/elicitation protocol

## Commit Plan

1. `feat(devin): add devin provider kind and model selection` — contracts only
2. `feat(devin): add devin ACP support module` — AcpSupport + probe
3. `feat(devin): add devin provider adapter` — adapter service + layer
4. `feat(devin): wire devin adapter into runtime` — runtimeLayer registration
