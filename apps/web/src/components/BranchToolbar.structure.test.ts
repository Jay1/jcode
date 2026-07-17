import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const branchToolbarSource = readFileSync(new URL("./BranchToolbar.tsx", import.meta.url), "utf8");
const runtimeUsageControlsSource = readFileSync(
  new URL("./RuntimeUsageControls.tsx", import.meta.url),
  "utf8",
);
const branchSelectorSource = readFileSync(
  new URL("./BranchToolbarBranchSelector.tsx", import.meta.url),
  "utf8",
);
const comboboxSource = readFileSync(new URL("./ui/combobox.tsx", import.meta.url), "utf8");

describe("BranchToolbar structure", () => {
  it("renders runtime access as a tokenized state chip", () => {
    expect(runtimeUsageControlsSource).toContain("runtime-usage-controls");
    expect(runtimeUsageControlsSource).toContain("runtime-access-chip");
    expect(runtimeUsageControlsSource).toContain("var(--app-runtime-chip-bg)");
    expect(runtimeUsageControlsSource).toContain("var(--app-runtime-chip-border)");
  });

  it("wires provider usage into active runtime controls", () => {
    expect(runtimeUsageControlsSource).toContain("ProviderUsageStatusChip");
    expect(branchToolbarSource).toContain("providerRateLimits={usageSummary.rateLimits}");
    expect(branchToolbarSource).toContain("providerUsageLines={usageSummary.usageLines}");
  });

  it("uses the shared combobox scroll fade without a selector-local duplicate", () => {
    expect(branchSelectorSource.match(/scrollFade/g) ?? []).toHaveLength(0);
    expect(comboboxSource.match(/<ScrollArea[^>]*scrollFade/g) ?? []).toHaveLength(1);
  });
});
