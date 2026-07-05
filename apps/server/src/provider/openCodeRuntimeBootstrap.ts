import type {
  OpenCodeRuntimeProfile,
  ProviderRuntimeBootstrapInput,
  ProviderRuntimeBootstrapSnapshot,
} from "@jcode/contracts";

import { OPENCODE_BACKGROUND_PROBE_ENV } from "./opencodeRuntime.ts";

export const JCODE_OPENCODE_SERVICE_NAME = "jcode-opencode.service" as const;
export const WSL_OPENCODE_PROFILE_ID = "wsl-opencode-service" as const;
export const WSL_OPENCODE_PROFILE_LABEL = "WSL OpenCode service" as const;
export const DEFAULT_WSL_OPENCODE_SERVER_URL = "http://127.0.0.1:4096" as const;

const WSL_OPENCODE_START_SCRIPT_NAME = "jcode-opencode-start" as const;

export interface WslOpenCodeBootstrapProbe {
  readonly now: string;
  readonly platform: string;
  readonly osRelease: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly userSystemdAvailable: boolean;
  readonly serviceExists: boolean;
  readonly serviceActive: boolean;
  readonly binaryPath: string | null;
  readonly portAvailable: boolean;
  readonly profileReachable: boolean;
  readonly serverUrl?: string;
}

export interface WslOpenCodeBootstrapAdapter {
  readonly paths?: WslOpenCodeBootstrapPaths;
  readonly now: () => string;
  readonly getProbe: () => Promise<WslOpenCodeBootstrapProbe>;
  readonly ensureRuntimeDirectory: () => Promise<void>;
  readonly resolveOpenCodeBinary: (forceReinstall: boolean) => Promise<string>;
  readonly writeExecutableFile: (path: string, contents: string) => Promise<void>;
  readonly writeFile: (path: string, contents: string) => Promise<void>;
  readonly systemctlUser: (args: readonly string[]) => Promise<void>;
  readonly smokeRuntime: (serverUrl: string) => Promise<void>;
}

export interface WslOpenCodeBootstrapPaths {
  readonly runtimeDir: string;
  readonly startScriptPath: string;
  readonly serviceUnitPath: string;
  readonly serverUrl: string;
  readonly host: "127.0.0.1";
  readonly port: 4096;
}

type BootstrapState = ProviderRuntimeBootstrapSnapshot["state"];

function isTruthyEnvMarker(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function isWslProbe(input: WslOpenCodeBootstrapProbe): boolean {
  if (input.platform !== "linux") {
    return false;
  }

  const osRelease = input.osRelease.toLowerCase();
  return (
    osRelease.includes("microsoft") ||
    osRelease.includes("wsl") ||
    isTruthyEnvMarker(input.env.WSL_DISTRO_NAME) ||
    isTruthyEnvMarker(input.env.WSL_INTEROP)
  );
}

function snapshot(input: {
  readonly checkedAt: string;
  readonly state: BootstrapState;
  readonly message?: string;
  readonly serviceName?: typeof JCODE_OPENCODE_SERVICE_NAME;
  readonly binaryPath?: string;
  readonly serverUrl?: string;
  readonly profileId?: string;
}): ProviderRuntimeBootstrapSnapshot {
  return {
    provider: "opencode",
    lane: "wsl-service",
    state: input.state,
    checkedAt: input.checkedAt,
    ...(input.serviceName ? { serviceName: input.serviceName } : {}),
    ...(input.binaryPath ? { binaryPath: input.binaryPath } : {}),
    ...(input.serverUrl ? { serverUrl: input.serverUrl } : {}),
    ...(input.profileId ? { profileId: input.profileId } : {}),
    ...(input.message ? { message: redactBootstrapMessage(input.message) } : {}),
  };
}

export function detectWslOpenCodeBootstrapStatus(
  input: WslOpenCodeBootstrapProbe,
): ProviderRuntimeBootstrapSnapshot {
  const serverUrl = input.serverUrl ?? DEFAULT_WSL_OPENCODE_SERVER_URL;

  if (!isWslProbe(input)) {
    return snapshot({
      checkedAt: input.now,
      state: "unsupported",
      message: "WSL OpenCode bootstrap is only supported inside WSL.",
    });
  }

  if (!input.userSystemdAvailable) {
    return snapshot({
      checkedAt: input.now,
      state: "unsupported",
      message: "WSL user systemd is required for jcode-opencode.service.",
    });
  }

  if (!input.portAvailable) {
    return snapshot({
      checkedAt: input.now,
      state: "error",
      serviceName: JCODE_OPENCODE_SERVICE_NAME,
      serverUrl,
      profileId: WSL_OPENCODE_PROFILE_ID,
      ...(input.binaryPath ? { binaryPath: input.binaryPath } : {}),
      message: "OpenCode loopback port 4096 is already occupied.",
    });
  }

  if (input.profileReachable) {
    return snapshot({
      checkedAt: input.now,
      state: "ready",
      serverUrl,
      profileId: WSL_OPENCODE_PROFILE_ID,
      ...(input.binaryPath ? { binaryPath: input.binaryPath } : {}),
    });
  }

  if (!input.serviceExists || !input.binaryPath) {
    return snapshot({
      checkedAt: input.now,
      state: "notInstalled",
      serverUrl,
      profileId: WSL_OPENCODE_PROFILE_ID,
      ...(input.binaryPath ? { binaryPath: input.binaryPath } : {}),
      message: "WSL OpenCode service or binary is not installed.",
    });
  }

  if (!input.serviceActive) {
    return snapshot({
      checkedAt: input.now,
      state: "error",
      serviceName: JCODE_OPENCODE_SERVICE_NAME,
      binaryPath: input.binaryPath,
      serverUrl,
      profileId: WSL_OPENCODE_PROFILE_ID,
      message: `${JCODE_OPENCODE_SERVICE_NAME} exists but is not active.`,
    });
  }

  return snapshot({
    checkedAt: input.now,
    state: "error",
    serviceName: JCODE_OPENCODE_SERVICE_NAME,
    binaryPath: input.binaryPath,
    serverUrl,
    profileId: WSL_OPENCODE_PROFILE_ID,
    message: `${JCODE_OPENCODE_SERVICE_NAME} is active but the OpenCode runtime is unreachable.`,
  });
}

export function renderJcodeOpenCodeServiceUnit(input: {
  readonly startScriptPath: string;
}): string {
  return [
    "[Unit]",
    "Description=JCode external OpenCode runtime",
    "After=network.target",
    "",
    "[Service]",
    "Type=simple",
    `ExecStart=${quoteSystemdExecArg(input.startScriptPath)}`,
    "Restart=on-failure",
    "RestartSec=2",
    "",
    "[Install]",
    "WantedBy=default.target",
    "",
  ].join("\n");
}

function quoteSystemdExecArg(value: string): string {
  if (!/[\s"\\]/u.test(value)) {
    return value;
  }
  return `"${value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
}

function quoteShellArg(value: string): string {
  return `'${value.replace(/'/gu, "'\\''")}'`;
}

export function renderJcodeOpenCodeStartScript(input: {
  readonly binaryPath: string;
  readonly host: "127.0.0.1";
  readonly port: 4096;
}): string {
  const backgroundProbeEnvExports = Object.entries(OPENCODE_BACKGROUND_PROBE_ENV).map(
    ([name, value]) => `export ${name}=${quoteShellArg(value ?? "")}`,
  );

  return [
    "#!/usr/bin/env sh",
    "set -eu",
    ...backgroundProbeEnvExports,
    "unset OPENCODE_CONFIG_CONTENT",
    `exec ${quoteShellArg(input.binaryPath)} serve --hostname=${input.host} --port=${input.port}`,
    "",
  ].join("\n");
}

function withoutTrailingSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/u, "") : path;
}

export function makeWslOpenCodeBootstrapPaths(input: {
  readonly homeDir: string;
  readonly runtimeDir: string;
  readonly serverUrl?: string;
}): WslOpenCodeBootstrapPaths {
  const homeDir = withoutTrailingSlash(input.homeDir);
  const runtimeDir = withoutTrailingSlash(input.runtimeDir);

  return {
    runtimeDir,
    startScriptPath: `${runtimeDir}/${WSL_OPENCODE_START_SCRIPT_NAME}`,
    serviceUnitPath: `${homeDir}/.config/systemd/user/${JCODE_OPENCODE_SERVICE_NAME}`,
    serverUrl: input.serverUrl ?? DEFAULT_WSL_OPENCODE_SERVER_URL,
    host: "127.0.0.1",
    port: 4096,
  };
}

export function makeWslOpenCodeRuntimeProfilePatch(input: {
  readonly binaryPath: string;
  readonly serverUrl?: string;
}): OpenCodeRuntimeProfile {
  return {
    id: WSL_OPENCODE_PROFILE_ID,
    label: WSL_OPENCODE_PROFILE_LABEL,
    provider: "opencode",
    mode: "external",
    configMode: "inherit",
    serverUrl: input.serverUrl ?? DEFAULT_WSL_OPENCODE_SERVER_URL,
    binaryPath: input.binaryPath,
    skillRoots: [],
    pluginRoots: [],
    requiredCommands: [],
    requiredSkills: [],
    requiredPlugins: [],
    requiredAgents: [],
    requiredModels: [],
    requiredEnv: [],
    requirements: [],
    capabilityPolicy: "warn",
  };
}

export function upsertWslOpenCodeRuntimeProfile(
  existing: readonly OpenCodeRuntimeProfile[],
  profile: OpenCodeRuntimeProfile,
): OpenCodeRuntimeProfile[] {
  const nextProfiles = existing.map((existingProfile) =>
    existingProfile.id === WSL_OPENCODE_PROFILE_ID ? profile : existingProfile,
  );

  return existing.some((existingProfile) => existingProfile.id === WSL_OPENCODE_PROFILE_ID)
    ? nextProfiles
    : [...existing, profile];
}

export function redactBootstrapMessage(message: string): string {
  return message
    .replace(/\b(client_secret)=([^\s&]+)/gi, "$1=<redacted>")
    .replace(/\b(token|password)=([^\s&]+)/gi, "$1=<redacted>")
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1<redacted>@");
}

export async function getWslOpenCodeRuntimeBootstrapStatus(
  adapter: WslOpenCodeBootstrapAdapter,
): Promise<ProviderRuntimeBootstrapSnapshot> {
  return detectWslOpenCodeBootstrapStatus(await adapter.getProbe());
}

export async function bootstrapWslOpenCodeRuntime(
  adapter: WslOpenCodeBootstrapAdapter,
  input: ProviderRuntimeBootstrapInput,
): Promise<{
  readonly snapshot: ProviderRuntimeBootstrapSnapshot;
  readonly profile: OpenCodeRuntimeProfile;
}> {
  return runWslOpenCodeRuntimeOrchestration(adapter, input, {
    serviceCommand: ["enable", "--now", JCODE_OPENCODE_SERVICE_NAME],
  });
}

export async function repairWslOpenCodeRuntime(
  adapter: WslOpenCodeBootstrapAdapter,
  input: ProviderRuntimeBootstrapInput,
): Promise<{
  readonly snapshot: ProviderRuntimeBootstrapSnapshot;
  readonly profile: OpenCodeRuntimeProfile;
}> {
  return runWslOpenCodeRuntimeOrchestration(adapter, input, {
    serviceCommand: ["restart", JCODE_OPENCODE_SERVICE_NAME],
  });
}

function getErrorMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  if (typeof cause === "string") {
    return cause;
  }
  return "WSL OpenCode runtime bootstrap failed.";
}

function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index > 0 ? path.slice(0, index) : ".";
}

function deriveWslHomeDirectory(binaryPath: string): string {
  if (binaryPath.startsWith("/root/")) {
    return "/root";
  }

  const homeMatch = binaryPath.match(/^(\/home\/[^/]+)(?:\/|$)/);
  if (homeMatch?.[1]) {
    return homeMatch[1];
  }

  const envHome = process.env.HOME?.trim();
  if (envHome?.startsWith("/")) {
    return envHome;
  }

  throw new Error("Unable to resolve WSL home directory for OpenCode runtime bootstrap.");
}

function getFallbackBootstrapPaths(binaryPath: string): WslOpenCodeBootstrapPaths {
  return makeWslOpenCodeBootstrapPaths({
    homeDir: deriveWslHomeDirectory(binaryPath),
    runtimeDir: dirname(binaryPath),
  });
}

async function runWslOpenCodeRuntimeOrchestration(
  adapter: WslOpenCodeBootstrapAdapter,
  input: ProviderRuntimeBootstrapInput,
  options: { readonly serviceCommand: readonly string[] },
): Promise<{
  readonly snapshot: ProviderRuntimeBootstrapSnapshot;
  readonly profile: OpenCodeRuntimeProfile;
}> {
  try {
    await adapter.ensureRuntimeDirectory();
    const binaryPath = await adapter.resolveOpenCodeBinary(Boolean(input.forceReinstall));
    const paths = adapter.paths ?? getFallbackBootstrapPaths(binaryPath);
    const profile = makeWslOpenCodeRuntimeProfilePatch({ binaryPath, serverUrl: paths.serverUrl });

    await adapter.writeExecutableFile(
      paths.startScriptPath,
      renderJcodeOpenCodeStartScript({ binaryPath, host: paths.host, port: paths.port }),
    );
    await adapter.writeFile(
      paths.serviceUnitPath,
      renderJcodeOpenCodeServiceUnit({ startScriptPath: paths.startScriptPath }),
    );
    await adapter.systemctlUser(["daemon-reload"]);
    await adapter.systemctlUser(options.serviceCommand);
    await adapter.smokeRuntime(paths.serverUrl);

    return {
      profile,
      snapshot: snapshot({
        checkedAt: adapter.now(),
        state: "ready",
        serviceName: JCODE_OPENCODE_SERVICE_NAME,
        binaryPath,
        serverUrl: paths.serverUrl,
        profileId: WSL_OPENCODE_PROFILE_ID,
      }),
    };
  } catch (cause) {
    throw new Error(redactBootstrapMessage(getErrorMessage(cause)));
  }
}
