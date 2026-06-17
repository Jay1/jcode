import type {
  CompleteFirstRunWizardInput,
  FirstRunState,
  FirstRunWizardData,
  FirstRunWizardStep,
  ManagedSidecarSnapshot,
  ProviderScanAllResult,
  ProviderScanResult,
  ServerSettingsError,
} from "@jcode/contracts";
import { DEFAULT_FIRST_RUN_STATE } from "@jcode/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Scope from "effect/Scope";
import { HttpClient } from "effect/unstable/http";

import { ServerSettingsService } from "../serverSettings.ts";
import {
  applyAutoCreatedProfile,
  autoCreateManagedRuntimeProfile,
} from "./managedRuntimeProfile.ts";
import { resolveManagedRuntimeDir } from "./managedRuntimeDownload.ts";
import type {
  ManagedSidecarError,
  ManagedSidecarLifecycleShape,
} from "./managedRuntimeLifecycle.ts";
import { scanAllProviders } from "./providerCredentialScan.ts";

const resolveCurrentStep = (state: FirstRunState): FirstRunWizardStep => {
  if (state.skipped) {
    return "skipped";
  }
  if (state.completed) {
    return "complete";
  }
  return "select-provider";
};

interface CompleteFirstRunWizardOptions {
  readonly managedSidecarLifecycle?: ManagedSidecarLifecycleShape;
  readonly scanResults?: ProviderScanAllResult;
}

function findOpenCodeScanResult(
  scanResults: ProviderScanAllResult,
): ProviderScanResult | undefined {
  return scanResults.providers.find((provider) => provider.provider === "opencode");
}

function sidecarSnapshotFromScanResult(
  scanResult: ProviderScanResult | undefined,
): ManagedSidecarSnapshot {
  return {
    state: scanResult?.binaryPath ? "ready" : "idle",
    ...(scanResult?.binaryPath ? { binaryPath: scanResult.binaryPath } : {}),
  };
}

export const detectFirstRunState = (): Effect.Effect<
  FirstRunState,
  ServerSettingsError,
  ServerSettingsService
> =>
  Effect.gen(function* () {
    const settings = yield* ServerSettingsService;
    const serverSettings = yield* settings.getSettings;
    return serverSettings.firstRun ?? DEFAULT_FIRST_RUN_STATE;
  });

export const getFirstRunWizardData = (): Effect.Effect<
  FirstRunWizardData,
  ServerSettingsError,
  ServerSettingsService | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const [state, scanResults] = yield* Effect.all([detectFirstRunState(), scanAllProviders()], {
      concurrency: "unbounded",
    });
    const currentStep = resolveCurrentStep(state);
    return { state, scanResults, currentStep };
  });

export const completeFirstRunWizard = (
  input: CompleteFirstRunWizardInput,
  options: CompleteFirstRunWizardOptions = {},
): Effect.Effect<
  FirstRunState,
  ServerSettingsError | PlatformError.PlatformError | ManagedSidecarError,
  ServerSettingsService | FileSystem.FileSystem | Path.Path | Scope.Scope | HttpClient.HttpClient
> =>
  Effect.gen(function* () {
    const settings = yield* ServerSettingsService;
    const now = yield* DateTime.now;
    const next: FirstRunState = {
      completed: true,
      skipped: false,
      completedAt: DateTime.formatIso(now),
      ...(input.provider ? { selectedProvider: input.provider } : {}),
    };

    if (input.provider !== "opencode") {
      yield* settings.updateSettings({ firstRun: next });
      return next;
    }

    const currentSettings = yield* settings.getSettings;
    const scanResults = options.scanResults ?? (yield* scanAllProviders());
    const openCodeScan = findOpenCodeScanResult(scanResults);
    const managedRuntimeDir = yield* resolveManagedRuntimeDir;
    const existingConfigDetected = openCodeScan?.hasCredentials ?? false;
    const cleanManagedFirstRun =
      openCodeScan?.hasCredentials === false && openCodeScan.hasBinary === false;
    const sidecarSnapshot =
      cleanManagedFirstRun && options.managedSidecarLifecycle
        ? yield* options.managedSidecarLifecycle.startManagedRuntime({ forceDownload: true })
        : sidecarSnapshotFromScanResult(openCodeScan);
    const profileResult = autoCreateManagedRuntimeProfile({
      sidecarSnapshot,
      existingConfigDetected,
      managedRuntimeDir,
      settings: currentSettings,
    });

    yield* settings.updateSettings({
      ...applyAutoCreatedProfile(profileResult, currentSettings),
      firstRun: next,
    });
    return next;
  });

export const skipFirstRunWizard = (): Effect.Effect<
  FirstRunState,
  ServerSettingsError,
  ServerSettingsService
> =>
  Effect.gen(function* () {
    const settings = yield* ServerSettingsService;
    const now = yield* DateTime.now;
    const next: FirstRunState = {
      completed: true,
      skipped: true,
      completedAt: DateTime.formatIso(now),
    };
    yield* settings.updateSettings({ firstRun: next });
    return next;
  });
