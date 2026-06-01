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
  background: string;
};

const PROJECT_ICON_ARTWORK: Record<ProjectIconId, ProjectIconArtwork> = {
  go: { icon: SiGo, color: "#00ADD8", background: "rgba(0, 173, 216, 0.16)" },
  javascript: { icon: SiJavascript, color: "#F7DF1E", background: "rgba(247, 223, 30, 0.16)" },
  python: { icon: SiPython, color: "#3776AB", background: "rgba(55, 118, 171, 0.16)" },
  react: { icon: SiReact, color: "#61DAFB", background: "rgba(97, 218, 251, 0.16)" },
  rust: { icon: SiRust, color: "#DEA584", background: "rgba(222, 165, 132, 0.16)" },
  svelte: { icon: SiSvelte, color: "#FF3E00", background: "rgba(255, 62, 0, 0.16)" },
  typescript: { icon: SiTypescript, color: "#3178C6", background: "rgba(49, 120, 198, 0.18)" },
  vue: { icon: SiVuedotjs, color: "#42B883", background: "rgba(66, 184, 131, 0.16)" },
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
    const artwork = PROJECT_ICON_ARTWORK[iconMetadata.iconId];
    const Icon = artwork.icon;

    return (
      <span
        aria-label={`${iconMetadata.label} project icon`}
        className={`${className} inline-flex shrink-0 items-center justify-center rounded-[4px] border border-current/20 shadow-[0_0_0_1px_rgba(0,0,0,0.14)]`}
        data-project-icon-id={iconMetadata.iconId}
        role="img"
        style={{ backgroundColor: artwork.background, color: artwork.color }}
        title={iconMetadata.label}
      >
        <Icon aria-hidden="true" className="size-[82%]" focusable="false" />
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
