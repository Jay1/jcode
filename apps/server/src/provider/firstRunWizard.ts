import type {
  CompleteFirstRunWizardInput,
  FirstRunState,
  FirstRunWizardData,
  FirstRunWizardStep,
} from "@jcode/contracts";
import { DEFAULT_FIRST_RUN_STATE } from "@jcode/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { ServerSettingsService } from "../serverSettings.ts";
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

export const detectFirstRunState = (): Effect.Effect<FirstRunState, never, ServerSettingsService> =>
  Effect.gen(function* () {
    const settings = yield* ServerSettingsService;
    const serverSettings = yield* settings.getSettings;
    return serverSettings.firstRun ?? DEFAULT_FIRST_RUN_STATE;
  });

export const getFirstRunWizardData = (): Effect.Effect<
  FirstRunWizardData,
  never,
  ServerSettingsService
> =>
  Effect.gen(function* () {
    const [state, scanResults] = yield* Effect.all([detectFirstRunState(), scanAllProviders()], {
      concurrency: "unbounded",
    });
    const currentStep = state.completed || state.skipped ? resolveCurrentStep(state) : "scanning";
    return { state, scanResults, currentStep };
  });

export const completeFirstRunWizard = (
  input: CompleteFirstRunWizardInput,
): Effect.Effect<FirstRunState, never, ServerSettingsService> =>
  Effect.gen(function* () {
    const settings = yield* ServerSettingsService;
    const now = yield* DateTime.now;
    const next: FirstRunState = {
      completed: true,
      completedAt: DateTime.formatIso(now),
      ...(input.provider ? { selectedProvider: input.provider } : {}),
    };
    yield* settings.updateSettings({ firstRun: next });
    return next;
  });

export const skipFirstRunWizard = (): Effect.Effect<FirstRunState, never, ServerSettingsService> =>
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
