import "../../index.css";

import { TurnId } from "@jcode/contracts";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { TurnDiffFileChange } from "../../types";
import { ChangedFilesTree } from "./ChangedFilesTree";

const FILES: TurnDiffFileChange[] = [
  { path: "apps/web/src/app.ts", kind: "modified", additions: 1, deletions: 0 },
];

const GEOMETRY_FILES: TurnDiffFileChange[] = [
  { path: "README.md", kind: "modified", additions: 2, deletions: 1 },
  { path: "apps/web/src/app.ts", kind: "modified", additions: 15_000, deletions: 9 },
  { path: "apps/web/src/components/leaf.ts", kind: "modified", additions: 1, deletions: 0 },
  { path: "apps/web/package.json", kind: "modified", additions: 1, deletions: 0 },
  { path: "apps/server/main.ts", kind: "modified", additions: 1, deletions: 0 },
];

describe("ChangedFilesTree", () => {
  afterEach(() => {
    window.localStorage.clear();
    document.body.innerHTML = "";
  });

  it("honors collapsed directory state on initial render", async () => {
    const screen = await render(
      <ChangedFilesTree
        turnId={TurnId.makeUnsafe("turn-collapsed")}
        files={FILES}
        allDirectoriesExpanded={false}
        resolvedTheme="light"
        onOpenTurnDiff={vi.fn()}
      />,
    );
    try {
      await vi.waitFor(() => {
        expect(page.getByText("apps")).toBeVisible();
      });

      expect(screen.container.textContent).not.toContain("app.ts");
    } finally {
      await screen.unmount();
    }
  });

  it("does not carry expanded directories to a different turn", async () => {
    const screen = await render(
      <ChangedFilesTree
        turnId={TurnId.makeUnsafe("turn-expanded")}
        files={FILES}
        allDirectoriesExpanded={false}
        resolvedTheme="light"
        onOpenTurnDiff={vi.fn()}
      />,
    );
    try {
      await page.getByText("apps").click();
      await vi.waitFor(() => {
        expect(page.getByText("app.ts")).toBeVisible();
      });

      await screen.rerender(
        <ChangedFilesTree
          turnId={TurnId.makeUnsafe("turn-fresh")}
          files={FILES}
          allDirectoriesExpanded={false}
          resolvedTheme="light"
          onOpenTurnDiff={vi.fn()}
        />,
      );

      await vi.waitFor(() => {
        expect(page.getByText("apps")).toBeVisible();
      });
      expect(screen.container.textContent).not.toContain("app.ts");
    } finally {
      await screen.unmount();
    }
  });

  it("keeps root and nested rows on the established 14px indentation rhythm", async () => {
    const screen = await render(
      <div style={{ width: 640 }}>
        <ChangedFilesTree
          turnId={TurnId.makeUnsafe("turn-geometry")}
          files={GEOMETRY_FILES}
          allDirectoriesExpanded
          resolvedTheme="light"
          onOpenTurnDiff={vi.fn()}
        />
      </div>,
    );
    try {
      await vi.waitFor(() => {
        expect(page.getByText("app.ts")).toBeVisible();
      });

      const rowFor = (name: string): HTMLButtonElement => {
        const row = page.getByText(name, { exact: true }).element().closest("button");
        expect(row).toBeInstanceOf(HTMLButtonElement);
        if (!(row instanceof HTMLButtonElement)) {
          throw new TypeError(`Expected ${name} to render inside a button row.`);
        }
        return row;
      };
      const labelLeft = (name: string): number =>
        page.getByText(name, { exact: true }).element().getBoundingClientRect().left;

      expect(getComputedStyle(rowFor("README.md")).paddingLeft).toBe("8px");
      expect(getComputedStyle(rowFor("apps")).paddingLeft).toBe("8px");
      expect(getComputedStyle(rowFor("web")).paddingLeft).toBe("22px");
      expect(getComputedStyle(rowFor("src")).paddingLeft).toBe("36px");
      expect(getComputedStyle(rowFor("app.ts")).paddingLeft).toBe("50px");
      expect(labelLeft("web") - labelLeft("apps")).toBeCloseTo(14, 3);
      expect(labelLeft("src") - labelLeft("web")).toBeCloseTo(14, 3);
      expect(labelLeft("app.ts") - labelLeft("src")).toBeCloseTo(14, 3);

      const appStat = screen.container.querySelector<HTMLElement>(
        '[aria-label="15,000 additions, 9 deletions"]',
      );
      expect(appStat).toBeInstanceOf(HTMLElement);
      expect(appStat?.textContent).toBe("+15k-9");
      const appStatGrid = appStat?.querySelector<HTMLElement>("[data-diff-stat-grid]");
      expect(appStatGrid).toBeInstanceOf(HTMLElement);
      expect(
        getComputedStyle(appStatGrid ?? document.body).gridTemplateColumns.split(" "),
      ).toHaveLength(2);
    } finally {
      await screen.unmount();
    }
  });
});
