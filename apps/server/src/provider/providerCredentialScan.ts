import type { ProviderDiscoveryKind } from "@jcode/contracts";
import nodePath from "node:path";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import type {
  ProviderCredentialInfo,
  ProviderScanAllResult,
  ProviderScanResult,
  ProviderScanStatus,
} from "@jcode/contracts";

interface ProviderCredentialSpec {
  readonly provider: ProviderDiscoveryKind;
  readonly binaryName: string;
  readonly envVars: ReadonlyArray<string>;
  readonly configDirs: ReadonlyArray<string>;
}

const PROVIDER_CREDENTIAL_SPECS: ReadonlyArray<ProviderCredentialSpec> = [
  {
    provider: "codex",
    binaryName: "codex",
    envVars: ["OPENAI_API_KEY"],
    configDirs: [],
  },
  {
    provider: "claudeAgent",
    binaryName: "claude",
    envVars: ["ANTHROPIC_API_KEY"],
    configDirs: [".claude"],
  },
  {
    provider: "cursor",
    binaryName: "agent",
    envVars: [],
    configDirs: [],
  },
  {
    provider: "devin",
    binaryName: "devin",
    envVars: ["DEVIN_API_KEY"],
    configDirs: [],
  },
  {
    provider: "gemini",
    binaryName: "gemini",
    envVars: ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
    configDirs: [],
  },
  {
    provider: "kilo",
    binaryName: "kilo",
    envVars: ["KILO_API_KEY"],
    configDirs: [],
  },
  {
    provider: "opencode",
    binaryName: "opencode",
    envVars: [],
    configDirs: [".config/opencode"],
  },
  {
    provider: "openclaw",
    binaryName: "openclaw",
    envVars: [],
    configDirs: [],
  },
  {
    provider: "pi",
    binaryName: "pi",
    envVars: [],
    configDirs: [],
  },
];

const WINDOWS_EXECUTABLE_EXTENSIONS = ["", ".exe", ".cmd", ".bat"] as const;

function dequotePathEntry(entry: string): string {
  const trimmed = entry.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

interface ScanProviderOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
  readonly homeDir?: string;
  readonly binaryExists?: (path: string) => Effect.Effect<boolean, never, never>;
}

const checkEnvVarCredentials = (
  envVars: ReadonlyArray<string>,
  env: NodeJS.ProcessEnv,
): ReadonlyArray<ProviderCredentialInfo> =>
  envVars.map((key) => ({
    source: "env-var" as const,
    key,
    found: typeof env[key] === "string" && env[key]!.length > 0,
  }));

const checkConfigDirCredentials = (
  configDirs: ReadonlyArray<string>,
  homeDir: string,
): Effect.Effect<ReadonlyArray<ProviderCredentialInfo>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    if (configDirs.length === 0) {
      return [];
    }
    const path = yield* Path.Path;
    const fileSystem = yield* FileSystem.FileSystem;

    return yield* Effect.all(
      configDirs.map((dir) =>
        Effect.gen(function* () {
          const fullPath = path.join(homeDir, dir);
          const exists = yield* fileSystem.exists(fullPath).pipe(Effect.orElseSucceed(() => false));
          return {
            source: "config-dir" as const,
            key: `~/${dir}`,
            found: exists,
          } satisfies ProviderCredentialInfo;
        }),
      ),
      { concurrency: "unbounded" },
    );
  });

const resolveBinaryPath = (
  binaryName: string,
  options: ScanProviderOptions,
): Effect.Effect<
  | { readonly found: true; readonly path: string }
  | { readonly found: false; readonly path: undefined },
  never,
  FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const platform = options.platform ?? process.platform;
    const pathEnv = (options.env?.PATH ?? process.env.PATH ?? "").trim();
    const separator = platform === "win32" ? ";" : ":";
    const pathEntries = pathEnv.split(separator).map(dequotePathEntry).filter(Boolean);
    const joinPath = platform === "win32" ? nodePath.win32.join : nodePath.posix.join;
    const binaryExists =
      options.binaryExists ??
      ((fullPath: string) =>
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          return yield* fileSystem.exists(fullPath).pipe(Effect.orElseSucceed(() => false));
        }));
    const executableCandidates =
      platform === "win32"
        ? WINDOWS_EXECUTABLE_EXTENSIONS.map((ext) => `${binaryName}${ext}`)
        : [binaryName];

    for (const entry of pathEntries) {
      for (const candidate of executableCandidates) {
        const fullPath = joinPath(entry, candidate);
        const exists = yield* binaryExists(fullPath);
        if (exists) {
          return { found: true, path: fullPath } as const;
        }
      }
    }

    return { found: false, path: undefined } as const;
  });

const deriveStatus = (hasCredentials: boolean, hasBinary: boolean): ProviderScanStatus => {
  if (hasCredentials && hasBinary) {
    return "ready";
  }
  if (hasBinary) {
    return "needs-config";
  }
  return "not-installed";
};

const scanSingleProvider = (
  spec: ProviderCredentialSpec,
  options: ScanProviderOptions,
): Effect.Effect<ProviderScanResult, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const env = options.env ?? process.env;
    const homeDir = options.homeDir ?? process.env.HOME ?? process.env.USERPROFILE ?? "/tmp";

    const envCredentials = checkEnvVarCredentials(spec.envVars, env);
    const configCredentials = yield* checkConfigDirCredentials(spec.configDirs, homeDir);
    const allCredentials = [...envCredentials, ...configCredentials];
    const hasCredentials = allCredentials.some((c) => c.found);

    const binaryResult = yield* resolveBinaryPath(spec.binaryName, options);
    const hasBinary = binaryResult.found;
    const status = deriveStatus(hasCredentials, hasBinary);

    return {
      provider: spec.provider,
      status,
      hasCredentials,
      credentials: allCredentials,
      hasBinary,
      binaryPath: binaryResult.found ? binaryResult.path : undefined,
      version: undefined,
    } satisfies ProviderScanResult;
  });

export const scanAllProviders = (
  options?: ScanProviderOptions,
): Effect.Effect<ProviderScanAllResult, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const resolvedOptions: ScanProviderOptions = options ?? {};
    const providers = yield* Effect.all(
      PROVIDER_CREDENTIAL_SPECS.map((spec) => scanSingleProvider(spec, resolvedOptions)),
      { concurrency: "unbounded" },
    );

    return {
      providers,
      scannedAt: DateTime.formatIso(yield* DateTime.now),
    } satisfies ProviderScanAllResult;
  });

export {
  PROVIDER_CREDENTIAL_SPECS,
  checkEnvVarCredentials,
  checkConfigDirCredentials,
  resolveBinaryPath,
  deriveStatus,
};
export type { ProviderCredentialSpec, ScanProviderOptions };
