import { describe, expect, it } from "vitest";

import type { SkillLibraryRow } from "../lib/skillLibrary";
import {
  buildSkillLibraryToggleInput,
  buildSkillLibraryProviderQueryMap,
  buildSkillLibraryProviderStatusMap,
} from "./SkillLibrarySettingsPanel";
import {
  buildSkillLibraryUninstallInput,
  formatSkillActionNotice,
  getSkillSourceOriginLabel,
} from "./SkillLibrarySkillRow";

describe("SkillLibrarySettingsPanel provider maps", () => {
  it("does not map OpenClaw to Pi skill queries", () => {
    const skillQueries = buildSkillLibraryProviderQueryMap({
      codex: "codex-skills",
      claudeAgent: "claude-skills",
      cursor: "cursor-skills",
      devin: "devin-skills",
      gemini: "gemini-skills",
      kilo: "kilo-skills",
      opencode: "opencode-skills",
      pi: "pi-skills",
    });

    expect(Object.keys(skillQueries)).toEqual([
      "codex",
      "claudeAgent",
      "cursor",
      "devin",
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
      devin: { capability: "devin-capability", skills: "devin-skills" },
      gemini: { capability: "gemini-capability", skills: "gemini-skills" },
      kilo: { capability: "kilo-capability", skills: "kilo-skills" },
      opencode: { capability: "opencode-capability", skills: "opencode-skills" },
      pi: { capability: "pi-capability", skills: "pi-skills" },
    });

    expect(Object.keys(providerStatus)).toEqual([
      "codex",
      "claudeAgent",
      "cursor",
      "devin",
      "gemini",
      "kilo",
      "opencode",
      "pi",
    ]);
    expect("openclaw" in providerStatus).toBe(false);
    expect(providerStatus.pi).toEqual({ capability: "pi-capability", skills: "pi-skills" });
  });
});

describe("SkillLibrarySettingsPanel skill management payloads", () => {
  it("uses the discovery cwd when building uninstall input", () => {
    const row: SkillLibraryRow = {
      key: "opencode:/workspace/jcode/.opencode/skill/code-review/SKILL.md:0",
      provider: "opencode",
      providerLabel: "OpenCode",
      skill: {
        name: "code-review",
        description: "Reviews changes",
        path: "/workspace/jcode/.opencode/skill/code-review/SKILL.md",
        enabled: true,
      },
      searchBlob: "code-review reviews changes",
    };

    const payload = buildSkillLibraryUninstallInput({
      row,
      discoveryCwd: "/workspace/jcode",
    });

    expect(payload).toEqual({
      provider: "opencode",
      cwd: "/workspace/jcode",
      skillPath: "/workspace/jcode/.opencode/skill/code-review/SKILL.md",
    });
  });

  it("uses the discovery cwd when building toggle input", () => {
    const row: SkillLibraryRow = {
      key: "opencode:/workspace/jcode/.opencode/skill/code-review/SKILL.md:0",
      provider: "opencode",
      providerLabel: "OpenCode",
      skill: {
        name: "code-review",
        description: "Reviews changes",
        path: "/workspace/jcode/.opencode/skill/code-review/SKILL.md",
        enabled: true,
      },
      searchBlob: "code-review reviews changes",
    };

    const payload = buildSkillLibraryToggleInput({
      row,
      discoveryCwd: "/workspace/jcode",
      enabled: false,
    });

    expect(payload).toEqual({
      provider: "opencode",
      cwd: "/workspace/jcode",
      skillPath: "/workspace/jcode/.opencode/skill/code-review/SKILL.md",
      enabled: false,
    });
  });
});

describe("SkillLibrarySettingsPanel row metadata", () => {
  it("formats source and action metadata for visible Skill Library rows", () => {
    const uninstallReason = "Built-in skills cannot be uninstalled.";
    const toggleReason = "Built-in skills cannot be disabled.";
    const builtInRow: SkillLibraryRow = {
      key: "opencode:opencode://skill/customize-opencode:0",
      provider: "opencode",
      providerLabel: "OpenCode",
      skill: {
        name: "customize-opencode",
        path: "opencode://skill/customize-opencode",
        enabled: true,
        source: { origin: "builtin", location: "<built-in>" },
        actions: {
          uninstall: {
            available: false,
            reason: uninstallReason,
          },
          toggle: {
            available: false,
            reason: toggleReason,
          },
        },
      },
      searchBlob: "customize-opencode",
    };
    const filesystemRow: SkillLibraryRow = {
      key: "opencode:/workspace/jcode/.opencode/skill/code-review/SKILL.md:0",
      provider: "opencode",
      providerLabel: "OpenCode",
      skill: {
        name: "code-review",
        path: "/workspace/jcode/.opencode/skill/code-review/SKILL.md",
        enabled: true,
        source: {
          origin: "filesystem",
          location: "/workspace/jcode/.opencode/skill/code-review/SKILL.md",
        },
      },
      searchBlob: "code-review",
    };

    expect(getSkillSourceOriginLabel(builtInRow)).toBe("Built-in");
    expect(getSkillSourceOriginLabel(filesystemRow)).toBe("Project");
    expect(
      formatSkillActionNotice({
        canUninstall: false,
        uninstallReason,
        canToggle: false,
        toggleReason,
      }),
    ).toBe(
      "Cannot uninstall: Built-in skills cannot be uninstalled. Cannot disable: Built-in skills cannot be disabled.",
    );
    expect(formatSkillActionNotice({ canUninstall: true, canToggle: true })).toBeNull();
  });
});
