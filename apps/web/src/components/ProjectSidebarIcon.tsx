// FILE: ProjectSidebarIcon.tsx
// Purpose: Render the standard project identity icon with optional language metadata and favicon badge fallback.
// Layer: Sidebar UI component
// Exports: ProjectSidebarIcon

import type { ProjectIconId, ProjectIconMetadata } from "@jcode/contracts";
import { useEffect, useState } from "react";
import type { IconType } from "react-icons";
import { HiOutlineFolderOpen } from "react-icons/hi2";
import {
  SiGo,
  SiJavascript,
  SiPython,
  SiReact,
  SiRust,
  SiSvelte,
  SiTypescript,
  SiVuedotjs,
} from "react-icons/si";
import { FolderClosed } from "./FolderClosed";

const projectFaviconPresence = new Map<string, boolean>();

type ProjectIconArtwork = {
  icon: IconType;
  color: string;
};

const PROJECT_ICON_ARTWORK: Record<ProjectIconId, ProjectIconArtwork> = {
  go: { icon: SiGo, color: "#00ADD8" },
  javascript: { icon: SiJavascript, color: "#F7DF1E" },
  python: { icon: SiPython, color: "#3776AB" },
  react: { icon: SiReact, color: "#61DAFB" },
  rust: { icon: SiRust, color: "#DEA584" },
  svelte: { icon: SiSvelte, color: "#FF3E00" },
  typescript: { icon: SiTypescript, color: "#3178C6" },
  vue: { icon: SiVuedotjs, color: "#42B883" },
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
  const FolderGlyph = expanded ? HiOutlineFolderOpen : FolderClosed;

  if (iconMetadata) {
    const artwork = PROJECT_ICON_ARTWORK[iconMetadata.iconId];
    const Icon = artwork.icon;

    return (
      <span
        aria-label={`${iconMetadata.label} project icon`}
        className={`${className} inline-flex shrink-0 items-center justify-center`}
        data-project-icon-id={iconMetadata.iconId}
        style={{ color: artwork.color }}
        title={iconMetadata.label}
      >
        <Icon aria-hidden="true" className="size-[94%]" focusable="false" />
      </span>
    );
  }

  return (
    <ProjectFolderIcon
      key={faviconSrc}
      className={className}
      faviconSrc={faviconSrc}
      FolderGlyph={FolderGlyph}
    />
  );
}

/**
 * Owns the fallback folder icon box so percentage-sized glyphs and favicon
 * badges stay constrained inside the sidebar project header.
 */
function ProjectFolderIcon({
  className,
  faviconSrc,
  FolderGlyph,
}: {
  className: string;
  faviconSrc: string;
  FolderGlyph: typeof HiOutlineFolderOpen;
}) {
  const [hasFavicon, setHasFavicon] = useState<boolean>(
    () => projectFaviconPresence.get(faviconSrc) === true,
  );

  // Probe with Image() so Electron/file-origin behaves like the actual visible <img>.
  useEffect(() => {
    if (projectFaviconPresence.has(faviconSrc)) {
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
  }, [faviconSrc]);

  return (
    <span
      className={`${className} relative inline-flex shrink-0 items-center justify-center`}
      data-project-folder-icon="true"
    >
      <FolderGlyph aria-hidden="true" focusable="false" className="size-full" />
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
    </span>
  );
}
