import type { CatalogSkillEntry, ProviderKind, ProviderSkillDescriptor } from "@jcode/contracts";
import { describe, expect, it } from "vitest";

import {
  buildSkillLibraryRows,
  countSkillLibraryRowsByProvider,
  filterInstallableCatalogEntries,
  filterSkillLibraryRows,
  resolveSkillLibraryRowActions,
} from "./skillLibrary";

function skill(
  name: string,
  overrides: Partial<ProviderSkillDescriptor> = {},
): ProviderSkillDescriptor {
  return {
    name,
    path: `/skills/${name}`,
    enabled: true,
    ...overrides,
  };
}

function catalogEntry(overrides: Partial<CatalogSkillEntry> = {}): CatalogSkillEntry {
  return {
    packageRef: "owner/skills",
    skillName: "analyze",
    displayName: "Analyze",
    ...overrides,
  };
}

describe("skill library helpers", () => {
  it("aggregates provider-tagged skill rows with searchable metadata", () => {
    const rows = buildSkillLibraryRows([
      {
        provider: "opencode",
        providerLabel: "OpenCode",
        skills: [
          skill("analyze", {
            description: "Answer data questions",
            interface: { displayName: "Analyze", shortDescription: "Data analysis" },
          }),
        ],
      },
      {
        provider: "codex",
        providerLabel: "Codex",
        skills: [skill("review-work", { description: "Post-implementation review" })],
      },
    ]);

    expect(rows.map((row) => `${row.providerLabel}:${row.skill.name}`)).toEqual([
      "OpenCode:analyze",
      "Codex:review-work",
    ]);
    expect(rows[0]?.searchBlob).toContain("data analysis");
  });

  it("filters by provider and normalized skill text", () => {
    const rows = buildSkillLibraryRows([
      {
        provider: "opencode",
        providerLabel: "OpenCode",
        skills: [skill("analyze", { description: "Answer data questions" })],
      },
      {
        provider: "codex",
        providerLabel: "Codex",
        skills: [skill("code-review", { description: "Review implementation" })],
      },
    ]);

    expect(filterSkillLibraryRows(rows, { query: "data", provider: "all" })).toHaveLength(1);
    expect(filterSkillLibraryRows(rows, { query: "review", provider: "opencode" })).toHaveLength(0);
    expect(filterSkillLibraryRows(rows, { query: "review", provider: "codex" })).toHaveLength(1);
  });

  it("counts rows by provider", () => {
    const rows = buildSkillLibraryRows([
      {
        provider: "opencode" as ProviderKind,
        providerLabel: "OpenCode",
        skills: [skill("z-last"), skill("a-first")],
      },
      {
        provider: "codex" as ProviderKind,
        providerLabel: "Codex",
        skills: [skill("m-middle")],
      },
    ]);

    expect(countSkillLibraryRowsByProvider(rows)).toEqual({ opencode: 2, codex: 1 });
  });

  it("keeps row keys unique when a provider reports duplicate skill paths", () => {
    const rows = buildSkillLibraryRows([
      {
        provider: "opencode",
        providerLabel: "OpenCode",
        skills: [skill("first", { path: "/same/path" }), skill("second", { path: "/same/path" })],
      },
    ]);

    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
  });

  it("hides catalog entries already installed for the selected provider only", () => {
    const installedRows = buildSkillLibraryRows([
      {
        provider: "opencode",
        providerLabel: "OpenCode",
        skills: [skill("analyze", { interface: { displayName: "Analyze" } })],
      },
    ]);
    const catalogEntries = [
      catalogEntry(),
      catalogEntry({ skillName: "code-review", displayName: "Code Review" }),
    ];

    expect(
      filterInstallableCatalogEntries({
        entries: catalogEntries,
        installedRows,
        provider: "opencode",
      }).map((entry) => entry.skillName),
    ).toEqual(["code-review"]);
    expect(
      filterInstallableCatalogEntries({
        entries: catalogEntries,
        installedRows,
        provider: "codex",
      }).map((entry) => entry.skillName),
    ).toEqual(["analyze", "code-review"]);
  });

  it("allows legacy skill row actions from provider capabilities", () => {
    const [row] = buildSkillLibraryRows([
      {
        provider: "opencode",
        providerLabel: "OpenCode",
        skills: [skill("code-review")],
      },
    ]);

    if (!row) {
      throw new Error("Expected Skill Library row fixture.");
    }
    expect(
      resolveSkillLibraryRowActions({
        row,
        providerCanUninstall: true,
        providerCanToggle: false,
      }),
    ).toEqual({
      canUninstall: true,
      canToggle: false,
    });
  });

  it("blocks uninstall when skill action metadata marks it unavailable", () => {
    const [row] = buildSkillLibraryRows([
      {
        provider: "opencode",
        providerLabel: "OpenCode",
        skills: [
          skill("customize-opencode", {
            path: "opencode://skill/customize-opencode",
            source: { origin: "builtin", location: "<built-in>" },
            actions: {
              uninstall: {
                available: false,
                reason: "Built-in skills cannot be uninstalled.",
              },
            },
          }),
        ],
      },
    ]);

    if (!row) {
      throw new Error("Expected Skill Library row fixture.");
    }
    expect(
      resolveSkillLibraryRowActions({
        row,
        providerCanUninstall: true,
        providerCanToggle: true,
      }),
    ).toEqual({
      canUninstall: false,
      uninstallReason: "Built-in skills cannot be uninstalled.",
      canToggle: true,
    });
    expect(filterSkillLibraryRows([row], { query: "customize", provider: "all" })).toHaveLength(1);
    expect(countSkillLibraryRowsByProvider([row])).toEqual({ opencode: 1 });
  });
});
