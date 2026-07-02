import type { ProviderKind, RuntimeMode } from "@jcode/contracts";
import { FiThumbsUp } from "react-icons/fi";
import { HiOutlineHandRaised } from "react-icons/hi2";

import type { ContextWindowSnapshot } from "../lib/contextWindow";
import type { OpenUsageUsageLine } from "../lib/openUsageRateLimits";
import type { ProviderRateLimit } from "../lib/rateLimits";
import { cn } from "../lib/utils";
import { ContextWindowMeter } from "./chat/ContextWindowMeter";
import { ProviderUsageStatusChip } from "./ProviderUsageStatusChip";

export interface RuntimeUsageControlsProps {
  provider?: ProviderKind | null | undefined;
  runtimeMode?: RuntimeMode | undefined;
  onRuntimeModeChange?: ((mode: RuntimeMode) => void) | undefined;
  providerRateLimits?: ReadonlyArray<ProviderRateLimit> | undefined;
  providerUsageLines?: ReadonlyArray<OpenUsageUsageLine> | undefined;
  providerUsageIsLoading?: boolean | undefined;
  providerUsageLearnMoreHref?: string | null | undefined;
  contextWindow?: ContextWindowSnapshot | null | undefined;
  cumulativeCostUsd?: number | null | undefined;
  activeContextWindowLabel?: string | null | undefined;
  pendingContextWindowLabel?: string | null | undefined;
  className?: string | undefined;
}

export function RuntimeUsageControls({
  provider,
  runtimeMode,
  onRuntimeModeChange,
  providerRateLimits = [],
  providerUsageLines = [],
  providerUsageIsLoading = false,
  providerUsageLearnMoreHref,
  contextWindow,
  cumulativeCostUsd,
  activeContextWindowLabel,
  pendingContextWindowLabel,
  className,
}: RuntimeUsageControlsProps) {
  return (
    <div
      className={cn(
        "runtime-usage-controls flex items-center gap-1.5 text-(--app-metadata-muted-fg)",
        className,
      )}
    >
      {runtimeMode && onRuntimeModeChange ? (
        <button
          type="button"
          className="runtime-access-chip inline-flex items-center gap-1 rounded-full border border-[color:var(--app-runtime-chip-border)] bg-[var(--app-runtime-chip-bg)] px-2 py-0.5 text-[length:var(--app-font-size-ui-xs,10px)] font-medium text-[var(--app-metadata-fg)] transition-colors hover:bg-[var(--app-chrome-control-hover-bg)] hover:text-[var(--app-chrome-control-hover-fg)] focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-[var(--app-state-focus)]"
          onClick={() =>
            onRuntimeModeChange(runtimeMode === "full-access" ? "approval-required" : "full-access")
          }
          title={
            runtimeMode === "full-access"
              ? "Full access — click to require approvals"
              : "Ask every action"
          }
        >
          {runtimeMode === "full-access" ? (
            <FiThumbsUp className="size-3 shrink-0" />
          ) : (
            <HiOutlineHandRaised className="size-3 shrink-0" />
          )}
          <span className="leading-none">
            {runtimeMode === "full-access" ? "Full access" : "Default permissions"}
          </span>
        </button>
      ) : null}
      <ProviderUsageStatusChip
        provider={provider}
        rateLimits={providerRateLimits}
        usageLines={providerUsageLines}
        isLoading={providerUsageIsLoading}
        learnMoreHref={providerUsageLearnMoreHref}
      />
      {contextWindow ? (
        <ContextWindowMeter
          usage={contextWindow}
          {...(cumulativeCostUsd != null ? { cumulativeCostUsd } : {})}
          {...(activeContextWindowLabel !== undefined
            ? { activeWindowLabel: activeContextWindowLabel }
            : {})}
          {...(pendingContextWindowLabel !== undefined
            ? { pendingWindowLabel: pendingContextWindowLabel }
            : {})}
        />
      ) : null}
    </div>
  );
}
