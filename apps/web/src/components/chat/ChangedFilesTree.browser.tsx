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
});
