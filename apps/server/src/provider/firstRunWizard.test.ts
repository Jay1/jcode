import { describe, expect, it, vi } from "vitest";
import { Effect, FileSystem, Layer, Path, Scope } from "effect";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import type { ManagedSidecarSnapshot, ProviderScanAllResult } from "@jcode/contracts";

import { ServerSettingsService } from "../serverSettings.ts";

import {
  detectFirstRunState,
  getFirstRunWizardData,
  completeFirstRunWizard,
  skipFirstRunWizard,
} from "./firstRunWizard.ts";
import { resolveManagedRuntimeDir } from "./managedRuntimeDownload.ts";
import type { ManagedSidecarLifecycleShape } from "./managedRuntimeLifecycle.ts";

const TestLayers = Layer.merge(
  Layer.merge(ServerSettingsService.layerTest(), NodeServices.layer),
  FetchHttpClient.layer,
);

type TestEnvironment =
  | ServerSettingsService
  | FileSystem.FileSystem
  | Path.Path
  | Scope.Scope
  | HttpClient.HttpClient;

const run = <A, E>(effect: Effect.Effect<A, E, TestEnvironment>) =>
  Effect.runPromise(effect.pipe(Effect.scoped, Effect.provide(TestLayers)));

const READY_MANAGED_SNAPSHOT: ManagedSidecarSnapshot = Object.freeze({
  state: "ready",
  binaryPath: "/managed/opencode",
  serverUrl: "http://127.0.0.1:9999",
  serverPassword: "secret",
});

function makeMockLifecycle(snapshot: ManagedSidecarSnapshot = READY_MANAGED_SNAPSHOT) {
  return {
    startManagedRuntime: vi.fn<ManagedSidecarLifecycleShape["startManagedRuntime"]>(() =>
      Effect.succeed(snapshot),
    ),
    stopManagedRuntime: vi.fn<ManagedSidecarLifecycleShape["stopManagedRuntime"]>(() =>
      Effect.succeed({ state: "idle" }),
    ),
    restartManagedRuntime: vi.fn<ManagedSidecarLifecycleShape["restartManagedRuntime"]>(() =>
      Effect.succeed(snapshot),
    ),
    getManagedRuntimeStatus: vi.fn<ManagedSidecarLifecycleShape["getManagedRuntimeStatus"]>(() =>
      Effect.succeed(snapshot),
    ),
  } satisfies ManagedSidecarLifecycleShape;
}

const scanResultsWithOpenCode = (input: {
  readonly hasCredentials: boolean;
  readonly hasBinary: boolean;
  readonly binaryPath?: string;
}): ProviderScanAllResult => ({
  scannedAt: "2026-06-07T00:00:00.000Z",
  providers: [
    {
      provider: "opencode",
      status:
        input.hasCredentials && input.hasBinary
          ? "ready"
          : input.hasBinary
            ? "needs-config"
            : "not-installed",
      hasCredentials: input.hasCredentials,
      credentials: [],
      hasBinary: input.hasBinary,
      ...(input.binaryPath ? { binaryPath: input.binaryPath } : {}),
    },
  ],
});

describe("detectFirstRunState", () => {
  it("returns default incomplete state for a fresh install", async () => {
    const state = await run(detectFirstRunState());
    expect(state.completed).toBe(false);
    expect(state.selectedProvider).toBeUndefined();
    expect(state.completedAt).toBeUndefined();
  });
});

describe("completeFirstRunWizard", () => {
  it("marks first-run as completed with a selected provider", async () => {
    const state = await run(completeFirstRunWizard({ provider: "codex" }));
    expect(state.completed).toBe(true);
    expect(state.selectedProvider).toBe("codex");
    expect(state.completedAt).toBeDefined();
  });

  it("marks first-run as completed without a provider (skip selection)", async () => {
    const state = await run(completeFirstRunWizard({}));
    expect(state.completed).toBe(true);
    expect(state.selectedProvider).toBeUndefined();
    expect(state.completedAt).toBeDefined();
  });

  it("starts the managed sidecar and persists a passwordless profile for clean OpenCode first-run completion", async () => {
    const lifecycle = makeMockLifecycle();

    const { runtimeDir, settings } = await run(
      Effect.gen(function* () {
        const runtimeDir = yield* resolveManagedRuntimeDir;
        yield* completeFirstRunWizard(
          { provider: "opencode" },
          {
            managedSidecarLifecycle: lifecycle,
            scanResults: scanResultsWithOpenCode({ hasCredentials: false, hasBinary: false }),
          },
        );
        const serverSettings = yield* ServerSettingsService;
        const settings = yield* serverSettings.getSettings;
        return { runtimeDir, settings };
      }),
    );

    const profile = settings.providers.opencode.runtimeProfiles[0];
    expect(lifecycle.startManagedRuntime).toHaveBeenCalledOnce();
    expect(lifecycle.startManagedRuntime).toHaveBeenCalledWith({ forceDownload: true });
    expect(settings.firstRun.completed).toBe(true);
    expect(settings.firstRun.selectedProvider).toBe("opencode");
    expect(settings.providers.opencode.activeRuntimeProfileId).toBe("managed-opencode-sidecar");
    expect(settings.providers.opencode.runtimeProfiles).toHaveLength(1);
    expect(profile?.mode).toBe("managed");
    expect(profile?.configMode).toBe("generated");
    expect(profile?.binaryPath).toBe(READY_MANAGED_SNAPSHOT.binaryPath);
    expect(profile?.serverUrl).toBe(READY_MANAGED_SNAPSHOT.serverUrl);
    expect(profile?.opencodeConfigDir).toBe(`${runtimeDir}/config`);
    expect(profile?.opencodeDataDir).toBe(`${runtimeDir}/data`);
    expect(JSON.stringify(profile)).not.toContain(READY_MANAGED_SNAPSHOT.serverPassword);
    expect(JSON.stringify(profile)).not.toContain("serverPassword");
    expect(JSON.stringify(settings)).not.toContain(READY_MANAGED_SNAPSHOT.serverPassword);
    expect(settings.providers.opencode.serverPassword).not.toBe(
      READY_MANAGED_SNAPSHOT.serverPassword,
    );
  });

  it("persists an external OpenCode runtime profile when first-run finds existing config", async () => {
    const lifecycle = makeMockLifecycle();

    const settings = await run(
      Effect.gen(function* () {
        yield* completeFirstRunWizard(
          { provider: "opencode" },
          {
            managedSidecarLifecycle: lifecycle,
            scanResults: scanResultsWithOpenCode({
              hasCredentials: true,
              hasBinary: true,
              binaryPath: "/usr/local/bin/opencode",
            }),
          },
        );
        const serverSettings = yield* ServerSettingsService;
        return yield* serverSettings.getSettings;
      }),
    );

    expect(lifecycle.startManagedRuntime).not.toHaveBeenCalled();
    expect(settings.providers.opencode.activeRuntimeProfileId).toBe("external-opencode-existing");
    expect(settings.providers.opencode.runtimeProfiles).toHaveLength(1);
    expect(settings.providers.opencode.runtimeProfiles[0]?.mode).toBe("external");
    expect(settings.providers.opencode.runtimeProfiles[0]?.configMode).toBe("inherit");
    expect(settings.providers.opencode.runtimeProfiles[0]?.binaryPath).toBe(
      "/usr/local/bin/opencode",
    );
  });

  it("does not create an OpenCode runtime profile for other providers", async () => {
    const settings = await run(
      Effect.gen(function* () {
        yield* completeFirstRunWizard({ provider: "codex" });
        const serverSettings = yield* ServerSettingsService;
        return yield* serverSettings.getSettings;
      }),
    );

    expect(settings.firstRun.selectedProvider).toBe("codex");
    expect(settings.providers.opencode.activeRuntimeProfileId).toBe("");
    expect(settings.providers.opencode.runtimeProfiles).toHaveLength(0);
  });
});

describe("skipFirstRunWizard", () => {
  it("marks first-run as skipped", async () => {
    const state = await run(skipFirstRunWizard());
    expect(state.completed).toBe(true);
    expect(state.skipped).toBe(true);
    expect(state.completedAt).toBeDefined();
  });
});

describe("getFirstRunWizardData", () => {
  it("returns wizard data with scan results for fresh install", async () => {
    const data = await run(getFirstRunWizardData());
    expect(data.state.completed).toBe(false);
    expect(Array.isArray(data.scanResults.providers)).toBe(true);
    expect(data.scanResults.scannedAt).toBeTruthy();
    expect(data.currentStep).toBe("select-provider");
  });
});
