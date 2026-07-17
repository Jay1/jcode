import "../index.css";

import type {
  GitBranch,
  GitListBranchesResult,
  GitStatusResult,
  NativeApi,
} from "@jcode/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { page, userEvent } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { gitQueryKeys } from "../lib/gitReactQuery";
import { buildThemeCssVariables, getCodeThemeSeed } from "../theme/theme.logic";
import { BranchToolbarBranchSelector } from "./BranchToolbarBranchSelector";

const TEST_CWD = "/repo/jcode";
const THEMES = ["light", "dark"] as const;
const WIDTHS = [375, 1280] as const;
const appliedThemeVariables = new Set<string>();

function applyTheme(theme: (typeof THEMES)[number]): void {
  const root = document.documentElement;
  const { variables } = buildThemeCssVariables(
    { codeThemeId: "github", theme: getCodeThemeSeed("github", theme) },
    theme,
  );
  root.classList.toggle("dark", theme === "dark");
  for (const [name, value] of Object.entries(variables)) {
    root.style.setProperty(name, value);
    appliedThemeVariables.add(name);
  }
}

function resetTheme(): void {
  document.documentElement.classList.remove("dark");
  for (const name of appliedThemeVariables) document.documentElement.style.removeProperty(name);
  appliedThemeVariables.clear();
}

function makeBranches(count: number): GitBranch[] {
  return Array.from({ length: count }, (_, index) => ({
    name: index === 0 ? "main" : `feature/branch-${String(index).padStart(2, "0")}`,
    current: index === 0,
    isDefault: index === 0,
    worktreePath: null,
  }));
}

function makeStatus(): GitStatusResult {
  return {
    branch: "main",
    hasWorkingTreeChanges: true,
    workingTree: {
      files: [{ path: "src/dirty.ts", insertions: 12, deletions: 3 }],
      insertions: 12,
      deletions: 3,
    },
    hasUpstream: true,
    upstreamBranch: "origin/main",
    aheadCount: 0,
    behindCount: 0,
    pr: null,
  };
}

async function mountSelector(
  branchCount: number,
  onSetThreadWorkspace: (patch: {
    branch?: string | null;
    worktreePath?: string | null;
  }) => void = () => {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const branchResult: GitListBranchesResult = {
    isRepo: true,
    hasOriginRemote: true,
    branches: makeBranches(branchCount),
  };
  let checkedOutBranch = "main";
  const gitApi: Pick<NativeApi["git"], "checkout" | "listBranches" | "status"> = {
    checkout: vi.fn(async ({ branch }) => {
      checkedOutBranch = branch;
    }),
    listBranches: vi.fn(async () => branchResult),
    status: vi.fn(async () => ({ ...makeStatus(), branch: checkedOutBranch })),
  };
  window.nativeApi = { git: gitApi } as NativeApi;
  client.setQueryData(gitQueryKeys.branches(TEST_CWD), branchResult);
  client.setQueryData(gitQueryKeys.status(TEST_CWD), makeStatus());

  return render(
    <QueryClientProvider client={client}>
      <main className="flex min-h-dvh items-end justify-end bg-background p-6 text-foreground">
        <BranchToolbarBranchSelector
          activeProjectCwd={TEST_CWD}
          activeThreadBranch="main"
          activeWorktreePath={null}
          branchCwd={TEST_CWD}
          effectiveEnvMode="local"
          envLocked
          onSetThreadWorkspace={onSetThreadWorkspace}
        />
      </main>
    </QueryClientProvider>,
  );
}

async function getViewport(): Promise<HTMLElement> {
  let viewport: HTMLElement | null = null;
  await vi.waitFor(() => {
    viewport = document.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
    expect(viewport).toBeInstanceOf(HTMLElement);
  });
  if (!viewport) throw new Error("Branch selector scroll viewport was not rendered.");
  return viewport;
}

async function openSelector(container: HTMLElement): Promise<HTMLElement> {
  const trigger = container.querySelector<HTMLElement>('[data-slot="combobox-trigger"]');
  expect(trigger).toBeInstanceOf(HTMLElement);
  if (!trigger) throw new Error("Branch selector trigger was not rendered.");
  trigger.click();
  return getViewport();
}

function overflowMetrics(viewport: HTMLElement) {
  const style = getComputedStyle(viewport);
  return {
    clientHeight: viewport.clientHeight,
    scrollHeight: viewport.scrollHeight,
    scrollTop: viewport.scrollTop,
    start: Number.parseFloat(style.getPropertyValue("--scroll-area-overflow-y-start")) || 0,
    end: Number.parseFloat(style.getPropertyValue("--scroll-area-overflow-y-end")) || 0,
    maskImage: style.maskImage,
  };
}

async function waitForOverflow(viewport: HTMLElement, state: "top" | "middle" | "end") {
  await vi.waitFor(() => {
    const metrics = overflowMetrics(viewport);
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
    expect(metrics.maskImage).not.toBe("none");
    if (state === "top") {
      expect(metrics.start).toBe(0);
      expect(metrics.end).toBeGreaterThan(0);
    } else if (state === "middle") {
      expect(metrics.start).toBeGreaterThan(0);
      expect(metrics.end).toBeGreaterThan(0);
    } else {
      expect(metrics.start).toBeGreaterThan(0);
      expect(metrics.end).toBe(0);
    }
  });
}

function dispatchPageDown(input: Element): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: "PageDown",
  });
  input.dispatchEvent(event);
  return event;
}

describe("BranchToolbarBranchSelector overflow", () => {
  afterEach(async () => {
    resetTheme();
    document.body.innerHTML = "";
    Reflect.deleteProperty(window, "nativeApi");
    await page.viewport(1280, 720);
  });

  it.each([
    { count: 39, virtualized: false },
    { count: 40, virtualized: false },
    { count: 41, virtualized: true },
  ])(
    "uses the exact virtualization threshold at $count branches",
    async ({ count, virtualized }) => {
      const screen = await mountSelector(count);
      try {
        const viewport = await openSelector(screen.container);
        await waitForOverflow(viewport, "top");
        const scrollViewports = Array.from(
          document.querySelectorAll<HTMLElement>('[data-slot="scroll-area-viewport"]'),
        );
        expect(scrollViewports).toHaveLength(1);
        expect(
          scrollViewports.filter((element) => getComputedStyle(element).maskImage !== "none"),
        ).toHaveLength(1);
        const renderedItems = document.querySelectorAll('[data-slot="combobox-item"]').length;
        if (virtualized) {
          expect(renderedItems).toBeLessThan(count);
        } else {
          expect(renderedItems).toBe(count);
        }
        expect(page.getByText("Uncommitted: 1 file")).toBeVisible();
      } finally {
        await screen.unmount();
      }
    },
  );

  it.each([39, 40])(
    "leaves PageDown uncancelled with %s nonvirtual branches",
    async (branchCount) => {
      const screen = await mountSelector(branchCount);
      try {
        await openSelector(screen.container);
        const searchInput = page.getByPlaceholder("Search branches...").element();

        const pageDown = dispatchPageDown(searchInput);

        expect(pageDown.defaultPrevented).toBe(false);
      } finally {
        await screen.unmount();
      }
    },
  );

  it("leaves PageDown uncancelled after search disables virtualization and after close", async () => {
    const screen = await mountSelector(50);
    try {
      await openSelector(screen.container);
      const search = page.getByPlaceholder("Search branches...");
      await search.fill("feature/branch-0");
      await vi.waitFor(() =>
        expect(document.querySelectorAll('[data-slot="combobox-item"]')).toHaveLength(9),
      );
      const searchInput = search.element();

      const filteredPageDown = dispatchPageDown(searchInput);
      expect(filteredPageDown.defaultPrevented).toBe(false);

      searchInput.focus();
      await userEvent.keyboard("{Escape}");
      await vi.waitFor(() => expect(searchInput.isConnected).toBe(false));
      const closedPageDown = dispatchPageDown(searchInput);
      expect(closedPageDown.defaultPrevented).toBe(false);
    } finally {
      await screen.unmount();
    }
  });

  it.each([41, 50])("handles PageDown with %s open virtualized branches", async (branchCount) => {
    const screen = await mountSelector(branchCount);
    try {
      const viewport = await openSelector(screen.container);
      const searchInput = page.getByPlaceholder("Search branches...").element();

      const pageDown = dispatchPageDown(searchInput);

      expect(pageDown.defaultPrevented).toBe(true);
      await vi.waitFor(() => expect(viewport.scrollTop).toBeGreaterThan(0));
    } finally {
      await screen.unmount();
    }
  });

  it("reports real top, middle, and end overflow for a virtualized branch list", async () => {
    await page.viewport(375, 720);
    const screen = await mountSelector(50);
    try {
      const viewport = await openSelector(screen.container);
      await waitForOverflow(viewport, "top");
      const statusRow = page
        .getByText("Uncommitted: 1 file")
        .element()
        .closest<HTMLElement>('[data-slot="combobox-item"]');
      expect(statusRow).toBeInstanceOf(HTMLElement);
      const statusRowHeight = statusRow?.getBoundingClientRect().height;
      if (!statusRow) return;
      expect(statusRowHeight).toBe(48);
      const renderedRows = Array.from(
        document.querySelectorAll<HTMLElement>('[data-slot="combobox-item"]'),
      );
      for (const [index, row] of renderedRows.entries()) {
        expect(row.getBoundingClientRect().height).toBe(row === statusRow ? 48 : 28);
        const nextRow = renderedRows[index + 1];
        if (nextRow) {
          expect(nextRow.getBoundingClientRect().top).toBeGreaterThanOrEqual(
            row.getBoundingClientRect().bottom,
          );
        }
      }
      const topMetrics = overflowMetrics(viewport);

      viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
      viewport.dispatchEvent(new Event("scroll"));
      await waitForOverflow(viewport, "middle");
      const middleMetrics = overflowMetrics(viewport);

      viewport.scrollTop = viewport.scrollHeight;
      viewport.dispatchEvent(new Event("scroll"));
      await waitForOverflow(viewport, "end");
      await expect.element(page.getByText("feature/branch-49", { exact: true })).toBeVisible();
      expect(topMetrics.start).toBe(0);
      expect(topMetrics.end).toBeGreaterThan(0);
      expect(middleMetrics.start).toBeGreaterThan(0);
      expect(middleMetrics.end).toBeGreaterThan(0);
      expect(overflowMetrics(viewport).end).toBe(0);
      expect(statusRowHeight).toBeGreaterThan(0);
    } finally {
      await screen.unmount();
    }
  });

  it("resets overflow after search shrink and after close and reopen", async () => {
    const screen = await mountSelector(50);
    try {
      const viewport = await openSelector(screen.container);
      viewport.scrollTop = viewport.scrollHeight;
      viewport.dispatchEvent(new Event("scroll"));
      await waitForOverflow(viewport, "end");

      const search = page.getByPlaceholder("Search branches...");
      await search.fill("feature/branch-0");
      await vi.waitFor(() => {
        expect(document.querySelectorAll('[data-slot="combobox-item"]')).toHaveLength(9);
        expect(viewport.scrollTop).toBe(0);
      });
      await waitForOverflow(viewport, "top");
      await expect.element(page.getByText("feature/branch-09", { exact: true })).toBeVisible();

      search.element().focus();
      await userEvent.keyboard("{Escape}");
      await vi.waitFor(() => expect(viewport.isConnected).toBe(false));
      const reopenedViewport = await openSelector(screen.container);
      await waitForOverflow(reopenedViewport, "top");
      expect(reopenedViewport.scrollTop).toBe(0);
      await expect.element(page.getByText("Uncommitted: 1 file")).toBeVisible();
    } finally {
      await screen.unmount();
    }
  });

  it("keeps keyboard and wheel navigation connected to the virtual list", async () => {
    const onSetThreadWorkspace = vi.fn();
    const screen = await mountSelector(50, onSetThreadWorkspace);
    try {
      const viewport = await openSelector(screen.container);
      const search = page.getByPlaceholder("Search branches...");
      search.element().focus();
      await userEvent.keyboard("{ArrowDown}");
      expect(document.querySelector<HTMLElement>("[data-highlighted]")?.textContent).toContain(
        "feature/branch-01",
      );
      await userEvent.keyboard("{PageDown}");
      await vi.waitFor(() => expect(viewport.scrollTop).toBeGreaterThan(0));

      viewport.scrollTop = 0;
      viewport.dispatchEvent(new Event("scroll"));
      await userEvent.wheel(viewport, { delta: { y: 420 } });
      await vi.waitFor(() => expect(viewport.scrollTop).toBeGreaterThan(0));

      await userEvent.keyboard("{End}");
      await waitForOverflow(viewport, "end");
      expect(document.activeElement).toBe(search.element());
      const finalRow = page.getByText("feature/branch-49", { exact: true });
      await expect.element(finalRow).toBeVisible();
      const bounds = finalRow.element().closest<HTMLElement>('[data-slot="combobox-item"]');
      expect(bounds?.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        viewport.getBoundingClientRect().bottom,
      );
      const activeId = search.element().getAttribute("aria-activedescendant");
      const activeElement = activeId ? document.getElementById(activeId) : null;
      expect(activeElement?.textContent).toContain("feature/branch-49");
      expect(activeElement?.isConnected).toBe(true);
      await userEvent.keyboard("{ArrowUp}");
      expect(document.querySelector<HTMLElement>("[data-highlighted]")?.textContent).toContain(
        "feature/branch-48",
      );
      await userEvent.keyboard("{End}");
      await expect.element(finalRow).toBeVisible();
      await userEvent.keyboard("{Enter}");
      await vi.waitFor(() => expect(viewport.isConnected).toBe(false));
      await vi.waitFor(() =>
        expect(onSetThreadWorkspace).toHaveBeenCalledWith({
          branch: "feature/branch-49",
          worktreePath: null,
        }),
      );
      const reopenedViewport = await openSelector(screen.container);
      await waitForOverflow(reopenedViewport, "top");
      await expect.element(page.getByText("Uncommitted: 1 file")).toBeVisible();
    } finally {
      await screen.unmount();
    }
  });

  it.each(THEMES.flatMap((theme) => WIDTHS.map((width) => ({ theme, width }))))(
    "verifies $theme overflow states at $width px",
    async ({ theme, width }) => {
      await page.viewport(width, 720);
      applyTheme(theme);
      const screen = await mountSelector(50);
      try {
        const viewport = await openSelector(screen.container);
        await waitForOverflow(viewport, "top");
        await vi.waitFor(() => {
          const popup = document.querySelector<HTMLElement>('[data-slot="combobox-popup"]');
          expect(popup).toBeInstanceOf(HTMLElement);
          expect(popup ? getComputedStyle(popup).opacity : "0").toBe("1");
        });
        viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
        viewport.dispatchEvent(new Event("scroll"));
        await waitForOverflow(viewport, "middle");
        const popup = document.querySelector<HTMLElement>('[data-slot="combobox-popup"]');
        const popupSurface = popup?.parentElement;
        const viewportStyle = getComputedStyle(viewport);
        expect(popupSurface).toBeInstanceOf(HTMLElement);
        expect(
          popupSurface ? getComputedStyle(popupSurface).backgroundColor : "transparent",
        ).not.toBe("rgba(0, 0, 0, 0)");
        expect(viewportStyle.maskComposite).not.toBe("none");
        const viewportBounds = viewport.getBoundingClientRect();
        const elementBelowViewport = document.elementFromPoint(
          viewportBounds.left + viewportBounds.width / 2,
          viewportBounds.bottom + 8,
        );
        expect(popup?.contains(elementBelowViewport)).toBe(true);
        viewport.scrollTop = viewport.scrollHeight;
        viewport.dispatchEvent(new Event("scroll"));
        await waitForOverflow(viewport, "end");
        await expect.element(page.getByText("feature/branch-49", { exact: true })).toBeVisible();
      } finally {
        await screen.unmount();
      }
    },
  );
});
