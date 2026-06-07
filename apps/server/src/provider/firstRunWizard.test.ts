import { describe, expect, it } from "vitest";
import { Effect, Layer } from "effect";
import * as NodeServices from "@effect/platform-node/NodeServices";

import { ServerSettingsService } from "../serverSettings.ts";

import {
  detectFirstRunState,
  getFirstRunWizardData,
  completeFirstRunWizard,
  skipFirstRunWizard,
} from "./firstRunWizard.ts";

const TestLayers = Layer.merge(ServerSettingsService.layerTest(), NodeServices.layer);

const run = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayers)));

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
    expect(["scanning", "select-provider", "configure"]).toContain(data.currentStep);
  });
});
