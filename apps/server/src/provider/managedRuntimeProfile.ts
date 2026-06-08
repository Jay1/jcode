import type {
  ManagedSidecarSnapshot,
  OpenCodeRuntimeCapabilityRequirement,
  OpenCodeRuntimeProfile,
  ServerSettings,
  ServerSettingsPatch,
} from "@jcode/contracts";

const EMPTY_CAPABILITY_ARRAYS = {
  skillRoots: [] as readonly string[],
  pluginRoots: [] as readonly string[],
  requiredCommands: [] as readonly string[],
  requiredSkills: [] as readonly string[],
  requiredPlugins: [] as readonly string[],
  requiredAgents: [] as readonly string[],
  requiredModels: [] as readonly string[],
  requiredEnv: [] as readonly string[],
  requirements: [] as readonly OpenCodeRuntimeCapabilityRequirement[],
  capabilityPolicy: "warn" as const,
};

function makeManagedProfile(snapshot: ManagedSidecarSnapshot): OpenCodeRuntimeProfile {
  return {
    id: "managed-opencode-sidecar",
    label: "Managed OpenCode (sidecar)",
    provider: "opencode",
    mode: "managed",
    configMode: "generated",
    binaryPath: snapshot.binaryPath ?? undefined,
    serverUrl: snapshot.serverUrl ?? undefined,
    ...EMPTY_CAPABILITY_ARRAYS,
  };
}

function makeExternalProfile(snapshot: ManagedSidecarSnapshot): OpenCodeRuntimeProfile {
  return {
    id: "external-opencode-existing",
    label: "OpenCode (existing config)",
    provider: "opencode",
    mode: "external",
    configMode: "inherit",
    binaryPath: snapshot.binaryPath ?? undefined,
    ...EMPTY_CAPABILITY_ARRAYS,
  };
}

export interface AutoCreateProfileInput {
  readonly sidecarSnapshot: ManagedSidecarSnapshot;
  readonly existingConfigDetected: boolean;
  readonly settings: ServerSettings;
}

export interface AutoCreateProfileResult {
  readonly profile: OpenCodeRuntimeProfile;
  readonly created: boolean;
  readonly activeProfileId: string;
}

export function autoCreateManagedRuntimeProfile(
  input: AutoCreateProfileInput,
): AutoCreateProfileResult {
  const desiredProfile = input.existingConfigDetected
    ? makeExternalProfile(input.sidecarSnapshot)
    : makeManagedProfile(input.sidecarSnapshot);

  const existingProfile = input.settings.providers.opencode.runtimeProfiles.find(
    (p) => p.id === desiredProfile.id,
  );

  if (existingProfile) {
    return {
      profile: existingProfile,
      created: false,
      activeProfileId: existingProfile.id,
    };
  }

  return {
    profile: desiredProfile,
    created: true,
    activeProfileId: desiredProfile.id,
  };
}

export function applyAutoCreatedProfile(
  result: AutoCreateProfileResult,
  settings: ServerSettings,
): ServerSettingsPatch {
  const currentProfiles = settings.providers.opencode.runtimeProfiles;
  const updatedProfiles = result.created ? [...currentProfiles, result.profile] : currentProfiles;

  return {
    providers: {
      opencode: {
        runtimeProfiles: updatedProfiles,
        activeRuntimeProfileId: result.activeProfileId,
      },
    },
  };
}
