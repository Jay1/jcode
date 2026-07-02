import { MessageId } from "@jcode/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { MessagesTimelineRow } from "./MessagesTimeline.logic";
import {
  TimelineMinimap,
  deriveTimelineMinimapItems,
  getTimelineMinimapScrollRequest,
} from "./MessagesTimelineMinimap";

function userRow(id: string, text: string): MessagesTimelineRow {
  return {
    kind: "message",
    id: `entry:${id}`,
    createdAt: "2026-03-17T19:12:28.000Z",
    message: {
      id: MessageId.makeUnsafe(id),
      role: "user",
      text,
      createdAt: "2026-03-17T19:12:28.000Z",
      streaming: false,
    },
    durationStart: "2026-03-17T19:12:28.000Z",
    showCompletionDivider: false,
    showAssistantCopyButton: false,
  };
}

function assistantRow(id: string, text: string): MessagesTimelineRow {
  return {
    kind: "message",
    id: `entry:${id}`,
    createdAt: "2026-03-17T19:12:29.000Z",
    message: {
      id: MessageId.makeUnsafe(id),
      role: "assistant",
      text,
      createdAt: "2026-03-17T19:12:29.000Z",
      streaming: false,
    },
    durationStart: "2026-03-17T19:12:28.000Z",
    showCompletionDivider: false,
    showAssistantCopyButton: false,
  };
}

describe("MessagesTimelineMinimap", () => {
  it("derives visible jump targets from user turns without flattening transcript grouping", () => {
    const items = deriveTimelineMinimapItems([
      userRow("user-1", "Investigate flaky scroll follow"),
      assistantRow("assistant-1", "Found the layout growth source"),
      {
        kind: "work",
        id: "work-between-turns",
        createdAt: "2026-03-17T19:12:30.000Z",
        groupedEntries: [
          {
            id: "work-1",
            createdAt: "2026-03-17T19:12:30.000Z",
            label: "Ran command",
            tone: "tool",
          },
        ],
      },
      userRow("user-2", "Jump to this checkpoint after streaming grows"),
    ]);

    expect(items).toEqual([
      {
        id: "entry:user-1",
        label: "Investigate flaky scroll follow",
        rowIndex: 0,
        preview: "Found the layout growth source",
      },
      {
        id: "entry:user-2",
        label: "Jump to this checkpoint after streaming grows",
        rowIndex: 3,
        preview: null,
      },
    ]);
    const secondItem = items[1];
    expect(secondItem).toBeDefined();
    if (!secondItem) return;

    expect(getTimelineMinimapScrollRequest(secondItem)).toEqual({
      index: 3,
      animated: true,
      viewOffset: 24,
    });
  });

  it("renders accessible jump buttons only when a transcript has multiple anchors", () => {
    const rows = [
      userRow("user-1", "First anchor"),
      assistantRow("assistant-1", "First response"),
      userRow("user-2", "Second anchor"),
    ];

    const markup = renderToStaticMarkup(<TimelineMinimap rows={rows} onJump={vi.fn()} />);

    expect(markup).toContain('aria-label="Timeline jumps"');
    expect(markup).toContain('aria-label="Jump to First anchor"');
    expect(markup).toContain('aria-label="Jump to Second anchor"');
    expect(markup).toContain("First response");
    expect(markup).toContain("bg-[var(--app-work-row-bg)]");
  });

  it("stays hidden for short transcripts without jump value", () => {
    const markup = renderToStaticMarkup(
      <TimelineMinimap rows={[userRow("user-1", "Only anchor")]} onJump={vi.fn()} />,
    );

    expect(markup).toBe("");
  });
});
