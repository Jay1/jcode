const COMPACT_DIFF_UNITS = [
  { divisor: 1_000, suffix: "k" },
  { divisor: 1_000_000, suffix: "m" },
  { divisor: 1_000_000_000, suffix: "b" },
] as const;

export function hasNonZeroStat(stat: { additions: number; deletions: number }): boolean {
  return stat.additions > 0 || stat.deletions > 0;
}

export function normalizeDiffCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.trunc(value);
}

export function formatCompactDiffCount(value: number): string {
  const count = normalizeDiffCount(value);
  if (count < 1_000) return String(count);

  const unitIndex = count >= 1_000_000_000 ? 2 : count >= 1_000_000 ? 1 : 0;
  return formatCountWithUnit(count, unitIndex);
}

export function formatExactDiffCount(value: number, locales?: Intl.LocalesArgument): string {
  return normalizeDiffCount(value).toLocaleString(locales);
}

export function formatDiffStatAccessibleLabel(
  additions: number,
  deletions: number,
  locales?: Intl.LocalesArgument,
): string {
  return `${formatExactDiffCount(additions, locales)} additions, ${formatExactDiffCount(deletions, locales)} deletions`;
}

function formatCountWithUnit(count: number, unitIndex: number): string {
  const unit = COMPACT_DIFF_UNITS[unitIndex];
  if (!unit) return String(count);

  const scaled = count / unit.divisor;
  const rounded = scaled < 10 ? Math.round(scaled * 10) / 10 : Math.round(scaled);
  if (rounded >= 1_000 && unitIndex < COMPACT_DIFF_UNITS.length - 1) {
    return formatCountWithUnit(count, unitIndex + 1);
  }
  return `${rounded}${unit.suffix}`;
}
