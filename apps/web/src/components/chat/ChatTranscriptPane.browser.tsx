import "../../index.css";

import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import {
  CollapsedUserMessageHarness,
  TranscriptPerfHarness,
} from "./ChatTranscriptPane.browser-harness";
import { COLLAPSED_USER_MESSAGE_MAX_CHARS } from "./userMessagePreview";

describe("ChatTranscriptPane", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does not re-render the transcript subtree when only composer text changes", async () => {
    let transcriptCommitCount = 0;

    const screen = await render(
      <TranscriptPerfHarness
        onTranscriptRender={() => {
          transcriptCommitCount += 1;
        }}
      />,
    );
    try {
      await vi.waitFor(() => {
        expect(transcriptCommitCount).toBeGreaterThan(0);
      });

      const baselineCommitCount = transcriptCommitCount;
      await page.getByPlaceholder("Type composer text").fill("reply follow up");

      await vi.waitFor(() => {
        expect(screen.container.querySelector("#composer-input")).toHaveValue("reply follow up");
      });

      expect(transcriptCommitCount).toBe(baselineCommitCount);
    } finally {
      await screen.unmount();
    }
  });

  it("expands collapsed user messages from the Show more control", async () => {
    const hiddenTail = "TAIL_SHOULD_APPEAR_AFTER_EXPAND";
    const longUserText = `${"a".repeat(COLLAPSED_USER_MESSAGE_MAX_CHARS)}${hiddenTail}`;

    const screen = await render(
      <CollapsedUserMessageHarness longUserText={longUserText} />,
    );
    try {
      expect(screen.container.textContent).not.toContain(hiddenTail);
      expect(screen.container.querySelector("button[data-scroll-anchor-ignore]")?.textContent).toBe(
        "Show more",
      );

      await page.getByText("Show more").click();

      await vi.waitFor(() => {
        expect(screen.container.textContent).toContain(hiddenTail);
      });
      await expect.element(page.getByText("Show less")).toBeInTheDocument();
      expect(screen.container.querySelector("button[data-scroll-anchor-ignore]")?.textContent).toBe(
        "Show less",
      );
    } finally {
      await screen.unmount();
    }
  });
});
