import { describe, expect, it } from "vitest";

import {
  buildSkillLibraryProviderQueryMap,
  buildSkillLibraryProviderStatusMap,
} from "./SkillLibrarySettingsPanel";

describe("SkillLibrarySettingsPanel provider maps", () => {
  it("does not map OpenClaw to Pi skill queries", () => {
    const skillQueries = buildSkillLibraryProviderQueryMap({
      codex: "codex-skills",
      claudeAgent: "claude-skills",
      cursor: "cursor-skills",
      gemini: "gemini-skills",
      kilo: "kilo-skills",
      opencode: "opencode-skills",
      pi: "pi-skills",
    });

    expect(Object.keys(skillQueries)).toEqual([
      "codex",
      "claudeAgent",
      "cursor",
      "gemini",
      "kilo",
      "opencode",
      "pi",
    ]);
    expect("openclaw" in skillQueries).toBe(false);
    expect(skillQueries.pi).toBe("pi-skills");
  });

  it("does not map OpenClaw to Pi provider status", () => {
    const providerStatus = buildSkillLibraryProviderStatusMap({
      codex: { capability: "codex-capability", skills: "codex-skills" },
      claudeAgent: { capability: "claude-capability", skills: "claude-skills" },
      cursor: { capability: "cursor-capability", skills: "cursor-skills" },
      gemini: { capability: "gemini-capability", skills: "gemini-skills" },
      kilo: { capability: "kilo-capability", skills: "kilo-skills" },
      opencode: { capability: "opencode-capability", skills: "opencode-skills" },
      pi: { capability: "pi-capability", skills: "pi-skills" },
    });

    expect(Object.keys(providerStatus)).toEqual([
      "codex",
      "claudeAgent",
      "cursor",
      "gemini",
      "kilo",
      "opencode",
      "pi",
    ]);
    expect("openclaw" in providerStatus).toBe(false);
    expect(providerStatus.pi).toEqual({ capability: "pi-capability", skills: "pi-skills" });
  });
});
