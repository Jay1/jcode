// FILE: providerScan.ts
// Purpose: Defines credential-first provider scanning contracts shared across web and server.
// Layer: Shared contracts
// Exports: Provider scan schemas and inferred types used by the provider credential scanner.

import { Schema } from "effect";
import { ProviderDiscoveryKind } from "./providerDiscovery";

export const ProviderScanStatus = Schema.Literals([
  "ready", // has credentials + binary
  "needs-config", // has binary but no credentials
  "not-installed", // no binary found
]);
export type ProviderScanStatus = typeof ProviderScanStatus.Type;

export const ProviderCredentialSource = Schema.Literals(["env-var", "config-dir"]);
export type ProviderCredentialSource = typeof ProviderCredentialSource.Type;

export const ProviderCredentialInfo = Schema.Struct({
  source: ProviderCredentialSource,
  key: Schema.String, // e.g. "ANTHROPIC_API_KEY" or "~/.claude/config.json"
  found: Schema.Boolean,
});
export type ProviderCredentialInfo = typeof ProviderCredentialInfo.Type;

export const ProviderScanResult = Schema.Struct({
  provider: ProviderDiscoveryKind,
  status: ProviderScanStatus,
  hasCredentials: Schema.Boolean,
  credentials: Schema.Array(ProviderCredentialInfo),
  hasBinary: Schema.Boolean,
  binaryPath: Schema.optional(Schema.String),
  version: Schema.optional(Schema.String),
});
export type ProviderScanResult = typeof ProviderScanResult.Type;

export const ProviderScanAllResult = Schema.Struct({
  providers: Schema.Array(ProviderScanResult),
  scannedAt: Schema.String, // ISO 8601 timestamp
});
export type ProviderScanAllResult = typeof ProviderScanAllResult.Type;
