import { describe, expect, it } from "vitest";

import {
  DEFAULT_MODEL_BY_PROVIDER,
  MODEL_OPTIONS_BY_PROVIDER,
  MODEL_SLUG_ALIASES_BY_PROVIDER,
} from "./model";

describe("Claude Sonnet 5 built-in metadata", () => {
  it("exposes the authoritative intrinsic capabilities", () => {
    const model = MODEL_OPTIONS_BY_PROVIDER.claudeAgent.find(
      (option) => option.slug === "claude-sonnet-5",
    );

    expect(model).toEqual({
      slug: "claude-sonnet-5",
      name: "Claude Sonnet 5",
      capabilities: {
        contextWindowTokens: 1_000_000,
        maxOutputTokens: 128_000,
        thinkingMode: "adaptive",
        minimumProviderVersion: "2.1.197",
        reasoningEffortLevels: [
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High", isDefault: true },
          { value: "xhigh", label: "Extra High" },
          { value: "max", label: "Max" },
        ],
        supportsFastMode: false,
        supportsThinkingToggle: false,
        promptInjectedEffortLevels: [],
        contextWindowOptions: [],
      },
    });
  });

  it("keeps Sonnet 4.6 as the Claude default and generic alias", () => {
    expect(DEFAULT_MODEL_BY_PROVIDER.claudeAgent).toBe("claude-sonnet-4-6");
    expect(MODEL_SLUG_ALIASES_BY_PROVIDER.claudeAgent.sonnet).toBe("claude-sonnet-4-6");
    expect(
      MODEL_OPTIONS_BY_PROVIDER.claudeAgent.some((option) => option.slug === "claude-sonnet-4-6"),
    ).toBe(true);
  });

  it("adds only explicit Sonnet 5 aliases for the canonical ID", () => {
    expect(MODEL_SLUG_ALIASES_BY_PROVIDER.claudeAgent["sonnet-5"]).toBe("claude-sonnet-5");
    expect(MODEL_SLUG_ALIASES_BY_PROVIDER.claudeAgent["claude-sonnet-5"]).toBe("claude-sonnet-5");
    expect(MODEL_SLUG_ALIASES_BY_PROVIDER.claudeAgent["claude-sonnet-5-0"]).toBeUndefined();
  });
});
