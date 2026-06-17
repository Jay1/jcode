// FILE: managedRuntimeHealth.ts
// Purpose: Contract schemas for managed sidecar health check, repair, and diagnostics.
// Layer: packages/contracts — shared types across server, web, and desktop.
// Depends on: effect (Schema), ./managedRuntimeLifecycle, ./baseSchemas

/**
 * Managed sidecar health, repair, and diagnostics contract schemas.
 *
 * Extends the lifecycle contracts with runtime health assessment, repair
 * operations (re-download + restart), and structured diagnostics export.
 *
 * @module managedRuntimeHealth
 */

import { Schema } from "effect";

import { IsoDateTime, NonNegativeInt } from "./baseSchemas";
import { ManagedSidecarState } from "./managedRuntimeLifecycle";

// ---------------------------------------------------------------------------
// Health status
// ---------------------------------------------------------------------------

export const ManagedSidecarHealthStatus = Schema.Literals([
  "healthy",
  "degraded",
  "unhealthy",
  "not_running",
  "repairing",
]);
export type ManagedSidecarHealthStatus = typeof ManagedSidecarHealthStatus.Type;

// ---------------------------------------------------------------------------
// Health check result
// ---------------------------------------------------------------------------

export const ManagedSidecarHealthCheck = Schema.Struct({
  status: ManagedSidecarHealthStatus,
  sidecarState: ManagedSidecarState,
  binaryPath: Schema.optional(Schema.String),
  binaryExists: Schema.Boolean,
  binaryValid: Schema.Boolean,
  serverUrl: Schema.optional(Schema.String),
  serverReachable: Schema.Boolean,
  uptimeSeconds: Schema.optional(NonNegativeInt),
  error: Schema.optional(Schema.String),
  checkedAt: IsoDateTime,
});
export type ManagedSidecarHealthCheck = typeof ManagedSidecarHealthCheck.Type;

// ---------------------------------------------------------------------------
// Repair
// ---------------------------------------------------------------------------

export const ManagedSidecarRepairRequest = Schema.Struct({
  forceRedownload: Schema.Boolean.pipe(Schema.withDecodingDefault(() => false)),
});
export type ManagedSidecarRepairRequest = typeof ManagedSidecarRepairRequest.Type;

export const ManagedSidecarRepairResult = Schema.Struct({
  success: Schema.Boolean,
  health: ManagedSidecarHealthCheck,
  error: Schema.optional(Schema.String),
});
export type ManagedSidecarRepairResult = typeof ManagedSidecarRepairResult.Type;

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export const ManagedSidecarDiagnosticsSnapshot = Schema.Struct({
  state: ManagedSidecarState,
  binaryPath: Schema.optional(Schema.String),
  serverUrl: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
}).annotate({ parseOptions: { onExcessProperty: "error" } });
export type ManagedSidecarDiagnosticsSnapshot = typeof ManagedSidecarDiagnosticsSnapshot.Type;

export const ManagedSidecarDiagnostics = Schema.Struct({
  generatedAt: IsoDateTime,
  health: ManagedSidecarHealthCheck,
  platform: Schema.Struct({
    os: Schema.String,
    arch: Schema.String,
    nodeVersion: Schema.String,
  }),
  binaryVersion: Schema.String,
  logs: Schema.Array(Schema.String),
  sidecarSnapshot: ManagedSidecarDiagnosticsSnapshot,
});
export type ManagedSidecarDiagnostics = typeof ManagedSidecarDiagnostics.Type;
