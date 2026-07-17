import "../../index.css";

import { MessageId, TurnId } from "@jcode/contracts";
import { cdp, page, userEvent } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { WorkLogEntry } from "../../session-logic";
import { MessagesTimeline, SimpleWorkEntryRow } from "./MessagesTimeline";

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

const MESSAGE_ACTION_TRANSITION_MS = 240;

async function renderMessageActions() {
  const onRevertUserMessage = vi.fn();
  const onEditUserMessage = vi.fn(() => true);
  const screen = await render(
    <div className="h-[560px] w-full bg-background text-foreground">
      <MessagesTimeline
        hasMessages
        isWorking={false}
        activeTurnInProgress={false}
        activeTurnStartedAt={null}
        timelineEntries={[
          {
            id: "entry-browser-user",
            kind: "message",
            createdAt: "2026-03-17T19:12:28.000Z",
            message: {
              id: MessageId.makeUnsafe("message-browser-user"),
              role: "user",
              text: "Browser action user message",
              createdAt: "2026-03-17T19:12:28.000Z",
              streaming: false,
            },
          },
          {
            id: "entry-browser-assistant",
            kind: "message",
            createdAt: "2026-03-17T19:12:29.000Z",
            message: {
              id: MessageId.makeUnsafe("message-browser-assistant"),
              role: "assistant",
              text: "Browser action assistant message",
              turnId: TurnId.makeUnsafe("turn-browser-assistant"),
              createdAt: "2026-03-17T19:12:29.000Z",
              completedAt: "2026-03-17T19:12:30.000Z",
              streaming: false,
            },
          },
        ]}
        completionDividerBeforeEntryId={null}
        completionSummary={null}
        turnDiffSummaryByAssistantMessageId={new Map()}
        nowIso="2026-03-17T19:12:30.000Z"
        expandedWorkGroups={{}}
        onToggleWorkGroup={() => {}}
        onOpenTurnDiff={() => {}}
        revertTurnCountByUserMessageId={
          new Map([[MessageId.makeUnsafe("message-browser-user"), 1]])
        }
        onRevertUserMessage={onRevertUserMessage}
        onEditUserMessage={onEditUserMessage}
        isRevertingCheckpoint={false}
        onImageExpand={() => {}}
        markdownCwd={undefined}
        resolvedTheme="light"
        timestampFormat="locale"
        workspaceRoot={undefined}
      />
    </div>,
  );

  return { onRevertUserMessage, screen };
}

async function waitForMessageActionTransition(): Promise<void> {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, MESSAGE_ACTION_TRANSITION_MS);
  });
}

function actionGroupFor(button: Element): HTMLElement {
  const group = button.parentElement;
  if (!(group instanceof HTMLElement)) {
    throw new Error("Message action button is missing its action group.");
  }
  return group;
}

async function emulateCoarsePointerNoHover(enabled: boolean): Promise<void> {
  const session = cdp();
  const send = Reflect.get(session, "send");
  if (typeof send !== "function") {
    throw new Error("Vitest browser CDP session does not expose send().");
  }

  await Reflect.apply(send, session, ["Emulation.setTouchEmulationEnabled", { enabled }]);
  await Reflect.apply(send, session, [
    "Emulation.setEmulatedMedia",
    {
      features: enabled
        ? [
            { name: "hover", value: "none" },
            { name: "pointer", value: "coarse" },
          ]
        : [],
    },
  ]);
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
        page.getByText("apps/web/src/components/chat/MessagesTimeline.tsx", { exact: true }),
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

describe("MessagesTimeline message actions", () => {
  afterEach(async () => {
    await emulateCoarsePointerNoHover(false);
    await page.viewport(1280, 720);
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("keeps user and assistant actions visible at rest and fully reveals them on hover or focus", async () => {
    const { screen } = await renderMessageActions();
    try {
      const userRow = page.getByRole("article", { name: "User message" });
      const assistantRow = page.getByRole("article", { name: "Assistant message" });
      const userCopy = userRow.getByRole("button", { name: "Copy message" });
      const assistantCopy = assistantRow.getByRole("button", { name: "Copy message" });
      const userActions = actionGroupFor(userCopy.element());
      const assistantActions = actionGroupFor(assistantCopy.element());

      expect(Number.parseFloat(getComputedStyle(userActions).opacity)).toBe(0.6);
      expect(Number.parseFloat(getComputedStyle(assistantActions).opacity)).toBe(0.6);
      expect(getComputedStyle(userActions).transitionDuration).toBe("0.2s");
      expect(getComputedStyle(assistantActions).transitionDuration).toBe("0.2s");

      await userRow.hover();
      await waitForMessageActionTransition();
      expect(Number.parseFloat(getComputedStyle(userActions).opacity)).toBe(1);

      await assistantRow.hover();
      await waitForMessageActionTransition();
      expect(Number.parseFloat(getComputedStyle(assistantActions).opacity)).toBe(1);

      await assistantRow.unhover();
      userCopy.element().focus();
      await waitForMessageActionTransition();
      expect(document.activeElement).toBe(userCopy.element());
      expect(Number.parseFloat(getComputedStyle(userActions).opacity)).toBe(1);
    } finally {
      await screen.unmount();
    }
  });

  it("retains accessible user and assistant actions and invokes each enabled action", async () => {
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const { onRevertUserMessage, screen } = await renderMessageActions();
    try {
      const userRow = page.getByRole("article", { name: "User message" });
      const assistantRow = page.getByRole("article", { name: "Assistant message" });
      const userCopy = userRow.getByRole("button", { name: "Copy message" });
      const edit = userRow.getByRole("button", { name: "Edit message" });
      const revert = userRow.getByRole("button", { name: "Revert to this message" });
      const assistantCopy = assistantRow.getByRole("button", { name: "Copy message" });

      await expect(userCopy).toBeEnabled();
      await expect(edit).toBeEnabled();
      await expect(revert).toBeEnabled();
      await expect(assistantCopy).toBeEnabled();

      await userCopy.click();
      await vi.waitFor(() => {
        expect(writeText).toHaveBeenCalledWith("Browser action user message");
      });

      await assistantCopy.click();
      await vi.waitFor(() => {
        expect(writeText).toHaveBeenCalledWith("Browser action assistant message");
      });

      await revert.click();
      expect(onRevertUserMessage).toHaveBeenCalledWith(
        MessageId.makeUnsafe("message-browser-user"),
      );

      await edit.click();
      await expect(page.getByRole("textbox", { name: "Edit message" })).toHaveValue(
        "Browser action user message",
      );
    } finally {
      await screen.unmount();
    }
  });

  it("keeps actions visible, contained, clickable, and keyboard reachable on coarse narrow input", async () => {
    await page.viewport(375, 720);
    await emulateCoarsePointerNoHover(true);
    const { onRevertUserMessage, screen } = await renderMessageActions();
    try {
      expect(window.matchMedia("(hover: none)").matches).toBe(true);
      expect(window.matchMedia("(pointer: coarse)").matches).toBe(true);

      const userRow = page.getByRole("article", { name: "User message" });
      const assistantRow = page.getByRole("article", { name: "Assistant message" });
      const userCopy = userRow.getByRole("button", { name: "Copy message" });
      const edit = userRow.getByRole("button", { name: "Edit message" });
      const revert = userRow.getByRole("button", { name: "Revert to this message" });
      const assistantCopy = assistantRow.getByRole("button", { name: "Copy message" });
      const actionGroups = [
        actionGroupFor(userCopy.element()),
        actionGroupFor(assistantCopy.element()),
      ];

      for (const group of actionGroups) {
        const bounds = group.getBoundingClientRect();
        expect(Number.parseFloat(getComputedStyle(group).opacity)).toBeGreaterThan(0);
        expect(bounds.left).toBeGreaterThanOrEqual(0);
        expect(bounds.right).toBeLessThanOrEqual(window.innerWidth);
      }

      userCopy.element().focus();
      await userEvent.tab();
      expect(document.activeElement).toBe(edit.element());
      await userEvent.tab();
      expect(document.activeElement).toBe(revert.element());
      await userEvent.tab();
      expect(document.activeElement).toBe(assistantCopy.element());

      await revert.click();
      expect(onRevertUserMessage).toHaveBeenCalledOnce();
    } finally {
      await screen.unmount();
    }
  });
});
