import { describe, expect, it } from "vitest";

import {
  createLocalSafeRunArgs,
  createVitestBrowserArgs,
  resolveBrowserRunnerEnv,
  shouldUseLocalSafeRun,
} from "./vitest-browser-runner.mjs";

describe("vitest browser runner", () => {
  it("defaults local runs to the local test profile outside CI", () => {
    expect(resolveBrowserRunnerEnv({}).JCODE_LOCAL_TEST_PROFILE).toBe("1");
    expect(resolveBrowserRunnerEnv({ CI: "true" }).JCODE_LOCAL_TEST_PROFILE).toBe("0");
    expect(
      resolveBrowserRunnerEnv({ JCODE_LOCAL_TEST_PROFILE: "0" }).JCODE_LOCAL_TEST_PROFILE,
    ).toBe("0");
  });

  it("constructs the Vitest browser command without changing filters", () => {
    expect(createVitestBrowserArgs(["src/example.browser.tsx", "-t", "only this"])).toEqual([
      "vitest",
      "run",
      "--config",
      "vitest.browser.config.ts",
      "src/example.browser.tsx",
      "-t",
      "only this",
    ]);
  });

  it("uses conservative local safe-run limits by default", () => {
    expect(
      createLocalSafeRunArgs({
        env: {},
        nodePath: "/node",
        scriptPath: "/repo/scripts/run-vitest-browser.mjs",
        testArgs: ["src/example.browser.tsx"],
      }),
    ).toEqual([
      "--profile",
      "browser",
      "--mem",
      "3G",
      "--high",
      "2G",
      "--cpu",
      "150%",
      "--tasks",
      "192",
      "--timeout",
      "20min",
      "--",
      "env",
      "JCODE_BROWSER_TEST_SAFE_RUN_ACTIVE=1",
      "JCODE_LOCAL_TEST_PROFILE=1",
      "/node",
      "/repo/scripts/run-vitest-browser.mjs",
      "src/example.browser.tsx",
    ]);
  });

  it("allows explicit safe-run resource overrides", () => {
    expect(
      createLocalSafeRunArgs({
        env: {
          JCODE_BROWSER_TEST_SAFE_RUN_CPU: "75%",
          JCODE_BROWSER_TEST_SAFE_RUN_HIGH: "1G",
          JCODE_BROWSER_TEST_SAFE_RUN_MEM: "2G",
          JCODE_BROWSER_TEST_SAFE_RUN_TASKS: "96",
          JCODE_BROWSER_TEST_SAFE_RUN_TIMEOUT: "5min",
        },
        nodePath: "/node",
        scriptPath: "/runner.mjs",
        testArgs: [],
      }),
    ).toContain("75%");
  });

  it("wraps local browser tests with safe-run only when safe-run is available and not already active", () => {
    expect(
      shouldUseLocalSafeRun({
        env: { INVOCATION_ID: "opencode-session", JCODE_LOCAL_TEST_PROFILE: "1" },
        safeRunAvailable: true,
      }),
    ).toBe(true);
    expect(
      shouldUseLocalSafeRun({
        env: { JCODE_LOCAL_TEST_PROFILE: "1" },
        safeRunAvailable: true,
      }),
    ).toBe(true);
    expect(
      shouldUseLocalSafeRun({
        env: { JCODE_LOCAL_TEST_PROFILE: "1", JCODE_BROWSER_TEST_SAFE_RUN_ACTIVE: "1" },
        safeRunAvailable: true,
      }),
    ).toBe(false);
    expect(
      shouldUseLocalSafeRun({
        env: { JCODE_LOCAL_TEST_PROFILE: "1", JCODE_BROWSER_TEST_SAFE_RUN: "0" },
        safeRunAvailable: true,
      }),
    ).toBe(false);
    expect(
      shouldUseLocalSafeRun({
        env: { JCODE_LOCAL_TEST_PROFILE: "1" },
        safeRunAvailable: false,
      }),
    ).toBe(false);
  });
});
