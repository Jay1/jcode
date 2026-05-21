import type { OpenCodeRuntimeProfile, OpenCodeRuntimeConfigMode } from "@t3tools/contracts";
import type { ServerSettings } from "@t3tools/contracts";

import type { OpenCodeCompatibleCliSpec } from "./opencodeRuntime.ts";

export interface ResolvedOpenCodeRuntimeProfile {
  readonly profile: OpenCodeRuntimeProfile;
  readonly serverPassword: string;
  readonly synthetic: boolean;
}

export interface OpenCodeRuntimeConnectionConfig {
  readonly binaryPath: string;
  readonly cliSpec: OpenCodeCompatibleCliSpec;
  readonly serverUrl?: string;
  readonly serverPassword?: string;
  readonly configMode: OpenCodeRuntimeConfigMode;
  readonly homePath?: string;
  readonly xdgConfigHome?: string;
  readonly cwd?: string;
}

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function fallbackBinaryPath(
  settings: ServerSettings["providers"]["opencode"],
  defaultBinaryPath: string,
): string {
  return trimToNull(settings.binaryPath) ?? defaultBinaryPath;
}

export function resolveOpenCodeRuntimeProfile(input: {
  readonly settings: ServerSettings;
  readonly defaultBinaryPath: string;
  readonly profileId?: string | null;
}): ResolvedOpenCodeRuntimeProfile {
  const providerSettings = input.settings.providers.opencode;
  const requestedProfileId =
    trimToNull(input.profileId) ?? trimToNull(providerSettings.activeRuntimeProfileId);
  const configuredProfile = requestedProfileId
    ? providerSettings.runtimeProfiles.find((profile) => profile.id === requestedProfileId)
    : providerSettings.runtimeProfiles[0];

  if (configuredProfile) {
    return {
      profile: configuredProfile,
      serverPassword: providerSettings.serverPassword,
      synthetic: false,
    };
  }

  const serverUrl = trimToNull(providerSettings.serverUrl);
  if (serverUrl) {
    return {
      profile: {
        id: "legacy-opencode-server-url",
        label: "OpenCode external server",
        provider: "opencode",
        mode: "external",
        serverUrl,
        binaryPath: fallbackBinaryPath(providerSettings, input.defaultBinaryPath),
        configMode: "inherit",
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
      },
      serverPassword: providerSettings.serverPassword,
      synthetic: true,
    };
  }

  return {
    profile: {
      id: "managed-opencode",
      label: "Managed OpenCode",
      provider: "opencode",
      mode: "managed",
      binaryPath: fallbackBinaryPath(providerSettings, input.defaultBinaryPath),
      configMode: "inherit",
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
    },
    serverPassword: providerSettings.serverPassword,
    synthetic: true,
  };
}

export function resolveOpenCodeRuntimeConnectionConfig(input: {
  readonly resolved: ResolvedOpenCodeRuntimeProfile;
  readonly cliSpec: OpenCodeCompatibleCliSpec;
  readonly defaultBinaryPath: string;
  readonly cwd?: string | null;
}): OpenCodeRuntimeConnectionConfig {
  const profile = input.resolved.profile;
  const binaryPath = trimToNull(profile.binaryPath) ?? input.defaultBinaryPath;
  const cwd = trimToNull(input.cwd) ?? trimToNull(profile.cwdDefault);
  return {
    binaryPath,
    cliSpec: input.cliSpec,
    ...(profile.mode === "external" || profile.mode === "remote"
      ? { serverUrl: profile.serverUrl }
      : {}),
    ...(input.resolved.serverPassword ? { serverPassword: input.resolved.serverPassword } : {}),
    configMode: profile.configMode,
    ...(profile.homePath ? { homePath: profile.homePath } : {}),
    ...(profile.configHome ? { xdgConfigHome: profile.configHome } : {}),
    ...(cwd ? { cwd } : {}),
  };
}
