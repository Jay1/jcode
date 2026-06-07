import type { ProviderCredentialInfo } from "@jcode/contracts";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Path } from "effect";
import { describe, it, assert } from "@effect/vitest";

import {
  checkEnvVarCredentials,
  deriveStatus,
  PROVIDER_CREDENTIAL_SPECS,
  resolveBinaryPath,
  scanAllProviders,
} from "./providerCredentialScan";

const makeEmptyEnv = (): NodeJS.ProcessEnv => ({});

const makeEnvWith = (entries: Record<string, string>): NodeJS.ProcessEnv => ({ ...entries });

describe("checkEnvVarCredentials", () => {
  it("reports found when env var is set and non-empty", () => {
    const env = makeEnvWith({ ANTHROPIC_API_KEY: "sk-test-123" });
    const result = checkEnvVarCredentials(["ANTHROPIC_API_KEY"], env);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]!.found, true);
    assert.strictEqual(result[0]!.key, "ANTHROPIC_API_KEY");
    assert.strictEqual(result[0]!.source, "env-var");
  });

  it("reports not-found when env var is missing", () => {
    const result = checkEnvVarCredentials(["OPENAI_API_KEY"], makeEmptyEnv());
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]!.found, false);
  });

  it("reports not-found when env var is empty string", () => {
    const env = makeEnvWith({ GOOGLE_API_KEY: "" });
    const result = checkEnvVarCredentials(["GOOGLE_API_KEY"], env);
    assert.strictEqual(result[0]!.found, false);
  });

  it("checks multiple env vars independently", () => {
    const env = makeEnvWith({ GOOGLE_API_KEY: "AIza..." });
    const result = checkEnvVarCredentials(["GOOGLE_API_KEY", "GEMINI_API_KEY"], env);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0]!.found, true);
    assert.strictEqual(result[1]!.found, false);
  });
});

describe("deriveStatus", () => {
  it("returns ready when credentials and binary both present", () => {
    assert.strictEqual(deriveStatus(true, true), "ready");
  });

  it("returns needs-config when binary present but no credentials", () => {
    assert.strictEqual(deriveStatus(false, true), "needs-config");
  });

  it("returns not-installed when no binary present", () => {
    assert.strictEqual(deriveStatus(true, false), "not-installed");
    assert.strictEqual(deriveStatus(false, false), "not-installed");
  });
});

describe("resolveBinaryPath", () => {
  it("finds binary in PATH", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const tempDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "jcode-scan-test-",
      });
      yield* fileSystem.writeFile(
        `${tempDir}/codex`,
        new TextEncoder().encode("#!/bin/sh\necho ok"),
      );

      const result = yield* resolveBinaryPath("codex", {
        env: { PATH: tempDir },
        platform: "linux",
      });

      assert.strictEqual(result.found, true);
      if (result.found) {
        assert.strictEqual(result.path, `${tempDir}/codex`);
      }
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)));

  it("reports not found when binary absent from PATH", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const tempDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "jcode-scan-empty-",
      });

      const result = yield* resolveBinaryPath("codex", {
        env: { PATH: tempDir },
        platform: "linux",
      });

      assert.strictEqual(result.found, false);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)));

  it("handles empty PATH", () =>
    Effect.gen(function* () {
      const result = yield* resolveBinaryPath("codex", {
        env: {},
        platform: "linux",
      });

      assert.strictEqual(result.found, false);
    }).pipe(Effect.provide(NodeServices.layer)));
});

describe("scanAllProviders", () => {
  it("returns all providers as not-installed with no env and empty PATH", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const tempDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "jcode-scan-none-",
      });

      const result = yield* scanAllProviders({
        env: { HOME: tempDir, PATH: tempDir },
        platform: "linux",
        homeDir: tempDir,
      });

      assert.strictEqual(result.providers.length, 7);
      for (const p of result.providers) {
        assert.strictEqual(p.hasBinary, false, `${p.provider} should have no binary`);
        assert.strictEqual(p.status, "not-installed", `${p.provider} should be not-installed`);
      }
      assert.ok(result.scannedAt.length > 0);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)));

  it("detects codex as not-installed with API key but no binary", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const tempDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "jcode-scan-key-",
      });

      const result = yield* scanAllProviders({
        env: {
          HOME: tempDir,
          PATH: tempDir,
          OPENAI_API_KEY: "sk-test-key",
        },
        platform: "linux",
        homeDir: tempDir,
      });

      const codex = result.providers.find((p) => p.provider === "codex")!;
      assert.strictEqual(codex.status, "not-installed");
      assert.strictEqual(codex.hasCredentials, true);
      assert.strictEqual(codex.hasBinary, false);
      const keyCred = codex.credentials.find(
        (c: ProviderCredentialInfo) => c.key === "OPENAI_API_KEY",
      )!;
      assert.strictEqual(keyCred.found, true);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)));

  it("detects claudeAgent as ready with API key and binary in PATH", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const tempDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "jcode-scan-ready-",
      });
      yield* fileSystem.writeFile(
        `${tempDir}/claude`,
        new TextEncoder().encode("#!/bin/sh\necho ok"),
      );

      const result = yield* scanAllProviders({
        env: {
          HOME: tempDir,
          PATH: tempDir,
          ANTHROPIC_API_KEY: "sk-ant-test",
        },
        platform: "linux",
        homeDir: tempDir,
      });

      const claude = result.providers.find((p) => p.provider === "claudeAgent")!;
      assert.strictEqual(claude.status, "ready");
      assert.strictEqual(claude.hasCredentials, true);
      assert.strictEqual(claude.hasBinary, true);
      assert.ok(claude.binaryPath!.includes("claude"));
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)));

  it("detects opencode config dir credentials", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const tempDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "jcode-scan-config-",
      });
      const path = yield* Path.Path;
      const configDir = path.join(tempDir, ".config", "opencode");
      yield* fileSystem.makeDirectory(configDir, { recursive: true });

      yield* fileSystem.writeFile(
        `${tempDir}/opencode`,
        new TextEncoder().encode("#!/bin/sh\necho ok"),
      );

      const result = yield* scanAllProviders({
        env: { HOME: tempDir, PATH: tempDir },
        platform: "linux",
        homeDir: tempDir,
      });

      const opencode = result.providers.find((p) => p.provider === "opencode")!;
      assert.strictEqual(opencode.hasCredentials, true);
      assert.strictEqual(opencode.hasBinary, true);
      assert.strictEqual(opencode.status, "ready");
      const configCred = opencode.credentials.find(
        (c: ProviderCredentialInfo) => c.source === "config-dir",
      )!;
      assert.strictEqual(configCred.found, true);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)));

  it("handles mixed provider states across all providers", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const tempDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "jcode-scan-mixed-",
      });

      yield* fileSystem.writeFile(
        `${tempDir}/gemini`,
        new TextEncoder().encode("#!/bin/sh\necho ok"),
      );

      const result = yield* scanAllProviders({
        env: {
          HOME: tempDir,
          PATH: tempDir,
          ANTHROPIC_API_KEY: "sk-ant-test",
          GOOGLE_API_KEY: "AIza-test",
        },
        platform: "linux",
        homeDir: tempDir,
      });

      const claude = result.providers.find((p) => p.provider === "claudeAgent")!;
      assert.strictEqual(claude.status, "not-installed");
      assert.strictEqual(claude.hasCredentials, true);
      assert.strictEqual(claude.hasBinary, false);

      const gemini = result.providers.find((p) => p.provider === "gemini")!;
      assert.strictEqual(gemini.status, "ready");
      assert.strictEqual(gemini.hasCredentials, true);
      assert.strictEqual(gemini.hasBinary, true);

      const codex = result.providers.find((p) => p.provider === "codex")!;
      assert.strictEqual(codex.status, "not-installed");
      assert.strictEqual(codex.hasCredentials, false);
      assert.strictEqual(codex.hasBinary, false);

      const cursor = result.providers.find((p) => p.provider === "cursor")!;
      assert.strictEqual(cursor.status, "not-installed");
      assert.strictEqual(cursor.hasCredentials, false);
      assert.strictEqual(cursor.hasBinary, false);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)));
});

describe("PROVIDER_CREDENTIAL_SPECS", () => {
  it("covers all 7 providers", () => {
    const providers = PROVIDER_CREDENTIAL_SPECS.map((s) => s.provider);
    assert.deepStrictEqual(providers.sort(), [
      "claudeAgent",
      "codex",
      "cursor",
      "gemini",
      "kilo",
      "opencode",
      "pi",
    ]);
  });
});
