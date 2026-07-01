import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const chatViewSource = readFileSync(new URL("./ChatView.tsx", import.meta.url), "utf8");

function extractRuntimeUsageControlsPropsSource(): string {
  const declaration = "const runtimeUsageControlsProps = {";
  const start = chatViewSource.indexOf(declaration);
  if (start < 0) return "";
  const bodyStart = start + declaration.length;
  let depth = 1;
  for (let index = bodyStart; index < chatViewSource.length; index += 1) {
    const char = chatViewSource[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return chatViewSource.slice(bodyStart, index);
  }
  return "";
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
