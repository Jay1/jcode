import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";

import type { ManagedSidecarSnapshot } from "@jcode/contracts";

import {
  checkManagedSidecarHealth,
  deriveHealthStatus,
  exportManagedSidecarDiagnostics,
  repairManagedSidecar,
} from "./managedRuntimeHealth.ts";
import { ManagedSidecarError } from "./managedRuntimeLifecycle.ts";

import * as managedRuntimeDownload from "./managedRuntimeDownload.ts";

vi.mock("node:fs", () => ({
  existsSync: vi.fn((path: string) => typeof path === "string" && path.includes("opencode")),
}));

vi.mock("./managedRuntimeDownload.ts", () => ({
  verifyManagedRuntimeBinary: vi.fn(() =>
    Effect.succeed({ exists: true, sha256: "abc", expectedSha256: null, valid: true }),
  ),
}));

const mockVerify = vi.mocked(managedRuntimeDownload.verifyManagedRuntimeBinary);

const READY_SNAPSHOT: ManagedSidecarSnapshot = Object.freeze({
  state: "ready",
  binaryPath: "/usr/local/bin/opencode",
  serverUrl: "http://127.0.0.1:9876",
  serverPassword: "test-password",
});

const ERROR_SNAPSHOT: ManagedSidecarSnapshot = Object.freeze({
  state: "error",
  error: "Spawn failed",
});

const IDLE_SNAPSHOT: ManagedSidecarSnapshot = Object.freeze({
  state: "idle",
});

const DOWNLOADING_SNAPSHOT: ManagedSidecarSnapshot = Object.freeze({
  state: "downloading",
});

function makeMockLifecycle(overrides?: {
  startResult?: ManagedSidecarSnapshot;
  startError?: ManagedSidecarError;
  currentSnapshot?: ManagedSidecarSnapshot;
}) {
  let currentSnapshot: ManagedSidecarSnapshot = overrides?.currentSnapshot ?? IDLE_SNAPSHOT;

  return {
    startManagedRuntime: vi.fn(() => {
      if (overrides?.startError) {
        currentSnapshot = { state: "error", error: overrides.startError.message };
        return Effect.fail(overrides.startError);
      }
      currentSnapshot = overrides?.startResult ?? READY_SNAPSHOT;
      return Effect.succeed(currentSnapshot);
    }),
    stopManagedRuntime: vi.fn(() => {
      currentSnapshot = { state: "idle" };
      return Effect.succeed(currentSnapshot);
    }),
    restartManagedRuntime: vi.fn(() => Effect.succeed(READY_SNAPSHOT)),
    getManagedRuntimeStatus: vi.fn(() => Effect.succeed(currentSnapshot)),
  };
}

describe("deriveHealthStatus", () => {
  it("returns healthy when ready with binary and reachable server", () => {
    expect(deriveHealthStatus("ready", true, true, true)).toBe("healthy");
  });

  it("returns degraded when ready but server unreachable", () => {
    expect(deriveHealthStatus("ready", true, true, false)).toBe("degraded");
  });

  it("returns unhealthy when ready but binary missing", () => {
    expect(deriveHealthStatus("ready", false, false, true)).toBe("unhealthy");
  });

  it("returns unhealthy when error state", () => {
    expect(deriveHealthStatus("error", false, false, false)).toBe("unhealthy");
  });

  it("returns not_running when idle", () => {
    expect(deriveHealthStatus("idle", false, false, false)).toBe("not_running");
  });

  it("returns degraded when downloading (transient)", () => {
    expect(deriveHealthStatus("downloading", false, false, false)).toBe("degraded");
  });
});

describe("checkManagedSidecarHealth", () => {
  it("returns healthy when ready with valid binary and reachable server", async () => {
    mockVerify.mockReturnValueOnce(
      Effect.succeed({ exists: true, sha256: "abc", expectedSha256: null, valid: true }),
    );

    const result = await Effect.runPromise(
      checkManagedSidecarHealth({ sidecarSnapshot: READY_SNAPSHOT }).pipe(
        Effect.provide(NodeServices.layer),
      ),
    );

    expect(result.status).toBe("healthy");
    expect(result.sidecarState).toBe("ready");
    expect(result.serverReachable).toBe(true);
    expect(result.binaryExists).toBe(true);
    expect(result.checkedAt).toBeTruthy();
  });

  it("returns unhealthy when ready with missing binary", async () => {
    const snapshot: ManagedSidecarSnapshot = { state: "ready", serverUrl: "http://127.0.0.1:9999" };

    const result = await Effect.runPromise(
      checkManagedSidecarHealth({ sidecarSnapshot: snapshot }).pipe(
        Effect.provide(NodeServices.layer),
      ),
    );

    expect(result.status).toBe("unhealthy");
    expect(result.binaryExists).toBe(false);
    expect(result.binaryValid).toBe(false);
  });

  it("returns unhealthy with error message when in error state", async () => {
    const result = await Effect.runPromise(
      checkManagedSidecarHealth({ sidecarSnapshot: ERROR_SNAPSHOT }).pipe(
        Effect.provide(NodeServices.layer),
      ),
    );

    expect(result.status).toBe("unhealthy");
    expect(result.sidecarState).toBe("error");
    expect(result.error).toBe("Spawn failed");
  });

  it("returns not_running when idle", async () => {
    const result = await Effect.runPromise(
      checkManagedSidecarHealth({ sidecarSnapshot: IDLE_SNAPSHOT }).pipe(
        Effect.provide(NodeServices.layer),
      ),
    );

    expect(result.status).toBe("not_running");
    expect(result.sidecarState).toBe("idle");
  });

  it("returns degraded when downloading (transient)", async () => {
    const result = await Effect.runPromise(
      checkManagedSidecarHealth({ sidecarSnapshot: DOWNLOADING_SNAPSHOT }).pipe(
        Effect.provide(NodeServices.layer),
      ),
    );

    expect(result.status).toBe("degraded");
    expect(result.sidecarState).toBe("downloading");
  });

  it("returns not_running when stopping", async () => {
    const snapshot: ManagedSidecarSnapshot = { state: "stopping" };

    const result = await Effect.runPromise(
      checkManagedSidecarHealth({ sidecarSnapshot: snapshot }).pipe(
        Effect.provide(NodeServices.layer),
      ),
    );

    expect(result.status).toBe("not_running");
  });
});

describe("repairManagedSidecar", () => {
  it("performs successful repair and returns healthy result", async () => {
    mockVerify.mockReturnValue(
      Effect.succeed({ exists: true, sha256: "abc", expectedSha256: null, valid: true }),
    );

    const lifecycle = makeMockLifecycle();

    const result = await Effect.runPromise(
      repairManagedSidecar({ sidecarSnapshot: IDLE_SNAPSHOT, lifecycle }).pipe(
        Effect.provide(NodeServices.layer),
      ),
    );

    expect(result.success).toBe(true);
    expect(lifecycle.stopManagedRuntime).toHaveBeenCalledOnce();
    expect(lifecycle.startManagedRuntime).toHaveBeenCalledOnce();
  });

  it("calls startManagedRuntime with forceDownload when forceRedownload is true", async () => {
    mockVerify.mockReturnValue(
      Effect.succeed({ exists: true, sha256: "abc", expectedSha256: null, valid: true }),
    );

    const lifecycle = makeMockLifecycle();

    await Effect.runPromise(
      repairManagedSidecar({
        sidecarSnapshot: IDLE_SNAPSHOT,
        lifecycle,
        forceRedownload: true,
      }).pipe(Effect.provide(NodeServices.layer)),
    );

    expect(lifecycle.startManagedRuntime).toHaveBeenCalledWith({ forceDownload: true });
  });

  it("returns error result when startManagedRuntime fails", async () => {
    mockVerify.mockReturnValue(
      Effect.succeed({ exists: false, sha256: null, expectedSha256: null, valid: false }),
    );

    const startError = new ManagedSidecarError({
      stage: "spawn",
      message: "Binary failed to start",
    });

    const lifecycle = makeMockLifecycle({ startError: startError });

    const result = await Effect.runPromise(
      repairManagedSidecar({ sidecarSnapshot: IDLE_SNAPSHOT, lifecycle }).pipe(
        Effect.provide(NodeServices.layer),
      ),
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Binary failed to start");
  });
});

describe("exportManagedSidecarDiagnostics", () => {
  it("returns full diagnostics bundle with correct shape", async () => {
    mockVerify.mockReturnValueOnce(
      Effect.succeed({ exists: true, sha256: "abc", expectedSha256: null, valid: true }),
    );

    const result = await Effect.runPromise(
      exportManagedSidecarDiagnostics({ sidecarSnapshot: READY_SNAPSHOT }).pipe(
        Effect.provide(NodeServices.layer),
      ),
    );

    expect(result.generatedAt).toBeTruthy();
    expect(result.health).toBeDefined();
    expect(result.health.status).toBe("healthy");
    expect(result.platform).toBeDefined();
    expect(result.sidecarSnapshot).toBe(READY_SNAPSHOT);
  });

  it("populates platform info from process globals", async () => {
    mockVerify.mockReturnValueOnce(
      Effect.succeed({ exists: true, sha256: "abc", expectedSha256: null, valid: true }),
    );

    const result = await Effect.runPromise(
      exportManagedSidecarDiagnostics({ sidecarSnapshot: READY_SNAPSHOT }).pipe(
        Effect.provide(NodeServices.layer),
      ),
    );

    expect(result.platform.os).toBe(process.platform);
    expect(result.platform.arch).toBe(process.arch);
    expect(result.platform.nodeVersion).toBe(process.version);
  });
});
