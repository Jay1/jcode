import type { OpenUsageUsageLine } from "~/lib/openUsageRateLimits";
import {
  deriveVisibleRateLimitRows,
  formatRateLimitRemainingPercent,
  formatRateLimitResetTime,
  type ProviderRateLimit,
} from "~/lib/rateLimits";

export type ProviderUsageStatusChipModel = {
  readonly ariaLabel: string;
  readonly detail: string | undefined;
  readonly label: string;
  readonly tone: "muted" | "warning";
  readonly value: string;
};

export function resolveProviderUsageStatusChip(input: {
  readonly rateLimits: ReadonlyArray<ProviderRateLimit>;
  readonly usageLines: ReadonlyArray<OpenUsageUsageLine>;
}): ProviderUsageStatusChipModel | null {
  const limitRow = deriveVisibleRateLimitRows(input.rateLimits)[0];
  if (limitRow) {
    const remaining = formatRateLimitRemainingPercent(limitRow.remainingPercent);
    const detail = limitRow.resetsAt
      ? `Resets ${formatRateLimitResetTime(limitRow.resetsAt)}`
      : undefined;

    return {
      ariaLabel: `Provider usage ${limitRow.label}: ${remaining} remaining`,
      detail,
      label: limitRow.label,
      tone: limitRow.remainingPercent <= 20 ? "warning" : "muted",
      value: `${remaining} left`,
    };
  }

  const usageLine = input.usageLines[0];
  if (!usageLine) {
    return null;
  }

  return {
    ariaLabel: `Provider usage ${usageLine.label}: ${usageLine.value}`,
    detail: usageLine.subtitle,
    label: usageLine.label,
    tone: "muted",
    value: usageLine.value,
  };
}
