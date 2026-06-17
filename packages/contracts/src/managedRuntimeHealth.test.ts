import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import { ManagedSidecarDiagnostics } from "./managedRuntimeHealth";

const BASE_DIAGNOSTICS = {
  generatedAt: "2026-06-11T20:00:00.000Z",
  health: {
    status: "healthy",
    sidecarState: "ready",
    binaryExists: true,
    binaryValid: true,
    serverReachable: true,
    checkedAt: "2026-06-11T20:00:00.000Z",
  },
  platform: {
    os: "linux",
    arch: "x64",
    nodeVersion: "v26.2.0",
  },
  binaryVersion: "unknown",
  logs: [] as string[],
  sidecarSnapshot: {
    state: "ready",
    serverUrl: "http://127.0.0.1:9876",
  },
};

describe("ManagedSidecarDiagnostics", () => {
  it("rejects diagnostics snapshots that contain serverPassword", () => {
    expect(() =>
      Schema.decodeUnknownSync(ManagedSidecarDiagnostics)({
        ...BASE_DIAGNOSTICS,
        sidecarSnapshot: {
          ...BASE_DIAGNOSTICS.sidecarSnapshot,
          serverPassword: "secret-password",
        },
      }),
    ).toThrow();
  });

  it("requires logs and binaryVersion fields", () => {
    const { binaryVersion: _binaryVersion, logs: _logs, ...missingFields } = BASE_DIAGNOSTICS;

    expect(() => Schema.decodeUnknownSync(ManagedSidecarDiagnostics)(missingFields)).toThrow();
  });
});
