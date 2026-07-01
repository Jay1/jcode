import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const chatViewSource = readFileSync(new URL("./ChatView.tsx", import.meta.url), "utf8");

function extractRuntimeUsageControlsPropsSource(): string {
  const match = chatViewSource.match(
    /const runtimeUsageControlsProps = \{(?<body>[\s\S]*?)\n  \};\n  const branchToolbarProps/,
  );
  return match?.groups?.body ?? "";
}

describe("ChatView runtime usage controls structure", () => {
  it("passes provider usage summary through every active runtime controls surface", () => {
    const propsSource = extractRuntimeUsageControlsPropsSource();

    expect(propsSource).toContain("provider: activeProvider");
    expect(propsSource).toContain("providerRateLimits: activeProviderUsageSummary.rateLimits");
    expect(propsSource).toContain("providerUsageLines: activeProviderUsageSummary.usageLines");
    expect(propsSource).toContain("providerUsageIsLoading: activeProviderUsageSummary.isLoading");
    expect(propsSource).toContain(
      "providerUsageLearnMoreHref: activeProviderUsageSummary.learnMoreHref",
    );
  });
});
