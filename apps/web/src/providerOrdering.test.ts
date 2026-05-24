import { describe, expect, it } from "vitest";

import { filterVisibleProviderItems } from "./providerOrdering";

describe("filterVisibleProviderItems", () => {
  it("removes hidden providers while preserving visible provider order", () => {
    expect(
      filterVisibleProviderItems(
        [
          { provider: "codex", label: "Codex" },
          { provider: "claudeAgent", label: "Claude" },
          { provider: "opencode", label: "OpenCode" },
        ],
        ["claudeAgent"],
      ),
    ).toEqual([
      { provider: "codex", label: "Codex" },
      { provider: "opencode", label: "OpenCode" },
    ]);
  });
});
