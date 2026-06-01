import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const branchToolbarSource = readFileSync(new URL("./BranchToolbar.tsx", import.meta.url), "utf8");

describe("BranchToolbar structure", () => {
  it("renders runtime access as a tokenized state chip", () => {
    expect(branchToolbarSource).toContain("runtime-usage-controls");
    expect(branchToolbarSource).toContain("runtime-access-chip");
    expect(branchToolbarSource).toContain("var(--app-runtime-chip-bg)");
    expect(branchToolbarSource).toContain("var(--app-runtime-chip-border)");
  });
});
