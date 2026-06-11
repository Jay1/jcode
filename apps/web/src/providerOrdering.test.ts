import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROVIDER_ORDER,
  filterVisibleProviderItems,
  normalizeHiddenProviders,
  normalizeProviderOrder,
} from "./providerOrdering";

describe("DEFAULT_PROVIDER_ORDER", () => {
  it("orders OpenClaw after OpenCode and before Pi", () => {
    expect(DEFAULT_PROVIDER_ORDER).toEqual([
      "codex",
      "claudeAgent",
      "cursor",
      "gemini",
      "kilo",
      "opencode",
      "openclaw",
      "pi",
    ]);
  });
});

describe("normalizeProviderOrder", () => {
  it("keeps OpenClaw and Pi in normalized provider order", () => {
    expect(normalizeProviderOrder(["opencode", "openclaw", "unknown", "pi", "openclaw"])).toEqual([
      "opencode",
      "openclaw",
      "pi",
      "codex",
      "claudeAgent",
      "cursor",
      "gemini",
      "kilo",
    ]);
  });
});

describe("normalizeHiddenProviders", () => {
  it("keeps OpenClaw and Pi as valid hidden providers", () => {
    expect(normalizeHiddenProviders(["openclaw", "pi", "unknown", "openclaw"])).toEqual([
      "openclaw",
      "pi",
    ]);
  });
});

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
