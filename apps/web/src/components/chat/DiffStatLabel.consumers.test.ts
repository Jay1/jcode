import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const DIFF_PANEL_SOURCE = readFileSync(new URL("../DiffPanel.tsx", import.meta.url), "utf8");
const MESSAGES_TIMELINE_SOURCE = readFileSync(
  new URL("./MessagesTimeline.tsx", import.meta.url),
  "utf8",
);
const CHANGED_FILES_TREE_SOURCE = readFileSync(
  new URL("./ChangedFilesTree.tsx", import.meta.url),
  "utf8",
);

describe("DiffStatLabel consumers", () => {
  it("keeps all six diff-stat call sites on the shared component", () => {
    const callSiteCount = [
      DIFF_PANEL_SOURCE,
      MESSAGES_TIMELINE_SOURCE,
      CHANGED_FILES_TREE_SOURCE,
    ].reduce((total, source) => total + (source.match(/<DiffStatLabel\b/gu)?.length ?? 0), 0);

    expect(callSiteCount).toBe(6);
  });

  it("describes exact counts on explicitly labelled focusable ancestors", () => {
    expect(DIFF_PANEL_SOURCE).toContain("aria-description={totalPatchStatAccessibleLabel}");
    expect(MESSAGES_TIMELINE_SOURCE).toContain("aria-description={changedFileStatAccessibleLabel}");
    expect(DIFF_PANEL_SOURCE).toContain("formatDiffStatAccessibleLabel(");
    expect(MESSAGES_TIMELINE_SOURCE).toContain("formatDiffStatAccessibleLabel(");
  });
});
