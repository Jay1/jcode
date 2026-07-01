// FILE: firstRunWizard.ts
// Purpose: Contract schemas for the first-run wizard shared across web and server.
// Layer: packages/contracts — shared types across server, web, and desktop.
// Depends on: effect (Schema), baseSchemas, providerDiscovery, providerScan

// FILE: firstRunWizard.ts
// Purpose: First-run wizard contracts — provider-agnostic setup flow for new installs.
// Layer: Shared contracts
// Exports: First-run state schemas, wizard step literals, input types, and default state.

import { Schema } from "effect";
import { ProviderDiscoveryKind } from "./providerDiscovery";
import { ProviderScanAllResult } from "./providerScan";

const IsoTimestampString = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/),
);

// ---------------------------------------------------------------------------
// First-run state
// ---------------------------------------------------------------------------

export const FirstRunState = Schema.Struct({
  completed: Schema.Boolean,
  selectedProvider: Schema.optional(ProviderDiscoveryKind),
  completedAt: Schema.optional(IsoTimestampString),
  skipped: Schema.Boolean.pipe(Schema.withDecodingDefault(() => false)),
});
export type FirstRunState = typeof FirstRunState.Type;

// ---------------------------------------------------------------------------
// Wizard steps
// ---------------------------------------------------------------------------

export const FirstRunWizardStep = Schema.Literals([
  "scanning",
  "select-provider",
  "configure",
  "complete",
  "skipped",
]);
export type FirstRunWizardStep = typeof FirstRunWizardStep.Type;

// ---------------------------------------------------------------------------
// Wizard data bundle
// ---------------------------------------------------------------------------

export const FirstRunWizardData = Schema.Struct({
  state: FirstRunState,
  scanResults: ProviderScanAllResult,
  currentStep: FirstRunWizardStep,
});
export type FirstRunWizardData = typeof FirstRunWizardData.Type;

// ---------------------------------------------------------------------------
// RPC input types
// ---------------------------------------------------------------------------

export const CompleteFirstRunWizardInput = Schema.Struct({
  provider: Schema.optional(ProviderDiscoveryKind),
});
export type CompleteFirstRunWizardInput = typeof CompleteFirstRunWizardInput.Type;

export const SkipFirstRunWizardInput = Schema.Struct({});
export type SkipFirstRunWizardInput = typeof SkipFirstRunWizardInput.Type;

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

export const DEFAULT_FIRST_RUN_STATE: FirstRunState = {
  completed: false,
  skipped: false,
};
