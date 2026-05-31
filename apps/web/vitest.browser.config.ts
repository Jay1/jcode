import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

const srcPath = fileURLToPath(new URL("./src", import.meta.url));
const localTestProfile = process.env.JCODE_LOCAL_TEST_PROFILE === "1";

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
            maxConcurrency: 1,
            maxWorkers: 1,
          }
        : {}),
      include: ["src/components/**/*.browser.tsx"],
      browser: {
        enabled: true,
        fileParallelism: localTestProfile ? false : undefined,
        provider: playwright(),
        instances: [{ browser: "chromium" }],
        headless: true,
      },
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  }),
);
