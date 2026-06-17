import { describe, expect, it } from "vitest";

import type { ManagedSidecarSnapshot, ServerSettings } from "@jcode/contracts";
import { DEFAULT_SERVER_SETTINGS } from "@jcode/contracts";

import {
  autoCreateManagedRuntimeProfile,
  applyAutoCreatedProfile,
} from "./managedRuntimeProfile.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const READY_SNAPSHOT: ManagedSidecarSnapshot = Object.freeze({
  state: "ready",
  binaryPath: "/opt/jcode/opencode-sidecar",
  serverUrl: "http://127.0.0.1:42001",
  serverPassword: "s3cret",
});

const IDLE_SNAPSHOT: ManagedSidecarSnapshot = Object.freeze({
  state: "idle",
});

const EMPTY_SETTINGS: ServerSettings = DEFAULT_SERVER_SETTINGS;

function settingsWithProfiles(
  ...profiles: ServerSettings["providers"]["opencode"]["runtimeProfiles"]
): ServerSettings {
  return {
    ...EMPTY_SETTINGS,
    providers: {
      ...EMPTY_SETTINGS.providers,
      opencode: {
        ...EMPTY_SETTINGS.providers.opencode,
        runtimeProfiles: profiles,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// autoCreateManagedRuntimeProfile
// ---------------------------------------------------------------------------

describe("autoCreateManagedRuntimeProfile", () => {
  it("creates a managed profile for clean install", () => {
    const result = autoCreateManagedRuntimeProfile({
      sidecarSnapshot: READY_SNAPSHOT,
      existingConfigDetected: false,
      managedRuntimeDir: "/var/lib/jcode/managed-opencode",
      settings: EMPTY_SETTINGS,
    });

    expect(result.created).toBe(true);
    expect(result.profile.id).toBe("managed-opencode-sidecar");
    expect(result.profile.label).toBe("Managed OpenCode (sidecar)");
    expect(result.profile.provider).toBe("opencode");
    expect(result.profile.mode).toBe("managed");
    expect(result.profile.configMode).toBe("generated");
    expect(result.profile.binaryPath).toBe("/opt/jcode/opencode-sidecar");
    expect(result.profile.serverUrl).toBe("http://127.0.0.1:42001");
    expect(result.profile.opencodeConfigDir).toBe("/var/lib/jcode/managed-opencode/config");
    expect(result.profile.opencodeDataDir).toBe("/var/lib/jcode/managed-opencode/data");
    expect(result.profile.capabilityPolicy).toBe("warn");
    expect(result.activeProfileId).toBe("managed-opencode-sidecar");
  });

  it("creates an external profile when existing config detected", () => {
    const result = autoCreateManagedRuntimeProfile({
      sidecarSnapshot: READY_SNAPSHOT,
      existingConfigDetected: true,
      settings: EMPTY_SETTINGS,
    });

    expect(result.created).toBe(true);
    expect(result.profile.id).toBe("external-opencode-existing");
    expect(result.profile.label).toBe("OpenCode (existing config)");
    expect(result.profile.provider).toBe("opencode");
    expect(result.profile.mode).toBe("external");
    expect(result.profile.configMode).toBe("inherit");
    expect(result.profile.binaryPath).toBe("/opt/jcode/opencode-sidecar");
    expect(result.profile.serverUrl).toBeUndefined();
    expect(result.profile.capabilityPolicy).toBe("warn");
    expect(result.activeProfileId).toBe("external-opencode-existing");
  });

  it("returns existing profile without duplication when ID matches", () => {
    const existing = {
      id: "managed-opencode-sidecar",
      label: "Managed OpenCode (sidecar)",
      provider: "opencode" as const,
      mode: "managed" as const,
      configMode: "generated" as const,
      binaryPath: "/old/path",
      serverUrl: "http://old-url",
      skillRoots: [],
      pluginRoots: [],
      requiredCommands: [],
      requiredSkills: [],
      requiredPlugins: [],
      requiredAgents: [],
      requiredModels: [],
      requiredEnv: [],
      requirements: [],
      capabilityPolicy: "warn" as const,
    };

    const result = autoCreateManagedRuntimeProfile({
      sidecarSnapshot: READY_SNAPSHOT,
      existingConfigDetected: false,
      settings: settingsWithProfiles(existing),
    });

    expect(result.created).toBe(false);
    expect(result.profile).toBe(existing);
    expect(result.activeProfileId).toBe("managed-opencode-sidecar");
  });

  it("sets configMode to generated for managed sidecar", () => {
    const result = autoCreateManagedRuntimeProfile({
      sidecarSnapshot: READY_SNAPSHOT,
      existingConfigDetected: false,
      managedRuntimeDir: "/var/lib/jcode/managed-opencode",
      settings: EMPTY_SETTINGS,
    });

    expect(result.profile.configMode).toBe("generated");
  });

  it("sets isolated OpenCode config and data directories for managed sidecar", () => {
    const result = autoCreateManagedRuntimeProfile({
      sidecarSnapshot: READY_SNAPSHOT,
      existingConfigDetected: false,
      managedRuntimeDir: "/var/lib/jcode/managed-opencode",
      settings: EMPTY_SETTINGS,
    });

    expect(result.profile.opencodeConfigDir).toBe("/var/lib/jcode/managed-opencode/config");
    expect(result.profile.opencodeDataDir).toBe("/var/lib/jcode/managed-opencode/data");
  });

  it("uses the managed runtime binary path when clean discovery has no binary", () => {
    const result = autoCreateManagedRuntimeProfile({
      sidecarSnapshot: IDLE_SNAPSHOT,
      existingConfigDetected: false,
      managedRuntimeDir: "/var/lib/jcode/managed-opencode",
      settings: EMPTY_SETTINGS,
    });

    expect(result.profile.binaryPath).toBe("/var/lib/jcode/managed-opencode/opencode");
  });

  it("sets configMode to inherit for external with existing config", () => {
    const result = autoCreateManagedRuntimeProfile({
      sidecarSnapshot: READY_SNAPSHOT,
      existingConfigDetected: true,
      settings: EMPTY_SETTINGS,
    });

    expect(result.profile.configMode).toBe("inherit");
  });
});

// ---------------------------------------------------------------------------
// applyAutoCreatedProfile
// ---------------------------------------------------------------------------

describe("applyAutoCreatedProfile", () => {
  it("returns patch that appends profile and sets active ID when created", () => {
    const autoResult = autoCreateManagedRuntimeProfile({
      sidecarSnapshot: READY_SNAPSHOT,
      existingConfigDetected: false,
      settings: EMPTY_SETTINGS,
    });

    const patch = applyAutoCreatedProfile(autoResult, EMPTY_SETTINGS);

    expect(patch.providers?.opencode?.activeRuntimeProfileId).toBe("managed-opencode-sidecar");
    const profiles = patch.providers?.opencode?.runtimeProfiles;
    expect(profiles).toHaveLength(1);
    expect(profiles?.[0]?.id).toBe("managed-opencode-sidecar");
  });

  it("does not duplicate profiles when created is false", () => {
    const existing = {
      id: "managed-opencode-sidecar",
      label: "Managed OpenCode (sidecar)",
      provider: "opencode" as const,
      mode: "managed" as const,
      configMode: "generated" as const,
      skillRoots: [],
      pluginRoots: [],
      requiredCommands: [],
      requiredSkills: [],
      requiredPlugins: [],
      requiredAgents: [],
      requiredModels: [],
      requiredEnv: [],
      requirements: [],
      capabilityPolicy: "warn" as const,
    };

    const settings = settingsWithProfiles(existing);

    const autoResult = autoCreateManagedRuntimeProfile({
      sidecarSnapshot: READY_SNAPSHOT,
      existingConfigDetected: false,
      settings,
    });

    expect(autoResult.created).toBe(false);

    const patch = applyAutoCreatedProfile(autoResult, settings);

    expect(patch.providers?.opencode?.activeRuntimeProfileId).toBe("managed-opencode-sidecar");
    expect(patch.providers?.opencode?.runtimeProfiles).toHaveLength(1);
  });
});
