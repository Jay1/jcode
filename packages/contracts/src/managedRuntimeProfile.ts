// FILE: managedRuntimeProfile.ts
// Purpose: Contract schemas for managed runtime profile auto-creation.
// Layer: packages/contracts — shared types across server, web, and desktop.
// Depends on: effect (Schema), ./managedRuntimeLifecycle, ./baseSchemas

/**
 * Managed runtime profile auto-creation contract schemas.
 *
 * When the managed sidecar starts successfully, the server auto-creates an
 * `OpenCodeRuntimeProfile` so that future sessions can reconnect without
 * re-discovery.  This module defines the request/result shapes for that flow.
 *
 * @module managedRuntimeProfile
 */

import { Schema } from "effect";

import { TrimmedNonEmptyString } from "./baseSchemas";
import { ManagedSidecarSnapshot } from "./managedRuntimeLifecycle";
import { OpenCodeRuntimeProfile } from "./providerDiscovery";

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export const ManagedRuntimeProfileAutoCreateRequest = Schema.Struct({
  sidecarSnapshot: ManagedSidecarSnapshot,
  existingConfigDetected: Schema.Boolean,
  profileId: Schema.optional(TrimmedNonEmptyString),
});
export type ManagedRuntimeProfileAutoCreateRequest =
  typeof ManagedRuntimeProfileAutoCreateRequest.Type;

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export const ManagedRuntimeProfileAutoCreateResult = Schema.Struct({
  profile: OpenCodeRuntimeProfile,
  created: Schema.Boolean,
  activeProfileId: TrimmedNonEmptyString,
});
export type ManagedRuntimeProfileAutoCreateResult =
  typeof ManagedRuntimeProfileAutoCreateResult.Type;
