// FILE: managedRuntimeLifecycle.ts
// Purpose: Contract schemas for the managed OpenCode sidecar lifecycle service.
// Layer: packages/contracts — shared types across server, web, and desktop.
// Depends on: effect (Schema)

/**
 * Managed sidecar lifecycle contract schemas.
 *
 * Defines the state machine, snapshot, and request types for the managed
 * OpenCode binary lifecycle: detect → download → spawn → health → stop.
 *
 * @module managedRuntimeLifecycle
 */

import { Schema } from "effect";

// ---------------------------------------------------------------------------
// Sidecar state machine
// ---------------------------------------------------------------------------

export const ManagedSidecarState = Schema.Literals([
  "idle",
  "downloading",
  "starting",
  "ready",
  "stopping",
  "error",
]);
export type ManagedSidecarState = typeof ManagedSidecarState.Type;

// ---------------------------------------------------------------------------
// Snapshot — current sidecar status
// ---------------------------------------------------------------------------

export const ManagedSidecarSnapshot = Schema.Struct({
  state: ManagedSidecarState,
  binaryPath: Schema.optional(Schema.String),
  serverUrl: Schema.optional(Schema.String),
  serverPassword: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
});
export type ManagedSidecarSnapshot = typeof ManagedSidecarSnapshot.Type;

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

export const ManagedSidecarStartRequest = Schema.Struct({
  forceDownload: Schema.optional(Schema.Boolean),
});
export type ManagedSidecarStartRequest = typeof ManagedSidecarStartRequest.Type;

export const ManagedSidecarStopRequest = Schema.Struct({});
export type ManagedSidecarStopRequest = typeof ManagedSidecarStopRequest.Type;
