import { Effect, FileSystem, Layer, Path, Schema } from "effect";
import { spawnSync } from "node:child_process";
import { ProjectIconMetadata } from "@jcode/contracts";
import {
  analyzeRepositoryLanguages,
  inferProjectIconMetadata,
  type ProjectIconMetadataLike,
} from "@jcode/jcode-linguist";

import {
  ProjectLanguageIconResolver,
  type ProjectLanguageIconResolverShape,
} from "../Services/ProjectLanguageIconResolver";

const TYPESCRIPT_METADATA: ProjectIconMetadata = {
  iconId: "typescript",
  label: "TypeScript",
};

const VUE_METADATA: ProjectIconMetadata = {
  iconId: "vue",
  label: "Vue",
};

const ROOT_TYPESCRIPT_MARKERS = [
  "tsconfig.json",
  "tsconfig.base.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
] as const;

const PROFILE_SCAN_ROOT_DIRS = [
  "app",
  "apps",
  "packages",
  "scripts",
  "src",
  "test",
  "tests",
] as const;
const PROFILE_SCAN_MAX_FILES = 1_200;
const PROFILE_SCAN_MAX_DEPTH = 4;
const GIT_LS_FILES_TIMEOUT_MS = 750;
const ROOT_METADATA_MAX_BYTES = 128 * 1024;

type RepositoryFileSampleForResolver = { path: string; sizeBytes: number; text?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function packageHasDependency(packageJson: unknown, dependencyName: string): boolean {
  if (!isRecord(packageJson)) return false;
  const dependencyGroups = [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.peerDependencies,
  ];
  return dependencyGroups.some(
    (group) => isRecord(group) && typeof group[dependencyName] === "string",
  );
}

function toProjectIconMetadata(
  inferred: ProjectIconMetadataLike | null,
): ProjectIconMetadata | null {
  if (!inferred) {
    return null;
  }
  const label = inferred.label.trim();
  if (label.length === 0) {
    return null;
  }
  const candidate = {
    iconId: inferred.iconId,
    label,
  } satisfies { readonly iconId: ProjectIconMetadata["iconId"]; readonly label: string };
  try {
    return Schema.decodeUnknownSync(ProjectIconMetadata)(candidate) satisfies ProjectIconMetadata;
  } catch {
    return null;
  }
}

export const makeProjectLanguageIconResolver = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const rootFileExists = Effect.fn(function* (cwd: string, fileName: string) {
    const stats = yield* fileSystem
      .stat(path.join(cwd, fileName))
      .pipe(Effect.catch(() => Effect.succeed(null)));
    return stats?.type === "File";
  });

  const hasRootFile = Effect.fn(function* (cwd: string, fileNames: readonly string[]) {
    for (const fileName of fileNames) {
      if (yield* rootFileExists(cwd, fileName)) {
        return true;
      }
    }
    return false;
  });

  const readRootTextFileIfSmall = Effect.fn(function* (cwd: string, fileName: string) {
    const absolutePath = path.join(cwd, fileName);
    const stats = yield* fileSystem
      .stat(absolutePath)
      .pipe(Effect.catch(() => Effect.succeed(null)));
    if (stats?.type !== "File" || Number(stats.size) > ROOT_METADATA_MAX_BYTES) {
      return null;
    }
    return yield* fileSystem
      .readFileString(absolutePath)
      .pipe(Effect.catch(() => Effect.succeed(null)));
  });

  const readRootPackageJson = Effect.fn(function* (cwd: string) {
    const source = yield* readRootTextFileIfSmall(cwd, "package.json");
    if (source === null) return null;
    try {
      return JSON.parse(source) as unknown;
    } catch {
      return null;
    }
  });

  const readRootGitAttributes = Effect.fn(function* (cwd: string) {
    return (yield* readRootTextFileIfSmall(cwd, ".gitattributes")) ?? undefined;
  });

  const listGitTrackedFiles = (cwd: string): Effect.Effect<string[]> =>
    Effect.sync(() => {
      const result = spawnSync("git", ["-C", cwd, "ls-files", "-z"], {
        encoding: "utf8",
        maxBuffer: 512 * 1024,
        timeout: GIT_LS_FILES_TIMEOUT_MS,
      });
      if (result.status !== 0 || result.error || result.stdout.length === 0) {
        return [] as string[];
      }
      return result.stdout
        .split("\0")
        .filter((entry) => entry.length > 0)
        .slice(0, PROFILE_SCAN_MAX_FILES);
    }).pipe(Effect.catch(() => Effect.succeed([] as string[])));

  const collectRepositoryFiles = (cwd: string): Effect.Effect<RepositoryFileSampleForResolver[]> =>
    Effect.gen(function* () {
      const files: RepositoryFileSampleForResolver[] = [];
      const seen = new Set<string>();

      const addFile = (relativePath: string): Effect.Effect<void> =>
        Effect.gen(function* () {
          if (seen.has(relativePath) || files.length >= PROFILE_SCAN_MAX_FILES) {
            return;
          }
          seen.add(relativePath);
          const absolutePath = path.join(cwd, relativePath);
          const stats = yield* fileSystem
            .stat(absolutePath)
            .pipe(Effect.catch(() => Effect.succeed(null)));
          if (stats?.type !== "File") {
            return;
          }
          const text =
            relativePath === "package.json"
              ? ((yield* readRootTextFileIfSmall(cwd, "package.json")) ?? undefined)
              : undefined;
          files.push({
            path: relativePath,
            sizeBytes: Number(stats.size),
            ...(text ? { text } : {}),
          });
        });

      const gitTrackedFiles = yield* listGitTrackedFiles(cwd);
      for (const relativePath of gitTrackedFiles) {
        yield* addFile(relativePath);
      }
      if (files.length > 0) {
        return files;
      }

      const walkDirectory = (relativeDir: string, depth: number): Effect.Effect<void> =>
        Effect.gen(function* () {
          if (files.length >= PROFILE_SCAN_MAX_FILES || depth > PROFILE_SCAN_MAX_DEPTH) {
            return;
          }
          const absoluteDir = relativeDir.length > 0 ? path.join(cwd, relativeDir) : cwd;
          const entries = yield* fileSystem
            .readDirectory(absoluteDir)
            .pipe(Effect.catch(() => Effect.succeed([])));
          for (const entry of entries.sort()) {
            if (entry.startsWith(".")) {
              continue;
            }
            const relativePath = relativeDir.length > 0 ? path.join(relativeDir, entry) : entry;
            const stats = yield* fileSystem
              .stat(path.join(cwd, relativePath))
              .pipe(Effect.catch(() => Effect.succeed(null)));
            if (stats?.type === "File") {
              yield* addFile(relativePath);
            } else if (stats?.type === "Directory") {
              yield* walkDirectory(relativePath, depth + 1);
            }
            if (files.length >= PROFILE_SCAN_MAX_FILES) {
              return;
            }
          }
        });

      const rootEntries = yield* fileSystem
        .readDirectory(cwd)
        .pipe(Effect.catch(() => Effect.succeed([])));
      for (const entry of rootEntries.sort()) {
        const relativePath = entry;
        const stats = yield* fileSystem
          .stat(path.join(cwd, relativePath))
          .pipe(Effect.catch(() => Effect.succeed(null)));
        if (stats?.type === "File") {
          yield* addFile(relativePath);
        }
      }

      for (const rootDir of PROFILE_SCAN_ROOT_DIRS) {
        const stats = yield* fileSystem
          .stat(path.join(cwd, rootDir))
          .pipe(Effect.catch(() => Effect.succeed(null)));
        if (stats?.type === "Directory") {
          yield* walkDirectory(rootDir, 1);
        }
      }

      return files;
    });

  const resolveMetadata: ProjectLanguageIconResolverShape["resolveMetadata"] = Effect.fn(
    function* (cwd) {
      const packageJson = yield* readRootPackageJson(cwd);
      if (packageHasDependency(packageJson, "vue")) {
        return VUE_METADATA;
      }

      if (yield* hasRootFile(cwd, ROOT_TYPESCRIPT_MARKERS)) {
        return TYPESCRIPT_METADATA;
      }

      const files = yield* collectRepositoryFiles(cwd);
      const attributesText = yield* readRootGitAttributes(cwd);
      const profile = analyzeRepositoryLanguages({
        files,
        ...(attributesText !== undefined ? { attributesText } : {}),
      });
      return toProjectIconMetadata(inferProjectIconMetadata(profile));
    },
  );

  return { resolveMetadata } satisfies ProjectLanguageIconResolverShape;
});

export const ProjectLanguageIconResolverLive = Layer.effect(
  ProjectLanguageIconResolver,
  makeProjectLanguageIconResolver,
);
