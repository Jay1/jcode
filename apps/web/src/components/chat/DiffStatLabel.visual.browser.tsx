import "../../index.css";

import { TurnId } from "@jcode/contracts";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import type { WorkLogEntry } from "../../session-logic";
import type { TurnDiffFileChange } from "../../types";
import { buildThemeCssVariables, getCodeThemeSeed } from "../../theme/theme.logic";
import { ChangedFilesTree } from "./ChangedFilesTree";
import { DiffStatLabel } from "./DiffStatLabel";
import { formatDiffStatAccessibleLabel } from "./DiffStatLabel.logic";
import { SimpleWorkEntryRow } from "./MessagesTimeline";

const TREE_FILES: readonly TurnDiffFileChange[] = [
  { path: "README.md", kind: "modified", additions: 999, deletions: 1 },
  {
    path: "apps/web/src/DiffStatLabel.tsx",
    kind: "modified",
    additions: 9_900_000,
    deletions: 10_000,
  },
  { path: "apps/web/package.json", kind: "modified", additions: 1_500, deletions: 0 },
  { path: "apps/server/main.ts", kind: "modified", additions: 1, deletions: 1 },
];

const TIMELINE_FILE = "apps/web/src/components/chat/MessagesTimeline.tsx";
const TIMELINE_ENTRY = {
  id: "visual-diff-stat-work",
  createdAt: "2026-07-16T12:00:00.000Z",
  label: "File Change",
  tone: "tool",
  requestKind: "file-change",
  changedFiles: [TIMELINE_FILE],
} satisfies WorkLogEntry;

const VIEWPORTS = [375, 768, 1280] as const;
const THEMES = ["light", "dark"] as const;
const appliedThemeVariableNames = new Set<string>();

function applyFixtureTheme(theme: (typeof THEMES)[number]): void {
  const root = document.documentElement;
  const { variables } = buildThemeCssVariables(
    { codeThemeId: "github", theme: getCodeThemeSeed("github", theme) },
    theme,
  );
  root.classList.toggle("dark", theme === "dark");
  root.setAttribute("data-theme-variant", theme);
  for (const [name, value] of Object.entries(variables)) {
    root.style.setProperty(name, value);
    appliedThemeVariableNames.add(name);
  }
}

function resetFixtureTheme(): void {
  const root = document.documentElement;
  root.classList.remove("dark");
  root.removeAttribute("data-theme-variant");
  for (const name of appliedThemeVariableNames) {
    root.style.removeProperty(name);
  }
  appliedThemeVariableNames.clear();
}

describe("DiffStatLabel visual matrix", () => {
  afterEach(async () => {
    resetFixtureTheme();
    window.localStorage.clear();
    document.body.innerHTML = "";
    await page.viewport(1280, 720);
  });

  it.each(THEMES.flatMap((theme) => VIEWPORTS.map((width) => ({ theme, width }))))(
    "verifies shared diff statistics in $theme at $width px",
    async ({ theme, width }) => {
      await page.viewport(width, 720);
      applyFixtureTheme(theme);

      const screen = await render(
        <main className="min-h-dvh bg-[var(--app-surface-canvas)] p-4 text-foreground">
          <div className="mx-auto grid w-full max-w-3xl gap-4">
            <section
              aria-label="Branch diff header"
              className="flex min-w-0 items-center gap-2 rounded-lg border border-[color:var(--app-surface-toolbar-border)] bg-[var(--app-surface-toolbar)] px-3 py-2"
            >
              <span className="font-system-ui min-w-0 flex-1 truncate text-sm font-medium">
                Branch changes
              </span>
              <span className="shrink-0 text-xs">
                <DiffStatLabel
                  additions={1_500_000_000}
                  deletions={1_000_000_000_000}
                  showParentheses
                />
              </span>
            </section>

            <section
              aria-label="Timeline changed-file row"
              className="rounded-lg border border-[color:var(--app-work-row-border)] bg-[var(--app-diff-card-bg)] p-2"
            >
              <p className="font-system-ui mb-1 text-xs text-[var(--app-metadata-muted-fg)]">
                Timeline checkpoint
              </p>
              <SimpleWorkEntryRow
                workEntry={TIMELINE_ENTRY}
                chatMetaFontSizePx={16}
                textFontSizePx={16}
                density="compact"
                fileDiffStatByPath={new Map([[TIMELINE_FILE, { additions: 15_000, deletions: 9 }]])}
                turnId={TurnId.makeUnsafe(`visual-timeline-${theme}-${width}`)}
                onOpenTurnDiff={() => {}}
                workspaceRoot="/repo/jcode"
              />
            </section>

            <section
              aria-label="Expanded changed-files tree"
              className="overflow-hidden rounded-lg border border-[color:var(--app-work-row-border)] bg-[var(--app-diff-card-bg)]"
            >
              <div className="border-b border-[color:var(--app-work-row-border)] bg-[var(--app-diff-card-header-bg)] px-3 py-2">
                <span className="font-system-ui text-sm font-medium">Changed files</span>
              </div>
              <ChangedFilesTree
                turnId={TurnId.makeUnsafe(`visual-stat-${theme}-${width}`)}
                files={TREE_FILES}
                allDirectoriesExpanded
                resolvedTheme={theme}
                onOpenTurnDiff={() => {}}
              />
            </section>
          </div>
        </main>,
      );
      try {
        const grids = screen.container.querySelectorAll<HTMLElement>("[data-diff-stat-grid]");
        expect(grids.length).toBeGreaterThanOrEqual(7);
        for (const grid of grids) {
          const columns = getComputedStyle(grid).gridTemplateColumns.split(" ");
          expect(columns).toHaveLength(2);
          expect(columns[0]).toBe(columns[1]);
        }
        const timelineRow = screen.container.querySelector<HTMLElement>(
          '[data-file-change-row="true"]',
        );
        expect(timelineRow).toHaveAttribute(
          "aria-description",
          formatDiffStatAccessibleLabel(15_000, 9, "en-US"),
        );
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
      } finally {
        await screen.unmount();
      }
    },
  );
});
