import { describe, expect, it } from "vitest";

import {
  COMMAND_OUTPUT_TAIL_LINES,
  formatWorkspaceRelativePath,
  getVisibleCommandOutputLines,
  hasCommandActivityDetails,
  hasExpandableActivityDetails,
} from "./MessagesTimelineActivityDetails.logic";

describe("MessagesTimelineActivityDetails logic", () => {
  it("uses the shared command classification for expandable command rows", () => {
    expect(
      hasCommandActivityDetails({
        id: "work-command",
        createdAt: "2026-03-17T19:12:28.000Z",
        label: "Ran command",
        tone: "tool",
        requestKind: "command",
        exitCode: 0,
      }),
    ).toBe(true);
  });

  it("keeps file-change patches expandable after normalizing workspace paths", () => {
    const entry = {
      id: "work-file-change",
      createdAt: "2026-03-17T19:12:28.000Z",
      label: "Edited",
      tone: "tool" as const,
      requestKind: "file-change" as const,
      patch: "diff --git a/app.ts b/app.ts",
    };

    expect(hasExpandableActivityDetails(entry)).toBe(true);
    expect(formatWorkspaceRelativePath("/repo/apps/web/src/app.ts", "/repo")).toBe(
      "apps/web/src/app.ts",
    );
  });

  it("reports hidden command output lines when tailing long output", () => {
    const value = Array.from(
      { length: COMMAND_OUTPUT_TAIL_LINES + 2 },
      (_, index) => `line ${index}`,
    ).join("\n");

    const output = getVisibleCommandOutputLines(value);

    expect(output.lines).toHaveLength(COMMAND_OUTPUT_TAIL_LINES);
    expect(output.lines[0]).toBe("line 2");
    expect(output.hiddenLineCount).toBe(2);
  });
});
