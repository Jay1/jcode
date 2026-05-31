// FILE: SidebarHeaderNavigationControls.tsx
// Purpose: Keeps the collapsed-sidebar trigger and Electron route arrows in one header cluster.
// Layer: Shared web shell chrome
// Depends on: Sidebar state plus AppNavigationButtons

import { APP_WORDMARK_SUFFIX } from "~/branding";
import { cn } from "~/lib/utils";
import { AppNavigationButtons } from "./AppNavigationButtons";
import { SidebarHeaderTrigger, SidebarTrigger, useSidebar } from "./ui/sidebar";

type SidebarHeaderNavigationControlsProps = {
  className?: string;
  showWhenExpanded?: boolean;
};

function AppWordmarkMark() {
  return (
    <svg
      className="size-4.5 shrink-0 text-(--app-wordmark-prefix)"
      viewBox="110 110 280 280"
      aria-hidden="true"
    >
      <circle fill="currentColor" cx="336.7" cy="249.5" r="25.3" />
      <circle fill="currentColor" cx="336.7" cy="336.5" r="25.3" />
      <circle fill="currentColor" cx="249" cy="336.2" r="25.3" />
      <ellipse fill="currentColor" cx="161.3" cy="336.2" rx="25.3" ry="25.3" />
      <ellipse fill="currentColor" cx="248.4" cy="167.5" rx="25.3" ry="25.3" />
    </svg>
  );
}

export function SidebarHeaderNavigationControls({
  className,
  showWhenExpanded = false,
}: SidebarHeaderNavigationControlsProps = {}) {
  const { isMobile, open } = useSidebar();
  const triggerVisible = isMobile || !open;

  if (!triggerVisible && !showWhenExpanded) {
    return null;
  }

  return (
    <div
      className={cn(
        "group/navbar-controls relative flex shrink-0 items-center [-webkit-app-region:no-drag]",
        className,
      )}
    >
      <div
        className="flex shrink-0 select-none items-center gap-1 text-[18px] leading-none font-system-ui"
        aria-label="JCode"
      >
        <AppWordmarkMark />
        <span className="font-normal text-foreground/89">{APP_WORDMARK_SUFFIX}</span>
      </div>
      <div
        data-navbar-controls="revealed-on-hover"
        className="pointer-events-none absolute top-1/2 left-full z-10 flex -translate-y-1/2 shrink-0 items-center gap-0.5 rounded-xl bg-background/95 opacity-0 shadow-sm ring-1 ring-border/55 backdrop-blur-sm transition-opacity duration-150 focus-within:pointer-events-auto focus-within:opacity-100 group-hover/navbar-controls:pointer-events-auto group-hover/navbar-controls:opacity-100"
      >
        <AppNavigationButtons className="ms-0" />
        {showWhenExpanded && !isMobile ? (
          <SidebarTrigger
            className="size-7 shrink-0 text-muted-foreground/75 hover:text-foreground"
            aria-label="Toggle thread sidebar"
          />
        ) : (
          <SidebarHeaderTrigger className="size-7 shrink-0" />
        )}
      </div>
    </div>
  );
}
