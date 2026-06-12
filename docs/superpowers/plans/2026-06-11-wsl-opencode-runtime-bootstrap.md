# WSL OpenCode Runtime Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Settings-native WSL OpenCode runtime bootstrap that installs/repairs a loopback `jcode-opencode.service`, activates a WSL runtime profile, verifies health, and documents the lane.

**Architecture:** Add typed provider-runtime bootstrap contracts, implement pure server-side WSL/service/profile helpers with injected filesystem/command seams, expose RPC handlers, bridge them to the web Native API, and extend `OpenCodeRuntimeSettingsPanel` with install/repair controls. Runtime verification stays on the existing `provider.getRuntimeHealth` path; docs explain install, generated files, diagnostics, repair, rollback, and the distinction from the Windows installer branch.

**Tech Stack:** Bun, TypeScript, Effect Schema/RPC, React, Vitest, Vitest Browser, user systemd command rendering, Markdown docs.

---

## File Structure

- Modify `packages/contracts/src/providerDiscovery.ts`: add OpenCode-only runtime bootstrap schemas and types.
- Modify `packages/contracts/src/ws.ts`: add WS method constants and request body tags.
- Modify `packages/contracts/src/rpc.ts`: add Effect RPC entries for status/install/repair.
- Modify `packages/contracts/src/ipc.ts`: add Native API provider method signatures.
- Modify `packages/contracts/src/ws.test.ts`: add decode tests for new WS request tags.
- Modify `packages/contracts/src/rpc.test.ts`: assert the RPC group exports the new methods.
- Create `apps/server/src/provider/openCodeRuntimeBootstrap.ts`: pure WSL detection, service rendering, redaction, profile upsert, and injected command orchestration.
- Create `apps/server/src/provider/openCodeRuntimeBootstrap.test.ts`: pure tests for bootstrap behavior.
- Modify `apps/server/src/wsRpc.ts`: wire bootstrap handlers and call `ServerSettingsService.updateSettings` when install/repair returns a profile patch.
- Modify `apps/web/src/wsNativeApi.ts`: bridge status/install/repair calls to WS methods.
- Modify `apps/web/src/wsNativeApi.test.ts`: assert web bridge calls the expected WS method names.
- Modify `apps/web/src/components/OpenCodeRuntimeSettingsPanel.tsx`: add bootstrap state, install/repair controls, progress/error text, and post-success health refresh.
- Create `apps/web/src/components/OpenCodeRuntimeSettingsPanel.browser.tsx`: browser tests for unsupported/not-installed/ready/error states.
- Modify `docs/runbooks/local-opencode-runtime.md`: document generated WSL service, helper, health, repair, rollback.
- Modify `docs/runbooks/local-deploy.md`: explain when Settings bootstrap is preferred over manual service files.
- Modify `docs/runbooks/README.md`: add WSL OpenCode runtime install/repair scenario links.
- Modify `docs/architecture/provider-runtime.md`: document server-owned provider-runtime bootstrap ownership.
- Modify `docs/adr/0007-parallel-windows-wsl-backend-routing.md`: clarify this is narrow provider runtime bootstrap, not full backend routing.

Do not modify Windows installer code in this branch. Do not commit unless the user explicitly asks; commit steps in this plan are checkpoints only.

---

### Task 1: Contracts And WS Methods

**Files:**

- Modify: `packages/contracts/src/providerDiscovery.ts`
- Modify: `packages/contracts/src/ws.ts`
- Modify: `packages/contracts/src/rpc.ts`
- Modify: `packages/contracts/src/ipc.ts`
- Test: `packages/contracts/src/ws.test.ts`
- Test: `packages/contracts/src/rpc.test.ts`

- [ ] **Step 1: Write failing WS decode tests**

Add these tests after the existing provider discovery request tests in `packages/contracts/src/ws.test.ts`:

```ts
it.effect("accepts provider runtime bootstrap status requests", () =>
  Effect.gen(function* () {
    const parsed = yield* decode(WebSocketRequest, {
      id: "req-runtime-bootstrap-status-1",
      body: {
        _tag: WS_METHODS.providerGetRuntimeBootstrapStatus,
        provider: "opencode",
      },
    });

    assert.strictEqual(parsed.body._tag, WS_METHODS.providerGetRuntimeBootstrapStatus);
  }),
);

it.effect("accepts provider runtime bootstrap requests", () =>
  Effect.gen(function* () {
    const parsed = yield* decode(WebSocketRequest, {
      id: "req-runtime-bootstrap-1",
      body: {
        _tag: WS_METHODS.providerBootstrapRuntime,
        provider: "opencode",
      },
    });

    assert.strictEqual(parsed.body._tag, WS_METHODS.providerBootstrapRuntime);
  }),
);

it.effect("accepts provider runtime repair requests", () =>
  Effect.gen(function* () {
    const parsed = yield* decode(WebSocketRequest, {
      id: "req-runtime-repair-1",
      body: {
        _tag: WS_METHODS.providerRepairRuntime,
        provider: "opencode",
        forceReinstall: true,
      },
    });

    assert.strictEqual(parsed.body._tag, WS_METHODS.providerRepairRuntime);
    if (parsed.body._tag === WS_METHODS.providerRepairRuntime) {
      assert.strictEqual(parsed.body.forceReinstall, true);
    }
  }),
);
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
snip bun run --cwd packages/contracts test src/ws.test.ts
```

Expected: FAIL because `WS_METHODS.providerGetRuntimeBootstrapStatus`, `providerBootstrapRuntime`, and `providerRepairRuntime` do not exist.

- [ ] **Step 3: Add bootstrap schemas**

Append these schemas after `ProviderGetRuntimeHealthInput` in `packages/contracts/src/providerDiscovery.ts`:

```ts
export const OpenCodeRuntimeBootstrapLane = Schema.Literal("wsl-service");
export type OpenCodeRuntimeBootstrapLane = typeof OpenCodeRuntimeBootstrapLane.Type;

export const OpenCodeRuntimeBootstrapState = Schema.Literals([
  "unsupported",
  "notInstalled",
  "installing",
  "starting",
  "ready",
  "error",
]);
export type OpenCodeRuntimeBootstrapState = typeof OpenCodeRuntimeBootstrapState.Type;

export const ProviderRuntimeBootstrapStatusInput = Schema.Struct({
  provider: Schema.Literal("opencode"),
});
export type ProviderRuntimeBootstrapStatusInput = typeof ProviderRuntimeBootstrapStatusInput.Type;

export const ProviderRuntimeBootstrapInput = Schema.Struct({
  provider: Schema.Literal("opencode"),
  forceReinstall: Schema.optional(Schema.Boolean),
});
export type ProviderRuntimeBootstrapInput = typeof ProviderRuntimeBootstrapInput.Type;

export const ProviderRuntimeBootstrapSnapshot = Schema.Struct({
  provider: Schema.Literal("opencode"),
  lane: OpenCodeRuntimeBootstrapLane,
  state: OpenCodeRuntimeBootstrapState,
  serviceName: Schema.optional(Schema.Literal("jcode-opencode.service")),
  binaryPath: Schema.optional(TrimmedNonEmptyString),
  serverUrl: Schema.optional(TrimmedNonEmptyString),
  profileId: Schema.optional(TrimmedNonEmptyString),
  message: Schema.optional(Schema.String.check(Schema.isMaxLength(4096))),
  checkedAt: TrimmedNonEmptyString,
});
export type ProviderRuntimeBootstrapSnapshot = typeof ProviderRuntimeBootstrapSnapshot.Type;
```

- [ ] **Step 4: Add WS methods and request tags**

Update imports from `./providerDiscovery` in `packages/contracts/src/ws.ts` to include:

```ts
ProviderRuntimeBootstrapInput,
ProviderRuntimeBootstrapStatusInput,
```

Add these `WS_METHODS` entries after `providerGetRuntimeHealth`:

```ts
providerGetRuntimeBootstrapStatus: "provider.getRuntimeBootstrapStatus",
providerBootstrapRuntime: "provider.bootstrapRuntime",
providerRepairRuntime: "provider.repairRuntime",
```

Add these request body tags after `providerGetRuntimeHealth`:

```ts
tagRequestBody(
  WS_METHODS.providerGetRuntimeBootstrapStatus,
  ProviderRuntimeBootstrapStatusInput,
),
tagRequestBody(WS_METHODS.providerBootstrapRuntime, ProviderRuntimeBootstrapInput),
tagRequestBody(WS_METHODS.providerRepairRuntime, ProviderRuntimeBootstrapInput),
```

- [ ] **Step 5: Add RPC contracts**

Update imports in `packages/contracts/src/rpc.ts` to include:

```ts
ProviderRuntimeBootstrapInput,
ProviderRuntimeBootstrapSnapshot,
ProviderRuntimeBootstrapStatusInput,
```

Add these RPC entries after `WsProviderGetRuntimeHealthRpc`:

```ts
export const WsProviderGetRuntimeBootstrapStatusRpc = Rpc.make(
  WS_METHODS.providerGetRuntimeBootstrapStatus,
  {
    payload: ProviderRuntimeBootstrapStatusInput,
    success: ProviderRuntimeBootstrapSnapshot,
    error: WsRpcError,
  },
);

export const WsProviderBootstrapRuntimeRpc = Rpc.make(WS_METHODS.providerBootstrapRuntime, {
  payload: ProviderRuntimeBootstrapInput,
  success: ProviderRuntimeBootstrapSnapshot,
  error: WsRpcError,
});

export const WsProviderRepairRuntimeRpc = Rpc.make(WS_METHODS.providerRepairRuntime, {
  payload: ProviderRuntimeBootstrapInput,
  success: ProviderRuntimeBootstrapSnapshot,
  error: WsRpcError,
});
```

If `WsRpcGroup` explicitly lists RPCs later in the file, add these three entries to the group in the provider discovery block.

- [ ] **Step 6: Add native API contract signatures**

In `packages/contracts/src/ipc.ts`, add provider methods matching the existing provider native API shape:

```ts
getRuntimeBootstrapStatus: (input: ProviderRuntimeBootstrapStatusInput) =>
  Promise<ProviderRuntimeBootstrapSnapshot>;
bootstrapRuntime: (input: ProviderRuntimeBootstrapInput) =>
  Promise<ProviderRuntimeBootstrapSnapshot>;
repairRuntime: (input: ProviderRuntimeBootstrapInput) => Promise<ProviderRuntimeBootstrapSnapshot>;
```

Add the corresponding imports from `./providerDiscovery`.

- [ ] **Step 7: Run contract tests to verify GREEN**

Run:

```bash
snip bun run --cwd packages/contracts test src/ws.test.ts src/rpc.test.ts
```

Expected: PASS.

- [ ] **Step 8: Checkpoint diff**

Run:

```bash
GIT_MASTER=1 git diff -- packages/contracts/src/providerDiscovery.ts packages/contracts/src/ws.ts packages/contracts/src/rpc.ts packages/contracts/src/ipc.ts packages/contracts/src/ws.test.ts packages/contracts/src/rpc.test.ts
```

Expected: only contract/test changes for runtime bootstrap. Do not commit unless the user explicitly asks.

---

### Task 2: Pure Server Bootstrap Module

**Files:**

- Create: `apps/server/src/provider/openCodeRuntimeBootstrap.ts`
- Create: `apps/server/src/provider/openCodeRuntimeBootstrap.test.ts`

- [ ] **Step 1: Write failing pure tests**

Create `apps/server/src/provider/openCodeRuntimeBootstrap.test.ts` with:

```ts
import { DEFAULT_SERVER_SETTINGS, type ServerSettings } from "@jcode/contracts";
import { describe, expect, it } from "vitest";

import {
  JCODE_OPENCODE_SERVICE_NAME,
  WSL_OPENCODE_PROFILE_ID,
  detectWslOpenCodeBootstrapStatus,
  makeWslOpenCodeRuntimeProfilePatch,
  redactBootstrapMessage,
  renderJcodeOpenCodeServiceUnit,
  renderJcodeOpenCodeStartScript,
  upsertWslOpenCodeRuntimeProfile,
} from "./openCodeRuntimeBootstrap";

const NOW = "2026-06-11T12:00:00.000Z";

function settingsWithProfiles(
  profiles: ServerSettings["providers"]["opencode"]["runtimeProfiles"],
): ServerSettings {
  return {
    ...DEFAULT_SERVER_SETTINGS,
    providers: {
      ...DEFAULT_SERVER_SETTINGS.providers,
      opencode: {
        ...DEFAULT_SERVER_SETTINGS.providers.opencode,
        runtimeProfiles: profiles,
        activeRuntimeProfileId: profiles[0]?.id,
      },
    },
  };
}

describe("openCodeRuntimeBootstrap", () => {
  it("reports unsupported outside WSL", () => {
    const status = detectWslOpenCodeBootstrapStatus({
      now: NOW,
      platform: "linux",
      osRelease: "Linux 6.8 generic",
      env: {},
      userSystemdAvailable: true,
      serviceExists: false,
      serviceActive: false,
      binaryPath: null,
      portAvailable: true,
      profileReachable: false,
    });

    expect(status.state).toBe("unsupported");
    expect(status.message).toContain("WSL");
  });

  it("reports not installed in supported WSL without service or binary", () => {
    const status = detectWslOpenCodeBootstrapStatus({
      now: NOW,
      platform: "linux",
      osRelease: "Linux microsoft-standard-WSL2",
      env: { WSL_DISTRO_NAME: "Ubuntu" },
      userSystemdAvailable: true,
      serviceExists: false,
      serviceActive: false,
      binaryPath: null,
      portAvailable: true,
      profileReachable: false,
    });

    expect(status.state).toBe("notInstalled");
    expect(status.lane).toBe("wsl-service");
  });

  it("renders a loopback-only user service", () => {
    const unit = renderJcodeOpenCodeServiceUnit({
      startScriptPath: "/home/alice/.local/share/jcode/runtime/opencode/jcode-opencode-start",
    });

    expect(unit).toContain("Description=JCode external OpenCode runtime");
    expect(unit).toContain(
      "ExecStart=/home/alice/.local/share/jcode/runtime/opencode/jcode-opencode-start",
    );
    expect(unit).not.toContain("0.0.0.0");
  });

  it("renders a start script that unsets inline OpenCode config", () => {
    const script = renderJcodeOpenCodeStartScript({
      binaryPath: "/home/alice/.local/share/jcode/runtime/opencode/opencode",
      host: "127.0.0.1",
      port: 4096,
    });

    expect(script).toContain("unset OPENCODE_CONFIG_CONTENT");
    expect(script).toContain("--hostname=127.0.0.1");
    expect(script).toContain("--port=4096");
  });

  it("upserts the WSL profile without duplicating it", () => {
    const settings = settingsWithProfiles([
      {
        id: WSL_OPENCODE_PROFILE_ID,
        label: "Old WSL profile",
        provider: "opencode",
        mode: "external",
        configMode: "inherit",
        serverUrl: "http://127.0.0.1:4096",
        binaryPath: "/old/opencode",
        skillRoots: [],
        pluginRoots: [],
        requiredCommands: [],
        requiredSkills: [],
        requiredPlugins: [],
        requiredAgents: [],
        requiredModels: [],
        requiredEnv: [],
        requirements: [],
        capabilityPolicy: "warn",
      },
    ]);

    const patch = makeWslOpenCodeRuntimeProfilePatch({
      binaryPath: "/home/alice/.local/share/jcode/runtime/opencode/opencode",
      serverUrl: "http://127.0.0.1:4096",
    });
    const nextProfiles = upsertWslOpenCodeRuntimeProfile(
      settings.providers.opencode.runtimeProfiles,
      patch,
    );

    expect(nextProfiles).toHaveLength(1);
    expect(nextProfiles[0]?.label).toBe("WSL OpenCode service");
    expect(nextProfiles[0]?.binaryPath).toBe(
      "/home/alice/.local/share/jcode/runtime/opencode/opencode",
    );
  });

  it("redacts credentials from bootstrap messages", () => {
    expect(
      redactBootstrapMessage(
        "failed token=abc password=secret http://user:pass@example.test/path?client_secret=1",
      ),
    ).not.toContain("secret");
  });

  it("uses the documented constants", () => {
    expect(JCODE_OPENCODE_SERVICE_NAME).toBe("jcode-opencode.service");
    expect(WSL_OPENCODE_PROFILE_ID).toBe("wsl-opencode-service");
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
snip bun run --cwd apps/server test src/provider/openCodeRuntimeBootstrap.test.ts
```

Expected: FAIL because `openCodeRuntimeBootstrap.ts` does not exist.

- [ ] **Step 3: Implement pure bootstrap helpers**

Create `apps/server/src/provider/openCodeRuntimeBootstrap.ts` with exported constants and pure helpers needed by the test. Keep live command execution as typed seams for later orchestration; do not call `systemctl` directly in pure helpers.

The implementation must export:

```ts
export const JCODE_OPENCODE_SERVICE_NAME = "jcode-opencode.service" as const;
export const WSL_OPENCODE_PROFILE_ID = "wsl-opencode-service" as const;
export const WSL_OPENCODE_PROFILE_LABEL = "WSL OpenCode service" as const;
export const DEFAULT_WSL_OPENCODE_SERVER_URL = "http://127.0.0.1:4096" as const;
```

Implement these functions with the behavior asserted in Step 1:

```ts
export function detectWslOpenCodeBootstrapStatus(
  input: WslOpenCodeBootstrapProbe,
): ProviderRuntimeBootstrapSnapshot;
export function renderJcodeOpenCodeServiceUnit(input: { readonly startScriptPath: string }): string;
export function renderJcodeOpenCodeStartScript(input: {
  readonly binaryPath: string;
  readonly host: "127.0.0.1";
  readonly port: 4096;
}): string;
export function makeWslOpenCodeRuntimeProfilePatch(input: {
  readonly binaryPath: string;
  readonly serverUrl?: string;
}): OpenCodeRuntimeProfile;
export function upsertWslOpenCodeRuntimeProfile(
  existing: readonly OpenCodeRuntimeProfile[],
  profile: OpenCodeRuntimeProfile,
): OpenCodeRuntimeProfile[];
export function redactBootstrapMessage(message: string): string;
```

Detection rules:

- Non-Linux or Linux without WSL markers returns `unsupported`.
- Missing user systemd returns `unsupported` with a systemd message.
- Occupied port returns `error` with a port message.
- Reachable profile returns `ready`.
- Missing service/binary returns `notInstalled`.
- Existing inactive service returns `error` with `serviceName`.
- Existing active service returns `ready`.

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
snip bun run --cwd apps/server test src/provider/openCodeRuntimeBootstrap.test.ts
```

Expected: PASS.

- [ ] **Step 5: Refactor only after green**

If helpers grow beyond a readable module, split only pure rendering into `apps/server/src/provider/openCodeRuntimeBootstrapTemplates.ts` with a matching test import. Keep behavior unchanged and rerun:

```bash
snip bun run --cwd apps/server test src/provider/openCodeRuntimeBootstrap.test.ts
```

Expected: PASS.

---

### Task 3: Server Orchestration And RPC Wiring

**Files:**

- Modify: `apps/server/src/provider/openCodeRuntimeBootstrap.ts`
- Modify: `apps/server/src/wsRpc.ts`
- Test: `apps/server/src/provider/openCodeRuntimeBootstrap.test.ts`

- [ ] **Step 1: Add failing orchestration tests with injected adapters**

Extend `openCodeRuntimeBootstrap.test.ts` with tests for:

```ts
it("installs by writing script and service, starting systemd, and returning a ready profile snapshot", async () => {
  // Arrange an injected adapter that records write/start/check calls.
  // Assert generated paths, service name, loopback URL, and profile id.
});

it("repairs idempotently without duplicating the profile", async () => {
  // Arrange existing WSL profile and service.
  // Assert one WSL profile remains and restart/health checks run once.
});
```

Use real arrays and simple fake functions. The expected RED failure is missing exported orchestration helpers.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
snip bun run --cwd apps/server test src/provider/openCodeRuntimeBootstrap.test.ts
```

Expected: FAIL because install/repair orchestration helpers do not exist.

- [ ] **Step 3: Add orchestration helpers**

Add typed adapter seams in `openCodeRuntimeBootstrap.ts`:

```ts
export interface WslOpenCodeBootstrapAdapter {
  readonly now: () => string;
  readonly getProbe: () => Promise<WslOpenCodeBootstrapProbe>;
  readonly ensureRuntimeDirectory: () => Promise<void>;
  readonly resolveOpenCodeBinary: (forceReinstall: boolean) => Promise<string>;
  readonly writeExecutableFile: (path: string, contents: string) => Promise<void>;
  readonly writeFile: (path: string, contents: string) => Promise<void>;
  readonly systemctlUser: (args: readonly string[]) => Promise<void>;
  readonly smokeRuntime: (serverUrl: string) => Promise<void>;
}
```

Export:

```ts
export async function getWslOpenCodeRuntimeBootstrapStatus(
  adapter: WslOpenCodeBootstrapAdapter,
): Promise<ProviderRuntimeBootstrapSnapshot>;

export async function bootstrapWslOpenCodeRuntime(
  adapter: WslOpenCodeBootstrapAdapter,
  input: ProviderRuntimeBootstrapInput,
): Promise<{
  readonly snapshot: ProviderRuntimeBootstrapSnapshot;
  readonly profile: OpenCodeRuntimeProfile;
}>;

export async function repairWslOpenCodeRuntime(
  adapter: WslOpenCodeBootstrapAdapter,
  input: ProviderRuntimeBootstrapInput,
): Promise<{
  readonly snapshot: ProviderRuntimeBootstrapSnapshot;
  readonly profile: OpenCodeRuntimeProfile;
}>;
```

Implementation rules:

- Write helper script before unit file.
- Run `systemctl --user daemon-reload` before `enable --now`.
- Return `state: "ready"` only after `smokeRuntime` succeeds.
- On caught errors, return/throw redacted messages only.

- [ ] **Step 4: Wire RPC handlers**

In `apps/server/src/wsRpc.ts`, import server bootstrap helpers. Add handlers after `providerGetRuntimeHealth`:

```ts
[WS_METHODS.providerGetRuntimeBootstrapStatus]: (input) =>
  rpcEffect(getOpenCodeRuntimeBootstrapStatus(input), "Failed to get runtime bootstrap status"),
[WS_METHODS.providerBootstrapRuntime]: (input) =>
  rpcEffect(bootstrapOpenCodeRuntime(input), "Failed to bootstrap runtime"),
[WS_METHODS.providerRepairRuntime]: (input) =>
  rpcEffect(repairOpenCodeRuntime(input), "Failed to repair runtime"),
```

If the bootstrap helper returns a profile patch, update settings with `serverSettings.updateSettings` inside the handler or a server wrapper. Do not hand-edit settings JSON.

- [ ] **Step 5: Run server tests to verify GREEN**

Run:

```bash
snip bun run --cwd apps/server test src/provider/openCodeRuntimeBootstrap.test.ts src/provider/openCodeRuntimeHealth.test.ts
```

Expected: PASS.

---

### Task 4: Web Native API Bridge

**Files:**

- Modify: `apps/web/src/wsNativeApi.ts`
- Modify: `apps/web/src/wsNativeApi.test.ts`

- [ ] **Step 1: Write failing bridge tests**

Add tests in `apps/web/src/wsNativeApi.test.ts` near existing provider API request tests:

```ts
it("bridges OpenCode runtime bootstrap status requests", async () => {
  requestMock.mockResolvedValueOnce({
    provider: "opencode",
    lane: "wsl-service",
    state: "notInstalled",
    checkedAt: "2026-06-11T12:00:00.000Z",
  });
  const { createWsNativeApi } = await import("./wsNativeApi");

  const api = createWsNativeApi();
  await api.provider.getRuntimeBootstrapStatus({ provider: "opencode" });

  expect(requestMock).toHaveBeenCalledWith(WS_METHODS.providerGetRuntimeBootstrapStatus, {
    provider: "opencode",
  });
});

it("bridges OpenCode runtime bootstrap and repair requests", async () => {
  requestMock.mockResolvedValue({
    provider: "opencode",
    lane: "wsl-service",
    state: "ready",
    checkedAt: "2026-06-11T12:00:00.000Z",
  });
  const { createWsNativeApi } = await import("./wsNativeApi");

  const api = createWsNativeApi();
  await api.provider.bootstrapRuntime({ provider: "opencode" });
  await api.provider.repairRuntime({ provider: "opencode", forceReinstall: true });

  expect(requestMock).toHaveBeenCalledWith(WS_METHODS.providerBootstrapRuntime, {
    provider: "opencode",
  });
  expect(requestMock).toHaveBeenCalledWith(WS_METHODS.providerRepairRuntime, {
    provider: "opencode",
    forceReinstall: true,
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
snip bun run --cwd apps/web test src/wsNativeApi.test.ts
```

Expected: FAIL because provider bridge methods do not exist.

- [ ] **Step 3: Implement bridge methods**

In `apps/web/src/wsNativeApi.ts`, add provider methods that call `transport.request` with the new `WS_METHODS` entries:

```ts
getRuntimeBootstrapStatus: (input) =>
  transport.request(WS_METHODS.providerGetRuntimeBootstrapStatus, input),
bootstrapRuntime: (input) => transport.request(WS_METHODS.providerBootstrapRuntime, input),
repairRuntime: (input) => transport.request(WS_METHODS.providerRepairRuntime, input),
```

Use existing method style and return typing.

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
snip bun run --cwd apps/web test src/wsNativeApi.test.ts
```

Expected: PASS.

---

### Task 5: Settings Panel UI

**Files:**

- Modify: `apps/web/src/components/OpenCodeRuntimeSettingsPanel.tsx`
- Create: `apps/web/src/components/OpenCodeRuntimeSettingsPanel.browser.tsx`

- [ ] **Step 1: Write failing browser tests**

Create `apps/web/src/components/OpenCodeRuntimeSettingsPanel.browser.tsx`:

```tsx
import "../index.css";

import type {
  NativeApi,
  OpenCodeRuntimeHealth,
  ProviderRuntimeBootstrapSnapshot,
} from "@jcode/contracts";
import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { OpenCodeRuntimeSettingsPanel } from "./OpenCodeRuntimeSettingsPanel";

const NOW = "2026-06-11T12:00:00.000Z";

const health: OpenCodeRuntimeHealth = {
  provider: "opencode",
  profileId: "wsl-opencode-service",
  profileLabel: "WSL OpenCode service",
  mode: "external",
  configMode: "inherit",
  status: "healthy",
  serverUrl: "http://127.0.0.1:4096",
  external: true,
  capabilities: {},
  mismatches: [],
  checkedAt: NOW,
};

let bootstrapStatus: ProviderRuntimeBootstrapSnapshot;

const nativeApi = {
  provider: {
    getRuntimeHealth: vi.fn(async () => health),
    getRuntimeBootstrapStatus: vi.fn(async () => bootstrapStatus),
    bootstrapRuntime: vi.fn(async () => ({ ...bootstrapStatus, state: "ready" as const })),
    repairRuntime: vi.fn(async () => ({ ...bootstrapStatus, state: "ready" as const })),
  },
} as unknown as NativeApi;

describe("OpenCodeRuntimeSettingsPanel", () => {
  beforeEach(() => {
    bootstrapStatus = {
      provider: "opencode",
      lane: "wsl-service",
      state: "notInstalled",
      checkedAt: NOW,
      message: "OpenCode runtime is not installed.",
    };
    for (const method of Object.values(nativeApi.provider)) {
      if (typeof method === "function" && "mockClear" in method) {
        (method as { mockClear: () => void }).mockClear();
      }
    }
    window.nativeApi = nativeApi;
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "nativeApi");
    document.body.innerHTML = "";
  });

  it("shows install when runtime bootstrap status is not installed", async () => {
    const screen = await render(<OpenCodeRuntimeSettingsPanel />);

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("OpenCode runtime is not installed.");
    });

    await page.getByRole("button", { name: "Install OpenCode runtime" }).click();

    await vi.waitFor(() => {
      expect(nativeApi.provider.bootstrapRuntime).toHaveBeenCalledWith({ provider: "opencode" });
      expect(nativeApi.provider.getRuntimeHealth).toHaveBeenCalledWith({
        provider: "opencode",
        forceRefresh: true,
      });
    });

    await screen.unmount();
  });

  it("shows repair when runtime bootstrap status is error", async () => {
    bootstrapStatus = {
      provider: "opencode",
      lane: "wsl-service",
      state: "error",
      serviceName: "jcode-opencode.service",
      message: "Service stopped.",
      checkedAt: NOW,
    };

    const screen = await render(<OpenCodeRuntimeSettingsPanel />);

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Service stopped.");
    });

    await page.getByRole("button", { name: "Repair runtime" }).click();

    await vi.waitFor(() => {
      expect(nativeApi.provider.repairRuntime).toHaveBeenCalledWith({ provider: "opencode" });
    });

    await screen.unmount();
  });
});
```

- [ ] **Step 2: Run browser tests to verify RED**

Run:

```bash
snip bun run --cwd apps/web test:browser:local src/components/OpenCodeRuntimeSettingsPanel.browser.tsx
```

Expected: FAIL because the panel does not fetch bootstrap status or render install/repair buttons.

- [ ] **Step 3: Implement UI state**

In `OpenCodeRuntimeSettingsPanel.tsx`:

- Import `ProviderRuntimeBootstrapSnapshot` type and a download/wrench icon if available.
- Add `bootstrapStatus`, `isBootstrapping`, and `bootstrapAction` state.
- Fetch bootstrap status in the existing initial `useEffect` alongside health.
- Add `installRuntime` and `repairRuntime` callbacks that call the new Native API methods and then `checkRuntime(true)`.
- Render install button for `state === "notInstalled"`.
- Render repair button for `state === "error"`.
- Render unsupported messages without attempting install.
- Keep the existing `Check` button and capability summary.

Use button labels exactly as tests expect:

```text
Install OpenCode runtime
Repair runtime
```

- [ ] **Step 4: Run browser tests to verify GREEN**

Run:

```bash
snip bun run --cwd apps/web test:browser:local src/components/OpenCodeRuntimeSettingsPanel.browser.tsx
```

Expected: PASS.

- [ ] **Step 5: Run focused web unit bridge tests**

Run:

```bash
snip bun run --cwd apps/web test src/wsNativeApi.test.ts
```

Expected: PASS.

---

### Task 6: Documentation Workstream

**Files:**

- Modify: `docs/runbooks/local-opencode-runtime.md`
- Modify: `docs/runbooks/local-deploy.md`
- Modify: `docs/runbooks/README.md`
- Modify: `docs/architecture/provider-runtime.md`
- Modify: `docs/adr/0007-parallel-windows-wsl-backend-routing.md`

- [ ] **Step 1: Update local OpenCode runtime runbook**

Add sections describing:

```text
WSL Settings bootstrap
Generated files
Health checks
Repair
Rollback
```

Include these concrete portable paths:

```text
~/.local/share/jcode/runtime/opencode/opencode
~/.local/share/jcode/runtime/opencode/jcode-opencode-start
~/.config/systemd/user/jcode-opencode.service
http://127.0.0.1:4096/
```

- [ ] **Step 2: Update local deploy notes and runbook index**

In `docs/runbooks/local-deploy.md`, explain that WSL OpenCode runtime bootstrap should be run from Settings -> Providers -> OpenCode when available, and manual systemd files are for diagnosis or unsupported environments.

In `docs/runbooks/README.md`, add a scenario row:

```markdown
| Installing or repairing a WSL OpenCode runtime | [Local OpenCode Runtime Service](local-opencode-runtime.md) | [Provider Runtime Architecture](../architecture/provider-runtime.md) |
```

- [ ] **Step 3: Update architecture/ADR docs**

In `docs/architecture/provider-runtime.md`, add the ownership invariant:

```text
Settings may trigger provider runtime bootstrap actions, but the server owns service creation, runtime profile mutation, and runtime health verification.
```

In ADR 0007, add a short note that WSL OpenCode runtime bootstrap is a narrow provider-runtime service lane and does not implement project-to-backend routing.

- [ ] **Step 4: Verify docs**

Run:

```bash
GIT_MASTER=1 git diff --check -- docs/runbooks/local-opencode-runtime.md docs/runbooks/local-deploy.md docs/runbooks/README.md docs/architecture/provider-runtime.md docs/adr/0007-parallel-windows-wsl-backend-routing.md
snip bunx oxfmt@0.52.0 --check docs/runbooks/local-opencode-runtime.md docs/runbooks/local-deploy.md docs/runbooks/README.md docs/architecture/provider-runtime.md docs/adr/0007-parallel-windows-wsl-backend-routing.md
```

Expected: PASS. If formatter fails, run `snip bunx oxfmt@0.52.0 <files>` only for touched docs and rerun the checks.

---

### Task 7: Final Focused Verification

**Files:**

- All files touched by Tasks 1-6.

- [ ] **Step 1: Run LSP diagnostics on changed source files**

Run LSP diagnostics on changed `.ts`/`.tsx` files. Expected: no new errors.

- [ ] **Step 2: Run focused tests**

Run:

```bash
snip bun run --cwd packages/contracts test src/ws.test.ts src/rpc.test.ts
snip bun run --cwd apps/server test src/provider/openCodeRuntimeBootstrap.test.ts src/provider/openCodeRuntimeHealth.test.ts
snip bun run --cwd apps/web test src/wsNativeApi.test.ts
snip bun run --cwd apps/web test:browser:local src/components/OpenCodeRuntimeSettingsPanel.browser.tsx
```

Expected: PASS.

- [ ] **Step 3: Run focused typechecks with safe-run**

Run:

```bash
safe-run --profile build -- bun run --cwd packages/contracts typecheck
safe-run --profile build -- bun run --cwd apps/server typecheck
safe-run --profile build -- bun run --cwd apps/web typecheck
```

Expected: PASS.

- [ ] **Step 4: Run formatting checks for touched files**

Run:

```bash
snip bunx oxfmt@0.52.0 --check <all-touched-ts-tsx-md-files>
```

Expected: PASS.

- [ ] **Step 5: Review diff for scope and secrets**

Run:

```bash
GIT_MASTER=1 git diff --check
GIT_MASTER=1 git diff --stat
```

Search touched docs/source for private values:

```bash
rg -n "tailnet|tailscale|cookie|token=|password=|client_secret|owner pairing|/home/jay/code/jcode-stable" docs apps packages
```

Expected: no new private hostnames, tokens, cookies, owner pairing links, service passwords, or Jay-specific defaults.

---

## Self-Review Notes

Spec coverage:

- Contracts/RPC covered by Task 1.
- Server-owned WSL service/profile bootstrap covered by Tasks 2-3.
- Existing runtime health reuse covered by Tasks 3 and 7.
- Web Settings install/repair UX covered by Tasks 4-5.
- Documentation workstream covered by Task 6.
- Verification and private-value checks covered by Task 7.

Scope guard:

- This plan does not implement Windows installer logic.
- This plan does not create `jcode.service` or install JCode itself into WSL.
- This plan does not implement ADR 0007 backend routing.
- This plan keeps OpenCode bound to `127.0.0.1:4096`.
