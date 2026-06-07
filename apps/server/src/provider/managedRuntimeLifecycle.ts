// FILE: managedRuntimeLifecycle.ts
// Purpose: Managed OpenCode sidecar lifecycle service — detect, download, spawn, health, stop.
// Layer: apps/server — provider runtime orchestration.
// Depends on: managedRuntimeDownload, opencodeRuntime, @jcode/contracts, effect

import type { ManagedSidecarSnapshot, ManagedSidecarStartRequest } from "@jcode/contracts";
import { Data, Effect, Layer, Path, Ref, Scope, ServiceMap } from "effect";
import * as Crypto from "node:crypto";

import {
  downloadManagedRuntime,
  resolveManagedRuntimeDir,
  verifyManagedRuntimeBinary,
} from "./managedRuntimeDownload.ts";
import {
  OpenCodeRuntime,
  OpenCodeRuntimeLive,
  OPENCODE_CLI_SPEC,
  type OpenCodeServerProcess,
} from "./opencodeRuntime.ts";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class ManagedSidecarError extends Data.TaggedError("ManagedSidecarError")<{
  readonly stage: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

// ---------------------------------------------------------------------------
// Password generation
// ---------------------------------------------------------------------------

export const generateSidecarPassword = (): string => Crypto.randomBytes(24).toString("base64url");

// ---------------------------------------------------------------------------
// Idle snapshot
// ---------------------------------------------------------------------------

const IDLE_SNAPSHOT: ManagedSidecarSnapshot = Object.freeze({
  state: "idle",
});

// ---------------------------------------------------------------------------
// Lifecycle service interface
// ---------------------------------------------------------------------------

export interface ManagedSidecarLifecycleShape {
  readonly startManagedRuntime: (
    request?: ManagedSidecarStartRequest,
  ) => Effect.Effect<ManagedSidecarSnapshot, ManagedSidecarError, Scope.Scope>;

  readonly stopManagedRuntime: () => Effect.Effect<ManagedSidecarSnapshot, ManagedSidecarError>;

  readonly restartManagedRuntime: () => Effect.Effect<
    ManagedSidecarSnapshot,
    ManagedSidecarError,
    Scope.Scope
  >;

  readonly getManagedRuntimeStatus: () => Effect.Effect<ManagedSidecarSnapshot>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export const makeManagedSidecarLifecycle = Effect.gen(function* () {
  const stateRef = yield* Ref.make<ManagedSidecarSnapshot>(IDLE_SNAPSHOT);
  const runtime = yield* OpenCodeRuntime;

  const updateState = (patch: Partial<ManagedSidecarSnapshot>) =>
    Ref.update(stateRef, (prev) => ({ ...prev, ...patch }));

  const getSnapshot = () => Ref.get(stateRef);

  // -----------------------------------------------------------------------
  // startManagedRuntime
  // -----------------------------------------------------------------------

  const startManagedRuntime = (request?: ManagedSidecarStartRequest) =>
    Effect.gen(function* () {
      const forceDownload = request?.forceDownload ?? false;

      yield* updateState({ state: "downloading" });

      const validation = yield* verifyManagedRuntimeBinary().pipe(
        Effect.catchTag("PlatformError", (err) =>
          Effect.fail(
            new ManagedSidecarError({
              stage: "verify",
              message: `Failed to verify managed runtime binary: ${String(err)}`,
              cause: err,
            }),
          ),
        ),
      );

      let binaryPath: string;

      if (!validation.exists || !validation.valid || forceDownload) {
        const downloadResult = yield* downloadManagedRuntime.pipe(
          Effect.mapError(
            (err) =>
              new ManagedSidecarError({
                stage: "download",
                message: `Failed to download managed runtime: ${err.message}`,
                cause: err,
              }),
          ),
        );
        binaryPath = downloadResult.binaryPath;
      } else {
        const runtimeDir = yield* resolveManagedRuntimeDir.pipe(
          Effect.mapError(
            (err) =>
              new ManagedSidecarError({
                stage: "resolve-dir",
                message: `Failed to resolve runtime directory: ${String(err)}`,
                cause: err,
              }),
          ),
        );
        const path = yield* Path.Path;
        const binaryName = process.platform === "win32" ? "opencode.exe" : "opencode";
        binaryPath = path.join(runtimeDir, binaryName);
      }

      yield* updateState({ state: "starting", binaryPath });

      const password = generateSidecarPassword();

      const server: OpenCodeServerProcess = yield* runtime
        .startOpenCodeServerProcess({
          binaryPath,
          cliSpec: OPENCODE_CLI_SPEC,
          configMode: "generated",
        })
        .pipe(
          Effect.mapError(
            (err) =>
              new ManagedSidecarError({
                stage: "spawn",
                message: `Failed to start managed sidecar: ${err.detail}`,
                cause: err,
              }),
          ),
        );

      const snapshot: ManagedSidecarSnapshot = {
        state: "ready",
        binaryPath,
        serverUrl: server.url,
        serverPassword: password,
      };

      yield* Ref.set(stateRef, snapshot);

      return snapshot;
    }).pipe(
      Effect.catchTag("ManagedSidecarError", (err) =>
        Effect.gen(function* () {
          yield* Ref.set(stateRef, {
            state: "error",
            error: err.message,
          });
          return yield* Effect.fail(err);
        }),
      ),
    );

  // -----------------------------------------------------------------------
  // stopManagedRuntime
  // -----------------------------------------------------------------------

  const stopManagedRuntime = (): Effect.Effect<ManagedSidecarSnapshot, ManagedSidecarError> =>
    Effect.gen(function* () {
      const current = yield* getSnapshot();

      if (current.state === "idle") {
        return current;
      }

      yield* updateState({ state: "stopping" });

      yield* Ref.set(stateRef, IDLE_SNAPSHOT);

      return IDLE_SNAPSHOT;
    });

  // -----------------------------------------------------------------------
  // restartManagedRuntime
  // -----------------------------------------------------------------------

  const restartManagedRuntime = () =>
    Effect.gen(function* () {
      yield* stopManagedRuntime();
      return yield* startManagedRuntime();
    });

  // -----------------------------------------------------------------------
  // getManagedRuntimeStatus
  // -----------------------------------------------------------------------

  const getManagedRuntimeStatus = () => getSnapshot();

  return {
    startManagedRuntime,
    stopManagedRuntime,
    restartManagedRuntime,
    getManagedRuntimeStatus,
  };
});

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

export class ManagedSidecarLifecycle extends ServiceMap.Service<
  ManagedSidecarLifecycle,
  ManagedSidecarLifecycleShape
>()("jcode/provider/managedSidecarLifecycle") {}

export const ManagedSidecarLifecycleLive = Layer.effect(
  ManagedSidecarLifecycle,
  makeManagedSidecarLifecycle,
).pipe(Layer.provide(OpenCodeRuntimeLive));
