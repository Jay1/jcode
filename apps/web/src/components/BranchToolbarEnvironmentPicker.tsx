import type { ProviderKind } from "@jcode/contracts";
import { LuSplit } from "react-icons/lu";
import { PiLaptop } from "react-icons/pi";

import { ChevronDownIcon, ChevronRightIcon, HandoffIcon } from "~/lib/icons";
import type { OpenUsageUsageLine } from "../lib/openUsageRateLimits";
import type { ProviderRateLimit } from "../lib/rateLimits";
import type { resolveThreadEnvironmentPresentation } from "../lib/threadEnvironment";
import { cn } from "../lib/utils";
import type { EnvMode } from "./BranchToolbar.logic";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "./ui/collapsible";
import { Popover, PopoverPopup, PopoverTrigger } from "./ui/popover";
import { ProviderUsagePanelContent } from "./ProviderUsagePanelContent";

type ThreadEnvironmentPresentation = ReturnType<typeof resolveThreadEnvironmentPresentation>;

type BranchToolbarUsageSummary = {
  readonly isLoading: boolean;
  readonly learnMoreHref: string | null;
  readonly rateLimits: ReadonlyArray<ProviderRateLimit>;
  readonly usageLines: ReadonlyArray<OpenUsageUsageLine>;
};

export function WorktreeGlyph({ className }: { readonly className?: string }) {
  return <LuSplit className={cn("rotate-90", className)} />;
}

export function BranchToolbarEnvironmentPicker(props: {
  readonly activeProvider: ProviderKind | null;
  readonly canHandoffToLocal: boolean;
  readonly canHandoffToWorktree: boolean;
  readonly canSwitchToWorktree: boolean;
  readonly effectiveEnvMode: EnvMode;
  readonly envPickerOpen: boolean;
  readonly environmentPresentation: ThreadEnvironmentPresentation;
  readonly handoffBusy: boolean;
  readonly onEnvModeChange: (mode: EnvMode) => void;
  readonly onEnvPickerOpenChange: (open: boolean) => void;
  readonly onHandoffToLocal?: (() => void) | undefined;
  readonly onHandoffToWorktree?: (() => void) | undefined;
  readonly onRateLimitsOpenChange: (open: boolean) => void;
  readonly rateLimitsOpen: boolean;
  readonly showEnvPicker: boolean;
  readonly usageSummary: BranchToolbarUsageSummary;
}) {
  if (!props.showEnvPicker) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 text-[length:var(--app-font-size-ui-xs,10px)] font-normal text-(--app-metadata-muted-fg)">
        <WorktreeGlyph className="size-3.5" />
        {props.environmentPresentation.shortLabel}
      </span>
    );
  }

  return (
    <Popover open={props.envPickerOpen} onOpenChange={props.onEnvPickerOpenChange}>
      <PopoverTrigger className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[length:var(--app-font-size-ui-xs,10px)] font-normal text-(--app-metadata-muted-fg) transition-colors hover:bg-(--app-chrome-control-hover-bg) hover:text-(--app-metadata-fg)">
        {props.environmentPresentation.mode === "local" ? (
          <PiLaptop className="size-3.5" />
        ) : (
          <WorktreeGlyph className="size-3.5" />
        )}
        {props.environmentPresentation.shortLabel}
        <ChevronDownIcon className="size-3 opacity-60" />
      </PopoverTrigger>
      <PopoverPopup
        align="start"
        side="top"
        sideOffset={6}
        className="w-56 [&_[data-slot=popover-viewport]]:py-0 [&_[data-slot=popover-viewport]]:[--viewport-inline-padding:0px]"
      >
        <div className="py-1.5">
          <p className="px-3 pb-1 pt-1 text-[11px] font-medium text-(--app-metadata-muted-fg)">
            Continue in
          </p>
          {props.environmentPresentation.mode === "local" ? (
            <div className="flex w-full items-center gap-2 px-3 py-1.5 text-sm">
              <PiLaptop className="size-4 text-(--app-work-row-icon)" />
              <span className="text-(--app-metadata-fg)">
                {props.environmentPresentation.localOptionLabel}
              </span>
              <svg
                className="ml-auto size-4 text-(--app-metadata-fg)"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          ) : (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-(--app-metadata-fg) transition-colors hover:bg-(--app-work-row-hover-bg)"
              onClick={() => {
                props.onEnvPickerOpenChange(false);
                props.onEnvModeChange("local");
              }}
            >
              <PiLaptop className="size-4 text-(--app-work-row-icon)" />
              <span>{props.environmentPresentation.localOptionLabel}</span>
            </button>
          )}
          {props.canSwitchToWorktree ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-(--app-metadata-fg) transition-colors hover:bg-(--app-work-row-hover-bg)"
              onClick={() => {
                props.onEnvPickerOpenChange(false);
                props.onEnvModeChange("worktree");
              }}
            >
              <WorktreeGlyph className="size-4 text-(--app-work-row-icon)" />
              <span>New worktree</span>
            </button>
          ) : null}
          {props.effectiveEnvMode === "worktree" && !props.canHandoffToLocal ? (
            <div className="flex w-full items-center gap-2 px-3 py-1.5 text-sm">
              <WorktreeGlyph className="size-4 text-(--app-work-row-icon)" />
              <span className="text-(--app-metadata-fg)">
                {props.environmentPresentation.worktreeOptionLabel}
              </span>
              <svg
                className="ml-auto size-4 text-(--app-metadata-fg)"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          ) : null}
          {props.canHandoffToWorktree && props.onHandoffToWorktree ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-(--app-metadata-fg) transition-colors hover:bg-(--app-work-row-hover-bg) disabled:pointer-events-none disabled:opacity-50"
              disabled={props.handoffBusy}
              onClick={() => {
                props.onEnvPickerOpenChange(false);
                props.onHandoffToWorktree?.();
              }}
            >
              <WorktreeGlyph className="size-4 text-(--app-work-row-icon)" />
              <span>Hand off to new worktree</span>
            </button>
          ) : null}
          {props.canHandoffToLocal && props.onHandoffToLocal ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-(--app-metadata-fg) transition-colors hover:bg-(--app-work-row-hover-bg) disabled:pointer-events-none disabled:opacity-50"
              disabled={props.handoffBusy}
              onClick={() => {
                props.onEnvPickerOpenChange(false);
                props.onHandoffToLocal?.();
              }}
            >
              <HandoffIcon className="size-4 text-(--app-work-row-icon)" />
              <span>Hand off to local</span>
            </button>
          ) : null}
        </div>

        <div className="mx-3 border-t border-(--app-work-row-border)" />

        <div className="py-1.5">
          <Collapsible open={props.rateLimitsOpen} onOpenChange={props.onRateLimitsOpenChange}>
            <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-(--app-metadata-fg) transition-colors hover:bg-(--app-work-row-hover-bg)">
              <svg
                className="size-4 text-(--app-work-row-icon)"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Rate limits remaining</span>
              <ChevronRightIcon
                className={cn(
                  "ml-auto size-3.5 text-(--app-work-row-icon) transition-transform duration-150",
                  props.rateLimitsOpen && "rotate-90",
                )}
              />
            </CollapsibleTrigger>
            <CollapsiblePanel>
              <ProviderUsagePanelContent
                provider={props.activeProvider}
                rateLimits={props.usageSummary.rateLimits}
                usageLines={props.usageSummary.usageLines}
                isLoading={props.usageSummary.isLoading}
                learnMoreHref={props.usageSummary.learnMoreHref}
                showTitle={false}
                className="px-3 pb-1 pt-1"
              />
            </CollapsiblePanel>
          </Collapsible>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
