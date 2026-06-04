import * as NodeServices from "@effect/platform-node/NodeServices";
import { spawnSync } from "node:child_process";
import { describe, expect } from "vitest";
import { it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";

import { ProjectLanguageIconResolver } from "../Services/ProjectLanguageIconResolver";
import { ProjectLanguageIconResolverLive } from "./ProjectLanguageIconResolver";

const TestLayer = Layer.empty.pipe(
  Layer.provideMerge(ProjectLanguageIconResolverLive),
  Layer.provideMerge(NodeServices.layer),
);

const makeTempDir = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  return yield* fileSystem.makeTempDirectoryScoped({ prefix: "jcode-project-language-icon-" });
});

const writeTextFile = Effect.fn(function* (cwd: string, relativePath: string, contents: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(cwd, relativePath);
  yield* fileSystem
    .makeDirectory(path.dirname(absolutePath), { recursive: true })
    .pipe(Effect.orDie);
  yield* fileSystem.writeFileString(absolutePath, contents).pipe(Effect.orDie);
});

it.layer(TestLayer)("ProjectLanguageIconResolverLive", (it) => {
  describe("resolveMetadata", () => {
    it.effect("detects TypeScript from a root tsconfig", () =>
      Effect.gen(function* () {
        const resolver = yield* ProjectLanguageIconResolver;
        const cwd = yield* makeTempDir;
        yield* writeTextFile(cwd, "tsconfig.json", "{}");

        const resolved = yield* resolver.resolveMetadata(cwd);

        expect(resolved).toEqual({ iconId: "typescript", label: "TypeScript" });
      }),
    );

    it.effect("detects TypeScript monorepos from a root tsconfig.base.json", () =>
      Effect.gen(function* () {
        const resolver = yield* ProjectLanguageIconResolver;
        const cwd = yield* makeTempDir;
        yield* writeTextFile(cwd, "tsconfig.base.json", "{}");

        const resolved = yield* resolver.resolveMetadata(cwd);

        expect(resolved).toEqual({ iconId: "typescript", label: "TypeScript" });
      }),
    );

    it.effect("prefers Vue over generic TypeScript when root package metadata includes Vue", () =>
      Effect.gen(function* () {
        const resolver = yield* ProjectLanguageIconResolver;
        const cwd = yield* makeTempDir;
        yield* writeTextFile(cwd, "tsconfig.json", "{}");
        yield* writeTextFile(
          cwd,
          "package.json",
          JSON.stringify({ dependencies: { vue: "^3.0.0" } }),
        );

        const resolved = yield* resolver.resolveMetadata(cwd);

        expect(resolved).toEqual({ iconId: "vue", label: "Vue" });
      }),
    );

    it.effect("detects Python from tracked scripts and tests when root manifests are absent", () =>
      Effect.gen(function* () {
        const resolver = yield* ProjectLanguageIconResolver;
        const cwd = yield* makeTempDir;
        yield* writeTextFile(cwd, "README.md", "RedOps operating notes");
        yield* writeTextFile(cwd, "scripts/redops_state_query.py", "print('state')");
        yield* writeTextFile(cwd, "scripts/sync_redops_state.py", "print('sync')");
        yield* writeTextFile(cwd, "tests/test_sync_redops_state.py", "def test_sync(): pass");

        const resolved = yield* resolver.resolveMetadata(cwd);

        expect(resolved).toEqual({ iconId: "python", label: "Python" });
      }),
    );

    it.effect("prefers Git tracked files before bounded directory sampling", () =>
      Effect.gen(function* () {
        const resolver = yield* ProjectLanguageIconResolver;
        const cwd = yield* makeTempDir;
        yield* writeTextFile(cwd, "README.md", "Repository notes");
        yield* writeTextFile(cwd, "tools/redops_profile.py", "print('profile')");
        spawnSync("git", ["init"], { cwd, stdio: "ignore" });
        spawnSync("git", ["add", "README.md", "tools/redops_profile.py"], { cwd, stdio: "ignore" });

        const resolved = yield* resolver.resolveMetadata(cwd);

        expect(resolved).toEqual({ iconId: "python", label: "Python" });
      }),
    );

    it.effect("honors root .gitattributes language overrides during repository profiling", () =>
      Effect.gen(function* () {
        const resolver = yield* ProjectLanguageIconResolver;
        const cwd = yield* makeTempDir;
        yield* writeTextFile(cwd, ".gitattributes", "tools/*.txt linguist-language=Python\n");
        yield* writeTextFile(cwd, "tools/redops_profile.txt", "print('profile')");
        spawnSync("git", ["init"], { cwd, stdio: "ignore" });
        spawnSync("git", ["add", ".gitattributes", "tools/redops_profile.txt"], {
          cwd,
          stdio: "ignore",
        });

        const resolved = yield* resolver.resolveMetadata(cwd);

        expect(resolved).toEqual({ iconId: "python", label: "Python" });
      }),
    );

    it.effect("does not inspect nested project files", () =>
      Effect.gen(function* () {
        const resolver = yield* ProjectLanguageIconResolver;
        const cwd = yield* makeTempDir;
        yield* writeTextFile(cwd, "nested/tsconfig.json", "{}");

        const resolved = yield* resolver.resolveMetadata(cwd);

        expect(resolved).toBeNull();
      }),
    );

    it.effect("returns null when no bounded marker is present", () =>
      Effect.gen(function* () {
        const resolver = yield* ProjectLanguageIconResolver;
        const cwd = yield* makeTempDir;

        const resolved = yield* resolver.resolveMetadata(cwd);

        expect(resolved).toBeNull();
      }),
    );
  });
});
