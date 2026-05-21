import * as path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@t3tools\/contracts$/,
        replacement: path.resolve(import.meta.dirname, "./packages/contracts/src/index.ts"),
      },
    ],
  },
  test: {
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
