import { describe, expect, it, vi } from "vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";

import { Data, Deferred, Effect, Fiber, FileSystem, Layer, Path, Ref, Exit, Scope } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";

import type { ManagedSidecarSnapshot, ManagedSidecarStartRequest } from "@jcode/contracts";

import {
  generateSidecarPassword,
  makeManagedSidecarLifecycle,
  managedSidecarOpenCodeLaunchOptions,
  ManagedSidecarError,
  type ManagedSidecarLifecycleShape,
} from "./managedRuntimeLifecycle.ts";
import { exportManagedSidecarDiagnostics } from "./managedRuntimeHealth.ts";

import { OpenCodeRuntime, type OpenCodeRuntimeShape } from "./opencodeRuntime.ts";

vi.mock("./managedRuntimeDownload.ts", () => ({
  downloadManagedRuntime: Effect.succeed({ binaryPath: "/tmp/jcode-test-runtime/opencode" }),
  resolveManagedRuntimeDir: Effect.succeed("/tmp/jcode-test-runtime"),
  verifyManagedRuntimeBinary: vi.fn(() =>
    Effect.succeed({ exists: true, sha256: "abc", expectedSha256: null, valid: true }),
  ),
}));

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const FAKE_BINARY_PATH = "/tmp/jcode-test-runtime/opencode";
const FAKE_SERVER_URL = "http://127.0.0.1:9999";
const ProductionTestLayer = Layer.merge(NodeServices.layer, FetchHttpClient.layer);

const makeMockRuntime = (overrides?: Partial<OpenCodeRuntimeShape>): OpenCodeRuntimeShape =>
  ({
    startOpenCodeServerProcess: vi.fn(() =>
      Effect.succeed({
        url: FAKE_SERVER_URL,
        exitCode: Effect.succeed(0),
      }),
    ),
    connectToOpenCodeServer: vi.fn(() => Effect.die(new Error("unused test runtime connection"))),
    runOpenCodeCommand: vi.fn(() => Effect.die(new Error("unused test runtime command"))),
    createOpenCodeSdkClient: vi.fn(() => {
      throw new Error("unused test runtime client");
    }),
    loadOpenCodeInventory: vi.fn(() => Effect.die(new Error("unused test runtime inventory"))),
    listOpenCodeCliModels: vi.fn(() => Effect.die(new Error("unused test runtime models"))),
    loadOpenCodeCredentialProviderIDs: vi.fn(() => Effect.succeed([])),
    ...overrides,
  }) satisfies OpenCodeRuntimeShape;

class TestOpenCodeRuntimeError extends Data.TaggedError("OpenCodeRuntimeError")<{
  readonly operation: string;
  readonly detail: string;
}> {}

const runEffectTest = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>): Promise<A> =>
  Effect.runPromise(Effect.scoped(effect));

const runProductionLifecycleTest = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    Scope.Scope | FileSystem.FileSystem | Path.Path | HttpClient.HttpClient
  >,
): Promise<A> => Effect.runPromise(effect.pipe(Effect.scoped, Effect.provide(ProductionTestLayer)));

// ---------------------------------------------------------------------------
// Test lifecycle factory
// ---------------------------------------------------------------------------

function makeTestLifecycle(mockRuntime: OpenCodeRuntimeShape) {
  return Effect.gen(function* () {
    const stateRef = yield* Ref.make<ManagedSidecarSnapshot>(Object.freeze({ state: "idle" }));

    const updateState = (patch: Partial<ManagedSidecarSnapshot>) =>
      Ref.update(stateRef, (prev) => ({ ...prev, ...patch }));

    const getSnapshot = () => Ref.get(stateRef);

    const startManagedRuntime = (_request?: ManagedSidecarStartRequest) =>
      Effect.gen(function* () {
        yield* updateState({ state: "starting" });
        const password = generateSidecarPassword();
        const server = yield* mockRuntime.startOpenCodeServerProcess({
          binaryPath: FAKE_BINARY_PATH,
          configMode: "generated",
          serverPassword: password,
          ...managedSidecarOpenCodeLaunchOptions("/tmp/jcode-test-runtime"),
        });
        const snapshot: ManagedSidecarSnapshot = {
          state: "ready",
          binaryPath: FAKE_BINARY_PATH,
          serverUrl: server.url,
          serverPassword: password,
        };
        yield* Ref.set(stateRef, snapshot);
        return snapshot;
      }).pipe(
        Effect.catchTag("OpenCodeRuntimeError", (err) =>
          Effect.gen(function* () {
            yield* Ref.set(stateRef, { state: "error", error: err.detail });
            return yield* Effect.fail(
              new ManagedSidecarError({
                stage: "spawn",
                message: err.detail,
                cause: err,
              }),
            );
          }),
        ),
      );

    const stopManagedRuntime = () =>
      Effect.gen(function* () {
        const current = yield* getSnapshot();
        if (current.state === "idle") return current;
        yield* updateState({ state: "stopping" });
        yield* Ref.set(stateRef, Object.freeze({ state: "idle" }));
        return Object.freeze({ state: "idle" });
      });

    const restartManagedRuntime = () =>
      Effect.gen(function* () {
        yield* stopManagedRuntime();
        return yield* startManagedRuntime();
      });

    const getManagedRuntimeStatus = () => getSnapshot();

    return {
      startManagedRuntime,
      stopManagedRuntime,
      restartManagedRuntime,
      getManagedRuntimeStatus,
    } satisfies ManagedSidecarLifecycleShape;
  });
}

// ---------------------------------------------------------------------------
// generateSidecarPassword
// ---------------------------------------------------------------------------

describe("generateSidecarPassword", () => {
  it("returns a non-empty base64url string", () => {
    const password = generateSidecarPassword();
    expect(password).toBeTruthy();
    expect(password).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates unique passwords per call", () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generateSidecarPassword()));
    expect(passwords.size).toBe(20);
  });

  it("produces a 32-character base64url string from 24 random bytes", () => {
    const password = generateSidecarPassword();
    expect(password).toHaveLength(32);
  });
});

// ---------------------------------------------------------------------------
// ManagedSidecarError
// ---------------------------------------------------------------------------

describe("ManagedSidecarError", () => {
  it("is a tagged error with stage and message", () => {
    const err = new ManagedSidecarError({
      stage: "spawn",
      message: "Failed to spawn",
    });
    expect(err._tag).toBe("ManagedSidecarError");
    expect(err.stage).toBe("spawn");
    expect(err.message).toBe("Failed to spawn");
  });

  it("accepts an optional cause", () => {
    const cause = new Error("root cause");
    const err = new ManagedSidecarError({
      stage: "download",
      message: "Download failed",
      cause,
    });
    expect(err.cause).toBe(cause);
  });
});

// ---------------------------------------------------------------------------
// Status tracking (state transitions)
// ---------------------------------------------------------------------------

describe("lifecycle state transitions", () => {
  it("starts in idle state", () =>
    runEffectTest(
      Effect.gen(function* () {
        const lifecycle = yield* makeTestLifecycle(makeMockRuntime());
        const status = yield* lifecycle.getManagedRuntimeStatus();
        expect(status.state).toBe("idle");
      }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))),
    ));

  it("transitions to ready after successful start", () =>
    runEffectTest(
      Effect.gen(function* () {
        const lifecycle = yield* makeTestLifecycle(makeMockRuntime());
        const result = yield* lifecycle.startManagedRuntime();
        expect(result.state).toBe("ready");
        expect(result.serverUrl).toBe(FAKE_SERVER_URL);
        expect(result.serverPassword).toBeTruthy();
      }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))),
    ));

  it("transitions back to idle after stop", () =>
    runEffectTest(
      Effect.gen(function* () {
        const lifecycle = yield* makeTestLifecycle(makeMockRuntime());
        yield* lifecycle.startManagedRuntime();
        const stopped = yield* lifecycle.stopManagedRuntime();
        expect(stopped.state).toBe("idle");
        const status = yield* lifecycle.getManagedRuntimeStatus();
        expect(status.state).toBe("idle");
      }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))),
    ));
});

// ---------------------------------------------------------------------------
// Start lifecycle
// ---------------------------------------------------------------------------

describe("startManagedRuntime", () => {
  it("generates a fresh server password on each start", () =>
    runEffectTest(
      Effect.gen(function* () {
        const lifecycle = yield* makeTestLifecycle(makeMockRuntime());
        const first = yield* lifecycle.startManagedRuntime();
        yield* lifecycle.stopManagedRuntime();
        const second = yield* lifecycle.startManagedRuntime();
        expect(first.serverPassword).toBeTruthy();
        expect(second.serverPassword).toBeTruthy();
        expect(first.serverPassword).not.toBe(second.serverPassword);
      }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))),
    ));

  it("passes generated config mode and password when spawning", () =>
    runEffectTest(
      Effect.gen(function* () {
        const startFn = vi.fn<OpenCodeRuntimeShape["startOpenCodeServerProcess"]>(() =>
          Effect.succeed({
            url: FAKE_SERVER_URL,
            exitCode: Effect.succeed(0),
          }),
        );
        const mock = makeMockRuntime({
          startOpenCodeServerProcess: startFn,
        });
        const lifecycle = yield* makeTestLifecycle(mock);
        yield* lifecycle.startManagedRuntime();

        expect(startFn).toHaveBeenCalledTimes(1);
        const callArgs = startFn.mock.calls[0]?.[0];
        expect(callArgs).toEqual(
          expect.objectContaining({
            configMode: "generated",
            serverPassword: expect.any(String),
          }),
        );
        expect(callArgs?.serverPassword).toBeTruthy();
      }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))),
    ));

  it("builds isolated config and data directories for managed sidecar launch", () => {
    expect(managedSidecarOpenCodeLaunchOptions("/tmp/jcode-test-runtime")).toEqual({
      xdgConfigHome: "/tmp/jcode-test-runtime/config",
      extraEnv: {
        XDG_DATA_HOME: "/tmp/jcode-test-runtime/data",
      },
    });
  });

  it("returns binaryPath in the snapshot", () =>
    runEffectTest(
      Effect.gen(function* () {
        const lifecycle = yield* makeTestLifecycle(makeMockRuntime());
        const result = yield* lifecycle.startManagedRuntime();
        expect(result.binaryPath).toBeTruthy();
      }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))),
    ));

  it("serializes overlapping starts so only one process spawn runs at a time", () =>
    runProductionLifecycleTest(
      Effect.gen(function* () {
        const firstStartEntered = yield* Deferred.make<void>();
        const releaseFirstStart = yield* Deferred.make<void>();
        let inFlightStarts = 0;
        let maxInFlightStarts = 0;
        let startCount = 0;
        const runtime = makeMockRuntime({
          startOpenCodeServerProcess: vi.fn(() =>
            Effect.gen(function* () {
              startCount += 1;
              const processId = `process-${startCount}`;
              inFlightStarts += 1;
              maxInFlightStarts = Math.max(maxInFlightStarts, inFlightStarts);
              if (startCount === 1) {
                yield* Deferred.succeed(firstStartEntered, undefined);
                yield* Deferred.await(releaseFirstStart);
              }
              inFlightStarts -= 1;
              return {
                url: `${FAKE_SERVER_URL}/${processId}`,
                exitCode: Effect.succeed(0),
              };
            }),
          ),
        });
        const lifecycle = yield* makeManagedSidecarLifecycle.pipe(
          Effect.provide(Layer.succeed(OpenCodeRuntime, runtime)),
        );

        const firstStart = yield* lifecycle.startManagedRuntime().pipe(Effect.forkChild);
        yield* Deferred.await(firstStartEntered);
        const secondStart = yield* lifecycle.startManagedRuntime().pipe(Effect.forkChild);
        yield* Effect.sleep("25 millis");
        yield* Deferred.succeed(releaseFirstStart, undefined);

        yield* Fiber.join(firstStart);
        const secondResult = yield* Fiber.join(secondStart);
        const status = yield* lifecycle.getManagedRuntimeStatus();

        expect(maxInFlightStarts).toBe(1);
        expect(secondResult.state).toBe("ready");
        expect(status.state).toBe("ready");
      }),
    ));

  it("does not expose stale ready credentials while a forced download start is starting", () =>
    runProductionLifecycleTest(
      Effect.gen(function* () {
        const secondStartEntered = yield* Deferred.make<void>();
        const releaseSecondStart = yield* Deferred.make<void>();
        let startCount = 0;
        const runtime = makeMockRuntime({
          startOpenCodeServerProcess: vi.fn(() =>
            Effect.gen(function* () {
              startCount += 1;
              const processId = `process-${startCount}`;
              if (startCount === 2) {
                yield* Deferred.succeed(secondStartEntered, undefined);
                yield* Deferred.await(releaseSecondStart);
              }
              return {
                url: `${FAKE_SERVER_URL}/${processId}`,
                exitCode: Effect.succeed(0),
              };
            }),
          ),
        });
        const lifecycle = yield* makeManagedSidecarLifecycle.pipe(
          Effect.provide(Layer.succeed(OpenCodeRuntime, runtime)),
        );

        const first = yield* lifecycle.startManagedRuntime();
        expect(first.state).toBe("ready");
        expect(first.serverUrl).toBe(`${FAKE_SERVER_URL}/process-1`);
        expect(first.serverPassword).toBeTruthy();

        const secondStart = yield* lifecycle
          .startManagedRuntime({ forceDownload: true })
          .pipe(Effect.forkChild);
        yield* Deferred.await(secondStartEntered);

        const transient = yield* lifecycle.getManagedRuntimeStatus();
        expect(transient.state).toBe("starting");
        expect(transient.serverUrl).toBeUndefined();
        expect(transient.serverPassword).toBeUndefined();

        yield* Deferred.succeed(releaseSecondStart, undefined);
        const second = yield* Fiber.join(secondStart);
        expect(second.state).toBe("ready");
        expect(second.serverUrl).toBe(`${FAKE_SERVER_URL}/process-2`);
        expect(second.serverPassword).toBeTruthy();
      }),
    ));
});

// ---------------------------------------------------------------------------
// Stop lifecycle
// ---------------------------------------------------------------------------

describe("stopManagedRuntime", () => {
  it("returns idle when already idle", () =>
    runEffectTest(
      Effect.gen(function* () {
        const lifecycle = yield* makeTestLifecycle(makeMockRuntime());
        const result = yield* lifecycle.stopManagedRuntime();
        expect(result.state).toBe("idle");
      }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))),
    ));

  it("closes the running sidecar process resource", () => {
    const finalizedProcesses: string[] = [];
    let startCount = 0;
    const runtime = makeMockRuntime({
      startOpenCodeServerProcess: vi.fn(() =>
        Effect.gen(function* () {
          startCount += 1;
          const processId = `process-${startCount}`;
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              finalizedProcesses.push(processId);
            }),
          );
          return {
            url: `${FAKE_SERVER_URL}/${processId}`,
            exitCode: Effect.succeed(0),
          };
        }),
      ),
    });

    return runProductionLifecycleTest(
      Effect.gen(function* () {
        const lifecycle = yield* makeManagedSidecarLifecycle.pipe(
          Effect.provide(Layer.succeed(OpenCodeRuntime, runtime)),
        );

        yield* lifecycle.startManagedRuntime();
        expect(finalizedProcesses).toEqual([]);

        yield* lifecycle.stopManagedRuntime();
        expect(finalizedProcesses).toEqual(["process-1"]);

        yield* lifecycle.stopManagedRuntime();
        expect(finalizedProcesses).toEqual(["process-1"]);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Restart lifecycle
// ---------------------------------------------------------------------------

describe("restartManagedRuntime", () => {
  it("generates a new password on restart (no reuse)", () =>
    runEffectTest(
      Effect.gen(function* () {
        const lifecycle = yield* makeTestLifecycle(makeMockRuntime());
        const first = yield* lifecycle.startManagedRuntime();
        const restarted = yield* lifecycle.restartManagedRuntime();
        expect(restarted.serverPassword).toBeTruthy();
        expect(restarted.serverPassword).not.toBe(first.serverPassword);
      }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))),
    ));

  it("returns to ready state after restart", () =>
    runEffectTest(
      Effect.gen(function* () {
        const lifecycle = yield* makeTestLifecycle(makeMockRuntime());
        const restarted = yield* lifecycle.restartManagedRuntime();
        expect(restarted.state).toBe("ready");
      }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))),
    ));

  it("closes only the old sidecar process resource before returning the replacement", () => {
    const finalizedProcesses: string[] = [];
    let startCount = 0;
    const runtime = makeMockRuntime({
      startOpenCodeServerProcess: vi.fn(() =>
        Effect.gen(function* () {
          startCount += 1;
          const processId = `process-${startCount}`;
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              finalizedProcesses.push(processId);
            }),
          );
          return {
            url: `${FAKE_SERVER_URL}/${processId}`,
            exitCode: Effect.succeed(0),
          };
        }),
      ),
    });

    return runProductionLifecycleTest(
      Effect.gen(function* () {
        const lifecycle = yield* makeManagedSidecarLifecycle.pipe(
          Effect.provide(Layer.succeed(OpenCodeRuntime, runtime)),
        );

        const first = yield* lifecycle.startManagedRuntime();
        expect(first.serverUrl).toBe(`${FAKE_SERVER_URL}/process-1`);
        expect(finalizedProcesses).toEqual([]);

        const restarted = yield* lifecycle.restartManagedRuntime();
        expect(restarted.serverUrl).toBe(`${FAKE_SERVER_URL}/process-2`);
        expect(finalizedProcesses).toEqual(["process-1"]);

        yield* lifecycle.stopManagedRuntime();
        expect(finalizedProcesses).toEqual(["process-1", "process-2"]);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("error handling", () => {
  it("transitions to error state on spawn failure", () =>
    runEffectTest(
      Effect.gen(function* () {
        const failingMock = makeMockRuntime({
          startOpenCodeServerProcess: vi.fn(() =>
            Effect.fail(
              new TestOpenCodeRuntimeError({
                operation: "startOpenCodeServerProcess",
                detail: "spawn failed",
              }),
            ),
          ),
        });
        const lifecycle = yield* makeTestLifecycle(failingMock);
        const exit = yield* Effect.exit(lifecycle.startManagedRuntime());
        expect(Exit.isFailure(exit)).toBe(true);

        const status = yield* lifecycle.getManagedRuntimeStatus();
        expect(status.state).toBe("error");
        expect(status.error).toContain("spawn failed");
      }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))),
    ));

  it("does not reuse password after a failed start", () =>
    runEffectTest(
      Effect.gen(function* () {
        let callCount = 0;
        const startMock = vi.fn<OpenCodeRuntimeShape["startOpenCodeServerProcess"]>(() => {
          callCount++;
          if (callCount === 1) {
            return Effect.fail(
              new TestOpenCodeRuntimeError({
                operation: "startOpenCodeServerProcess",
                detail: "first attempt fails",
              }),
            );
          }
          return Effect.succeed({
            url: FAKE_SERVER_URL,
            exitCode: Effect.succeed(0),
          });
        });
        const failThenSucceed = makeMockRuntime({
          startOpenCodeServerProcess: startMock,
        });
        const lifecycle = yield* makeTestLifecycle(failThenSucceed);

        yield* Effect.flip(lifecycle.startManagedRuntime());

        const success = yield* lifecycle.startManagedRuntime();
        const firstPassword = startMock.mock.calls[0]?.[0].serverPassword;
        const secondPassword = startMock.mock.calls[1]?.[0].serverPassword;
        expect(success.state).toBe("ready");
        expect(success.serverPassword).toBeTruthy();
        expect(firstPassword).toBeTruthy();
        expect(secondPassword).toBeTruthy();
        expect(secondPassword).not.toBe(firstPassword);
      }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))),
    ));

  it("redacts generated password from spawn error diagnostics", () =>
    runProductionLifecycleTest(
      Effect.gen(function* () {
        let generatedPassword: string | undefined;
        const startMock = vi.fn<OpenCodeRuntimeShape["startOpenCodeServerProcess"]>((input) => {
          generatedPassword = input.serverPassword;
          return Effect.fail(
            new TestOpenCodeRuntimeError({
              operation: "startOpenCodeServerProcess",
              detail: `spawn failed with password ${input.serverPassword}`,
            }),
          );
        });
        const runtime = makeMockRuntime({
          startOpenCodeServerProcess: startMock,
        });
        const lifecycle = yield* makeManagedSidecarLifecycle.pipe(
          Effect.provide(Layer.succeed(OpenCodeRuntime, runtime)),
        );

        const exit = yield* Effect.exit(lifecycle.startManagedRuntime());
        expect(Exit.isFailure(exit)).toBe(true);
        expect(generatedPassword).toEqual(expect.any(String));
        if (generatedPassword === undefined) {
          throw new Error("expected generated password");
        }

        const status = yield* lifecycle.getManagedRuntimeStatus();
        const diagnostics = yield* exportManagedSidecarDiagnostics({ sidecarSnapshot: status });
        const serializedResult = JSON.stringify({ status, diagnostics });

        expect(status.state).toBe("error");
        expect(status.error).toContain("[redacted]");
        expect(diagnostics.report.issue).toContain("[redacted]");
        expect(diagnostics.report.summary).toContain("[redacted]");
        expect(serializedResult).not.toContain(generatedPassword);
      }),
    ));
});
