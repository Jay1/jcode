import * as path from "node:path";
import { defineConfig } from "vitest/config";

const localTestProfile = process.env.JCODE_LOCAL_TEST_PROFILE === "1";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@jcode\/contracts$/,
        replacement: path.resolve(import.meta.dirname, "./packages/contracts/src/index.ts"),
      },
    ],
  },
  test: {
    ...(localTestProfile
      ? {
          fileParallelism: false,
          maxConcurrency: 2,
          maxWorkers: 2,
        }
      : {}),
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html", "json"],
      include: ["src/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "*.ts"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.browser.{ts,tsx}",
        "**/*.config.{ts,tsx}",
        "**/_generated/**",
        "**/dist/**",
        "**/dist-electron/**",
        "**/node_modules/**",
      ],
    },
  },
});
