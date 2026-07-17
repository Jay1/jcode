import { describe, expect, it } from "vitest";

import {
  formatCompactDiffCount,
  formatDiffStatAccessibleLabel,
  formatExactDiffCount,
  normalizeDiffCount,
} from "./DiffStatLabel.logic";

describe("normalizeDiffCount", () => {
  it.each([
    [0, 0],
    [-42, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [Number.NEGATIVE_INFINITY, 0],
    [42.9, 42],
  ])("normalizes %s to %s", (value, expected) => {
    expect(normalizeDiffCount(value)).toBe(expected);
  });
});

describe("formatCompactDiffCount", () => {
  it.each([
    [0, "0"],
    [-42, "0"],
    [Number.NaN, "0"],
    [Number.POSITIVE_INFINITY, "0"],
    [Number.NEGATIVE_INFINITY, "0"],
    [42.9, "42"],
    [1, "1"],
    [999, "999"],
    [1_000, "1k"],
    [1_500, "1.5k"],
    [9_900, "9.9k"],
    [9_960, "10k"],
    [10_000, "10k"],
    [999_499, "999k"],
    [999_500, "1m"],
    [1_000_000, "1m"],
    [9_900_000, "9.9m"],
    [9_960_000, "10m"],
    [10_000_000, "10m"],
    [999_499_999, "999m"],
    [999_500_000, "1b"],
    [1_000_000_000, "1b"],
    [9_900_000_000, "9.9b"],
    [10_000_000_000, "10b"],
    [1_500_000_000, "1.5b"],
    [1_000_000_000_000, "1000b"],
  ])("formats %s as %s", (value, expected) => {
    expect(formatCompactDiffCount(value)).toBe(expected);
  });
});

describe("formatExactDiffCount", () => {
  it("localizes the normalized unabridged integer", () => {
    expect(formatExactDiffCount(1_000_000_000_000.9, "en-US")).toBe("1,000,000,000,000");
    expect(formatExactDiffCount(Number.POSITIVE_INFINITY, "en-US")).toBe("0");
  });
});

describe("formatDiffStatAccessibleLabel", () => {
  it("keeps exact localized additions before deletions", () => {
    expect(formatDiffStatAccessibleLabel(15_000, 9, "en-US")).toBe("15,000 additions, 9 deletions");
  });
});
