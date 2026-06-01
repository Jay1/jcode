// FILE: ProjectSidebarIcon.tsx
// Purpose: Render the standard project identity icon with optional language metadata and favicon badge fallback.
// Layer: Sidebar UI component
// Exports: ProjectSidebarIcon

import type { ProjectIconId, ProjectIconMetadata } from "@jcode/contracts";
import { useEffect, useState } from "react";
import { HiOutlineFolderOpen } from "react-icons/hi2";
import { FolderClosed } from "./FolderClosed";

const projectFaviconPresence = new Map<string, boolean>();

const PROJECT_ICON_GLYPHS: Record<ProjectIconId, string> = {
  go: "Go",
  javascript: "JS",
  python: "Py",
  react: "R",
  rust: "Rs",
  svelte: "S",
  typescript: "TS",
  vue: "V",
};

interface ProjectSidebarIconProps {
  cwd: string;
  expanded: boolean;
  iconMetadata?: ProjectIconMetadata | null;
  className?: string;
}

function resolveServerHttpOrigin(): string {
  if (typeof window === "undefined") return "";

  const bridgeWsUrl = window.desktopBridge?.getWsUrl?.();
  const envWsUrl = import.meta.env.VITE_WS_URL as string | undefined;
  const wsCandidate =
    typeof bridgeWsUrl === "string" && bridgeWsUrl.length > 0
      ? bridgeWsUrl
      : typeof envWsUrl === "string" && envWsUrl.length > 0
        ? envWsUrl
        : null;

  if (!wsCandidate) return window.location.origin;

  try {
    const wsUrl = new URL(wsCandidate);
    const protocol =
      wsUrl.protocol === "wss:" ? "https:" : wsUrl.protocol === "ws:" ? "http:" : wsUrl.protocol;
    return `${protocol}//${wsUrl.host}`;
  } catch {
    return window.location.origin;
  }
}

function resolveProjectFaviconUrl(cwd: string): string {
  const origin = resolveServerHttpOrigin();
  const url =
    origin.length > 0
      ? new URL("/api/project-favicon", origin)
      : new URL("/api/project-favicon", "http://localhost");
  url.searchParams.set("cwd", cwd);
  url.searchParams.set("fallback", "none");
  return origin.length > 0 ? url.toString() : `${url.pathname}${url.search}`;
}

export function ProjectSidebarIcon({
  cwd,
  expanded,
  iconMetadata = null,
  className = "size-4",
}: ProjectSidebarIconProps) {
  const faviconSrc = resolveProjectFaviconUrl(cwd);
  const shouldUseFavicon = iconMetadata === null;
  const [hasFavicon, setHasFavicon] = useState<boolean>(
    () => shouldUseFavicon && projectFaviconPresence.get(faviconSrc) === true,
  );
  const FolderGlyph = expanded ? HiOutlineFolderOpen : FolderClosed;

  // Probe with Image() so Electron/file-origin behaves like the actual visible <img>.
  useEffect(() => {
    if (!shouldUseFavicon) {
      setHasFavicon(false);
      return;
    }

    const cached = projectFaviconPresence.get(faviconSrc);
    if (cached !== undefined) {
      setHasFavicon(cached);
      return;
    }

    let cancelled = false;
    const image = new Image();
    const handleLoad = () => {
      projectFaviconPresence.set(faviconSrc, true);
      if (!cancelled) {
        setHasFavicon(true);
      }
    };
    const handleError = () => {
      projectFaviconPresence.set(faviconSrc, false);
      if (!cancelled) {
        setHasFavicon(false);
      }
    };

    image.addEventListener("load", handleLoad);
    image.addEventListener("error", handleError);

    image.src = faviconSrc;

    return () => {
      cancelled = true;
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
    };
  }, [faviconSrc, shouldUseFavicon]);

  if (iconMetadata) {
    return (
      <span
        aria-label={`${iconMetadata.label} project icon`}
        className={`${className} inline-flex shrink-0 items-center justify-center font-mono text-(length:--app-font-size-ui-meta,10px) font-semibold leading-none text-current`}
        data-project-icon-id={iconMetadata.iconId}
        role="img"
        title={iconMetadata.label}
      >
        {PROJECT_ICON_GLYPHS[iconMetadata.iconId]}
      </span>
    );
  }

  return (
    <>
      <FolderGlyph aria-hidden="true" focusable="false" className={className} />
      {hasFavicon ? (
        <img
          src={faviconSrc}
          alt=""
          aria-hidden="true"
          className="absolute -right-1 -bottom-1 size-3 rounded-lg object-contain shadow-sm"
          onError={() => {
            projectFaviconPresence.set(faviconSrc, false);
            setHasFavicon(false);
          }}
        />
      ) : null}
    </>
  );
}
