import type { CatalogSkillEntry, ProviderKind, ProviderSkillDescriptor } from "@jcode/contracts";

import { buildSkillSearchBlob, normalizeProviderDiscoveryText } from "./providerDiscovery";

export type SkillLibraryProviderGroup = {
  provider: ProviderKind;
  providerLabel: string;
  skills: readonly ProviderSkillDescriptor[];
};

export type SkillLibraryRow = {
  key: string;
  provider: ProviderKind;
  providerLabel: string;
  skill: ProviderSkillDescriptor;
  searchBlob: string;
};

export type SkillLibraryProviderFilter = ProviderKind | "all";

export function buildSkillLibraryRows(
  groups: readonly SkillLibraryProviderGroup[],
): SkillLibraryRow[] {
  return groups.flatMap((group) =>
    group.skills.map((skill, index) => ({
      key: `${group.provider}:${skill.path}:${index}`,
      provider: group.provider,
      providerLabel: group.providerLabel,
      skill,
      searchBlob: buildSkillSearchBlob(skill),
    })),
  );
}

export function filterSkillLibraryRows(
  rows: readonly SkillLibraryRow[],
  filters: { query: string; provider: SkillLibraryProviderFilter },
): SkillLibraryRow[] {
  const query = normalizeProviderDiscoveryText(filters.query);

  return rows.filter((row) => {
    if (filters.provider !== "all" && row.provider !== filters.provider) {
      return false;
    }
    return query.length === 0 || row.searchBlob.includes(query);
  });
}

export function countSkillLibraryRowsByProvider(
  rows: readonly SkillLibraryRow[],
): Partial<Record<ProviderKind, number>> {
  const counts: Partial<Record<ProviderKind, number>> = {};
  for (const row of rows) {
    counts[row.provider] = (counts[row.provider] ?? 0) + 1;
  }
  return counts;
}

function catalogSkillMatchesInstalledSkill(
  entry: CatalogSkillEntry,
  row: SkillLibraryRow,
): boolean {
  const installedNames = [row.skill.name, row.skill.interface?.displayName]
    .map(normalizeProviderDiscoveryText)
    .filter((value) => value.length > 0);
  const catalogNames = [entry.skillName, entry.displayName]
    .map(normalizeProviderDiscoveryText)
    .filter((value) => value.length > 0);

  return catalogNames.some((catalogName) => installedNames.includes(catalogName));
}

export function filterInstallableCatalogEntries(input: {
  entries: readonly CatalogSkillEntry[];
  installedRows: readonly SkillLibraryRow[];
  provider: ProviderKind;
}): CatalogSkillEntry[] {
  const installedProviderRows = input.installedRows.filter(
    (row) => row.provider === input.provider,
  );

  return input.entries.filter(
    (entry) => !installedProviderRows.some((row) => catalogSkillMatchesInstalledSkill(entry, row)),
  );
}
