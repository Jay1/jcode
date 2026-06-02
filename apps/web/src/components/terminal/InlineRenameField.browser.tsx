import "../../index.css";

import { page } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import InlineRenameField from "./InlineRenameField";

function dispatchInputKey(input: HTMLInputElement, key: string): void {
  input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key }));
}

describe("InlineRenameField", () => {
  it("selects the initial value on mount and merges caller class names", async () => {
    const screen = await render(
      <InlineRenameField
        initialValue="Terminal"
        onCommit={() => {}}
        onCancel={() => {}}
        className="min-w-0 flex-1"
        autoFocus
      />,
    );

    try {
      await expect.element(page.getByRole("textbox")).toBeInTheDocument();
      const input = screen.container.querySelector<HTMLInputElement>("input");
      expect(input).not.toBeNull();
      expect(document.activeElement).toBe(input);
      expect(input?.selectionStart).toBe(0);
      expect(input?.selectionEnd).toBe("Terminal".length);
      expect(input?.classList.contains("min-w-0")).toBe(true);
      expect(input?.classList.contains("flex-1")).toBe(true);
      expect(input?.classList.contains("bg-background")).toBe(true);
    } finally {
      await screen.unmount();
    }
  });

  it("commits trimmed values on Enter and blur, and cancels on Escape", async () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const screen = await render(
      <InlineRenameField initialValue="Old" onCommit={onCommit} onCancel={onCancel} autoFocus />,
    );

    try {
      const input = screen.container.querySelector<HTMLInputElement>("input");
      expect(input).not.toBeNull();
      if (!input) return;

      await page.getByRole("textbox").fill("  New Name  ");
      dispatchInputKey(input, "Enter");
      expect(onCommit).toHaveBeenCalledWith("New Name");

      dispatchInputKey(input, "Escape");
      expect(onCancel).toHaveBeenCalledTimes(1);

      await page.getByRole("textbox").fill("  Blur Name  ");
      input.blur();
      expect(onCommit).toHaveBeenLastCalledWith("Blur Name");
    } finally {
      await screen.unmount();
    }
  });
});
