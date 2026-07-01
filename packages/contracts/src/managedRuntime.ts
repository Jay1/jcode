/**
 * Managed runtime contract schemas.
 *
 * Defines types for downloading, verifying, and tracking an OpenCode binary
 * managed by JCode in a platform-appropriate runtime directory.
 *
 * @module managedRuntime
 */

import { Schema } from "effect";

import { NonNegativeInt } from "./baseSchemas";

// ---------------------------------------------------------------------------
// Platform identifiers
// ---------------------------------------------------------------------------

export const ManagedRuntimePlatform = Schema.Literals([
  "win-x64",
  "linux-x64",
  "darwin-arm64",
  "darwin-x64",
]);
export type ManagedRuntimePlatform = typeof ManagedRuntimePlatform.Type;

// ---------------------------------------------------------------------------
// Download status
// ---------------------------------------------------------------------------

export const ManagedRuntimeDownloadStatus = Schema.Literals([
  "idle",
  "checking",
  "downloading",
  "verifying",
  "complete",
  "error",
]);
export type ManagedRuntimeDownloadStatus = typeof ManagedRuntimeDownloadStatus.Type;

// ---------------------------------------------------------------------------
// Download progress
// ---------------------------------------------------------------------------

export const ManagedRuntimeDownloadProgress = Schema.Struct({
  status: ManagedRuntimeDownloadStatus,
  bytesDownloaded: Schema.optional(NonNegativeInt),
  bytesTotal: Schema.optional(NonNegativeInt),
  error: Schema.optional(Schema.String),
  binaryPath: Schema.optional(Schema.String),
  version: Schema.optional(Schema.String),
});
export type ManagedRuntimeDownloadProgress = typeof ManagedRuntimeDownloadProgress.Type;

// ---------------------------------------------------------------------------
// GitHub release shapes
// ---------------------------------------------------------------------------

export const GitHubReleaseAsset = Schema.Struct({
  name: Schema.String,
  browserDownloadUrl: Schema.String,
  size: NonNegativeInt,
  digest: Schema.optional(Schema.String),
});
export type GitHubReleaseAsset = typeof GitHubReleaseAsset.Type;

export const GitHubRelease = Schema.Struct({
  tagName: Schema.String,
  name: Schema.optional(Schema.String),
  assets: Schema.Array(GitHubReleaseAsset),
});
export type GitHubRelease = typeof GitHubRelease.Type;
