import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "vitest";
import { Effect, FileSystem, Path } from "effect";

import type { GitHubRelease } from "@jcode/contracts";

import {
  computeFileSha256,
  detectManagedRuntimePlatform,
  findAssetForPlatform,
  resolveManagedRuntimeDir,
  verifyManagedRuntimeBinary,
} from "./managedRuntimeDownload";

const makeMockRelease = (assets: ReadonlyArray<{ name: string; size: number }>): GitHubRelease => ({
  tagName: "v1.0.0",
  name: "OpenCode v1.0.0",
  assets: assets.map((a) => ({
    name: a.name,
    browserDownloadUrl: `https://github.com/anomalyco/opencode/releases/download/v1.0.0/${a.name}`,
    size: a.size,
  })),
});

const MOCK_BINARY_CONTENT = new TextEncoder().encode("#!/bin/sh\necho opencode");

describe("detectManagedRuntimePlatform", () => {
  it("returns linux-x64 for linux", () => {
    expect(detectManagedRuntimePlatform("linux", "x64")).toBe("linux-x64");
  });

  it("returns darwin-arm64 for darwin arm64", () => {
    expect(detectManagedRuntimePlatform("darwin", "arm64")).toBe("darwin-arm64");
  });

  it("returns darwin-x64 for darwin x64", () => {
    expect(detectManagedRuntimePlatform("darwin", "x64")).toBe("darwin-x64");
  });

  it("returns win-x64 for win32", () => {
    expect(detectManagedRuntimePlatform("win32", "x64")).toBe("win-x64");
  });

  it("defaults to linux-x64 for unknown platform", () => {
    expect(detectManagedRuntimePlatform("freebsd", "x64")).toBe("linux-x64");
  });
});

describe("findAssetForPlatform", () => {
  const release = makeMockRelease([
    { name: "opencode-v1.0.0-darwin-arm64", size: 100 },
    { name: "opencode-v1.0.0-darwin-x86_64", size: 100 },
    { name: "opencode-v1.0.0-linux-x86_64", size: 100 },
    { name: "opencode-v1.0.0-windows-x86_64.exe", size: 100 },
  ]);

  it("finds darwin-arm64 asset", () => {
    const asset = findAssetForPlatform(release, "darwin-arm64");
    expect(asset?.name).toBe("opencode-v1.0.0-darwin-arm64");
  });

  it("finds darwin-x64 asset", () => {
    const asset = findAssetForPlatform(release, "darwin-x64");
    expect(asset?.name).toBe("opencode-v1.0.0-darwin-x86_64");
  });

  it("finds linux-x64 asset", () => {
    const asset = findAssetForPlatform(release, "linux-x64");
    expect(asset?.name).toBe("opencode-v1.0.0-linux-x86_64");
  });

  it("finds win-x64 asset", () => {
    const asset = findAssetForPlatform(release, "win-x64");
    expect(asset?.name).toBe("opencode-v1.0.0-windows-x86_64.exe");
  });

  it("returns null when no asset matches", () => {
    const emptyRelease = makeMockRelease([{ name: "readme.txt", size: 10 }]);
    const asset = findAssetForPlatform(emptyRelease, "linux-x64");
    expect(asset).toBeNull();
  });

  it("matches macOS naming variants", () => {
    const macosRelease = makeMockRelease([
      { name: "opencode-macos-arm64", size: 100 },
      { name: "opencode-mac-x64", size: 100 },
    ]);
    expect(findAssetForPlatform(macosRelease, "darwin-arm64")?.name).toBe("opencode-macos-arm64");
    expect(findAssetForPlatform(macosRelease, "darwin-x64")?.name).toBe("opencode-mac-x64");
  });
});

describe("resolveManagedRuntimeDir", () => {
  it("resolves and creates the runtime directory", () =>
    Effect.gen(function* () {
      const dir = yield* resolveManagedRuntimeDir;
      expect(dir).toContain("runtime");
      const fileSystem = yield* FileSystem.FileSystem;
      const exists = yield* fileSystem.exists(dir);
      expect(exists).toBe(true);
    }).pipe(Effect.provide(NodeServices.layer)));
});

describe("computeFileSha256", () => {
  it("computes deterministic SHA-256 for content", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempDir = yield* fs.makeTempDirectoryScoped({
        prefix: "t3-managed-runtime-sha-",
      });
      const filePath = path.join(tempDir, "test-binary");
      yield* fs.writeFile(filePath, MOCK_BINARY_CONTENT);
      const hash = yield* computeFileSha256(filePath);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)));
});

describe("verifyManagedRuntimeBinary", () => {
  it("reports non-existent binary as invalid", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const result = yield* verifyManagedRuntimeBinary(
        "abc123",
        path.join("/nonexistent/path/opencode"),
      );
      expect(result.exists).toBe(false);
      expect(result.valid).toBe(false);
    }).pipe(Effect.provide(NodeServices.layer)));

  it("verifies SHA-256 of existing binary", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempDir = yield* fs.makeTempDirectoryScoped({
        prefix: "t3-managed-runtime-verify-",
      });
      const binaryPath = path.join(tempDir, "opencode");
      yield* fs.writeFile(binaryPath, MOCK_BINARY_CONTENT);
      const hash = yield* computeFileSha256(binaryPath);
      const validResult = yield* verifyManagedRuntimeBinary(hash, binaryPath);
      const invalidResult = yield* verifyManagedRuntimeBinary("wronghash", binaryPath);
      expect(validResult.valid).toBe(true);
      expect(validResult.sha256).toBe(hash);
      expect(invalidResult.valid).toBe(false);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)));

  it("treats existing binary without expected hash as valid", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempDir = yield* fs.makeTempDirectoryScoped({
        prefix: "t3-managed-runtime-nohash-",
      });
      const binaryPath = path.join(tempDir, "opencode");
      yield* fs.writeFile(binaryPath, MOCK_BINARY_CONTENT);
      const result = yield* verifyManagedRuntimeBinary(undefined, binaryPath);
      expect(result.exists).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.sha256).toBeTruthy();
      expect(result.expectedSha256).toBeNull();
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)));
});
