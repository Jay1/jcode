import { type ModelSelection } from "@jcode/contracts";
import { describe, expect, it } from "vitest";
import {
  resolveAvailableHandoffTargetProviders,
  resolveThreadHandoffModelSelection,
} from "./threadHandoff";

describe("threadHandoff", () => {
  it("lists all supported handoff targets except the active provider", () => {
    expect(resolveAvailableHandoffTargetProviders("codex")).toEqual([
      "claudeAgent",
      "cursor",
      "gemini",
      "kilo",
      "opencode",
      "openclaw",
      "pi",
    ]);
    expect(resolveAvailableHandoffTargetProviders("claudeAgent")).toEqual([
      "codex",
      "cursor",
      "gemini",
      "kilo",
      "opencode",
      "openclaw",
      "pi",
    ]);
    expect(resolveAvailableHandoffTargetProviders("cursor")).toEqual([
      "codex",
      "claudeAgent",
      "gemini",
      "kilo",
      "opencode",
      "openclaw",
      "pi",
    ]);
    expect(resolveAvailableHandoffTargetProviders("gemini")).toEqual([
      "codex",
      "claudeAgent",
      "cursor",
      "kilo",
      "opencode",
      "openclaw",
      "pi",
    ]);
    expect(resolveAvailableHandoffTargetProviders("kilo")).toEqual([
      "codex",
      "claudeAgent",
      "cursor",
      "gemini",
      "opencode",
      "openclaw",
      "pi",
    ]);
    expect(resolveAvailableHandoffTargetProviders("opencode")).toEqual([
      "codex",
      "claudeAgent",
      "cursor",
      "gemini",
      "kilo",
      "openclaw",
      "pi",
    ]);
    expect(resolveAvailableHandoffTargetProviders("openclaw")).toEqual([
      "codex",
      "claudeAgent",
      "cursor",
      "gemini",
      "kilo",
      "opencode",
      "pi",
    ]);
    expect(resolveAvailableHandoffTargetProviders("pi")).toEqual([
      "codex",
      "claudeAgent",
      "cursor",
      "gemini",
      "kilo",
      "opencode",
      "openclaw",
    ]);
  });

  it("prefers sticky model selection for the chosen handoff target", () => {
    const stickySelection = {
      provider: "gemini",
      model: "gemini-2.5-pro",
    } satisfies ModelSelection;

    expect(
      resolveThreadHandoffModelSelection({
        sourceThread: {
          modelSelection: {
            provider: "claudeAgent",
            model: "claude-sonnet-4-6",
          },
        },
        targetProvider: "gemini",
        projectDefaultModelSelection: {
          provider: "gemini",
          model: "gemini-3.1-pro-preview",
        },
        stickyModelSelectionByProvider: {
          gemini: stickySelection,
        },
      }),
    ).toEqual(stickySelection);
  });

  it("falls back to the resolved provider default model when no sticky or project default exists", () => {
    expect(
      resolveThreadHandoffModelSelection({
        sourceThread: {
          modelSelection: {
            provider: "gemini",
            model: "gemini-2.5-pro",
          },
        },
        targetProvider: "codex",
        projectDefaultModelSelection: null,
        stickyModelSelectionByProvider: {},
      }),
    ).toEqual({
      provider: "codex",
      model: "gpt-5.5",
    });
  });

  it("falls back to the fixed OpenClaw gateway model for handoff targets", () => {
    expect(
      resolveThreadHandoffModelSelection({
        sourceThread: {
          modelSelection: {
            provider: "gemini",
            model: "gemini-2.5-pro",
          },
        },
        targetProvider: "openclaw",
        projectDefaultModelSelection: null,
        stickyModelSelectionByProvider: {},
      }),
    ).toEqual({
      provider: "openclaw",
      model: "gateway",
    });
  });
});
