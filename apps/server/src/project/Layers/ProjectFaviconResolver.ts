import { Effect, FileSystem, Layer, Path } from "effect";

import {
  ProjectFaviconResolver,
  type ProjectFaviconResolverShape,
} from "../Services/ProjectFaviconResolver";

const FAVICON_CANDIDATES = [
  "favicon.svg",
  "favicon.ico",
  "favicon.png",
  "public/favicon.svg",
  "public/favicon.ico",
  "public/favicon.png",
  "app/favicon.ico",
  "app/favicon.png",
  "app/icon.svg",
  "app/icon.png",
  "app/icon.ico",
  "src/favicon.ico",
  "src/favicon.svg",
  "src/app/favicon.ico",
  "src/app/icon.svg",
  "src/app/icon.png",
  "assets/icon.svg",
  "assets/icon.png",
  "assets/logo.svg",
  "assets/logo.png",
] as const;

const ICON_SOURCE_FILES = [
  "index.html",
  "public/index.html",
  "app/routes/__root.tsx",
  "src/routes/__root.tsx",
  "app/root.tsx",
  "src/root.tsx",
  "src/index.html",
] as const;

const MANIFEST_CANDIDATES = [
  "manifest.json",
  "manifest.webmanifest",
  "public/manifest.json",
  "public/manifest.webmanifest",
  "app/manifest.json",
  "app/manifest.webmanifest",
  "src/manifest.json",
  "static/manifest.json",
] as const;

const MANIFEST_MAX_BYTES = 128 * 1024;

const LINK_ICON_HTML_RE =
  /<link\b(?=[^>]*\brel=["'](?:icon|shortcut icon)["'])(?=[^>]*\bhref=["']([^"'?]+))[^>]*>/i;
const LINK_ICON_OBJ_RE =
  /(?=[^}]*\brel\s*:\s*["'](?:icon|shortcut icon)["'])(?=[^}]*\bhref\s*:\s*["']([^"'?]+))[^}]*/i;

function extractIconHref(source: string): string | null {
  const htmlMatch = source.match(LINK_ICON_HTML_RE);
  if (htmlMatch?.[1]) return htmlMatch[1];
  const objMatch = source.match(LINK_ICON_OBJ_RE);
  if (objMatch?.[1]) return objMatch[1];
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractManifestIconSrcs(manifestText: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(manifestText);
  } catch {
    return [];
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.icons)) {
    return [];
  }
  const icons: Array<{ src: string; score: number }> = [];
  for (const icon of parsed.icons) {
    if (isRecord(icon) && typeof icon.src === "string" && icon.src.length > 0) {
      const ext = icon.src.split(".").pop()?.toLowerCase() ?? "";
      const type = typeof icon.type === "string" ? icon.type.toLowerCase() : "";
      const sizes = typeof icon.sizes === "string" ? icon.sizes : "";
      let score = 0;
      // Prefer SVG (highest), then PNG, then ICO, then unknown.
      if (type.includes("svg") || ext === "svg") {
        score = 3000;
      } else if (type.includes("png") || ext === "png") {
        score = 2000;
      } else if (type.includes("ico") || ext === "ico") {
        score = 1000;
      }
      // Add size bonus: prefer larger icons. "any" gets max bonus.
      if (sizes === "any") {
        score += 999;
      } else if (sizes) {
        const firstSize = sizes.split(/\s*x\s*/i)[0];
        const numericSize = Number.parseInt(firstSize ?? "0", 10);
        if (Number.isFinite(numericSize) && numericSize > 0) {
          score += Math.min(numericSize, 999);
        }
      }
      icons.push({ src: icon.src, score });
    }
  }
  icons.sort((a, b) => b.score - a.score);
  return icons.map((icon) => icon.src);
}

export const makeProjectFaviconResolver = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const resolveIconHref = (projectCwd: string, href: string): string[] => {
    const clean = href.replace(/^\//, "");
    return [path.join(projectCwd, "public", clean), path.join(projectCwd, clean)];
  };

  const isPathWithinProject = (projectCwd: string, candidatePath: string): boolean => {
    const relative = path.relative(path.resolve(projectCwd), path.resolve(candidatePath));
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  };

  const findExistingFile = Effect.fn(function* (
    projectCwd: string,
    candidates: ReadonlyArray<string>,
  ) {
    for (const candidate of candidates) {
      if (!isPathWithinProject(projectCwd, candidate)) {
        continue;
      }
      const stats = yield* fileSystem
        .stat(candidate)
        .pipe(Effect.catch(() => Effect.succeed(null)));
      if (stats?.type === "File") {
        return candidate;
      }
    }
    return null;
  });

  const resolvePath: ProjectFaviconResolverShape["resolvePath"] = Effect.fn(function* (cwd) {
    for (const candidate of FAVICON_CANDIDATES) {
      const existing = yield* findExistingFile(cwd, [path.join(cwd, candidate)]);
      if (existing) {
        return existing;
      }
    }

    for (const manifestFile of MANIFEST_CANDIDATES) {
      const manifestPath = path.join(cwd, manifestFile);
      const manifestStat = yield* fileSystem
        .stat(manifestPath)
        .pipe(Effect.catch(() => Effect.succeed(null)));
      if (manifestStat?.type !== "File") {
        continue;
      }
      if (manifestStat.size > MANIFEST_MAX_BYTES) {
        continue;
      }
      const manifestText = yield* fileSystem
        .readFileString(manifestPath)
        .pipe(Effect.catch(() => Effect.succeed(null)));
      if (!manifestText) {
        continue;
      }
      const srcs = extractManifestIconSrcs(manifestText);
      if (srcs.length === 0) {
        continue;
      }
      const resolved = yield* findExistingFile(
        cwd,
        srcs.flatMap((src) => resolveIconHref(cwd, src)),
      );
      if (resolved) {
        return resolved;
      }
    }

    for (const sourceFile of ICON_SOURCE_FILES) {
      const sourcePath = path.join(cwd, sourceFile);
      const source = yield* fileSystem
        .readFileString(sourcePath)
        .pipe(Effect.catch(() => Effect.succeed(null)));
      if (!source) {
        continue;
      }
      const href = extractIconHref(source);
      if (!href) {
        continue;
      }
      const existing = yield* findExistingFile(cwd, resolveIconHref(cwd, href));
      if (existing) {
        return existing;
      }
    }

    return null;
  });

  return { resolvePath } satisfies ProjectFaviconResolverShape;
});

export const ProjectFaviconResolverLive = Layer.effect(
  ProjectFaviconResolver,
  makeProjectFaviconResolver,
);
