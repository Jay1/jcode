#!/usr/bin/env node
import { spawn } from "node:child_process";

const args = ["vitest", "run", "--config", "vitest.browser.config.ts", ...process.argv.slice(2)];
const env = {
  ...process.env,
  JCODE_LOCAL_TEST_PROFILE:
    process.env.JCODE_LOCAL_TEST_PROFILE ?? (process.env.CI === "true" ? "0" : "1"),
};

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
