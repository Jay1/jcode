import type { ProviderKind } from "@jcode/contracts";
import { useMemo } from "react";

import type { OpenUsageUsageLine } from "~/lib/openUsageRateLimits";
import type { ProviderRateLimit } from "~/lib/rateLimits";
import { cn } from "~/lib/utils";

import { Popover, PopoverPopup, PopoverTrigger } from "./ui/popover";
import { ProviderUsagePanelContent } from "./ProviderUsagePanelContent";
import { resolveProviderUsageStatusChip } from "./ProviderUsageStatusChip.logic";

export function ProviderUsageStatusChip(props: {
  readonly provider: ProviderKind | null | undefined;
  readonly rateLimits: ReadonlyArray<ProviderRateLimit>;
  readonly usageLines: ReadonlyArray<OpenUsageUsageLine>;
  readonly isLoading: boolean;
  readonly learnMoreHref: string | null | undefined;
}) {
  const chip = useMemo(
    () =>
      resolveProviderUsageStatusChip({
        rateLimits: props.rateLimits,
        usageLines: props.usageLines,
      }),
    [props.rateLimits, props.usageLines],
  );

  if (!chip) {
    return null;
  }

  const title = chip.detail ? `${chip.ariaLabel}. ${chip.detail}` : chip.ariaLabel;

  return (
    <Popover>
      <PopoverTrigger
        aria-label={chip.ariaLabel}
        title={title}
        className={cn(
          "provider-usage-chip inline-flex items-center gap-1 rounded-full border border-[color:var(--app-runtime-chip-border)] bg-[var(--app-runtime-chip-bg)] px-2 py-0.5 text-[length:var(--app-font-size-ui-xs,10px)] font-medium text-[var(--app-metadata-fg)] tabular-nums transition-colors hover:bg-[var(--app-chrome-control-hover-bg)] hover:text-[var(--app-chrome-control-hover-fg)] focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-[var(--app-state-focus)]",
          chip.tone === "warning" &&
            "border-[color:var(--app-status-warning-border)] bg-[var(--app-status-warning-bg)] text-[var(--app-status-warning-fg)]",
        )}
      >
        <span className="leading-none text-(--app-metadata-muted-fg)">{chip.label}</span>
        <span className="leading-none">{chip.value}</span>
      </PopoverTrigger>
      <PopoverPopup align="end" side="top" sideOffset={6} className="w-64">
        <ProviderUsagePanelContent
          provider={props.provider}
          rateLimits={props.rateLimits}
          usageLines={props.usageLines}
          isLoading={props.isLoading}
          learnMoreHref={props.learnMoreHref}
        />
      </PopoverPopup>
    </Popover>
  );
}
