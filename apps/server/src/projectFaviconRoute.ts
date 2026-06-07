import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const FAVICON_MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const FALLBACK_FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#6b728080" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-fallback="project-favicon"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"/></svg>`;

// Well-known favicon paths checked in order.
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
];

// Files that may contain a <link rel="icon"> or icon metadata declaration.
const ICON_SOURCE_FILES = [
  "index.html",
  "public/index.html",
  "app/routes/__root.tsx",
  "src/routes/__root.tsx",
  "app/root.tsx",
  "src/root.tsx",
  "src/index.html",
];

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

// Matches <link ...> tags or object-like icon metadata where rel/href can appear in any order.
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
      if (type.includes("svg") || ext === "svg") {
        score = 3000;
      } else if (type.includes("png") || ext === "png") {
        score = 2000;
      } else if (type.includes("ico") || ext === "ico") {
        score = 1000;
      }
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

function resolveIconHref(projectCwd: string, href: string): string[] {
  const clean = href.replace(/^\//, "");
  return [path.join(projectCwd, "public", clean), path.join(projectCwd, clean)];
}

function isPathWithinProject(projectCwd: string, candidatePath: string): boolean {
  const relative = path.relative(path.resolve(projectCwd), path.resolve(candidatePath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function serveFaviconFile(filePath: string, res: http.ServerResponse): void {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = FAVICON_MIME_TYPES[ext] ?? "application/octet-stream";
  fs.readFile(filePath, (readErr, data) => {
    if (readErr) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Read error");
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    });
    res.end(data);
  });
}

function serveFallbackFavicon(res: http.ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=3600",
  });
  res.end(FALLBACK_FAVICON_SVG);
}

function serveNoContent(res: http.ServerResponse): void {
  res.writeHead(204, {
    "Cache-Control": "public, max-age=3600",
  });
  res.end();
}

export function tryHandleProjectFaviconRequest(url: URL, res: http.ServerResponse): boolean {
  if (url.pathname !== "/api/project-favicon") {
    return false;
  }

  const projectCwd = url.searchParams.get("cwd");
  if (!projectCwd) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Missing cwd parameter");
    return true;
  }

  const shouldServeFallback = url.searchParams.get("fallback") !== "none";

  const tryResolvedPaths = (paths: string[], index: number, onExhausted: () => void): void => {
    if (index >= paths.length) {
      onExhausted();
      return;
    }
    const candidate = paths[index]!;
    if (!isPathWithinProject(projectCwd, candidate)) {
      tryResolvedPaths(paths, index + 1, onExhausted);
      return;
    }
    fs.stat(candidate, (err, stats) => {
      if (err || !stats?.isFile()) {
        tryResolvedPaths(paths, index + 1, onExhausted);
        return;
      }
      serveFaviconFile(candidate, res);
    });
  };

  const tryManifestIconSrcs = (
    manifestPath: string,
    srcs: string[],
    srcIndex: number,
    onExhausted: () => void,
  ): void => {
    if (srcIndex >= srcs.length) {
      onExhausted();
      return;
    }
    const candidates = resolveIconHref(projectCwd, srcs[srcIndex]!);
    tryResolvedPaths(candidates, 0, () =>
      tryManifestIconSrcs(manifestPath, srcs, srcIndex + 1, onExhausted),
    );
  };

  const tryManifests = (index: number, onExhausted: () => void): void => {
    if (index >= MANIFEST_CANDIDATES.length) {
      onExhausted();
      return;
    }
    const manifestPath = path.join(projectCwd, MANIFEST_CANDIDATES[index]!);
    if (!isPathWithinProject(projectCwd, manifestPath)) {
      tryManifests(index + 1, onExhausted);
      return;
    }
    fs.stat(manifestPath, (statErr, stats) => {
      if (statErr || !stats?.isFile() || stats.size > MANIFEST_MAX_BYTES) {
        tryManifests(index + 1, onExhausted);
        return;
      }
      fs.readFile(manifestPath, "utf8", (readErr, content) => {
        if (readErr) {
          tryManifests(index + 1, onExhausted);
          return;
        }
        const srcs = extractManifestIconSrcs(content);
        if (srcs.length === 0) {
          tryManifests(index + 1, onExhausted);
          return;
        }
        tryManifestIconSrcs(manifestPath, srcs, 0, () => tryManifests(index + 1, onExhausted));
      });
    });
  };

  const trySourceFiles = (index: number, onExhausted: () => void): void => {
    if (index >= ICON_SOURCE_FILES.length) {
      onExhausted();
      return;
    }
    const sourceFile = path.join(projectCwd, ICON_SOURCE_FILES[index]!);
    fs.readFile(sourceFile, "utf8", (err, content) => {
      if (err) {
        trySourceFiles(index + 1, onExhausted);
        return;
      }
      const href = extractIconHref(content);
      if (!href) {
        trySourceFiles(index + 1, onExhausted);
        return;
      }
      const candidates = resolveIconHref(projectCwd, href);
      tryResolvedPaths(candidates, 0, () => trySourceFiles(index + 1, onExhausted));
    });
  };

  const tryCandidates = (index: number): void => {
    if (index >= FAVICON_CANDIDATES.length) {
      tryManifests(0, () =>
        trySourceFiles(0, () => {
          if (shouldServeFallback) {
            serveFallbackFavicon(res);
            return;
          }
          serveNoContent(res);
        }),
      );
      return;
    }
    const candidate = path.join(projectCwd, FAVICON_CANDIDATES[index]!);
    if (!isPathWithinProject(projectCwd, candidate)) {
      tryCandidates(index + 1);
      return;
    }
    fs.stat(candidate, (err, stats) => {
      if (err || !stats?.isFile()) {
        tryCandidates(index + 1);
        return;
      }
      serveFaviconFile(candidate, res);
    });
  };

  tryCandidates(0);
  return true;
}
