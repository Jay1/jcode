import { spawn } from "node:child_process";

export type ReactDoctorRunnerMode = "full" | "changed";

export interface ReactDoctorRunnerOptions {
  mode: ReactDoctorRunnerMode;
  passthroughArgs: string[];
}

export interface ReactDoctorInvocation {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  maxRssMb: number;
  mode: ReactDoctorRunnerMode;
}

export type ReactDoctorValidationResult = { ok: true } | { ok: false; message: string };

const SAFE_ENV: NodeJS.ProcessEnv = {
  CI: "1",
  FORCE_COLOR: "0",
  NO_COLOR: "1",
  REACT_DOCTOR_PARALLEL: "0",
};

const DEFAULT_MAX_RSS_MB = 1536;

export function buildReactDoctorInvocation(
  options: ReactDoctorRunnerOptions,
): ReactDoctorInvocation {
  const modeArgs =
    options.mode === "changed" ? ["--diff", "HEAD", "--fail-on", "warning"] : ["--fail-on", "none"];

  return {
    command: process.platform === "win32" ? "react-doctor.cmd" : "react-doctor",
    args: [
      "apps/web",
      "--yes",
      "--no-parallel",
      "--no-score",
      "--no-dead-code",
      ...modeArgs,
      ...options.passthroughArgs,
    ],
    env: { ...process.env, ...SAFE_ENV },
    maxRssMb: DEFAULT_MAX_RSS_MB,
    mode: options.mode,
  };
}

export function validateReactDoctorInvocation(
  invocation: ReactDoctorInvocation,
  env: NodeJS.ProcessEnv,
): ReactDoctorValidationResult {
  if (invocation.mode !== "full") {
    return { ok: true };
  }
  if (env.JCODE_REACT_DOCTOR_ALLOW_FULL === "1") {
    return { ok: true };
  }
  return {
    ok: false,
    message:
      "Full React Doctor scans are disabled by default because they can consume multiple GB of memory. Use `bun run react-doctor` for changed files, or set JCODE_REACT_DOCTOR_ALLOW_FULL=1 for a guarded full scan.",
  };
}

function parseCliArgs(argv: string[]): {
  options: ReactDoctorRunnerOptions;
  printCommand: boolean;
} {
  const [rawMode = "full", ...rest] = argv;
  const printCommand = rest.includes("--print-command");
  const passthroughStart = rest.indexOf("--");
  const passthroughArgs = passthroughStart === -1 ? [] : rest.slice(passthroughStart + 1);
  const mode = rawMode === "changed" ? "changed" : "full";

  return { options: { mode, passthroughArgs }, printCommand };
}

function quoteArg(arg: string): string {
  return /^[A-Za-z0-9_./:=@-]+$/.test(arg) ? arg : JSON.stringify(arg);
}

async function main(argv: string[]): Promise<number> {
  const { options, printCommand } = parseCliArgs(argv);
  const invocation = buildReactDoctorInvocation(options);
  const validation = validateReactDoctorInvocation(invocation, process.env);

  if (!validation.ok) {
    console.error(validation.message);
    return 2;
  }

  if (printCommand) {
    console.log(
      `REACT_DOCTOR_PARALLEL=${invocation.env.REACT_DOCTOR_PARALLEL} ${invocation.command} ${invocation.args.map(quoteArg).join(" ")}`,
    );
    return 0;
  }

  return await new Promise((resolve) => {
    const child = spawn(invocation.command, invocation.args, {
      env: invocation.env,
      detached: process.platform !== "win32",
      stdio: "inherit",
    });

    const memoryCheckInterval = setInterval(() => {
      if (!child.pid) return;
      const rssMb = readProcessTreeRssMb(child.pid);
      if (rssMb <= invocation.maxRssMb) return;
      console.error(
        `React Doctor exceeded ${invocation.maxRssMb} MB RSS (${rssMb} MB). Terminating the process group.`,
      );
      killProcessGroup(child.pid);
    }, 1_000);

    child.on("close", (code) => {
      clearInterval(memoryCheckInterval);
      resolve(code ?? 1);
    });
    child.on("error", (error) => {
      clearInterval(memoryCheckInterval);
      console.error(error.message);
      resolve(1);
    });
  });
}

function killProcessGroup(pid: number) {
  try {
    if (process.platform === "win32") {
      process.kill(pid, "SIGTERM");
      return;
    }
    process.kill(-pid, "SIGTERM");
  } catch {
    // Process may have already exited.
  }
}

function readProcessTreeRssMb(rootPid: number): number {
  if (process.platform !== "linux") return 0;
  const pids = collectProcessTreePids(rootPid);
  let totalKb = 0;
  for (const pid of pids) {
    totalKb += readProcessRssKb(pid);
  }
  return Math.round(totalKb / 1024);
}

function collectProcessTreePids(rootPid: number): number[] {
  const childrenByParent = new Map<number, number[]>();
  let procEntries: string[] = [];
  try {
    procEntries = Array.from(require("node:fs").readdirSync("/proc"));
  } catch {
    return [rootPid];
  }
  for (const entry of procEntries) {
    const pid = Number(entry);
    if (!Number.isInteger(pid)) continue;
    const parentPid = readParentPid(pid);
    if (parentPid === null) continue;
    const children = childrenByParent.get(parentPid) ?? [];
    children.push(pid);
    childrenByParent.set(parentPid, children);
  }
  const result: number[] = [];
  const pending = [rootPid];
  while (pending.length > 0) {
    const pid = pending.pop();
    if (pid === undefined) continue;
    result.push(pid);
    pending.push(...(childrenByParent.get(pid) ?? []));
  }
  return result;
}

function readParentPid(pid: number): number | null {
  try {
    const stat = require("node:fs").readFileSync(`/proc/${pid}/stat`, "utf8");
    const closingParen = stat.lastIndexOf(")");
    const rest = stat.slice(closingParen + 2).split(" ");
    const parentPid = Number(rest[1]);
    return Number.isInteger(parentPid) ? parentPid : null;
  } catch {
    return null;
  }
}

function readProcessRssKb(pid: number): number {
  try {
    const status = require("node:fs").readFileSync(`/proc/${pid}/status`, "utf8");
    const match = /^VmRSS:\s+(\d+)\s+kB$/m.exec(status);
    return match ? Number(match[1]) : 0;
  } catch {
    return 0;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await main(process.argv.slice(2));
}
