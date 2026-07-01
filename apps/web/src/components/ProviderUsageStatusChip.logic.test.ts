import { describe, expect, it } from "vitest";

import { resolveProviderUsageStatusChip } from "./ProviderUsageStatusChip.logic";

describe("resolveProviderUsageStatusChip", () => {
  it("surfaces the most constrained normalized limit as active provider status", () => {
    const chip = resolveProviderUsageStatusChip({
      rateLimits: [
        {
          provider: "codex",
          updatedAt: "2099-04-08T18:00:00.000Z",
          limits: [
            { window: "Weekly", usedPercent: 20 },
            { window: "5h", usedPercent: 42 },
          ],
        },
      ],
      usageLines: [],
    });

    expect(chip).toEqual({
      ariaLabel: "Provider usage 5h: 58% remaining",
      detail: undefined,
      label: "5h",
      tone: "muted",
      value: "58% left",
    });
  });

  it("surfaces local usage lines when no provider exposes limit windows", () => {
    const chip = resolveProviderUsageStatusChip({
      rateLimits: [],
      usageLines: [
        {
          label: "24h",
          value: "1.2K tokens",
          subtitle: "3 recent sessions",
        },
      ],
    });

    expect(chip).toEqual({
      ariaLabel: "Provider usage 24h: 1.2K tokens",
      detail: "3 recent sessions",
      label: "24h",
      tone: "muted",
      value: "1.2K tokens",
    });
  });

  it("omits unsupported or empty usage data instead of implying limits exist", () => {
    expect(resolveProviderUsageStatusChip({ rateLimits: [], usageLines: [] })).toBeNull();
  });
});
