import { readFile } from "node:fs/promises";

import * as NodeServices from "@effect/platform-node/NodeServices";
import {
  AuthSessionId,
  type AuthCapabilityScope,
  type ManagedSidecarSnapshot,
  type ManagedSidecarStartRequest,
} from "@jcode/contracts";
import { Effect, Exit, Layer, Scope } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { describe, expect, it, vi } from "vitest";

import type { AuthenticatedSession } from "./auth/Services/ServerAuth.ts";
import * as managedRuntimeDownload from "./provider/managedRuntimeDownload.ts";
import type { ManagedSidecarLifecycleShape } from "./provider/managedRuntimeLifecycle.ts";
import { ServerSettingsService } from "./serverSettings.ts";
import {
  exportManagedSidecarDiagnosticsFromLifecycle,
  getManagedSidecarHealthFromLifecycle,
  requireManagedSidecarHealthRpcAccess,
  requireManagedSidecarDiagnosticsRpcAccess,
  requireManagedSidecarRepairRpcAccess,
  requireOwnerWsRpcAccess,
  requireProviderStatusRpcAccess,
  repairManagedSidecarFromLifecycle,
  resolveLocalLegacyWsAuthSession,
  skipFirstRunWizardFromRpc,
} from "./wsRpc.ts";

vi.mock("node:fs", () => ({
  existsSync: vi.fn((path: string) => typeof path === "string" && path.includes("opencode")),
}));

vi.mock("./provider/managedRuntimeDownload.ts", () => ({
  verifyManagedRuntimeBinary: vi.fn(() =>
    Effect.succeed({ exists: true, sha256: "abc", expectedSha256: null, valid: true }),
  ),
}));

const mockVerify = vi.mocked(managedRuntimeDownload.verifyManagedRuntimeBinary);
const TestLayer = Layer.merge(NodeServices.layer, FetchHttpClient.layer);
const FirstRunTestLayer = Layer.merge(ServerSettingsService.layerTest(), NodeServices.layer);
const successfulServerProbe = () => Effect.succeed(true);

function makeAuthSession(input: {
  readonly role: "owner" | "client";
  readonly scopes?: ReadonlyArray<AuthCapabilityScope>;
}): AuthenticatedSession {
  return {
    sessionId: AuthSessionId.makeUnsafe(`${input.role}-session`),
    subject: input.role,
    method: "browser-session-cookie",
    role: input.role,
    ...(input.scopes ? { scopes: input.scopes } : {}),
  };
}

const READY_SNAPSHOT: ManagedSidecarSnapshot = Object.freeze({
  state: "ready",
  binaryPath: "/usr/local/bin/opencode",
  serverUrl: "http://127.0.0.1:9876",
  serverPassword: "test-password",
});

async function expectWsRpcHandlerOwnerGuarded(methodExpression: string) {
  const source = await readFile(new URL("./wsRpc.ts", import.meta.url), "utf8");
  const methodStart = source.indexOf(`[${methodExpression}]`);
  expect(methodStart, `${methodExpression} handler exists`).toBeGreaterThanOrEqual(0);
  const nextMethodStart = source.indexOf("\n        [", methodStart + 1);
  const handlerSource = source.slice(
    methodStart,
    nextMethodStart === -1 ? undefined : nextMethodStart,
  );

  expect(handlerSource).toMatch(
    new RegExp(`withCurrentSession(?:Stream)?\\(\\s*requireOwnerWsRpcAccess`),
  );
}

async function expectWsRpcHandlerScopeGuarded(
  methodExpression: string,
  scope: AuthCapabilityScope,
) {
  const source = await readFile(new URL("./wsRpc.ts", import.meta.url), "utf8");
  const methodStart = source.indexOf(`[${methodExpression}]`);
  expect(methodStart, `${methodExpression} handler exists`).toBeGreaterThanOrEqual(0);
  const nextMethodStart = source.indexOf("\n        [", methodStart + 1);
  const handlerSource = source.slice(
    methodStart,
    nextMethodStart === -1 ? undefined : nextMethodStart,
  );

  expect(handlerSource).toContain(`withScope`);
  expect(handlerSource).toContain(`"${scope}"`);
}

describe("managed sidecar lifecycle layer composition", () => {
  it("shares the managed sidecar lifecycle from the provider layer instead of a WS-only layer", async () => {
    const wsRpcSource = await readFile(new URL("./wsRpc.ts", import.meta.url), "utf8");
    const runtimeLayerSource = await readFile(
      new URL("./provider/runtimeLayer.ts", import.meta.url),
      "utf8",
    );

    expect(wsRpcSource).not.toContain("ManagedSidecarLifecycleLive");
    expect(runtimeLayerSource).toContain("ManagedSidecarLifecycleLive");
    expect(runtimeLayerSource).toContain("| ManagedSidecarLifecycle");
  });
});

function makeLifecycle(initialSnapshot: ManagedSidecarSnapshot = READY_SNAPSHOT) {
  let currentSnapshot = initialSnapshot;
  const startManagedRuntime = vi.fn<ManagedSidecarLifecycleShape["startManagedRuntime"]>(
    (request?: ManagedSidecarStartRequest) => {
      void request;
      currentSnapshot = READY_SNAPSHOT;
      return Effect.succeed(currentSnapshot);
    },
  );
  const stopManagedRuntime = vi.fn<ManagedSidecarLifecycleShape["stopManagedRuntime"]>(() => {
    currentSnapshot = { state: "idle" };
    return Effect.succeed(currentSnapshot);
  });
  const restartManagedRuntime = vi.fn<ManagedSidecarLifecycleShape["restartManagedRuntime"]>(() => {
    currentSnapshot = READY_SNAPSHOT;
    return Effect.succeed(currentSnapshot);
  });
  const getManagedRuntimeStatus = vi.fn<ManagedSidecarLifecycleShape["getManagedRuntimeStatus"]>(
    () => Effect.succeed(currentSnapshot),
  );

  return {
    lifecycle: {
      startManagedRuntime,
      stopManagedRuntime,
      restartManagedRuntime,
      getManagedRuntimeStatus,
    } satisfies ManagedSidecarLifecycleShape,
  };
}

describe("managed sidecar wsRpc adapters", () => {
  it("does not provide a private managed sidecar lifecycle inside the websocket route", async () => {
    const source = await readFile(new URL("./wsRpc.ts", import.meta.url), "utf8");

    expect(source).not.toContain("ManagedSidecarLifecycleLive");
    expect(source).toContain("yield* ManagedSidecarLifecycle");
  });

  it("allows owner-only WS RPC access for owners", async () => {
    await expect(
      Effect.runPromise(requireOwnerWsRpcAccess(makeAuthSession({ role: "owner" }))),
    ).resolves.toBeUndefined();
  });

  it("denies owner-only WS RPC access for clients without scopes", async () => {
    await expect(
      Effect.runPromise(requireOwnerWsRpcAccess(makeAuthSession({ role: "client" }))),
    ).rejects.toThrow("requires owner role");
  });

  it("denies owner-only WS RPC access for provider-status scoped clients", async () => {
    await expect(
      Effect.runPromise(
        requireOwnerWsRpcAccess(
          makeAuthSession({ role: "client", scopes: ["provider_status:read"] }),
        ),
      ),
    ).rejects.toThrow("requires owner role");
  });

  it("allows provider runtime health for provider-status scoped clients", async () => {
    await expect(
      Effect.runPromise(
        requireProviderStatusRpcAccess(
          makeAuthSession({ role: "client", scopes: ["provider_status:read"] }),
        ),
      ),
    ).resolves.toBeUndefined();
  });

  it("denies provider runtime health for clients without provider-status scope", async () => {
    await expect(
      Effect.runPromise(requireProviderStatusRpcAccess(makeAuthSession({ role: "client" }))),
    ).rejects.toMatchObject({ message: "Missing required scope: provider_status:read" });
  });

  it("allows managed sidecar health for provider-status scoped clients", async () => {
    await expect(
      Effect.runPromise(
        requireManagedSidecarHealthRpcAccess(
          makeAuthSession({ role: "client", scopes: ["provider_status:read"] }),
        ),
      ),
    ).resolves.toBeUndefined();
  });

  it("denies managed sidecar health for clients without provider-status scope", async () => {
    await expect(
      Effect.runPromise(requireManagedSidecarHealthRpcAccess(makeAuthSession({ role: "client" }))),
    ).rejects.toMatchObject({ message: "Missing required scope: provider_status:read" });
  });

  it("denies managed sidecar repair for non-owner clients even with provider-status scope", async () => {
    await expect(
      Effect.runPromise(
        requireManagedSidecarRepairRpcAccess(
          makeAuthSession({ role: "client", scopes: ["provider_status:read"] }),
        ),
      ),
    ).rejects.toThrow("requires owner role");
  });

  it("denies managed sidecar diagnostics for non-owner clients even with provider-status scope", async () => {
    await expect(
      Effect.runPromise(
        requireManagedSidecarDiagnosticsRpcAccess(
          makeAuthSession({ role: "client", scopes: ["provider_status:read"] }),
        ),
      ),
    ).rejects.toThrow("requires owner role");
  });

  it("allows managed sidecar repair and diagnostics for owners", async () => {
    await expect(
      Effect.runPromise(requireManagedSidecarRepairRpcAccess(makeAuthSession({ role: "owner" }))),
    ).resolves.toBeUndefined();
    await expect(
      Effect.runPromise(
        requireManagedSidecarDiagnosticsRpcAccess(makeAuthSession({ role: "owner" })),
      ),
    ).resolves.toBeUndefined();
  });

  it("maps local legacy WebSocket access to an owner-equivalent RPC session", () => {
    expect(
      resolveLocalLegacyWsAuthSession({ authToken: undefined, legacyToken: null }),
    ).toMatchObject({ role: "owner", subject: "local-legacy-websocket" });
    expect(
      resolveLocalLegacyWsAuthSession({ authToken: "local-token", legacyToken: "local-token" }),
    ).toMatchObject({ role: "owner", subject: "local-legacy-websocket" });
    expect(
      resolveLocalLegacyWsAuthSession({ authToken: "local-token", legacyToken: "wrong-token" }),
    ).toBeNull();
  });

  it("keeps privileged WS RPC handlers owner-only for scoped client sessions", async () => {
    await expectWsRpcHandlerOwnerGuarded("ORCHESTRATION_WS_METHODS.importThread");
    await expectWsRpcHandlerOwnerGuarded("ORCHESTRATION_WS_METHODS.repairState");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.projectsSearchLocalEntries");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.projectsWriteFile");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.filesystemBrowse");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.shellOpenInEditor");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.gitPull");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.gitRunStackedAction");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.gitPreparePullRequestThread");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.gitCreateWorktree");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.gitCreateDetachedWorktree");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.gitRemoveWorktree");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.gitCreateBranch");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.gitCheckout");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.gitStashAndCheckout");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.gitStashDrop");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.gitRemoveIndexLock");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.gitInit");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.gitHandoffThread");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.terminalOpen");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.terminalWrite");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.terminalResize");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.terminalClear");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.terminalRestart");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.terminalClose");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.subscribeTerminalEvents");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.serverUpdateProvider");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.serverTranscribeVoice");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.providerCompactThread");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.providerInstallSkill");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.providerUninstallSkill");
    await expectWsRpcHandlerOwnerGuarded("WS_METHODS.providerSetSkillEnabled");
  });

  it("keeps observable WS RPC handlers limited to explicit scopes", async () => {
    await expectWsRpcHandlerScopeGuarded(
      "WS_METHODS.subscribeOrchestrationDomainEvents",
      "thread:read",
    );
    await expectWsRpcHandlerScopeGuarded(
      "WS_METHODS.serverGetProviderUsageSnapshot",
      "provider_status:read",
    );
  });

  it("checks health from the lifecycle snapshot", async () => {
    mockVerify.mockReturnValueOnce(
      Effect.succeed({ exists: true, sha256: "abc", expectedSha256: null, valid: true }),
    );
    const { lifecycle } = makeLifecycle();

    const result = await Effect.runPromise(
      getManagedSidecarHealthFromLifecycle({ lifecycle, serverProbe: successfulServerProbe }).pipe(
        Effect.provide(TestLayer),
      ),
    );

    expect(lifecycle.getManagedRuntimeStatus).toHaveBeenCalledOnce();
    expect(result.status).toBe("healthy");
    expect(result.serverReachable).toBe(true);
  });

  it("repairs through lifecycle using the force redownload request", async () => {
    mockVerify.mockReturnValue(
      Effect.succeed({ exists: true, sha256: "abc", expectedSha256: null, valid: true }),
    );
    const { lifecycle } = makeLifecycle({ state: "idle" });

    const result = await Effect.runPromise(
      repairManagedSidecarFromLifecycle({
        lifecycle,
        request: { forceRedownload: true },
        serverProbe: successfulServerProbe,
      }).pipe(Effect.scoped, Effect.provide(TestLayer)),
    );

    expect(result.success).toBe(true);
    expect(lifecycle.getManagedRuntimeStatus).not.toHaveBeenCalled();
    expect(lifecycle.stopManagedRuntime).toHaveBeenCalledOnce();
    expect(lifecycle.startManagedRuntime).toHaveBeenCalledWith({ forceDownload: true });
  });

  it("kills the old sidecar during repair and keeps the replacement attached to the caller scope", async () => {
    mockVerify.mockReturnValue(
      Effect.succeed({ exists: true, sha256: "abc", expectedSha256: null, valid: true }),
    );
    let oldSidecarFinalized = false;
    let replacementSidecarFinalized = false;
    const { lifecycle } = makeLifecycle({ state: "idle" });
    const scope = await Effect.runPromise(Scope.make());
    lifecycle.stopManagedRuntime.mockImplementation(() =>
      Effect.sync(() => {
        oldSidecarFinalized = true;
        return { state: "idle" } satisfies ManagedSidecarSnapshot;
      }),
    );
    lifecycle.startManagedRuntime.mockImplementation((request?: ManagedSidecarStartRequest) => {
      void request;
      return Scope.provide(
        Effect.gen(function* () {
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              replacementSidecarFinalized = true;
            }),
          );
          return READY_SNAPSHOT;
        }),
        scope,
      );
    });

    const result = await Effect.runPromise(
      Scope.provide(
        repairManagedSidecarFromLifecycle({
          lifecycle,
          request: { forceRedownload: false },
          serverProbe: successfulServerProbe,
        }),
        scope,
      ).pipe(Effect.provide(TestLayer)),
    );

    expect(result.success).toBe(true);
    expect(oldSidecarFinalized).toBe(true);
    expect(replacementSidecarFinalized).toBe(false);

    await Effect.runPromise(Scope.close(scope, Exit.void));
    expect(replacementSidecarFinalized).toBe(true);
  });

  it("exports diagnostics without leaking the sidecar password", async () => {
    mockVerify.mockReturnValueOnce(
      Effect.succeed({ exists: true, sha256: "abc", expectedSha256: null, valid: true }),
    );
    const { lifecycle } = makeLifecycle();

    const result = await Effect.runPromise(
      exportManagedSidecarDiagnosticsFromLifecycle({
        lifecycle,
        serverProbe: successfulServerProbe,
      }).pipe(Effect.provide(TestLayer)),
    );

    expect(lifecycle.getManagedRuntimeStatus).toHaveBeenCalledOnce();
    expect(Object.hasOwn(result.sidecarSnapshot, "serverPassword")).toBe(false);
    expect(JSON.stringify(result)).not.toContain("test-password");
  });
});

describe("first-run wsRpc adapters", () => {
  it("skips first-run through the RPC adapter", async () => {
    const result = await Effect.runPromise(
      skipFirstRunWizardFromRpc().pipe(Effect.provide(FirstRunTestLayer)),
    );

    expect(result.completed).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.completedAt).toBeDefined();
  });
});
