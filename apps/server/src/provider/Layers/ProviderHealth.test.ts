import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, it, assert } from "@effect/vitest";
import { DEFAULT_SERVER_SETTINGS } from "@jcode/contracts";
import { Effect, FileSystem, Layer, Path, Sink, Stream } from "effect";
import * as PlatformError from "effect/PlatformError";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import {
  checkClaudeProviderStatus,
  checkCodexProviderStatus,
  checkCursorProviderStatus,
  checkOpenCodeProviderStatus,
  checkOpenClawProviderStatus,
  hasCustomModelProvider,
  isExternalOpenCodeRuntimeActive,
  makeCheckClaudeProviderStatus,
  makeCheckCodexProviderStatus,
  makeCheckCursorProviderStatus,
  makeCheckKiloProviderStatus,
  makeCheckOpenCodeProviderStatus,
  makeCheckOpenClawProviderStatus,
  parseAuthStatusFromOutput,
  parseClaudeAuthStatusFromOutput,
  ProviderHealthLive,
  readCodexConfigModelProvider,
} from "./ProviderHealth";
import { ServerConfig } from "../../config";
import { ServerSettingsService } from "../../serverSettings";
import { ServerSecretStoreLive } from "../../auth/Layers/ServerSecretStore";
import { ServerSecretStore } from "../../auth/Services/ServerSecretStore";
import { setOpenClawToken } from "../openclawSecrets";
import { ProviderHealth } from "../Services/ProviderHealth";

// ── Test helpers ────────────────────────────────────────────────────

const encoder = new TextEncoder();

const openClawSecretLayer = ServerSecretStoreLive.pipe(
  Layer.provide(
    ServerConfig.layerTest(process.cwd(), {
      prefix: "jcode-provider-health-openclaw-test-",
    }),
  ),
  Layer.provide(NodeServices.layer),
);

const openClawTokenSecretLayer = Layer.effect(
  ServerSecretStore,
  Effect.gen(function* () {
    const store = yield* ServerSecretStore;
    yield* setOpenClawToken("token-secret");
    return store;
  }),
).pipe(Layer.provide(openClawSecretLayer));

function mockHandle(result: { stdout: string; stderr: string; code: number }) {
  return ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(1),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(result.code)),
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    stdin: Sink.drain,
    stdout: Stream.make(encoder.encode(result.stdout)),
    stderr: Stream.make(encoder.encode(result.stderr)),
    all: Stream.empty,
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
  });
}

function mockSpawnerLayer(
  handler: (
    args: ReadonlyArray<string>,
    command: string,
    options: ChildProcess.CommandOptions,
  ) => {
    stdout: string;
    stderr: string;
    code: number;
  },
) {
  return Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) => {
      const cmd = command as unknown as {
        command: string;
        args: ReadonlyArray<string>;
        options: ChildProcess.CommandOptions;
      };
      return Effect.succeed(mockHandle(handler(cmd.args, cmd.command, cmd.options)));
    }),
  );
}

function withProcessPlatform<A, E, R>(
  platform: NodeJS.Platform,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> {
  return Effect.acquireUseRelease(
    Effect.sync(() => {
      const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
      Object.defineProperty(process, "platform", { value: platform });
      return descriptor;
    }),
    () => effect,
    (descriptor) =>
      Effect.sync(() => {
        if (descriptor) {
          Object.defineProperty(process, "platform", descriptor);
        }
      }),
  );
}

function failingSpawnerLayer(description: string) {
  return Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() =>
      Effect.fail(
        PlatformError.systemError({
          _tag: "NotFound",
          module: "ChildProcess",
          method: "spawn",
          description,
        }),
      ),
    ),
  );
}

/**
 * Create a temporary CODEX_HOME scoped to the current Effect test.
 * Cleanup is registered in the test scope rather than via Vitest hooks.
 */
function withTempCodexHome(configContent?: string) {
  return Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const tmpDir = yield* fileSystem.makeTempDirectoryScoped({ prefix: "t3-test-codex-" });

    yield* Effect.acquireRelease(
      Effect.sync(() => {
        const originalCodexHome = process.env.CODEX_HOME;
        process.env.CODEX_HOME = tmpDir;
        return originalCodexHome;
      }),
      (originalCodexHome) =>
        Effect.sync(() => {
          if (originalCodexHome !== undefined) {
            process.env.CODEX_HOME = originalCodexHome;
          } else {
            delete process.env.CODEX_HOME;
          }
        }),
    );

    if (configContent !== undefined) {
      yield* fileSystem.writeFileString(path.join(tmpDir, "config.toml"), configContent);
    }

    return { tmpDir } as const;
  });
}

it.layer(NodeServices.layer)("ProviderHealth", (it) => {
  // ── checkCodexProviderStatus tests ────────────────────────────────
  //
  // These tests control CODEX_HOME to ensure the custom-provider detection
  // in hasCustomModelProvider() does not interfere with the auth-probe
  // path being tested.

  describe("checkCodexProviderStatus", () => {
    it.effect("returns ready when codex is installed and authenticated", () =>
      Effect.gen(function* () {
        // Point CODEX_HOME at an empty tmp dir (no config.toml) so the
        // default code path (OpenAI provider, auth probe runs) is exercised.
        yield* withTempCodexHome();
        const status = yield* checkCodexProviderStatus;
        assert.strictEqual(status.provider, "codex");
        assert.strictEqual(status.status, "ready");
        assert.strictEqual(status.available, true);
        assert.strictEqual(status.authStatus, "authenticated");
      }).pipe(
        Effect.provide(
          mockSpawnerLayer((args) => {
            const joined = args.join(" ");
            if (joined === "--version") return { stdout: "codex 1.0.0\n", stderr: "", code: 0 };
            if (joined === "login status") return { stdout: "Logged in\n", stderr: "", code: 0 };
            throw new Error(`Unexpected args: ${joined}`);
          }),
        ),
      ),
    );

    it.effect("uses configured codex binary for version and auth probes", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome();
        const status = yield* makeCheckCodexProviderStatus("/custom/bin/codex");
        assert.strictEqual(status.status, "ready");
      }).pipe(
        Effect.provide(
          mockSpawnerLayer((args, command) => {
            assert.strictEqual(command, "/custom/bin/codex");
            const joined = args.join(" ");
            if (joined === "--version") return { stdout: "codex 1.0.0\n", stderr: "", code: 0 };
            if (joined === "login status") return { stdout: "Logged in\n", stderr: "", code: 0 };
            throw new Error(`Unexpected args: ${joined}`);
          }),
        ),
      ),
    );

    it.effect("returns unavailable when codex is missing", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome();
        const status = yield* checkCodexProviderStatus;
        assert.strictEqual(status.provider, "codex");
        assert.strictEqual(status.status, "error");
        assert.strictEqual(status.available, false);
        assert.strictEqual(status.authStatus, "unknown");
        assert.strictEqual(status.message, "Codex CLI (`codex`) is not installed or not on PATH.");
      }).pipe(Effect.provide(failingSpawnerLayer("spawn codex ENOENT"))),
    );

    it.effect("returns unavailable when codex is below the minimum supported version", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome();
        const status = yield* checkCodexProviderStatus;
        assert.strictEqual(status.provider, "codex");
        assert.strictEqual(status.status, "error");
        assert.strictEqual(status.available, false);
        assert.strictEqual(status.authStatus, "unknown");
        assert.strictEqual(
          status.message,
          "Codex CLI v0.36.0 is too old for JCode. Upgrade to v0.37.0 or newer and restart JCode.",
        );
      }).pipe(
        Effect.provide(
          mockSpawnerLayer((args) => {
            const joined = args.join(" ");
            if (joined === "--version") return { stdout: "codex 0.36.0\n", stderr: "", code: 0 };
            throw new Error(`Unexpected args: ${joined}`);
          }),
        ),
      ),
    );

    it.effect("returns unauthenticated when auth probe reports login required", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome();
        const status = yield* checkCodexProviderStatus;
        assert.strictEqual(status.provider, "codex");
        assert.strictEqual(status.status, "error");
        assert.strictEqual(status.available, true);
        assert.strictEqual(status.authStatus, "unauthenticated");
        assert.strictEqual(
          status.message,
          "Codex CLI is not authenticated. Run `codex login` and try again.",
        );
      }).pipe(
        Effect.provide(
          mockSpawnerLayer((args) => {
            const joined = args.join(" ");
            if (joined === "--version") return { stdout: "codex 1.0.0\n", stderr: "", code: 0 };
            if (joined === "login status") {
              return { stdout: "", stderr: "Not logged in. Run codex login.", code: 1 };
            }
            throw new Error(`Unexpected args: ${joined}`);
          }),
        ),
      ),
    );

    it.effect("returns unauthenticated when login status output includes 'not logged in'", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome();
        const status = yield* checkCodexProviderStatus;
        assert.strictEqual(status.provider, "codex");
        assert.strictEqual(status.status, "error");
        assert.strictEqual(status.available, true);
        assert.strictEqual(status.authStatus, "unauthenticated");
        assert.strictEqual(
          status.message,
          "Codex CLI is not authenticated. Run `codex login` and try again.",
        );
      }).pipe(
        Effect.provide(
          mockSpawnerLayer((args) => {
            const joined = args.join(" ");
            if (joined === "--version") return { stdout: "codex 1.0.0\n", stderr: "", code: 0 };
            if (joined === "login status")
              return { stdout: "Not logged in\n", stderr: "", code: 1 };
            throw new Error(`Unexpected args: ${joined}`);
          }),
        ),
      ),
    );

    it.effect("returns warning when login status command is unsupported", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome();
        const status = yield* checkCodexProviderStatus;
        assert.strictEqual(status.provider, "codex");
        assert.strictEqual(status.status, "warning");
        assert.strictEqual(status.available, true);
        assert.strictEqual(status.authStatus, "unknown");
        assert.strictEqual(
          status.message,
          "Codex CLI authentication status command is unavailable in this Codex version.",
        );
      }).pipe(
        Effect.provide(
          mockSpawnerLayer((args) => {
            const joined = args.join(" ");
            if (joined === "--version") return { stdout: "codex 1.0.0\n", stderr: "", code: 0 };
            if (joined === "login status") {
              return { stdout: "", stderr: "error: unknown command 'login'", code: 2 };
            }
            throw new Error(`Unexpected args: ${joined}`);
          }),
        ),
      ),
    );
  });

  // ── Custom model provider: checkCodexProviderStatus integration ───

  describe("checkCodexProviderStatus with custom model provider", () => {
    it.effect("skips auth probe and returns ready when a custom model provider is configured", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome(
          [
            'model_provider = "portkey"',
            "",
            "[model_providers.portkey]",
            'base_url = "https://api.portkey.ai/v1"',
            'env_key = "PORTKEY_API_KEY"',
          ].join("\n"),
        );
        const status = yield* checkCodexProviderStatus;
        assert.strictEqual(status.provider, "codex");
        assert.strictEqual(status.status, "ready");
        assert.strictEqual(status.available, true);
        assert.strictEqual(status.authStatus, "unknown");
        assert.strictEqual(
          status.message,
          "Using a custom Codex model provider; OpenAI login check skipped.",
        );
      }).pipe(
        Effect.provide(
          // The spawner only handles --version; if the test attempts
          // "login status" the throw proves the auth probe was NOT skipped.
          mockSpawnerLayer((args) => {
            const joined = args.join(" ");
            if (joined === "--version") return { stdout: "codex 1.0.0\n", stderr: "", code: 0 };
            throw new Error(`Auth probe should have been skipped but got args: ${joined}`);
          }),
        ),
      ),
    );

    it.effect("still reports error when codex CLI is missing even with custom provider", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome(
          [
            'model_provider = "portkey"',
            "",
            "[model_providers.portkey]",
            'base_url = "https://api.portkey.ai/v1"',
            'env_key = "PORTKEY_API_KEY"',
          ].join("\n"),
        );
        const status = yield* checkCodexProviderStatus;
        assert.strictEqual(status.status, "error");
        assert.strictEqual(status.available, false);
      }).pipe(Effect.provide(failingSpawnerLayer("spawn codex ENOENT"))),
    );
  });

  describe("checkCodexProviderStatus with openai model provider", () => {
    it.effect("still runs auth probe when model_provider is openai", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome('model_provider = "openai"\n');
        const status = yield* checkCodexProviderStatus;
        // The auth probe runs and sees "not logged in" → error
        assert.strictEqual(status.status, "error");
        assert.strictEqual(status.authStatus, "unauthenticated");
      }).pipe(
        Effect.provide(
          mockSpawnerLayer((args) => {
            const joined = args.join(" ");
            if (joined === "--version") return { stdout: "codex 1.0.0\n", stderr: "", code: 0 };
            if (joined === "login status")
              return { stdout: "Not logged in\n", stderr: "", code: 1 };
            throw new Error(`Unexpected args: ${joined}`);
          }),
        ),
      ),
    );
  });

  // ── parseAuthStatusFromOutput pure tests ──────────────────────────

  describe("parseAuthStatusFromOutput", () => {
    it("exit code 0 with no auth markers is ready", () => {
      const parsed = parseAuthStatusFromOutput({ stdout: "OK\n", stderr: "", code: 0 });
      assert.strictEqual(parsed.status, "ready");
      assert.strictEqual(parsed.authStatus, "authenticated");
    });

    it("JSON with authenticated=false is unauthenticated", () => {
      const parsed = parseAuthStatusFromOutput({
        stdout: '[{"authenticated":false}]\n',
        stderr: "",
        code: 0,
      });
      assert.strictEqual(parsed.status, "error");
      assert.strictEqual(parsed.authStatus, "unauthenticated");
    });

    it("JSON without auth marker is warning", () => {
      const parsed = parseAuthStatusFromOutput({
        stdout: '[{"ok":true}]\n',
        stderr: "",
        code: 0,
      });
      assert.strictEqual(parsed.status, "warning");
      assert.strictEqual(parsed.authStatus, "unknown");
    });
  });

  // ── readCodexConfigModelProvider tests ─────────────────────────────

  describe("readCodexConfigModelProvider", () => {
    it.effect("returns undefined when config file does not exist", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome();
        assert.strictEqual(yield* readCodexConfigModelProvider, undefined);
      }).pipe(Effect.provide(openClawSecretLayer)),
    );

    it.effect("returns undefined when config has no model_provider key", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome('model = "gpt-5-codex"\n');
        assert.strictEqual(yield* readCodexConfigModelProvider, undefined);
      }).pipe(Effect.provide(openClawSecretLayer)),
    );

    it.effect("returns the provider when model_provider is set at top level", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome('model = "gpt-5-codex"\nmodel_provider = "portkey"\n');
        assert.strictEqual(yield* readCodexConfigModelProvider, "portkey");
      }).pipe(Effect.provide(openClawSecretLayer)),
    );

    it.effect("returns openai when model_provider is openai", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome('model_provider = "openai"\n');
        assert.strictEqual(yield* readCodexConfigModelProvider, "openai");
      }).pipe(Effect.provide(openClawSecretLayer)),
    );

    it.effect("ignores model_provider inside section headers", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome(
          [
            'model = "gpt-5-codex"',
            "",
            "[model_providers.portkey]",
            'base_url = "https://api.portkey.ai/v1"',
            'model_provider = "should-be-ignored"',
            "",
          ].join("\n"),
        );
        assert.strictEqual(yield* readCodexConfigModelProvider, undefined);
      }).pipe(Effect.provide(openClawSecretLayer)),
    );

    it.effect("handles comments and whitespace", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome(
          [
            "# This is a comment",
            "",
            '  model_provider = "azure"  ',
            "",
            "[profiles.deep-review]",
            'model = "gpt-5-pro"',
          ].join("\n"),
        );
        assert.strictEqual(yield* readCodexConfigModelProvider, "azure");
      }).pipe(Effect.provide(openClawSecretLayer)),
    );

    it.effect("handles single-quoted values in TOML", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome("model_provider = 'mistral'\n");
        assert.strictEqual(yield* readCodexConfigModelProvider, "mistral");
      }).pipe(Effect.provide(openClawSecretLayer)),
    );
  });

  // ── hasCustomModelProvider tests ───────────────────────────────────

  describe("hasCustomModelProvider", () => {
    it.effect("returns false when no config file exists", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome();
        assert.strictEqual(yield* hasCustomModelProvider, false);
      }).pipe(Effect.provide(openClawSecretLayer)),
    );

    it.effect("returns false when model_provider is not set", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome('model = "gpt-5-codex"\n');
        assert.strictEqual(yield* hasCustomModelProvider, false);
      }).pipe(Effect.provide(openClawSecretLayer)),
    );

    it.effect("returns false when model_provider is openai", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome('model_provider = "openai"\n');
        assert.strictEqual(yield* hasCustomModelProvider, false);
      }),
    );

    it.effect("returns true when model_provider is portkey", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome('model_provider = "portkey"\n');
        assert.strictEqual(yield* hasCustomModelProvider, true);
      }),
    );

    it.effect("returns true when model_provider is azure", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome('model_provider = "azure"\n');
        assert.strictEqual(yield* hasCustomModelProvider, true);
      }),
    );

    it.effect("returns true when model_provider is ollama", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome('model_provider = "ollama"\n');
        assert.strictEqual(yield* hasCustomModelProvider, true);
      }),
    );

    it.effect("returns true when model_provider is a custom proxy", () =>
      Effect.gen(function* () {
        yield* withTempCodexHome('model_provider = "my-company-proxy"\n');
        assert.strictEqual(yield* hasCustomModelProvider, true);
      }),
    );
  });

  // ── checkClaudeProviderStatus tests ──────────────────────────

  describe("checkClaudeProviderStatus", () => {
    it.effect("returns ready when claude is installed and authenticated", () =>
      Effect.gen(function* () {
        const status = yield* checkClaudeProviderStatus;
        assert.strictEqual(status.provider, "claudeAgent");
        assert.strictEqual(status.status, "ready");
        assert.strictEqual(status.available, true);
        assert.strictEqual(status.authStatus, "authenticated");
      }).pipe(
        Effect.provide(
          mockSpawnerLayer((args) => {
            const joined = args.join(" ");
            if (joined === "--version") return { stdout: "1.0.0\n", stderr: "", code: 0 };
            if (joined === "auth status")
              return {
                stdout: '{"loggedIn":true,"authMethod":"claude.ai"}\n',
                stderr: "",
                code: 0,
              };
            throw new Error(`Unexpected args: ${joined}`);
          }),
        ),
      ),
    );

    it.effect("uses configured claude binary for version and auth probes", () =>
      Effect.gen(function* () {
        const status = yield* makeCheckClaudeProviderStatus(undefined, "/custom/bin/claude");
        assert.strictEqual(status.status, "ready");
      }).pipe(
        Effect.provide(
          mockSpawnerLayer((args, command) => {
            assert.strictEqual(command, "/custom/bin/claude");
            const joined = args.join(" ");
            if (joined === "--version") return { stdout: "1.0.0\n", stderr: "", code: 0 };
            if (joined === "auth status")
              return {
                stdout: '{"loggedIn":true,"authMethod":"claude.ai"}\n',
                stderr: "",
                code: 0,
              };
            throw new Error(`Unexpected args: ${joined}`);
          }),
        ),
      ),
    );

    it.effect("returns unavailable when claude is missing", () =>
      Effect.gen(function* () {
        const status = yield* checkClaudeProviderStatus;
        assert.strictEqual(status.provider, "claudeAgent");
        assert.strictEqual(status.status, "error");
        assert.strictEqual(status.available, false);
        assert.strictEqual(status.authStatus, "unknown");
        assert.strictEqual(
          status.message,
          "Claude Agent CLI (`claude`) is not installed or not on PATH.",
        );
      }).pipe(Effect.provide(failingSpawnerLayer("spawn claude ENOENT"))),
    );

    it.effect("returns error when version check fails with non-zero exit code", () =>
      Effect.gen(function* () {
        const status = yield* checkClaudeProviderStatus;
        assert.strictEqual(status.provider, "claudeAgent");
        assert.strictEqual(status.status, "error");
        assert.strictEqual(status.available, false);
      }).pipe(
        Effect.provide(
          mockSpawnerLayer((args) => {
            const joined = args.join(" ");
            if (joined === "--version")
              return { stdout: "", stderr: "Something went wrong", code: 1 };
            throw new Error(`Unexpected args: ${joined}`);
          }),
        ),
      ),
    );

    it.effect("returns unauthenticated when auth status reports not logged in", () =>
      Effect.gen(function* () {
        const status = yield* checkClaudeProviderStatus;
        assert.strictEqual(status.provider, "claudeAgent");
        assert.strictEqual(status.status, "error");
        assert.strictEqual(status.available, true);
        assert.strictEqual(status.authStatus, "unauthenticated");
        assert.strictEqual(
          status.message,
          "Claude is not authenticated. Run `claude auth login` and try again.",
        );
      }).pipe(
        Effect.provide(
          mockSpawnerLayer((args) => {
            const joined = args.join(" ");
            if (joined === "--version") return { stdout: "1.0.0\n", stderr: "", code: 0 };
            if (joined === "auth status")
              return {
                stdout: '{"loggedIn":false}\n',
                stderr: "",
                code: 1,
              };
            throw new Error(`Unexpected args: ${joined}`);
          }),
        ),
      ),
    );

    it.effect("returns unauthenticated when output includes 'not logged in'", () =>
      Effect.gen(function* () {
        const status = yield* checkClaudeProviderStatus;
        assert.strictEqual(status.provider, "claudeAgent");
        assert.strictEqual(status.status, "error");
        assert.strictEqual(status.available, true);
        assert.strictEqual(status.authStatus, "unauthenticated");
      }).pipe(
        Effect.provide(
          mockSpawnerLayer((args) => {
            const joined = args.join(" ");
            if (joined === "--version") return { stdout: "1.0.0\n", stderr: "", code: 0 };
            if (joined === "auth status") return { stdout: "Not logged in\n", stderr: "", code: 1 };
            throw new Error(`Unexpected args: ${joined}`);
          }),
        ),
      ),
    );

    it.effect("returns warning when auth status command is unsupported", () =>
      Effect.gen(function* () {
        const status = yield* checkClaudeProviderStatus;
        assert.strictEqual(status.provider, "claudeAgent");
        assert.strictEqual(status.status, "warning");
        assert.strictEqual(status.available, true);
        assert.strictEqual(status.authStatus, "unknown");
        assert.strictEqual(
          status.message,
          "Claude Agent authentication status command is unavailable in this version of Claude.",
        );
      }).pipe(
        Effect.provide(
          mockSpawnerLayer((args) => {
            const joined = args.join(" ");
            if (joined === "--version") return { stdout: "1.0.0\n", stderr: "", code: 0 };
            if (joined === "auth status")
              return { stdout: "", stderr: "error: unknown command 'auth'", code: 2 };
            throw new Error(`Unexpected args: ${joined}`);
          }),
        ),
      ),
    );
  });

  describe("checkOpenCodeProviderStatus", () => {
    it.effect("returns ready when opencode is installed", () =>
      Effect.gen(function* () {
        const status = yield* checkOpenCodeProviderStatus;
        assert.strictEqual(status.provider, "opencode");
        assert.strictEqual(status.status, "ready");
        assert.strictEqual(status.available, true);
        assert.strictEqual(status.authStatus, "unknown");
      }).pipe(
        Effect.provide(
          mockSpawnerLayer((args) => {
            const joined = args.join(" ");
            if (joined === "--version") return { stdout: "opencode 1.3.17\n", stderr: "", code: 0 };
            throw new Error(`Unexpected args: ${joined}`);
          }),
        ),
      ),
    );

    it.effect("uses configured opencode binary for version probe", () =>
      Effect.gen(function* () {
        const status = yield* makeCheckOpenCodeProviderStatus("/custom/bin/opencode");
        assert.strictEqual(status.status, "ready");
      }).pipe(
        Effect.provide(
          mockSpawnerLayer((args, command) => {
            assert.strictEqual(command, "/custom/bin/opencode");
            const joined = args.join(" ");
            if (joined === "--version") return { stdout: "opencode 1.3.17\n", stderr: "", code: 0 };
            throw new Error(`Unexpected args: ${joined}`);
          }),
        ),
      ),
    );

    it.effect("returns unavailable when opencode is missing", () =>
      Effect.gen(function* () {
        const status = yield* checkOpenCodeProviderStatus;
        assert.strictEqual(status.provider, "opencode");
        assert.strictEqual(status.status, "error");
        assert.strictEqual(status.available, false);
        assert.strictEqual(status.authStatus, "unknown");
        assert.strictEqual(
          status.message,
          "OpenCode CLI (`opencode`) is not installed or not on PATH.",
        );
      }).pipe(Effect.provide(failingSpawnerLayer("spawn opencode ENOENT"))),
    );
  });

  describe("checkOpenClawProviderStatus", () => {
    it.effect("reports unconfigured when no gateway URL is set", () =>
      Effect.gen(function* () {
        const status = yield* makeCheckOpenClawProviderStatus({
          enabled: true,
          gatewayUrl: "",
          authMode: "none",
          hasSecret: false,
          paired: false,
        });
        assert.strictEqual(status.provider, "openclaw");
        assert.strictEqual(status.status, "warning");
        assert.strictEqual(status.available, false);
        assert.strictEqual(status.authStatus, "unknown");
        assert.match(status.message ?? "", /gateway URL is not configured/);
      }).pipe(Effect.provide(openClawSecretLayer)),
    );

    it.effect("reports ready when the gateway probe succeeds", () =>
      Effect.gen(function* () {
        let capturedAuth: unknown;
        const status = yield* makeCheckOpenClawProviderStatus(
          {
            enabled: true,
            gatewayUrl: "https://gateway.example.test/path?token=must-not-leak",
            authMode: "token",
            hasSecret: true,
            paired: false,
          },
          {
            probe: (input) => {
              capturedAuth = input.auth;
              return Effect.succeed({ methods: ["chat.history", "chat.send", "chat.abort"] });
            },
          },
        );
        assert.strictEqual(status.provider, "openclaw");
        assert.strictEqual(status.status, "ready");
        assert.strictEqual(status.available, true);
        assert.strictEqual(status.authStatus, "authenticated");
        assert.strictEqual(status.authType, "token");
        assert.deepStrictEqual(capturedAuth, { type: "token", token: "token-secret" });
        assert.strictEqual(/must-not-leak/.test(status.message ?? ""), false);
      }).pipe(Effect.provide(openClawTokenSecretLayer)),
    );

    it.effect("does not report available when live gateway probing is unavailable", () =>
      Effect.gen(function* () {
        const status = yield* makeCheckOpenClawProviderStatus({
          enabled: true,
          gatewayUrl: "https://gateway.example.test/path?token=must-not-leak",
          authMode: "none",
          hasSecret: false,
          paired: false,
        });
        assert.strictEqual(status.provider, "openclaw");
        assert.strictEqual(status.status, "warning");
        assert.strictEqual(status.available, false);
        assert.strictEqual(status.authStatus, "unknown");
        assert.match(status.message ?? "", /probing is not configured/);
        assert.strictEqual(/must-not-leak/.test(status.message ?? ""), false);
      }).pipe(Effect.provide(openClawSecretLayer)),
    );

    it.effect("live wrapper attempts the default gateway probe", () =>
      Effect.gen(function* () {
        const status = yield* checkOpenClawProviderStatus({
          enabled: true,
          gatewayUrl: "https://127.0.0.1:1/path?token=must-not-leak",
          authMode: "none",
          hasSecret: false,
          paired: false,
        });
        assert.strictEqual(status.provider, "openclaw");
        assert.strictEqual(status.status, "error");
        assert.strictEqual(status.available, false);
        assert.match(status.message ?? "", /gateway is unreachable/);
        assert.strictEqual(/probing is not configured/.test(status.message ?? ""), false);
        assert.strictEqual(/must-not-leak/.test(status.message ?? ""), false);
      }).pipe(Effect.provide(openClawSecretLayer)),
    );

    it.effect("reports pairing needed when device mode is not paired", () =>
      Effect.gen(function* () {
        const status = yield* makeCheckOpenClawProviderStatus({
          enabled: true,
          gatewayUrl: "https://gateway.example.test",
          authMode: "device",
          hasSecret: false,
          paired: false,
        });
        assert.strictEqual(status.status, "warning");
        assert.strictEqual(status.available, false);
        assert.strictEqual(status.authStatus, "unauthenticated");
        assert.match(status.message ?? "", /pairing is required/);
      }).pipe(Effect.provide(openClawSecretLayer)),
    );

    it.effect("reports unauthenticated when token mode has no stored secret", () =>
      Effect.gen(function* () {
        const status = yield* makeCheckOpenClawProviderStatus({
          enabled: true,
          gatewayUrl: "https://gateway.example.test",
          authMode: "token",
          hasSecret: false,
          paired: false,
        });
        assert.strictEqual(status.status, "error");
        assert.strictEqual(status.available, false);
        assert.strictEqual(status.authStatus, "unauthenticated");
        assert.match(status.message ?? "", /token secret is not configured/);
      }).pipe(Effect.provide(openClawSecretLayer)),
    );

    it.effect("reports unreachable when the gateway probe fails", () =>
      Effect.gen(function* () {
        const status = yield* makeCheckOpenClawProviderStatus(
          {
            enabled: true,
            gatewayUrl: "https://user:pass@gateway.example.test/path?token=must-not-leak",
            authMode: "none",
            hasSecret: false,
            paired: false,
          },
          { probe: () => Effect.fail(new Error("connection refused token=must-not-leak")) },
        );
        assert.strictEqual(status.status, "error");
        assert.strictEqual(status.available, false);
        assert.strictEqual(status.authStatus, "unknown");
        assert.match(status.message ?? "", /unreachable/);
        assert.match(status.message ?? "", /connection refused/);
        assert.strictEqual(/must-not-leak|user:pass/.test(status.message ?? ""), false);
      }).pipe(Effect.provide(openClawSecretLayer)),
    );

    it.effect("reports unsupported when required chat methods are missing", () =>
      Effect.gen(function* () {
        const status = yield* makeCheckOpenClawProviderStatus(
          {
            enabled: true,
            gatewayUrl: "https://gateway.example.test",
            authMode: "none",
            hasSecret: false,
            paired: false,
          },
          { probe: () => Effect.succeed({ methods: ["chat.history"] }) },
        );
        assert.strictEqual(status.status, "warning");
        assert.strictEqual(status.available, false);
        assert.strictEqual(status.authStatus, "authenticated");
        assert.match(status.message ?? "", /chat\.send/);
        assert.match(status.message ?? "", /chat\.abort/);
      }).pipe(Effect.provide(openClawSecretLayer)),
    );

    it.effect("reports protocol mismatch when the gateway protocol is outside v1 support", () =>
      Effect.gen(function* () {
        const status = yield* makeCheckOpenClawProviderStatus(
          {
            enabled: true,
            gatewayUrl: "https://gateway.example.test",
            authMode: "none",
            hasSecret: false,
            paired: false,
          },
          {
            probe: () =>
              Effect.succeed({
                methods: ["chat.history", "chat.send", "chat.abort"],
                protocolVersion: 5,
              }),
          },
        );
        assert.strictEqual(status.status, "warning");
        assert.strictEqual(status.available, false);
        assert.strictEqual(status.authStatus, "unknown");
        assert.match(status.message ?? "", /protocol/i);
      }).pipe(Effect.provide(openClawSecretLayer)),
    );

    it.effect("rejects public insecure WebSocket gateway URLs", () =>
      Effect.gen(function* () {
        const status = yield* makeCheckOpenClawProviderStatus({
          enabled: true,
          gatewayUrl: "ws://gateway.example.test/path?token=must-not-leak",
          authMode: "none",
          hasSecret: false,
          paired: false,
        });
        assert.strictEqual(status.status, "error");
        assert.strictEqual(status.available, false);
        assert.strictEqual(status.authStatus, "unknown");
        assert.match(status.message ?? "", /requires wss/);
        assert.strictEqual(/must-not-leak/.test(status.message ?? ""), false);
      }).pipe(Effect.provide(openClawSecretLayer)),
    );
  });

  describe("isExternalOpenCodeRuntimeActive", () => {
    it("does not treat the default OpenCode CLI runtime as external", () => {
      assert.strictEqual(isExternalOpenCodeRuntimeActive(DEFAULT_SERVER_SETTINGS), false);
    });

    it("detects an active external OpenCode runtime profile", () => {
      assert.strictEqual(
        isExternalOpenCodeRuntimeActive({
          ...DEFAULT_SERVER_SETTINGS,
          providers: {
            ...DEFAULT_SERVER_SETTINGS.providers,
            opencode: {
              ...DEFAULT_SERVER_SETTINGS.providers.opencode,
              activeRuntimeProfileId: "external",
              runtimeProfiles: [
                {
                  id: "external",
                  label: "Jay Battlestation OpenCode",
                  provider: "opencode",
                  mode: "external",
                  serverUrl: "http://127.0.0.1:4096",
                  configMode: "inherit",
                  skillRoots: [],
                  pluginRoots: [],
                  requiredCommands: [],
                  requiredSkills: [],
                  requiredPlugins: [],
                  requiredAgents: [],
                  requiredModels: [],
                  requiredEnv: [],
                  requirements: [],
                  capabilityPolicy: "warn",
                },
              ],
            },
          },
        }),
        true,
      );
    });

    it("detects a legacy external OpenCode server URL", () => {
      assert.strictEqual(
        isExternalOpenCodeRuntimeActive({
          ...DEFAULT_SERVER_SETTINGS,
          providers: {
            ...DEFAULT_SERVER_SETTINGS.providers,
            opencode: {
              ...DEFAULT_SERVER_SETTINGS.providers.opencode,
              serverUrl: "http://127.0.0.1:4096",
            },
          },
        }),
        true,
      );
    });
  });

  describe("checkKiloProviderStatus", () => {
    it.effect("uses configured Kilo binary for version probe", () =>
      Effect.gen(function* () {
        const status = yield* makeCheckKiloProviderStatus("/custom/bin/kilo");
        assert.strictEqual(status.status, "ready");
      }).pipe(
        Effect.provide(
          mockSpawnerLayer((args, command) => {
            assert.strictEqual(command, "/custom/bin/kilo");
            const joined = args.join(" ");
            if (joined === "--version") return { stdout: "kilo 7.2.52\n", stderr: "", code: 0 };
            throw new Error(`Unexpected args: ${joined}`);
          }),
        ),
      ),
    );
  });

  describe("checkCursorProviderStatus", () => {
    it.effect("returns ready when Cursor Agent is installed", () =>
      Effect.gen(function* () {
        const status = yield* checkCursorProviderStatus;
        assert.strictEqual(status.provider, "cursor");
        assert.strictEqual(status.status, "ready");
        assert.strictEqual(status.available, true);
        assert.strictEqual(status.authStatus, "unknown");
      }).pipe(
        Effect.provide(
          mockSpawnerLayer((args) => {
            const joined = args.join(" ");
            if (joined === "--version") {
              return { stdout: "agent 2026.04.27\n", stderr: "", code: 0 };
            }
            throw new Error(`Unexpected args: ${joined}`);
          }),
        ),
      ),
    );

    it.effect("uses configured Cursor Agent binary for version probe", () =>
      Effect.gen(function* () {
        const status = yield* makeCheckCursorProviderStatus("/custom/bin/agent");
        assert.strictEqual(status.status, "ready");
      }).pipe(
        Effect.provide(
          mockSpawnerLayer((args, command) => {
            assert.strictEqual(command, "/custom/bin/agent");
            const joined = args.join(" ");
            if (joined === "--version") {
              return { stdout: "agent 2026.04.27\n", stderr: "", code: 0 };
            }
            throw new Error(`Unexpected args: ${joined}`);
          }),
        ),
      ),
    );

    it.effect("returns unavailable when Cursor Agent is missing", () =>
      Effect.gen(function* () {
        const status = yield* checkCursorProviderStatus;
        assert.strictEqual(status.provider, "cursor");
        assert.strictEqual(status.status, "error");
        assert.strictEqual(status.available, false);
        assert.strictEqual(status.authStatus, "unknown");
        assert.strictEqual(
          status.message,
          "Cursor Agent CLI (`agent`) is not installed or not on PATH.",
        );
      }).pipe(Effect.provide(failingSpawnerLayer("spawn agent ENOENT"))),
    );

    it.effect("returns unavailable when Cursor Agent exits with an error", () =>
      Effect.gen(function* () {
        const status = yield* checkCursorProviderStatus;
        assert.strictEqual(status.provider, "cursor");
        assert.strictEqual(status.status, "error");
        assert.strictEqual(status.available, false);
        assert.strictEqual(status.authStatus, "unknown");
        assert.strictEqual(
          status.message,
          "Cursor Agent CLI is installed but failed to run. version failed",
        );
      }).pipe(
        Effect.provide(
          mockSpawnerLayer((args) => {
            const joined = args.join(" ");
            if (joined === "--version") {
              return { stdout: "", stderr: "version failed\n", code: 1 };
            }
            throw new Error(`Unexpected args: ${joined}`);
          }),
        ),
      ),
    );
  });

  // ── provider update command tests ──────────────────────────────────

  describe("updateProvider", () => {
    it.effect("runs provider update commands through a shell on Windows", () => {
      const calls: Array<{
        command: string;
        args: ReadonlyArray<string>;
        shell: ChildProcess.CommandOptions["shell"];
      }> = [];

      return withProcessPlatform(
        "win32",
        Effect.gen(function* () {
          const providerHealth = yield* ProviderHealth;
          const result = yield* providerHealth.updateProvider({ provider: "cursor" });

          assert.strictEqual(result.providers.length, 0);
          assert.deepStrictEqual(calls, [
            {
              command: "agent",
              args: ["update"],
              shell: true,
            },
          ]);
        }).pipe(
          Effect.provide(ProviderHealthLive),
          Effect.provide(ServerSettingsService.layerTest()),
          Effect.provide(
            ServerConfig.layerTest(process.cwd(), { prefix: "jcode-provider-health-" }),
          ),
          Effect.provide(openClawSecretLayer),
          Effect.provide(
            mockSpawnerLayer((args, command, options) => {
              calls.push({ command, args, shell: options.shell });
              return { stdout: "", stderr: "update failed\n", code: 1 };
            }),
          ),
        ),
      );
    });
  });

  // ── parseClaudeAuthStatusFromOutput pure tests ────────────────────

  describe("parseClaudeAuthStatusFromOutput", () => {
    it("exit code 0 with no auth markers is ready", () => {
      const parsed = parseClaudeAuthStatusFromOutput({ stdout: "OK\n", stderr: "", code: 0 });
      assert.strictEqual(parsed.status, "ready");
      assert.strictEqual(parsed.authStatus, "authenticated");
    });

    it("JSON with loggedIn=true is authenticated", () => {
      const parsed = parseClaudeAuthStatusFromOutput({
        stdout: '{"loggedIn":true,"authMethod":"claude.ai"}\n',
        stderr: "",
        code: 0,
      });
      assert.strictEqual(parsed.status, "ready");
      assert.strictEqual(parsed.authStatus, "authenticated");
    });

    it("JSON with loggedIn=false is unauthenticated", () => {
      const parsed = parseClaudeAuthStatusFromOutput({
        stdout: '{"loggedIn":false}\n',
        stderr: "",
        code: 0,
      });
      assert.strictEqual(parsed.status, "error");
      assert.strictEqual(parsed.authStatus, "unauthenticated");
    });

    it("JSON without auth marker is warning", () => {
      const parsed = parseClaudeAuthStatusFromOutput({
        stdout: '{"ok":true}\n',
        stderr: "",
        code: 0,
      });
      assert.strictEqual(parsed.status, "warning");
      assert.strictEqual(parsed.authStatus, "unknown");
    });
  });
});
