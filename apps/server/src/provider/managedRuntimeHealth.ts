import { existsSync } from "node:fs";

import type {
  ManagedSidecarDiagnostics,
  ManagedSidecarHealthCheck,
  ManagedSidecarHealthStatus,
  ManagedSidecarRepairResult,
  ManagedSidecarSnapshot,
} from "@jcode/contracts";
import { Effect, Scope } from "effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { verifyManagedRuntimeBinary } from "./managedRuntimeDownload.ts";
import type { ManagedSidecarLifecycleShape } from "./managedRuntimeLifecycle.ts";
import { ManagedSidecarError } from "./managedRuntimeLifecycle.ts";

const isoNow = (): string => new Date().toISOString();

export const checkBinaryExists = (binaryPath: string | undefined): boolean =>
  binaryPath != null && binaryPath.length > 0 && existsSync(binaryPath);

const checkServerReachable = (serverUrl: string | undefined): boolean =>
  serverUrl != null && serverUrl.length > 0;

export const deriveHealthStatus = (
  state: ManagedSidecarSnapshot["state"],
  binaryExists: boolean,
  binaryValid: boolean,
  serverReachable: boolean,
): ManagedSidecarHealthStatus => {
  if (state === "ready") {
    if (!binaryExists || !binaryValid) return "unhealthy";
    if (!serverReachable) return "degraded";
    return "healthy";
  }
  if (state === "error") return "unhealthy";
  if (state === "idle" || state === "stopping") return "not_running";
  return "degraded";
};

export const checkManagedSidecarHealth = (input: {
  sidecarSnapshot: ManagedSidecarSnapshot;
}): Effect.Effect<ManagedSidecarHealthCheck, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const snapshot = input.sidecarSnapshot;
    const binaryExists = checkBinaryExists(snapshot.binaryPath);
    const serverReachable = checkServerReachable(snapshot.serverUrl);

    const binaryValid =
      binaryExists && snapshot.binaryPath
        ? yield* verifyManagedRuntimeBinary(undefined, snapshot.binaryPath).pipe(
            Effect.map((verification) => verification.valid),
            Effect.catch(() => Effect.succeed(false)),
          )
        : false;

    const status = deriveHealthStatus(snapshot.state, binaryExists, binaryValid, serverReachable);

    return {
      status,
      sidecarState: snapshot.state,
      binaryExists,
      binaryValid,
      serverReachable,
      checkedAt: isoNow(),
      ...(snapshot.binaryPath ? { binaryPath: snapshot.binaryPath } : {}),
      ...(snapshot.serverUrl ? { serverUrl: snapshot.serverUrl } : {}),
      ...(snapshot.error ? { error: snapshot.error } : {}),
    } satisfies ManagedSidecarHealthCheck;
  });

export const repairManagedSidecar = (input: {
  sidecarSnapshot: ManagedSidecarSnapshot;
  lifecycle: ManagedSidecarLifecycleShape;
  forceRedownload?: boolean;
}): Effect.Effect<
  ManagedSidecarRepairResult,
  ManagedSidecarError,
  FileSystem.FileSystem | Path.Path | Scope.Scope
> => {
  const { lifecycle, forceRedownload = false } = input;

  return Effect.gen(function* () {
    yield* lifecycle
      .stopManagedRuntime()
      .pipe(Effect.catchTag("ManagedSidecarError", () => Effect.void));

    const startRequest = forceRedownload ? { forceDownload: true } : undefined;

    const startResult = yield* lifecycle.startManagedRuntime(startRequest).pipe(
      Effect.mapError((err) =>
        err instanceof ManagedSidecarError
          ? err
          : new ManagedSidecarError({
              stage: "repair",
              message: String(err),
              cause: err,
            }),
      ),
    );

    const health = yield* checkManagedSidecarHealth({ sidecarSnapshot: startResult });

    return {
      success: health.status === "healthy" || health.status === "degraded",
      health,
    } satisfies ManagedSidecarRepairResult;
  }).pipe(
    Effect.catchTag("ManagedSidecarError", (err) =>
      Effect.gen(function* () {
        const latestSnapshot = yield* lifecycle.getManagedRuntimeStatus();
        const health = yield* checkManagedSidecarHealth({ sidecarSnapshot: latestSnapshot });
        return {
          success: false,
          health,
          error: err.message,
        } satisfies ManagedSidecarRepairResult;
      }),
    ),
  );
};

export const exportManagedSidecarDiagnostics = (input: {
  sidecarSnapshot: ManagedSidecarSnapshot;
}): Effect.Effect<ManagedSidecarDiagnostics, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const health = yield* checkManagedSidecarHealth(input);

    return {
      generatedAt: isoNow(),
      health,
      platform: {
        os: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
      },
      sidecarSnapshot: input.sidecarSnapshot,
    } satisfies ManagedSidecarDiagnostics;
  });
