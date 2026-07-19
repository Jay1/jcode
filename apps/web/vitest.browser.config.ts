import { fileURLToPath } from "node:url";
import { defineBrowserCommand, playwright } from "@vitest/browser-playwright";
import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

const srcPath = fileURLToPath(new URL("./src", import.meta.url));
const localTestProfile = process.env.JCODE_LOCAL_TEST_PROFILE === "1";
const browserApiPort = Number(process.env.VITEST_BROWSER_API_PORT ?? 63315);

export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      alias: {
        "~": srcPath,
      },
    },
    test: {
      ...(localTestProfile
        ? {
            fileParallelism: false,
            maxConcurrency: 1,
            minWorkers: 1,
            maxWorkers: 1,
          }
        : {}),
      include: ["src/components/**/*.browser.tsx"],
      browser: {
        enabled: true,
        api: {
          host: "127.0.0.1",
          port: Number.isFinite(browserApiPort) ? browserApiPort : 63315,
          strictPort: false,
        },
        fileParallelism: localTestProfile ? false : undefined,
        provider: playwright(),
        commands: {
          dragSidebarProject: defineBrowserCommand(async ({ frame, page }, sourceId, targetId) => {
            const testerFrame = await frame();
            const source = testerFrame.locator(`button[data-sidebar-project-id="${sourceId}"]`);
            const target = testerFrame.locator(`button[data-sidebar-project-id="${targetId}"]`);
            const [sourceBounds, targetBounds] = await Promise.all([
              source.boundingBox(),
              target.boundingBox(),
            ]);
            if (sourceBounds === null || targetBounds === null) {
              throw new Error("Missing visible sidebar project drag activator");
            }
            const sourcePoint = {
              x: sourceBounds.x + sourceBounds.width / 2,
              y: sourceBounds.y + sourceBounds.height / 2,
            };
            const targetPoint = {
              x: targetBounds.x + targetBounds.width / 2,
              y: targetBounds.y + targetBounds.height / 2,
            };
            await page.mouse.move(sourcePoint.x, sourcePoint.y);
            await page.mouse.down();
            try {
              await page.mouse.move(sourcePoint.x, sourcePoint.y + 8, { steps: 2 });
              await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 8 });
            } finally {
              await page.mouse.up();
            }
          }),
          dragPinnedThread: defineBrowserCommand(async ({ frame, page }, sourceId, targetId) => {
            const testerFrame = await frame();
            const source = testerFrame.locator(
              `button[data-pinned-thread-drag-handle="${sourceId}"]`,
            );
            const target = testerFrame.locator(`[data-pinned-thread-id="${targetId}"]`);
            const [sourceBounds, targetBounds] = await Promise.all([
              source.boundingBox(),
              target.boundingBox(),
            ]);
            if (sourceBounds === null || targetBounds === null) {
              throw new Error("Missing visible pinned-thread drag activator");
            }
            await page.mouse.move(
              sourceBounds.x + sourceBounds.width / 2,
              sourceBounds.y + sourceBounds.height / 2,
            );
            await page.mouse.down();
            try {
              await page.mouse.move(sourceBounds.x, sourceBounds.y + 8, { steps: 2 });
              await page.mouse.move(
                targetBounds.x + targetBounds.width / 2,
                targetBounds.y + targetBounds.height / 2,
                { steps: 8 },
              );
            } finally {
              await page.mouse.up();
            }
          }),
          dragPinnedThreadOutOfBounds: defineBrowserCommand(async ({ frame, page }, sourceId) => {
            const testerFrame = await frame();
            const sourceHandle = testerFrame.locator(
              `button[data-pinned-thread-drag-handle="${sourceId}"]`,
            );
            const sourceRow = testerFrame.locator(`[data-pinned-thread-id="${sourceId}"]`);
            const list = testerFrame.locator("[data-pinned-thread-list]");
            const [sourceBounds, listBounds] = await Promise.all([
              sourceHandle.boundingBox(),
              list.boundingBox(),
            ]);
            if (sourceBounds === null || listBounds === null) {
              throw new Error("Missing pinned-thread containment bounds");
            }
            const sourcePoint = {
              x: sourceBounds.x + sourceBounds.width / 2,
              y: sourceBounds.y + sourceBounds.height / 2,
            };
            await page.mouse.move(sourcePoint.x, sourcePoint.y);
            await page.mouse.down();
            try {
              await page.mouse.move(sourceBounds.x, sourceBounds.y + 8, { steps: 2 });
              await testerFrame
                .locator(
                  `button[data-pinned-thread-drag-handle="${sourceId}"][aria-pressed="true"]`,
                )
                .waitFor({ state: "attached", timeout: 5_000 });
              await page.mouse.move(listBounds.x + listBounds.width + 160, sourceBounds.y + 8, {
                steps: 8,
              });
              await testerFrame.evaluate(
                () =>
                  new Promise<void>((resolve) => {
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
                  }),
              );
              const activeBounds = await sourceRow.boundingBox();
              if (activeBounds === null) {
                throw new Error("Missing active pinned-thread bounds");
              }
              return (
                activeBounds.x >= listBounds.x - 0.5 &&
                activeBounds.x + activeBounds.width <= listBounds.x + listBounds.width + 0.5
              );
            } finally {
              await page.mouse.up();
            }
          }),
          keyboardMovePinnedThread: defineBrowserCommand(async ({ frame }, sourceId, direction) => {
            const testerFrame = await frame();
            const source = testerFrame.locator(
              `button[data-pinned-thread-drag-handle="${sourceId}"]`,
            );
            await source.focus();
            await source.press("Space");
            await testerFrame
              .locator(`button[data-pinned-thread-drag-handle="${sourceId}"][aria-pressed="true"]`)
              .waitFor({ state: "attached", timeout: 5_000 });
            let movedOverSibling = false;
            for (let attempt = 0; attempt < 4; attempt += 1) {
              await source.press(String(direction));
              await testerFrame.evaluate(
                () =>
                  new Promise<void>((resolve) => {
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
                  }),
              );
              const announcements = await testerFrame
                .locator('[aria-live="assertive"]')
                .allTextContents();
              movedOverSibling = announcements.some(
                (announcement) =>
                  announcement.includes(
                    `Draggable item ${sourceId} was moved over droppable area`,
                  ) && !announcement.includes(`droppable area ${sourceId}.`),
              );
              if (movedOverSibling) {
                break;
              }
            }
            if (!movedOverSibling) {
              throw new Error("Keyboard drag did not announce a sibling target");
            }
            await source.press("Space");
            await testerFrame
              .locator(`button[data-pinned-thread-drag-handle="${sourceId}"][aria-pressed="false"]`)
              .waitFor({ state: "attached", timeout: 5_000 });
          }),
          selectProjectSortOption: defineBrowserCommand(async ({ frame, page }, name) => {
            const testerFrame = await frame();
            const triggerCandidates = testerFrame.getByRole("button", {
              name: "Sort projects",
              exact: true,
            });
            const triggerCount = await triggerCandidates.count();
            let visibleTriggerIndex = -1;
            for (let index = 0; index < triggerCount; index += 1) {
              const candidate = triggerCandidates.nth(index);
              if (await candidate.isVisible()) {
                visibleTriggerIndex = index;
                break;
              }
            }
            if (visibleTriggerIndex < 0) {
              throw new Error("Missing visible project sort trigger");
            }
            const visibleTrigger = triggerCandidates.nth(visibleTriggerIndex);
            if ((await visibleTrigger.getAttribute("aria-expanded")) !== "true") {
              await testerFrame
                .locator('[role="menu"]:visible')
                .waitFor({ state: "hidden", timeout: 5_000 });
              await visibleTrigger.click({ timeout: 5_000 });
            }
            const openMenu = testerFrame.locator('[role="menu"]:visible').last();
            await openMenu.waitFor({ state: "visible", timeout: 5_000 });
            const candidate = openMenu.getByRole("menuitemradio", { name, exact: true }).first();
            await candidate.waitFor({ state: "visible", timeout: 5_000 });
            const bounds = await candidate.boundingBox();
            if (bounds === null) {
              throw new Error(`Missing bounds for visible menu radio item: ${name}`);
            }
            await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            await page.mouse.down();
            await page.mouse.up();
            await page.keyboard.press("Escape");
            await openMenu.waitFor({ state: "hidden", timeout: 5_000 });
          }),
          clickProjectThreadPin: defineBrowserCommand(async ({ frame }, threadId) => {
            const testerFrame = await frame();
            await testerFrame
              .locator(`[data-sidebar-thread-id="${threadId}"]`)
              .getByRole("button", { name: "Pin thread", exact: true })
              .click();
          }),
          clickPinnedThreadUnpin: defineBrowserCommand(async ({ frame }, threadId) => {
            const testerFrame = await frame();
            await testerFrame
              .locator(`[data-pinned-thread-id="${threadId}"]`)
              .getByRole("button", { name: "Unpin thread", exact: true })
              .click();
          }),
        },
        instances: [{ browser: "chromium" }],
        headless: true,
      },
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  }),
);
