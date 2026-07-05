// FILE: managedRuntimeLifecycle.ts
// Purpose: Managed OpenCode sidecar lifecycle service — detect, download, spawn, health, stop.
// Layer: apps/server — provider runtime orchestration.
// Depends on: managedRuntimeDownload, opencodeRuntime, @jcode/contracts, effect

import type { ManagedSidecarSnapshot, ManagedSidecarStartRequest } from "@jcode/contracts";
import { Data, Effect, Exit, FileSystem, Layer, Path, Ref, Scope, ServiceMap } from "effect";
import * as Semaphore from "effect/Semaphore";
import * as Crypto from "node:crypto";
import { HttpClient } from "effect/unstable/http";

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

const redactGeneratedSidecarPassword = (value: string, password: string): string =>
  value.split(password).join("[redacted]");

export function managedSidecarOpenCodeLaunchOptions(managedRuntimeDir: string): {
  readonly xdgConfigHome: string;
  readonly extraEnv: Readonly<Record<string, string>>;
} {
  const root = managedRuntimeDir.replace(/[\\/]+$/, "");
  return {
    xdgConfigHome: `${root}/config`,
    extraEnv: {
      XDG_DATA_HOME: `${root}/data`,
    },
  };
}

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
  const runningProcessScopeRef = yield* Ref.make<Scope.Scope | null>(null);
  const lifecycleMutex = yield* Semaphore.make(1);
  const fileSystem = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const httpClient = yield* HttpClient.HttpClient;
  const runtime = yield* OpenCodeRuntime;

  const omitReadyOnlyFieldsWhenNotReady = (
    snapshot: ManagedSidecarSnapshot,
  ): ManagedSidecarSnapshot => {
    if (snapshot.state === "ready") {
      return snapshot;
    }

    const {
      serverUrl: _serverUrl,
      serverPassword: _serverPassword,
      ...transientSnapshot
    } = snapshot;
    return transientSnapshot;
  };

  const provideManagedRuntimeServices = <A, E>(
    effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path | HttpClient.HttpClient>,
  ): Effect.Effect<A, E> =>
    effect.pipe(
      Effect.provideService(FileSystem.FileSystem, fileSystem),
      Effect.provideService(Path.Path, pathService),
      Effect.provideService(HttpClient.HttpClient, httpClient),
    );

  const updateState = (patch: Partial<ManagedSidecarSnapshot>) =>
    Ref.update(stateRef, (prev) => omitReadyOnlyFieldsWhenNotReady({ ...prev, ...patch }));

  const getSnapshot = () => Ref.get(stateRef);

  const closeRunningProcessScope = Effect.gen(function* () {
    const runningProcessScope = yield* Ref.get(runningProcessScopeRef);
    if (runningProcessScope === null) {
      return;
    }
    yield* Ref.set(runningProcessScopeRef, null);
    yield* Scope.close(runningProcessScope, Exit.void);
  });

  yield* Effect.addFinalizer(() => closeRunningProcessScope);

  // -----------------------------------------------------------------------
  // startManagedRuntime
  // -----------------------------------------------------------------------

  const startManagedRuntimeUnlocked = (request?: ManagedSidecarStartRequest) =>
    Effect.gen(function* () {
      const forceDownload = request?.forceDownload ?? false;

      yield* closeRunningProcessScope;
      yield* updateState({ state: "downloading" });

      const validation = yield* provideManagedRuntimeServices(verifyManagedRuntimeBinary()).pipe(
        Effect.mapError(
          (err) =>
            new ManagedSidecarError({
              stage: "verify",
              message: `Failed to verify managed runtime binary: ${String(err)}`,
              cause: err,
            }),
        ),
      );

      const path = pathService;
      let binaryPath: string;

      if (!validation.exists || !validation.valid || forceDownload) {
        const downloadResult = yield* provideManagedRuntimeServices(downloadManagedRuntime).pipe(
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
        const runtimeDir = yield* provideManagedRuntimeServices(resolveManagedRuntimeDir).pipe(
          Effect.mapError(
            (err) =>
              new ManagedSidecarError({
                stage: "resolve-dir",
                message: `Failed to resolve runtime directory: ${String(err)}`,
                cause: err,
              }),
          ),
        );
        const binaryName = process.platform === "win32" ? "opencode.exe" : "opencode";
        binaryPath = path.join(runtimeDir, binaryName);
      }

      yield* updateState({ state: "starting", binaryPath });

      const password = generateSidecarPassword();
      const processScope = yield* Scope.make();

      const server: OpenCodeServerProcess = yield* Scope.provide(
        runtime
          .startOpenCodeServerProcess({
            binaryPath,
            cliSpec: OPENCODE_CLI_SPEC,
            configMode: "generated",
            serverPassword: password,
            ...managedSidecarOpenCodeLaunchOptions(path.dirname(binaryPath)),
          })
          .pipe(
            Effect.mapError(
              (err) =>
                new ManagedSidecarError({
                  stage: "spawn",
                  message: `Failed to start managed sidecar: ${redactGeneratedSidecarPassword(err.detail, password)}`,
                  cause: err,
                }),
            ),
          ),
        processScope,
      ).pipe(
        Effect.catch((err) =>
          Effect.gen(function* () {
            yield* Scope.close(processScope, Exit.void);
            return yield* Effect.fail(err);
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
      yield* Ref.set(runningProcessScopeRef, processScope);

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

  const startManagedRuntime = (request?: ManagedSidecarStartRequest) =>
    lifecycleMutex.withPermits(1)(startManagedRuntimeUnlocked(request));

  // -----------------------------------------------------------------------
  // stopManagedRuntime
  // -----------------------------------------------------------------------

  const stopManagedRuntimeUnlocked = (): Effect.Effect<
    ManagedSidecarSnapshot,
    ManagedSidecarError
  > =>
    Effect.gen(function* () {
      const current = yield* getSnapshot();

      if (current.state === "idle") {
        return current;
      }

      yield* updateState({ state: "stopping" });
      yield* closeRunningProcessScope;

      yield* Ref.set(stateRef, IDLE_SNAPSHOT);

      return IDLE_SNAPSHOT;
    });

  const stopManagedRuntime = (): Effect.Effect<ManagedSidecarSnapshot, ManagedSidecarError> =>
    lifecycleMutex.withPermits(1)(stopManagedRuntimeUnlocked());

  // -----------------------------------------------------------------------
  // restartManagedRuntime
  // -----------------------------------------------------------------------

  const restartManagedRuntime = () =>
    lifecycleMutex.withPermits(1)(
      Effect.gen(function* () {
        yield* stopManagedRuntimeUnlocked();
        return yield* startManagedRuntimeUnlocked();
      }),
    );

  // -----------------------------------------------------------------------
  // getManagedRuntimeStatus
  // -----------------------------------------------------------------------

  const getManagedRuntimeStatus = () => getSnapshot();

  return {
    startManagedRuntime,
    stopManagedRuntime,
    restartManagedRuntime,
    getManagedRuntimeStatus,
  } satisfies ManagedSidecarLifecycleShape;
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
