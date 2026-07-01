import "../../index.css";

import { MessageId } from "@jcode/contracts";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { TimelineEntry, WorkLogEntry } from "../../session-logic";
import { MessagesTimeline } from "./MessagesTimeline";

type DetailedWorkLogEntry = WorkLogEntry & {
  readonly output?: string;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly exitCode?: number;
  readonly durationMs?: number;
  readonly patch?: string;
};

const EMPTY_WORK_GROUPS: Record<string, boolean> = {};
const EMPTY_TURN_DIFFS = new Map();
const EMPTY_REVERT_COUNTS = new Map();
const NOOP = () => {};

function workEntryTimeline(entry: DetailedWorkLogEntry): TimelineEntry[] {
  return [
    {
      id: `entry:${entry.id}`,
      kind: "work",
      createdAt: entry.createdAt,
      entry,
    },
    {
      id: `assistant:${entry.id}`,
      kind: "message",
      createdAt: "2026-03-17T19:12:29.000Z",
      message: {
        id: MessageId.makeUnsafe(`assistant:${entry.id}`),
        role: "assistant",
        text: "done",
        createdAt: "2026-03-17T19:12:29.000Z",
        completedAt: "2026-03-17T19:12:30.000Z",
        streaming: false,
      },
    },
  ];
}

async function renderTimeline(entry: DetailedWorkLogEntry) {
  const host = document.createElement("div");
  host.style.height = "640px";
  host.style.width = "900px";
  document.body.append(host);
  return render(
    <div style={{ height: "100%" }}>
      <MessagesTimeline
        hasMessages
        isWorking={false}
        activeTurnInProgress={false}
        activeTurnStartedAt={null}
        timelineEntries={workEntryTimeline(entry)}
        completionDividerBeforeEntryId={null}
        completionSummary={null}
        turnDiffSummaryByAssistantMessageId={EMPTY_TURN_DIFFS}
        nowIso="2026-03-17T19:12:30.000Z"
        expandedWorkGroups={EMPTY_WORK_GROUPS}
        onToggleWorkGroup={NOOP}
        onOpenTurnDiff={NOOP}
        revertTurnCountByUserMessageId={EMPTY_REVERT_COUNTS}
        onRevertUserMessage={NOOP}
        isRevertingCheckpoint={false}
        onImageExpand={NOOP}
        markdownCwd={undefined}
        resolvedTheme="dark"
        timestampFormat="locale"
        workspaceRoot="/home/jay/code/jcode"
      />
    </div>,
    { container: host },
  );
}

describe("MessagesTimeline activity details", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("expands command rows to show command metadata and captured output", async () => {
    const screen = await renderTimeline({
      id: "work-command-details",
      createdAt: "2026-03-17T19:12:28.000Z",
      label: "Ran command",
      tone: "tool",
      itemType: "command_execution",
      toolTitle: "Ran command",
      command: "bun test src/components/chat/MessagesTimeline.browser.tsx",
      rawCommand: "snip bun test src/components/chat/MessagesTimeline.browser.tsx",
      stdout: "PASS timeline details",
      stderr: "warning: slow path",
      exitCode: 0,
      durationMs: 1250,
    });
    try {
      const row = page.getByRole("button", { name: /Expand Ran command/u });
      await expect(row).toHaveAttribute("aria-expanded", "false");

      await row.click();

      await expect(row).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByText("Command")).toBeVisible();
      await expect(page.getByText("Exit code 0")).toBeVisible();
      await expect(page.getByText("Duration 1.3s")).toBeVisible();
      await expect(page.getByText("PASS timeline details")).toBeVisible();
      await expect(page.getByText("warning: slow path")).toBeVisible();
    } finally {
      await screen.unmount();
    }
  });

  it("expands file-change rows to show changed paths and inline patch details", async () => {
    const screen = await renderTimeline({
      id: "work-file-details",
      createdAt: "2026-03-17T19:12:28.000Z",
      label: "File Change",
      tone: "tool",
      requestKind: "file-change",
      changedFiles: ["apps/web/src/components/chat/MessagesTimeline.tsx"],
      patch: [
        "diff --git a/apps/web/src/components/chat/MessagesTimeline.tsx b/apps/web/src/components/chat/MessagesTimeline.tsx",
        "--- a/apps/web/src/components/chat/MessagesTimeline.tsx",
        "+++ b/apps/web/src/components/chat/MessagesTimeline.tsx",
        "@@ -1 +1 @@",
        "-old timeline row",
        "+new timeline row",
      ].join("\n"),
    });
    try {
      const row = page.getByRole("button", { name: /Expand File Change/u });
      await row.click();

      await expect(
        page.getByText("apps/web/src/components/chat/MessagesTimeline.tsx"),
      ).toBeVisible();
      await expect(page.getByText("-old timeline row")).toBeVisible();
      await expect(page.getByText("+new timeline row")).toBeVisible();
    } finally {
      await screen.unmount();
    }
  });

  it("keeps rows stable when optional output and patch details are missing", async () => {
    const screen = await renderTimeline({
      id: "work-empty-details",
      createdAt: "2026-03-17T19:12:28.000Z",
      label: "File Change",
      tone: "tool",
      requestKind: "file-change",
      changedFiles: ["apps/web/src/components/chat/MessagesTimeline.logic.ts"],
    });
    try {
      await expect(page.getByText("Edited")).toBeVisible();
      await expect(page.getByText("MessagesTimeline.logic.ts")).toBeVisible();
      expect(screen.container.textContent).not.toContain("Patch");
    } finally {
      await screen.unmount();
    }
  });
});
