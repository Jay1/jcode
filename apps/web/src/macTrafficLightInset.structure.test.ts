import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const insetSource = readFileSync(new URL("./macTrafficLightInset.ts", import.meta.url), "utf8");
const consumerSources = [
  readFileSync(new URL("./components/Sidebar.tsx", import.meta.url), "utf8"),
  readFileSync(new URL("./components/ChatView.tsx", import.meta.url), "utf8"),
  readFileSync(new URL("./components/ui/sidebar.tsx", import.meta.url), "utf8"),
];
const browserFixtureSource = readFileSync(
  new URL("./components/macTrafficLightInset.browser.tsx", import.meta.url),
  "utf8",
);

describe("macOS traffic-light inset production wiring", () => {
  it("imports one shared production layout primitive at all four consumer sites", () => {
    // Given the shared inset module and the three files that own four consumer branches
    // When their imports and JSX are inspected as secondary wiring proof
    const combinedConsumers = consumerSources.join("\n");

    // Then the actual runtime primitive is defined once and rendered exactly four times
    expect(insetSource).toContain("export function MacTrafficLightInsetLayout");
    for (const source of consumerSources) {
      expect(source).toContain("MacTrafficLightInsetLayout");
    }
    expect(combinedConsumers.match(/<MacTrafficLightInsetLayout\b/gu)).toHaveLength(4);
  });

  it("keeps browser proof on the production primitive instead of a source-derived copy", () => {
    expect(browserFixtureSource).toContain("<MacTrafficLightInsetLayout");
    expect(browserFixtureSource).not.toContain("SourceDerivedConsumer");
    expect(browserFixtureSource).not.toContain("page.screenshot");
  });

  it("rejects every legacy fixed inset literal", () => {
    expect(consumerSources.join("\n")).not.toMatch(/(?:sm:)?pl-\[90px\]|ml-\[76px\]/u);
  });
});
