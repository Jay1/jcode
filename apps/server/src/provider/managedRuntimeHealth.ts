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
import { HttpClient } from "effect/unstable/http";

import { verifyManagedRuntimeBinary } from "./managedRuntimeDownload.ts";
import { buildManagedSidecarDiagnosticsReport } from "./managedRuntimeDiagnosticsReport.ts";
import {
  defaultManagedSidecarBinaryVersionProbe,
  defaultManagedSidecarServerProbe,
} from "./managedRuntimeHealthProbes.ts";
import type { ManagedSidecarLifecycleShape } from "./managedRuntimeLifecycle.ts";
import { ManagedSidecarError } from "./managedRuntimeLifecycle.ts";

const isoNow = (): string => new Date().toISOString();

export const MANAGED_SIDECAR_DIAGNOSTIC_LOG_LIMIT = 10;

export type ManagedSidecarServerProbe = (
  serverUrl: string,
  serverPassword?: string,
) => Effect.Effect<boolean, never, never>;

export type ManagedSidecarBinaryVersionProbe = (
  binaryPath: string,
) => Effect.Effect<string, never, never>;

export type ManagedSidecarLogCollector = (input: {
  sidecarSnapshot: ManagedSidecarSnapshot;
  health: ManagedSidecarHealthCheck;
}) => Effect.Effect<ReadonlyArray<string>, never, never>;

export const checkBinaryExists = (binaryPath: string | undefined): boolean =>
  binaryPath != null && binaryPath.length > 0 && existsSync(binaryPath);

const checkServerReachable = (
  serverUrl: string | undefined,
  serverPassword: string | undefined,
  serverProbe: ManagedSidecarServerProbe,
): Effect.Effect<boolean, never, never> =>
  serverUrl != null && serverUrl.length > 0
    ? serverProbe(serverUrl, serverPassword)
    : Effect.succeed(false);

const redactionSecretsForSnapshot = (snapshot: ManagedSidecarSnapshot): ReadonlyArray<string> =>
  snapshot.serverPassword && snapshot.serverPassword.length > 0 ? [snapshot.serverPassword] : [];

const redactSensitiveText = (value: string, secrets: ReadonlyArray<string>): string =>
  secrets.reduce((redacted, secret) => redacted.split(secret).join("[redacted]"), value);

const redactSidecarSnapshot = (snapshot: ManagedSidecarSnapshot): ManagedSidecarSnapshot => {
  const secrets = redactionSecretsForSnapshot(snapshot);
  const { serverPassword: _serverPassword, ...redacted } = snapshot;
  return {
    ...redacted,
    ...(redacted.error ? { error: redactSensitiveText(redacted.error, secrets) } : {}),
  };
};

const redactHealthCheck = (
  health: ManagedSidecarHealthCheck,
  secrets: ReadonlyArray<string>,
): ManagedSidecarHealthCheck => ({
  ...health,
  ...(health.error ? { error: redactSensitiveText(health.error, secrets) } : {}),
});

const collectBinaryVersion = (input: {
  sidecarSnapshot: ManagedSidecarSnapshot;
  binaryVersionProbe?: ManagedSidecarBinaryVersionProbe;
}): Effect.Effect<string, never, never> => {
  const binaryPath = input.sidecarSnapshot.binaryPath;
  if (binaryPath == null || binaryPath.length === 0) {
    return Effect.succeed("unavailable");
  }

  return (input.binaryVersionProbe ?? defaultManagedSidecarBinaryVersionProbe)(binaryPath);
};

const defaultLogCollector: ManagedSidecarLogCollector = ({ sidecarSnapshot, health }) => {
  const lines = [
    `sidecarState=${sidecarSnapshot.state}`,
    `healthStatus=${health.status}`,
    `binaryExists=${health.binaryExists}`,
    `binaryValid=${health.binaryValid}`,
    `serverReachable=${health.serverReachable}`,
    ...(sidecarSnapshot.binaryPath ? [`binaryPath=${sidecarSnapshot.binaryPath}`] : []),
    ...(sidecarSnapshot.serverUrl ? [`serverUrl=${sidecarSnapshot.serverUrl}`] : []),
    ...(sidecarSnapshot.error ? [`error=${sidecarSnapshot.error}`] : []),
  ];

  return Effect.succeed(lines);
};

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
  serverProbe?: ManagedSidecarServerProbe;
}): Effect.Effect<ManagedSidecarHealthCheck, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const snapshot = input.sidecarSnapshot;
    const binaryExists = checkBinaryExists(snapshot.binaryPath);
    const serverReachable = yield* checkServerReachable(
      snapshot.serverUrl,
      snapshot.serverPassword,
      input.serverProbe ?? defaultManagedSidecarServerProbe,
    );

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
  lifecycle: ManagedSidecarLifecycleShape;
  forceRedownload?: boolean;
  serverProbe?: ManagedSidecarServerProbe;
}): Effect.Effect<
  ManagedSidecarRepairResult,
  ManagedSidecarError,
  FileSystem.FileSystem | Path.Path | Scope.Scope | HttpClient.HttpClient
> => {
  const { lifecycle } = input;

  return Effect.gen(function* () {
    yield* lifecycle
      .stopManagedRuntime()
      .pipe(Effect.catchTag("ManagedSidecarError", () => Effect.void));

    const startResult = yield* lifecycle
      .startManagedRuntime({
        forceDownload: input.forceRedownload ?? false,
      })
      .pipe(
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

    const health = yield* checkManagedSidecarHealth({
      sidecarSnapshot: startResult,
      ...(input.serverProbe ? { serverProbe: input.serverProbe } : {}),
    });

    return {
      success: health.status === "healthy",
      health,
    } satisfies ManagedSidecarRepairResult;
  }).pipe(
    Effect.catchTag("ManagedSidecarError", (err) =>
      Effect.gen(function* () {
        const latestSnapshot = yield* lifecycle.getManagedRuntimeStatus();
        const health = yield* checkManagedSidecarHealth({
          sidecarSnapshot: latestSnapshot,
          ...(input.serverProbe ? { serverProbe: input.serverProbe } : {}),
        });
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
  serverProbe?: ManagedSidecarServerProbe;
  binaryVersionProbe?: ManagedSidecarBinaryVersionProbe;
  logCollector?: ManagedSidecarLogCollector;
}): Effect.Effect<ManagedSidecarDiagnostics, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const health = yield* checkManagedSidecarHealth(input);
    const binaryVersion = yield* collectBinaryVersion(input);
    const secrets = redactionSecretsForSnapshot(input.sidecarSnapshot);
    const logs = yield* (input.logCollector ?? defaultLogCollector)({
      sidecarSnapshot: input.sidecarSnapshot,
      health,
    });
    const redactedHealth = redactHealthCheck(health, secrets);
    const redactedLogs = logs.map((line) => redactSensitiveText(line, secrets));
    const generatedAt = isoNow();
    const platform = {
      os: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    };

    return {
      generatedAt,
      health: redactedHealth,
      platform,
      binaryVersion,
      logs: redactedLogs.slice(0, MANAGED_SIDECAR_DIAGNOSTIC_LOG_LIMIT),
      report: buildManagedSidecarDiagnosticsReport({
        generatedAt,
        health: redactedHealth,
        platform,
        binaryVersion,
      }),
      sidecarSnapshot: redactSidecarSnapshot(input.sidecarSnapshot),
    } satisfies ManagedSidecarDiagnostics;
  });
