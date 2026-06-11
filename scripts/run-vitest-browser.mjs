#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  createLocalSafeRunArgs,
  createVitestBrowserArgs,
  resolveBrowserRunnerEnv,
  shouldUseLocalSafeRun,
} from "./vitest-browser-runner.mjs";

const testArgs = process.argv.slice(2);
const args = createVitestBrowserArgs(testArgs);
const env = resolveBrowserRunnerEnv(process.env);
const scriptPath = fileURLToPath(import.meta.url);
const safeRunAvailable = () => spawnSync("safe-run", ["--help"], { stdio: "ignore" }).status === 0;

const localSafeRunArgs = createLocalSafeRunArgs({
  env,
  nodePath: process.execPath,
  scriptPath,
  testArgs,
});

const hasSafeRun = safeRunAvailable();
const localSafeRunRequested =
  env.JCODE_LOCAL_TEST_PROFILE === "1" &&
  env.JCODE_BROWSER_TEST_SAFE_RUN !== "0" &&
  env.JCODE_BROWSER_TEST_SAFE_RUN_ACTIVE !== "1";
const useLocalSafeRun = shouldUseLocalSafeRun({ env, safeRunAvailable: hasSafeRun });

if (localSafeRunRequested && !hasSafeRun) {
  console.error(
    "Refusing to run local browser tests without safe-run bounds. Install safe-run or set JCODE_BROWSER_TEST_SAFE_RUN=0 to opt into an unbounded run.",
  );
  process.exit(69);
}

if (useLocalSafeRun) {
  if (env.JCODE_BROWSER_TEST_SAFE_RUN_DRY_RUN === "1") {
    console.log(["safe-run", ...localSafeRunArgs].join(" "));
    process.exit(0);
  }

  const safeRun = spawn("safe-run", localSafeRunArgs, {
    env: {
      ...env,
      JCODE_BROWSER_TEST_SAFE_RUN_ACTIVE: "1",
    },
    stdio: "inherit",
  });

  safeRun.on("exit", (code, signal) => {
    if (typeof code === "number") {
      process.exit(code);
    }
    process.exit(signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1);
  });

  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => {
      safeRun.kill(signal);
    });
  }

  await new Promise(() => {});
} else if (env.JCODE_BROWSER_TEST_SAFE_RUN_DRY_RUN === "1") {
  console.log(["bunx", ...args].join(" "));
  process.exit(0);
}

let childExitCode = null;
let childSignal = null;

const child = spawn("bunx", args, {
  detached: true,
  env,
  stdio: "inherit",
});

const killChildGroup = (signal) => {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
};

const exitFromChild = () => {
  killChildGroup("SIGTERM");
  if (typeof childExitCode === "number") {
    process.exit(childExitCode);
  }
  if (childSignal) {
    process.exit(128 + (childSignal === "SIGINT" ? 2 : childSignal === "SIGTERM" ? 15 : 1));
  }
  process.exit(1);
};

child.on("exit", (code, signal) => {
  childExitCode = code;
  childSignal = signal;
});

child.on("close", exitFromChild);

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    killChildGroup(signal);
    setTimeout(() => {
      killChildGroup("SIGKILL");
      process.exit(128 + (signal === "SIGINT" ? 2 : signal === "SIGTERM" ? 15 : 1));
    }, 5_000).unref();
  });
}

process.on("exit", () => {
  killChildGroup("SIGTERM");
});
