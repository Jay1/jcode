export const resolveBrowserRunnerEnv = (baseEnv) => ({
  ...baseEnv,
  JCODE_LOCAL_TEST_PROFILE: baseEnv.JCODE_LOCAL_TEST_PROFILE ?? (baseEnv.CI === "true" ? "0" : "1"),
});

export const createVitestBrowserArgs = (testArgs) => [
  "vitest",
  "run",
  "--config",
  "vitest.browser.config.ts",
  ...testArgs,
];

export const createLocalSafeRunArgs = ({ env, nodePath, scriptPath, testArgs }) => [
  "--profile",
  "browser",
  "--mem",
  env.JCODE_BROWSER_TEST_SAFE_RUN_MEM ?? "3G",
  "--high",
  env.JCODE_BROWSER_TEST_SAFE_RUN_HIGH ?? "2G",
  "--cpu",
  env.JCODE_BROWSER_TEST_SAFE_RUN_CPU ?? "150%",
  "--tasks",
  env.JCODE_BROWSER_TEST_SAFE_RUN_TASKS ?? "192",
  "--timeout",
  env.JCODE_BROWSER_TEST_SAFE_RUN_TIMEOUT ?? "20min",
  "--",
  "env",
  "JCODE_BROWSER_TEST_SAFE_RUN_ACTIVE=1",
  "JCODE_LOCAL_TEST_PROFILE=1",
  nodePath,
  scriptPath,
  ...testArgs,
];

export const shouldUseLocalSafeRun = ({ env, safeRunAvailable }) =>
  env.JCODE_LOCAL_TEST_PROFILE === "1" &&
  env.JCODE_BROWSER_TEST_SAFE_RUN !== "0" &&
  env.JCODE_BROWSER_TEST_SAFE_RUN_ACTIVE !== "1" &&
  safeRunAvailable;
