import "../../index.css";

import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { DiffStatLabel } from "./DiffStatLabel";
import { formatDiffStatAccessibleLabel } from "./DiffStatLabel.logic";

describe("DiffStatLabel", () => {
  afterEach(async () => {
    await page.viewport(1280, 720);
    document.body.innerHTML = "";
  });

  it("exposes localized exact counts once while preserving compact visual order", async () => {
    const screen = await render(<DiffStatLabel additions={1_500} deletions={9} showParentheses />);
    try {
      const wrapper = screen.container.querySelector<HTMLElement>(
        '[aria-label="1,500 additions, 9 deletions"]',
      );
      expect(wrapper).toBeInstanceOf(HTMLElement);
      if (!wrapper) return;
      expect(wrapper.textContent).toBe("(+1.5k-9)");
      expect(wrapper.querySelector("[data-diff-stat-additions]")?.getAttribute("aria-hidden")).toBe(
        "true",
      );
      expect(wrapper.querySelector("[data-diff-stat-deletions]")?.getAttribute("aria-hidden")).toBe(
        "true",
      );
    } finally {
      await screen.unmount();
    }
  });

  it("uses equal fixed columns that align asymmetric magnitudes", async () => {
    const screen = await render(
      <div className="grid gap-2">
        <DiffStatLabel additions={1} deletions={999} />
        <DiffStatLabel additions={9_900_000} deletions={10_000} />
      </div>,
    );
    try {
      const grids = Array.from(
        screen.container.querySelectorAll<HTMLElement>("[data-diff-stat-grid]"),
      );
      expect(grids).toHaveLength(2);

      for (const grid of grids) {
        const columns = getComputedStyle(grid).gridTemplateColumns.split(" ");
        expect(getComputedStyle(grid).display).toBe("inline-grid");
        expect(columns).toHaveLength(2);
        expect(columns[0]).toBe(columns[1]);
        expect(Number.parseFloat(columns[0] ?? "0")).toBeGreaterThan(0);
      }

      const firstAdditions = grids[0]?.querySelector<HTMLElement>("[data-diff-stat-additions]");
      const secondAdditions = grids[1]?.querySelector<HTMLElement>("[data-diff-stat-additions]");
      const firstDeletions = grids[0]?.querySelector<HTMLElement>("[data-diff-stat-deletions]");
      const secondDeletions = grids[1]?.querySelector<HTMLElement>("[data-diff-stat-deletions]");
      expect(firstAdditions?.getBoundingClientRect().width).toBeCloseTo(
        secondAdditions?.getBoundingClientRect().width ?? 0,
        3,
      );
      expect(firstDeletions?.getBoundingClientRect().width).toBeCloseTo(
        secondDeletions?.getBoundingClientRect().width ?? 0,
        3,
      );
    } finally {
      await screen.unmount();
    }
  });

  it("shows the same exact localized counts in the tooltip", async () => {
    const screen = await render(<DiffStatLabel additions={15_000} deletions={9} />);
    try {
      const labelElement = screen.container.querySelector<HTMLElement>(
        '[aria-label="15,000 additions, 9 deletions"]',
      );
      expect(labelElement).toBeInstanceOf(HTMLElement);
      if (!labelElement) return;
      const label = page.getByLabelText("15,000 additions, 9 deletions");
      await label.hover();

      await vi.waitFor(() => {
        expect(page.getByText("15,000 additions, 9 deletions", { exact: true })).toBeVisible();
      });
    } finally {
      await screen.unmount();
    }
  });

  it("normalizes invalid counts and stays contained at 375px with increased type", async () => {
    await page.viewport(375, 720);
    const screen = await render(
      <div data-testid="narrow-stat-host" style={{ width: 343, fontSize: 24 }}>
        <DiffStatLabel additions={Number.POSITIVE_INFINITY} deletions={1_000_000_000_000} />
      </div>,
    );
    try {
      const host = screen.getByTestId("narrow-stat-host").element();
      const label = screen.container.querySelector<HTMLElement>(
        '[aria-label="0 additions, 1,000,000,000,000 deletions"]',
      );
      expect(label).toBeInstanceOf(HTMLElement);
      if (!label) return;
      expect(label.textContent).toBe("+0-1000b");
      expect(label.getBoundingClientRect().right).toBeLessThanOrEqual(
        host.getBoundingClientRect().right,
      );
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    } finally {
      await screen.unmount();
    }
  });

  it("keeps exact counts available when a focusable ancestor has its own label", async () => {
    const exactLabel = formatDiffStatAccessibleLabel(15_000, 9, "en-US");
    const screen = await render(
      <div className="grid gap-2">
        <button type="button" aria-label="Choose repo diff source" aria-description={exactLabel}>
          Branch <DiffStatLabel additions={15_000} deletions={9} />
        </button>
        <button type="button" aria-label="Open diff for Edited file" aria-description={exactLabel}>
          Edited file <DiffStatLabel additions={15_000} deletions={9} />
        </button>
      </div>,
    );
    try {
      for (const accessibleName of ["Choose repo diff source", "Open diff for Edited file"]) {
        const button = page.getByRole("button", { name: accessibleName });
        await expect.element(button).toHaveAttribute("aria-description", exactLabel);
        button.element().focus();
        expect(document.activeElement).toBe(button.element());
      }
      const statWrappers = screen.container.querySelectorAll<HTMLElement>("[data-diff-stat-label]");
      expect(statWrappers).toHaveLength(2);
      for (const wrapper of statWrappers) {
        expect(wrapper.tabIndex).toBe(-1);
      }
    } finally {
      await screen.unmount();
    }
  });

  it.each([14, 24])(
    "keeps long signed glyphs painted inside each 4ch cell at %spx",
    async (fontSize) => {
      const screen = await render(
        <div data-diff-stat-font-host style={{ fontSize }}>
          <DiffStatLabel additions={9_900_000} deletions={1_000_000_000_000} />
        </div>,
      );
      try {
        const host = screen.container.querySelector<HTMLElement>("[data-diff-stat-font-host]");
        expect(host).toBeInstanceOf(HTMLElement);
        if (!host) return;
        const grid = host.querySelector<HTMLElement>("[data-diff-stat-grid]");
        expect(grid).toBeInstanceOf(HTMLElement);
        const fourCharacterProbe = document.createElement("span");
        fourCharacterProbe.className = "font-chat-code";
        fourCharacterProbe.style.cssText = "position:absolute;display:block;width:4ch";
        host.append(fourCharacterProbe);
        const expectedCellWidth = fourCharacterProbe.getBoundingClientRect().width;

        let additionsGlyphBounds: DOMRect | undefined;
        let deletionsGlyphBounds: DOMRect | undefined;
        for (const kind of ["additions", "deletions"] as const) {
          const cell = screen.container.querySelector<HTMLElement>(`[data-diff-stat-${kind}]`);
          const glyph = screen.container.querySelector<HTMLElement>(
            `[data-diff-stat-${kind}-glyph]`,
          );
          expect(cell).toBeInstanceOf(HTMLElement);
          if (!cell) continue;
          const cellBounds = cell.getBoundingClientRect();
          const glyphBounds = glyph ? glyph.getBoundingClientRect() : textBounds(cell);
          expect(cellBounds.width).toBeCloseTo(expectedCellWidth, 3);
          expect(glyphBounds.left).toBeGreaterThanOrEqual(cellBounds.left);
          expect(glyphBounds.right).toBeLessThanOrEqual(cellBounds.right);
          if (kind === "additions") {
            additionsGlyphBounds = glyphBounds;
          } else {
            deletionsGlyphBounds = glyphBounds;
          }
        }
        if (additionsGlyphBounds && deletionsGlyphBounds) {
          expect(additionsGlyphBounds.right).toBeLessThanOrEqual(deletionsGlyphBounds.left);
        }
      } finally {
        await screen.unmount();
      }
    },
  );
});

function textBounds(element: HTMLElement): DOMRect {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getBoundingClientRect();
}
