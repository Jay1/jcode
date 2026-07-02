import "../../index.css";

import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { WorkLogEntry } from "../../session-logic";
import { SimpleWorkEntryRow } from "./MessagesTimeline";

type DetailedWorkLogEntry = WorkLogEntry & {
  readonly output?: string;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly exitCode?: number;
  readonly durationMs?: number;
  readonly patch?: string;
};

async function renderTimeline(entry: DetailedWorkLogEntry) {
  return render(
    <SimpleWorkEntryRow
      workEntry={entry}
      chatMetaFontSizePx={12}
      workspaceRoot="/home/jay/code/jcode"
    />,
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

      await expect(page.getByRole("button", { name: /Collapse Ran command/u })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      await expect(page.getByText("Command", { exact: true })).toBeVisible();
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
      const row = page.getByRole("button", { name: /Show details/u });
      await row.click();

      await expect(
        page.getByTitle("apps/web/src/components/chat/MessagesTimeline.tsx"),
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
