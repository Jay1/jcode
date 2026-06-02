import type { ProviderKind, ProviderSkillDescriptor } from "@jcode/contracts";

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
