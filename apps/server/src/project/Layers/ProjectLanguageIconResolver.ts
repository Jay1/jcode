import { Effect, FileSystem, Layer, Path } from "effect";
import type { ProjectIconMetadata } from "@jcode/contracts";

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

  const readRootPackageJson = Effect.fn(function* (cwd: string) {
    const source = yield* fileSystem
      .readFileString(path.join(cwd, "package.json"))
      .pipe(Effect.catch(() => Effect.succeed(null)));
    if (source === null) return null;
    try {
      return JSON.parse(source) as unknown;
    } catch {
      return null;
    }
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

      return null;
    },
  );

  return { resolveMetadata } satisfies ProjectLanguageIconResolverShape;
});

export const ProjectLanguageIconResolverLive = Layer.effect(
  ProjectLanguageIconResolver,
  makeProjectLanguageIconResolver,
);
