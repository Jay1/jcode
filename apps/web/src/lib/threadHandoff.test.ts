import { type ModelSelection } from "@jcode/contracts";
import { describe, expect, it } from "vitest";
import {
  buildThreadHandoffImportedMessages,
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

  it("ignores non-gateway sticky and project defaults for OpenClaw handoff", () => {
    expect(
      resolveThreadHandoffModelSelection({
        sourceThread: {
          modelSelection: {
            provider: "gemini",
            model: "gemini-2.5-pro",
          },
        },
        targetProvider: "openclaw",
        projectDefaultModelSelection: {
          provider: "openclaw",
          model: "custom-model",
        } as unknown as ModelSelection,
        stickyModelSelectionByProvider: {
          openclaw: {
            provider: "openclaw",
            model: "another-model",
          } as unknown as ModelSelection,
        },
      }),
    ).toEqual({
      provider: "openclaw",
      model: "gateway",
    });
  });

  it("excludes internal goal-continuation prompts from imported handoff messages", () => {
    const imported = buildThreadHandoffImportedMessages({
      messages: [
        {
          id: "message-native" as never,
          role: "user",
          text: "Visible user prompt",
          turnId: null,
          streaming: false,
          source: "native",
          attachments: [],
          createdAt: "2026-06-06T00:00:00.000Z",
          completedAt: "2026-06-06T00:00:00.000Z",
        },
        {
          id: "message-goal-continuation" as never,
          role: "user",
          text: "Hidden goal continuation prompt",
          turnId: null,
          streaming: false,
          source: "goal-continuation",
          attachments: [],
          createdAt: "2026-06-06T00:01:00.000Z",
          completedAt: "2026-06-06T00:01:00.000Z",
        },
      ],
    });

    expect(imported.map((message) => message.text)).toEqual(["Visible user prompt"]);
  });
});
