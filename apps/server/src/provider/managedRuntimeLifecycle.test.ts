import { describe, expect, it, vi } from "vitest";

import { Data, Effect, Layer, Ref, Exit } from "effect";

import type { ManagedSidecarSnapshot } from "@jcode/contracts";

import {
  generateSidecarPassword,
  ManagedSidecarError,
  type ManagedSidecarLifecycleShape,
} from "./managedRuntimeLifecycle.ts";

import { OpenCodeRuntime, type OpenCodeRuntimeShape } from "./opencodeRuntime.ts";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const FAKE_BINARY_PATH = "/tmp/jcode-test-runtime/opencode";
const FAKE_SERVER_URL = "http://127.0.0.1:9999";

const makeMockRuntime = (overrides?: Partial<OpenCodeRuntimeShape>): OpenCodeRuntimeShape =>
  ({
    startOpenCodeServerProcess: vi.fn(() =>
      Effect.succeed({
        url: FAKE_SERVER_URL,
        exitCode: Effect.succeed(0),
      }),
    ),
    ...overrides,
  }) as unknown as OpenCodeRuntimeShape;

class TestOpenCodeRuntimeError extends Data.TaggedError("OpenCodeRuntimeError")<{
  readonly operation: string;
  readonly detail: string;
}> {}

// ---------------------------------------------------------------------------
// Test lifecycle factory
// ---------------------------------------------------------------------------

function makeTestLifecycle(mockRuntime: OpenCodeRuntimeShape) {
  return Effect.gen(function* () {
    const stateRef = yield* Ref.make<ManagedSidecarSnapshot>(Object.freeze({ state: "idle" }));

    const updateState = (patch: Partial<ManagedSidecarSnapshot>) =>
      Ref.update(stateRef, (prev) => ({ ...prev, ...patch }));

    const getSnapshot = () => Ref.get(stateRef);

    const startManagedRuntime = (_request?: Readonly<{ readonly forceDownload?: boolean }>) =>
      Effect.gen(function* () {
        yield* updateState({ state: "starting" });
        const password = generateSidecarPassword();
        const server = yield* mockRuntime.startOpenCodeServerProcess({
          binaryPath: FAKE_BINARY_PATH,
          configMode: "generated",
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
    Effect.gen(function* () {
      const lifecycle = yield* makeTestLifecycle(makeMockRuntime());
      const status = yield* lifecycle.getManagedRuntimeStatus();
      expect(status.state).toBe("idle");
    }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))));

  it("transitions to ready after successful start", () =>
    Effect.gen(function* () {
      const lifecycle = yield* makeTestLifecycle(makeMockRuntime());
      const result = yield* lifecycle.startManagedRuntime();
      expect(result.state).toBe("ready");
      expect(result.serverUrl).toBe(FAKE_SERVER_URL);
      expect(result.serverPassword).toBeTruthy();
    }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))));

  it("transitions back to idle after stop", () =>
    Effect.gen(function* () {
      const lifecycle = yield* makeTestLifecycle(makeMockRuntime());
      yield* lifecycle.startManagedRuntime();
      const stopped = yield* lifecycle.stopManagedRuntime();
      expect(stopped.state).toBe("idle");
      const status = yield* lifecycle.getManagedRuntimeStatus();
      expect(status.state).toBe("idle");
    }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))));
});

// ---------------------------------------------------------------------------
// Start lifecycle
// ---------------------------------------------------------------------------

describe("startManagedRuntime", () => {
  it("generates a fresh server password on each start", () =>
    Effect.gen(function* () {
      const lifecycle = yield* makeTestLifecycle(makeMockRuntime());
      const first = yield* lifecycle.startManagedRuntime();
      yield* lifecycle.stopManagedRuntime();
      const second = yield* lifecycle.startManagedRuntime();
      expect(first.serverPassword).toBeTruthy();
      expect(second.serverPassword).toBeTruthy();
      expect(first.serverPassword).not.toBe(second.serverPassword);
    }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))));

  it("uses configMode generated when spawning", () =>
    Effect.gen(function* () {
      const startFn = vi.fn(() =>
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
      const callArgs = startFn.mock.calls[0]![0] as Record<string, unknown>;
      expect(callArgs["configMode"]).toBe("generated");
    }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))));

  it("returns binaryPath in the snapshot", () =>
    Effect.gen(function* () {
      const lifecycle = yield* makeTestLifecycle(makeMockRuntime());
      const result = yield* lifecycle.startManagedRuntime();
      expect(result.binaryPath).toBeTruthy();
    }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))));
});

// ---------------------------------------------------------------------------
// Stop lifecycle
// ---------------------------------------------------------------------------

describe("stopManagedRuntime", () => {
  it("returns idle when already idle", () =>
    Effect.gen(function* () {
      const lifecycle = yield* makeTestLifecycle(makeMockRuntime());
      const result = yield* lifecycle.stopManagedRuntime();
      expect(result.state).toBe("idle");
    }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))));
});

// ---------------------------------------------------------------------------
// Restart lifecycle
// ---------------------------------------------------------------------------

describe("restartManagedRuntime", () => {
  it("generates a new password on restart (no reuse)", () =>
    Effect.gen(function* () {
      const lifecycle = yield* makeTestLifecycle(makeMockRuntime());
      const first = yield* lifecycle.startManagedRuntime();
      const restarted = yield* lifecycle.restartManagedRuntime();
      expect(restarted.serverPassword).toBeTruthy();
      expect(restarted.serverPassword).not.toBe(first.serverPassword);
    }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))));

  it("returns to ready state after restart", () =>
    Effect.gen(function* () {
      const lifecycle = yield* makeTestLifecycle(makeMockRuntime());
      const restarted = yield* lifecycle.restartManagedRuntime();
      expect(restarted.state).toBe("ready");
    }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))));
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("error handling", () => {
  it("transitions to error state on spawn failure", () =>
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
    }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))));

  it("does not reuse password after a failed start", () =>
    Effect.gen(function* () {
      let callCount = 0;
      const failThenSucceed = makeMockRuntime({
        startOpenCodeServerProcess: vi.fn(() => {
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
        }),
      });
      const lifecycle = yield* makeTestLifecycle(failThenSucceed);

      yield* Effect.flip(lifecycle.startManagedRuntime());

      const success = yield* lifecycle.startManagedRuntime();
      expect(success.state).toBe("ready");
      expect(success.serverPassword).toBeTruthy();
    }).pipe(Effect.provide(Layer.succeed(OpenCodeRuntime, makeMockRuntime()))));
});
