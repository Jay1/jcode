import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect } from "vitest";
import { it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";

import { ProjectFaviconResolver } from "../Services/ProjectFaviconResolver";
import { ProjectFaviconResolverLive } from "./ProjectFaviconResolver";

const TestLayer = Layer.empty.pipe(
  Layer.provideMerge(ProjectFaviconResolverLive),
  Layer.provideMerge(NodeServices.layer),
);

const makeTempDir = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  return yield* fileSystem.makeTempDirectoryScoped({ prefix: "jcode-project-favicon-" });
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

it.layer(TestLayer)("ProjectFaviconResolverLive", (it) => {
  describe("resolvePath", () => {
    it.effect("prefers well-known favicon files", () =>
      Effect.gen(function* () {
        const resolver = yield* ProjectFaviconResolver;
        const cwd = yield* makeTempDir;
        yield* writeTextFile(cwd, "favicon.svg", "<svg>favicon</svg>");

        const resolved = yield* resolver.resolvePath(cwd);

        expect(resolved).not.toBeNull();
        expect(resolved).toContain("favicon.svg");
      }),
    );

    it.effect("resolves icon hrefs from project source files", () =>
      Effect.gen(function* () {
        const resolver = yield* ProjectFaviconResolver;
        const cwd = yield* makeTempDir;
        yield* writeTextFile(cwd, "index.html", '<link rel="icon" href="/brand/logo.svg">');
        yield* writeTextFile(cwd, "public/brand/logo.svg", "<svg>brand</svg>");

        const resolved = yield* resolver.resolvePath(cwd);

        expect(resolved).not.toBeNull();
        expect(resolved).toContain("public/brand/logo.svg");
      }),
    );

    it.effect("returns null when no icon is present", () =>
      Effect.gen(function* () {
        const resolver = yield* ProjectFaviconResolver;
        const cwd = yield* makeTempDir;

        const resolved = yield* resolver.resolvePath(cwd);

        expect(resolved).toBeNull();
      }),
    );

    it.effect("resolves icon from root manifest.json", () =>
      Effect.gen(function* () {
        const resolver = yield* ProjectFaviconResolver;
        const cwd = yield* makeTempDir;
        yield* writeTextFile(
          cwd,
          "manifest.json",
          JSON.stringify({
            icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
          }),
        );
        yield* writeTextFile(cwd, "public/icon-192.png", "png-data");

        const resolved = yield* resolver.resolvePath(cwd);

        expect(resolved).not.toBeNull();
        expect(resolved).toContain("public/icon-192.png");
      }),
    );

    it.effect("resolves icon from public/manifest.webmanifest", () =>
      Effect.gen(function* () {
        const resolver = yield* ProjectFaviconResolver;
        const cwd = yield* makeTempDir;
        yield* writeTextFile(
          cwd,
          "public/manifest.webmanifest",
          JSON.stringify({
            icons: [{ src: "icons/logo.svg", sizes: "any", type: "image/svg+xml" }],
          }),
        );
        yield* writeTextFile(cwd, "public/icons/logo.svg", "<svg>logo</svg>");

        const resolved = yield* resolver.resolvePath(cwd);

        expect(resolved).not.toBeNull();
        expect(resolved).toContain("public/icons/logo.svg");
      }),
    );

    it.effect("prefers SVG icons from manifest over PNG", () =>
      Effect.gen(function* () {
        const resolver = yield* ProjectFaviconResolver;
        const cwd = yield* makeTempDir;
        yield* writeTextFile(
          cwd,
          "manifest.json",
          JSON.stringify({
            icons: [
              { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
              { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
            ],
          }),
        );
        yield* writeTextFile(cwd, "public/icon-512.png", "png-data");
        yield* writeTextFile(cwd, "public/icon.svg", "<svg>icon</svg>");

        const resolved = yield* resolver.resolvePath(cwd);

        expect(resolved).not.toBeNull();
        expect(resolved).toContain("public/icon.svg");
      }),
    );

    it.effect("skips manifest when icons array is empty", () =>
      Effect.gen(function* () {
        const resolver = yield* ProjectFaviconResolver;
        const cwd = yield* makeTempDir;
        yield* writeTextFile(cwd, "manifest.json", JSON.stringify({ icons: [] }));

        const resolved = yield* resolver.resolvePath(cwd);

        expect(resolved).toBeNull();
      }),
    );

    it.effect("skips manifest when file exceeds size cap", () =>
      Effect.gen(function* () {
        const resolver = yield* ProjectFaviconResolver;
        const cwd = yield* makeTempDir;
        const largeIcons = Array.from({ length: 5000 }, (_, i) => ({
          src: `/icon-${i}.png`,
          sizes: "192x192",
          type: "image/png",
        }));
        yield* writeTextFile(cwd, "manifest.json", JSON.stringify({ icons: largeIcons }));

        const resolved = yield* resolver.resolvePath(cwd);

        expect(resolved).toBeNull();
      }),
    );

    it.effect("does not recursively scan directories for manifests", () =>
      Effect.gen(function* () {
        const resolver = yield* ProjectFaviconResolver;
        const cwd = yield* makeTempDir;
        yield* writeTextFile(
          cwd,
          "deep/nested/manifest.json",
          JSON.stringify({
            icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
          }),
        );
        yield* writeTextFile(cwd, "deep/nested/icon.svg", "<svg>deep</svg>");

        const resolved = yield* resolver.resolvePath(cwd);

        expect(resolved).toBeNull();
      }),
    );

    it.effect("prefers well-known favicon files over manifest icons", () =>
      Effect.gen(function* () {
        const resolver = yield* ProjectFaviconResolver;
        const cwd = yield* makeTempDir;
        yield* writeTextFile(cwd, "favicon.svg", "<svg>direct</svg>");
        yield* writeTextFile(
          cwd,
          "manifest.json",
          JSON.stringify({
            icons: [{ src: "/manifest-icon.png", type: "image/png" }],
          }),
        );
        yield* writeTextFile(cwd, "manifest-icon.png", "fake-png");

        const resolved = yield* resolver.resolvePath(cwd);

        expect(resolved).not.toBeNull();
        expect(resolved).toContain("favicon.svg");
      }),
    );
  });
});
