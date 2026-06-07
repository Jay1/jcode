import type { GitHubRelease, GitHubReleaseAsset, ManagedRuntimePlatform } from "@jcode/contracts";
import { Data, Effect, FileSystem, Path, Schema } from "effect";
import * as Crypto from "node:crypto";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class ManagedRuntimeDownloadError extends Data.TaggedError("ManagedRuntimeDownloadError")<{
  readonly stage: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

export const detectManagedRuntimePlatform = (
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): ManagedRuntimePlatform => {
  if (platform === "win32") return "win-x64";
  if (platform === "linux") return "linux-x64";
  if (platform === "darwin" && arch === "arm64") return "darwin-arm64";
  if (platform === "darwin") return "darwin-x64";
  return "linux-x64";
};

// ---------------------------------------------------------------------------
// Managed runtime directory
// ---------------------------------------------------------------------------

export const resolveManagedRuntimeDir = Effect.gen(function* () {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;

  const platform = process.platform;
  const home = process.env["HOME"] ?? process.env["USERPROFILE"] ?? "";

  let dir: string;
  if (platform === "win32") {
    const localAppData = process.env["LOCALAPPDATA"] ?? path.join(home, "AppData", "Local");
    dir = path.join(localAppData, "JCode", "runtime");
  } else if (platform === "darwin") {
    dir = path.join(home, "Library", "Application Support", "JCode", "runtime");
  } else {
    const xdgData = process.env["XDG_DATA_HOME"] ?? path.join(home, ".local", "share");
    dir = path.join(xdgData, "jcode", "runtime");
  }

  yield* fs
    .makeDirectory(dir, { recursive: true })
    .pipe(
      Effect.catchTag("PlatformError", (err) =>
        err.reason._tag === "AlreadyExists" ? Effect.void : Effect.fail(err),
      ),
    );

  return dir;
});

// ---------------------------------------------------------------------------
// Asset name matching
// ---------------------------------------------------------------------------

const PLATFORM_ASSET_PATTERNS: Record<
  ManagedRuntimePlatform,
  ReadonlyArray<(name: string) => boolean>
> = {
  "win-x64": [
    (name) => /windows/i.test(name) && /(x86_64|x64)/i.test(name),
    (name) => /windows/i.test(name) && name.endsWith(".exe"),
  ],
  "linux-x64": [
    (name) => /linux/i.test(name) && /(x86_64|x64)/i.test(name),
    (name) => /linux/i.test(name) && !/arm64|aarch64/i.test(name),
  ],
  "darwin-arm64": [(name) => /darwin|macos|mac/i.test(name) && /(arm64|aarch64)/i.test(name)],
  "darwin-x64": [
    (name) => /darwin|macos|mac/i.test(name) && /(x86_64|x64)/i.test(name),
    (name) => /darwin|macos|mac/i.test(name) && !/arm64|aarch64/i.test(name),
  ],
};

export const findAssetForPlatform = (
  release: GitHubRelease,
  targetPlatform: ManagedRuntimePlatform,
): GitHubReleaseAsset | null => {
  const patterns = PLATFORM_ASSET_PATTERNS[targetPlatform];
  for (const asset of release.assets) {
    for (const matches of patterns) {
      if (matches(asset.name)) return asset;
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// GitHub release fetch
// ---------------------------------------------------------------------------

const GITHUB_RELEASES_URL = "https://api.github.com/repos/anomalyco/opencode/releases/latest";

const GitHubReleaseApiResponse = Schema.Struct({
  tag_name: Schema.String,
  name: Schema.optional(Schema.String),
  assets: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      browser_download_url: Schema.String,
      size: Schema.Number,
    }),
  ),
});

export const fetchLatestOpenCodeRelease = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient;

  const response = yield* HttpClientRequest.get(GITHUB_RELEASES_URL).pipe(
    HttpClientRequest.setHeader("Accept", "application/vnd.github+json"),
    HttpClientRequest.setHeader("User-Agent", "JCode-ManagedRuntime"),
    client.execute,
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.mapError(
      (err) =>
        new ManagedRuntimeDownloadError({
          stage: "fetch",
          message: `Failed to fetch latest OpenCode release: ${String(err)}`,
          cause: err,
        }),
    ),
  );

  const rawBody = yield* response.json.pipe(
    Effect.mapError(
      (err) =>
        new ManagedRuntimeDownloadError({
          stage: "fetch",
          message: `Failed to parse GitHub release response: ${String(err)}`,
          cause: err,
        }),
    ),
  );

  const parsed = yield* Schema.decodeUnknownEffect(GitHubReleaseApiResponse)(rawBody).pipe(
    Effect.mapError(
      (err) =>
        new ManagedRuntimeDownloadError({
          stage: "fetch",
          message: `GitHub release response schema mismatch: ${String(err)}`,
          cause: err,
        }),
    ),
  );

  const mappedAssets: ReadonlyArray<GitHubReleaseAsset> = parsed.assets.map((asset) => ({
    name: asset.name,
    browserDownloadUrl: asset.browser_download_url,
    size: asset.size,
  }));

  return {
    tagName: parsed.tag_name,
    name: parsed.name ?? undefined,
    assets: mappedAssets,
  } satisfies GitHubRelease;
});

// ---------------------------------------------------------------------------
// SHA-256 helpers
// ---------------------------------------------------------------------------

export const computeFileSha256 = (filePath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const fileBytes = yield* fs.readFile(filePath).pipe(
      Effect.mapError(
        (err) =>
          new ManagedRuntimeDownloadError({
            stage: "verify",
            message: `Failed to read file for SHA-256: ${String(err)}`,
            cause: err,
          }),
      ),
    );
    const hash = Crypto.createHash("sha256").update(fileBytes).digest("hex");
    return hash;
  });

// ---------------------------------------------------------------------------
// Download pipeline
// ---------------------------------------------------------------------------

export const downloadManagedRuntime = Effect.gen(function* () {
  const platform = detectManagedRuntimePlatform();
  const release = yield* fetchLatestOpenCodeRelease;
  const asset = findAssetForPlatform(release, platform);

  if (!asset) {
    yield* Effect.fail(
      new ManagedRuntimeDownloadError({
        stage: "resolve-asset",
        message: `No matching asset found for platform "${platform}" in release ${release.tagName}`,
      }),
    );
    return undefined as never;
  }

  const runtimeDir = yield* resolveManagedRuntimeDir;
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;

  const binaryName = platform === "win-x64" ? "opencode.exe" : "opencode";
  const finalPath = path.join(runtimeDir, binaryName);
  const tempPath = `${finalPath}.download`;

  const client = yield* HttpClient.HttpClient;
  const response = yield* HttpClientRequest.get(asset.browserDownloadUrl).pipe(
    client.execute,
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.mapError(
      (err) =>
        new ManagedRuntimeDownloadError({
          stage: "download",
          message: `Failed to download binary: ${String(err)}`,
          cause: err,
        }),
    ),
  );

  const bodyBytes = yield* response.arrayBuffer.pipe(
    Effect.map((buffer) => new Uint8Array(buffer)),
    Effect.mapError(
      (err) =>
        new ManagedRuntimeDownloadError({
          stage: "download",
          message: `Failed to read download body: ${String(err)}`,
          cause: err,
        }),
    ),
  );

  yield* fs.writeFile(tempPath, bodyBytes).pipe(
    Effect.mapError(
      (err) =>
        new ManagedRuntimeDownloadError({
          stage: "download",
          message: `Failed to write temp binary: ${String(err)}`,
          cause: err,
        }),
    ),
  );

  const actualHash = yield* computeFileSha256(tempPath);

  if (asset.digest && asset.digest !== actualHash) {
    yield* fs.remove(tempPath).pipe(Effect.orDie);
    yield* Effect.fail(
      new ManagedRuntimeDownloadError({
        stage: "verify",
        message: `SHA-256 mismatch: expected ${asset.digest}, got ${actualHash}`,
      }),
    );
    return undefined as never;
  }

  const existingExists = yield* fs.exists(finalPath).pipe(Effect.orDie);
  if (existingExists) {
    yield* fs.remove(finalPath).pipe(
      Effect.mapError(
        (err) =>
          new ManagedRuntimeDownloadError({
            stage: "replace",
            message: `Failed to remove existing binary: ${String(err)}`,
            cause: err,
          }),
      ),
    );
  }

  yield* fs.rename(tempPath, finalPath).pipe(
    Effect.mapError(
      (err) =>
        new ManagedRuntimeDownloadError({
          stage: "install",
          message: `Failed to move binary to final location: ${String(err)}`,
          cause: err,
        }),
    ),
  );

  if (process.platform !== "win32") {
    yield* fs.chmod(finalPath, 0o755).pipe(
      Effect.mapError(
        (err) =>
          new ManagedRuntimeDownloadError({
            stage: "install",
            message: `Failed to set executable permission: ${String(err)}`,
            cause: err,
          }),
      ),
    );
  }

  return { binaryPath: finalPath, version: release.tagName, sha256: actualHash };
});

// ---------------------------------------------------------------------------
// Binary verification
// ---------------------------------------------------------------------------

export interface ManagedRuntimeBinaryValidation {
  readonly exists: boolean;
  readonly sha256: string | null;
  readonly expectedSha256: string | null;
  readonly valid: boolean;
}

export const verifyManagedRuntimeBinary = (expectedSha256?: string, binaryPath?: string) =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    const runtimeDir = yield* resolveManagedRuntimeDir;

    const platform = detectManagedRuntimePlatform();
    const binaryName = platform === "win-x64" ? "opencode.exe" : "opencode";
    const resolvedPath = binaryPath ?? path.join(runtimeDir, binaryName);

    const exists = yield* fs.exists(resolvedPath).pipe(Effect.orDie);

    if (!exists) {
      return {
        exists: false,
        sha256: null,
        expectedSha256: expectedSha256 ?? null,
        valid: false,
      } satisfies ManagedRuntimeBinaryValidation;
    }

    const actualHash = yield* computeFileSha256(resolvedPath);
    const expected = expectedSha256 ?? null;
    const valid = expected !== null ? actualHash === expected : true;

    return {
      exists: true,
      sha256: actualHash,
      expectedSha256: expected,
      valid,
    } satisfies ManagedRuntimeBinaryValidation;
  });
