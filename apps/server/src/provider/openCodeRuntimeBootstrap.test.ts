import {
  DEFAULT_SERVER_SETTINGS,
  type OpenCodeRuntimeProfile,
  type ServerSettings,
} from "@jcode/contracts";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_WSL_OPENCODE_SERVER_URL,
  JCODE_OPENCODE_SERVICE_NAME,
  WSL_OPENCODE_PROFILE_ID,
  WSL_OPENCODE_PROFILE_LABEL,
  bootstrapWslOpenCodeRuntime,
  detectWslOpenCodeBootstrapStatus,
  getWslOpenCodeRuntimeBootstrapStatus,
  makeWslOpenCodeBootstrapPaths,
  makeWslOpenCodeRuntimeProfilePatch,
  redactBootstrapMessage,
  repairWslOpenCodeRuntime,
  renderJcodeOpenCodeServiceUnit,
  renderJcodeOpenCodeStartScript,
  upsertWslOpenCodeRuntimeProfile,
  type WslOpenCodeBootstrapAdapter,
  type WslOpenCodeBootstrapProbe,
} from "./openCodeRuntimeBootstrap";

const NOW = "2026-06-11T12:00:00.000Z";
const BINARY_PATH = "/home/alice/.local/share/jcode/runtime/opencode/opencode";
const START_SCRIPT_PATH = "/home/alice/.local/share/jcode/runtime/opencode/jcode-opencode-start";
const SERVICE_UNIT_PATH = "/home/alice/.config/systemd/user/jcode-opencode.service";

type AdapterCall =
  | { readonly name: "getProbe" }
  | { readonly name: "ensureRuntimeDirectory" }
  | { readonly name: "resolveOpenCodeBinary"; readonly forceReinstall: boolean }
  | { readonly name: "writeExecutableFile"; readonly path: string; readonly contents: string }
  | { readonly name: "writeFile"; readonly path: string; readonly contents: string }
  | { readonly name: "systemctlUser"; readonly args: readonly string[] }
  | { readonly name: "smokeRuntime"; readonly serverUrl: string };

function probe(overrides: Partial<WslOpenCodeBootstrapProbe> = {}): WslOpenCodeBootstrapProbe {
  return {
    now: NOW,
    platform: "linux",
    osRelease: "Linux 6.8.0 microsoft-standard-WSL2",
    env: { WSL_DISTRO_NAME: "Ubuntu" },
    userSystemdAvailable: true,
    serviceExists: true,
    serviceActive: true,
    binaryPath: BINARY_PATH,
    portAvailable: true,
    profileReachable: false,
    ...overrides,
  };
}

function existingProfile(overrides: Partial<OpenCodeRuntimeProfile> = {}): OpenCodeRuntimeProfile {
  return {
    id: "managed-opencode",
    label: "Managed OpenCode",
    provider: "opencode",
    mode: "managed",
    configMode: "inherit",
    binaryPath: "/usr/bin/opencode",
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
    ...overrides,
  };
}

function settingsWithProfiles(
  profiles: ServerSettings["providers"]["opencode"]["runtimeProfiles"],
): ServerSettings {
  return {
    ...DEFAULT_SERVER_SETTINGS,
    providers: {
      ...DEFAULT_SERVER_SETTINGS.providers,
      opencode: {
        ...DEFAULT_SERVER_SETTINGS.providers.opencode,
        runtimeProfiles: profiles,
        activeRuntimeProfileId: profiles[0]?.id ?? "",
      },
    },
  };
}

function recordingAdapter(
  options: {
    readonly probe?: WslOpenCodeBootstrapProbe;
    readonly binaryPath?: string;
    readonly failSmokeWith?: string;
  } = {},
): { readonly adapter: WslOpenCodeBootstrapAdapter; readonly calls: AdapterCall[] } {
  const calls: AdapterCall[] = [];
  const adapter: WslOpenCodeBootstrapAdapter = {
    now: () => NOW,
    getProbe: async () => {
      calls.push({ name: "getProbe" });
      return options.probe ?? probe();
    },
    ensureRuntimeDirectory: async () => {
      calls.push({ name: "ensureRuntimeDirectory" });
    },
    resolveOpenCodeBinary: async (forceReinstall) => {
      calls.push({ name: "resolveOpenCodeBinary", forceReinstall });
      return options.binaryPath ?? BINARY_PATH;
    },
    writeExecutableFile: async (path, contents) => {
      calls.push({ name: "writeExecutableFile", path, contents });
    },
    writeFile: async (path, contents) => {
      calls.push({ name: "writeFile", path, contents });
    },
    systemctlUser: async (args) => {
      calls.push({ name: "systemctlUser", args });
    },
    smokeRuntime: async (serverUrl) => {
      calls.push({ name: "smokeRuntime", serverUrl });
      if (options.failSmokeWith) {
        throw new Error(options.failSmokeWith);
      }
    },
  };

  return { adapter, calls };
}

describe("openCodeRuntimeBootstrap", () => {
  it("exports the documented WSL OpenCode runtime constants", () => {
    expect(JCODE_OPENCODE_SERVICE_NAME).toBe("jcode-opencode.service");
    expect(WSL_OPENCODE_PROFILE_ID).toBe("wsl-opencode-service");
    expect(WSL_OPENCODE_PROFILE_LABEL).toBe("WSL OpenCode service");
    expect(DEFAULT_WSL_OPENCODE_SERVER_URL).toBe("http://127.0.0.1:4096");
  });

  it("reports unsupported outside Linux or without WSL markers", () => {
    for (const input of [
      probe({ platform: "darwin", osRelease: "Darwin Kernel Version", env: {} }),
      probe({ osRelease: "Linux 6.8.0 generic", env: {} }),
    ]) {
      const status = detectWslOpenCodeBootstrapStatus(input);

      expect(status).toMatchObject({
        provider: "opencode",
        lane: "wsl-service",
        state: "unsupported",
        checkedAt: NOW,
      });
      expect(status.message).toContain("WSL");
    }
  });

  it("reports unsupported in WSL when user systemd is missing", () => {
    const status = detectWslOpenCodeBootstrapStatus(probe({ userSystemdAvailable: false }));

    expect(status).toMatchObject({
      provider: "opencode",
      lane: "wsl-service",
      state: "unsupported",
      checkedAt: NOW,
    });
    expect(status.message).toContain("systemd");
  });

  it("reports an error when the default loopback port is occupied", () => {
    const status = detectWslOpenCodeBootstrapStatus(probe({ portAvailable: false }));

    expect(status).toMatchObject({
      provider: "opencode",
      lane: "wsl-service",
      state: "error",
      serviceName: JCODE_OPENCODE_SERVICE_NAME,
      serverUrl: DEFAULT_WSL_OPENCODE_SERVER_URL,
      checkedAt: NOW,
    });
    expect(status.message).toContain("port");
  });

  it("reports ready when the WSL runtime profile is reachable", () => {
    const status = detectWslOpenCodeBootstrapStatus(
      probe({ serviceExists: false, serviceActive: false, profileReachable: true }),
    );

    expect(status).toMatchObject({
      provider: "opencode",
      lane: "wsl-service",
      state: "ready",
      binaryPath: BINARY_PATH,
      serverUrl: DEFAULT_WSL_OPENCODE_SERVER_URL,
      profileId: WSL_OPENCODE_PROFILE_ID,
      checkedAt: NOW,
    });
  });

  it("reports not installed when the service or binary is missing", () => {
    for (const input of [
      probe({ serviceExists: false, serviceActive: false }),
      probe({ binaryPath: null }),
    ]) {
      const status = detectWslOpenCodeBootstrapStatus(input);

      expect(status).toMatchObject({
        provider: "opencode",
        lane: "wsl-service",
        state: "notInstalled",
        serverUrl: DEFAULT_WSL_OPENCODE_SERVER_URL,
        profileId: WSL_OPENCODE_PROFILE_ID,
        checkedAt: NOW,
      });
    }
  });

  it("reports an error with the service name when an existing service is inactive", () => {
    const status = detectWslOpenCodeBootstrapStatus(probe({ serviceActive: false }));

    expect(status).toMatchObject({
      provider: "opencode",
      lane: "wsl-service",
      state: "error",
      serviceName: JCODE_OPENCODE_SERVICE_NAME,
      binaryPath: BINARY_PATH,
      serverUrl: DEFAULT_WSL_OPENCODE_SERVER_URL,
      profileId: WSL_OPENCODE_PROFILE_ID,
      checkedAt: NOW,
    });
    expect(status.message).toContain(JCODE_OPENCODE_SERVICE_NAME);
  });

  it("reports an error when an existing active service is unreachable", () => {
    const status = detectWslOpenCodeBootstrapStatus(probe());

    expect(status).toMatchObject({
      provider: "opencode",
      lane: "wsl-service",
      state: "error",
      serviceName: JCODE_OPENCODE_SERVICE_NAME,
      binaryPath: BINARY_PATH,
      serverUrl: DEFAULT_WSL_OPENCODE_SERVER_URL,
      profileId: WSL_OPENCODE_PROFILE_ID,
      checkedAt: NOW,
    });
    expect(status.message).toContain("unreachable");
  });

  it("renders a loopback-only user service unit", () => {
    const unit = renderJcodeOpenCodeServiceUnit({
      startScriptPath: "/home/alice/.local/bin/jcode-opencode-start",
    });

    expect(unit).toContain("Description=JCode external OpenCode runtime");
    expect(unit).toContain("ExecStart=/home/alice/.local/bin/jcode-opencode-start");
    expect(unit).not.toContain("0.0.0.0");
  });

  it("quotes generated service unit paths with systemd escapes", () => {
    const unit = renderJcodeOpenCodeServiceUnit({
      startScriptPath: "/home/alice/bin/opencode start'script",
    });

    expect(unit).toContain('ExecStart="/home/alice/bin/opencode start\'script"');
  });

  it("renders a start script that unsets inline OpenCode config before serving", () => {
    const script = renderJcodeOpenCodeStartScript({
      binaryPath: BINARY_PATH,
      host: "127.0.0.1",
      port: 4096,
    });

    expect(script).toContain("unset OPENCODE_CONFIG_CONTENT");
    expect(script).toContain(`'${BINARY_PATH}' serve --hostname=127.0.0.1 --port=4096`);
    expect(script).not.toContain("0.0.0.0");
  });

  it("shell-quotes generated start script binary paths", () => {
    const script = renderJcodeOpenCodeStartScript({
      binaryPath: "/tmp/opencode $(touch /tmp/pwned)'bin",
      host: "127.0.0.1",
      port: 4096,
    });

    expect(script).toContain("exec '/tmp/opencode $(touch /tmp/pwned)'\\''bin' serve");
  });

  it("creates deterministic WSL bootstrap paths under the runtime and user systemd dirs", () => {
    const paths = makeWslOpenCodeBootstrapPaths({
      homeDir: "/home/alice",
      runtimeDir: "/home/alice/.local/share/jcode/runtime/opencode",
    });

    expect(paths).toEqual({
      runtimeDir: "/home/alice/.local/share/jcode/runtime/opencode",
      startScriptPath: START_SCRIPT_PATH,
      serviceUnitPath: SERVICE_UNIT_PATH,
      serverUrl: DEFAULT_WSL_OPENCODE_SERVER_URL,
      host: "127.0.0.1",
      port: 4096,
    });
  });

  it("creates the WSL external runtime profile patch with safe defaults", () => {
    const profile = makeWslOpenCodeRuntimeProfilePatch({ binaryPath: BINARY_PATH });

    expect(profile).toEqual({
      id: WSL_OPENCODE_PROFILE_ID,
      label: WSL_OPENCODE_PROFILE_LABEL,
      provider: "opencode",
      mode: "external",
      configMode: "inherit",
      serverUrl: DEFAULT_WSL_OPENCODE_SERVER_URL,
      binaryPath: BINARY_PATH,
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
    });
  });

  it("upserts the WSL profile without duplicating it", () => {
    const settings = settingsWithProfiles([
      existingProfile(),
      existingProfile({
        id: WSL_OPENCODE_PROFILE_ID,
        label: "Old WSL profile",
        mode: "external",
        serverUrl: DEFAULT_WSL_OPENCODE_SERVER_URL,
        binaryPath: "/old/opencode",
      }),
    ]);
    const patch = makeWslOpenCodeRuntimeProfilePatch({
      binaryPath: BINARY_PATH,
      serverUrl: "http://127.0.0.1:4097",
    });

    const nextProfiles = upsertWslOpenCodeRuntimeProfile(
      settings.providers.opencode.runtimeProfiles,
      patch,
    );

    expect(nextProfiles).toHaveLength(2);
    expect(nextProfiles[0]).toEqual(settings.providers.opencode.runtimeProfiles[0]);
    expect(nextProfiles[1]).toMatchObject({
      id: WSL_OPENCODE_PROFILE_ID,
      label: WSL_OPENCODE_PROFILE_LABEL,
      binaryPath: BINARY_PATH,
      serverUrl: "http://127.0.0.1:4097",
    });
  });

  it("appends the WSL profile when it does not already exist", () => {
    const settings = settingsWithProfiles([existingProfile()]);
    const patch = makeWslOpenCodeRuntimeProfilePatch({ binaryPath: BINARY_PATH });

    const nextProfiles = upsertWslOpenCodeRuntimeProfile(
      settings.providers.opencode.runtimeProfiles,
      patch,
    );

    expect(nextProfiles).toHaveLength(2);
    expect(nextProfiles[1]?.id).toBe(WSL_OPENCODE_PROFILE_ID);
  });

  it("redacts credentials from bootstrap messages", () => {
    const redacted = redactBootstrapMessage(
      "failed token=abc password=secret http://user:pass@example.test/path?client_secret=1",
    );

    expect(redacted).not.toContain("abc");
    expect(redacted).not.toContain("secret");
    expect(redacted).not.toContain("user:pass");
    expect(redacted).toContain("token=<redacted>");
    expect(redacted).toContain("password=<redacted>");
  });

  it("gets bootstrap status through the injected probe adapter", async () => {
    const { adapter, calls } = recordingAdapter({
      probe: probe({ profileReachable: true, serverUrl: "http://127.0.0.1:4096" }),
    });

    const snapshot = await getWslOpenCodeRuntimeBootstrapStatus(adapter);

    expect(calls).toEqual([{ name: "getProbe" }]);
    expect(snapshot).toMatchObject({
      state: "ready",
      provider: "opencode",
      lane: "wsl-service",
      serverUrl: DEFAULT_WSL_OPENCODE_SERVER_URL,
      profileId: WSL_OPENCODE_PROFILE_ID,
      checkedAt: NOW,
    });
  });

  it("installs by writing script and service, starting systemd, and returning a ready profile snapshot", async () => {
    const { adapter, calls } = recordingAdapter();

    const result = await bootstrapWslOpenCodeRuntime(adapter, { provider: "opencode" });

    expect(calls.map((call) => call.name)).toEqual([
      "ensureRuntimeDirectory",
      "resolveOpenCodeBinary",
      "writeExecutableFile",
      "writeFile",
      "systemctlUser",
      "systemctlUser",
      "smokeRuntime",
    ]);
    expect(calls[1]).toEqual({ name: "resolveOpenCodeBinary", forceReinstall: false });
    expect(calls[2]).toMatchObject({
      name: "writeExecutableFile",
      path: START_SCRIPT_PATH,
    });
    if (calls[2]?.name === "writeExecutableFile") {
      expect(calls[2].contents).toContain(
        `'${BINARY_PATH}' serve --hostname=127.0.0.1 --port=4096`,
      );
    }
    expect(calls[3]).toMatchObject({
      name: "writeFile",
      path: SERVICE_UNIT_PATH,
    });
    if (calls[3]?.name === "writeFile") {
      expect(calls[3].contents).toContain(`ExecStart=${START_SCRIPT_PATH}`);
    }
    expect(calls[4]).toEqual({ name: "systemctlUser", args: ["daemon-reload"] });
    expect(calls[5]).toEqual({
      name: "systemctlUser",
      args: ["enable", "--now", JCODE_OPENCODE_SERVICE_NAME],
    });
    expect(calls[6]).toEqual({
      name: "smokeRuntime",
      serverUrl: DEFAULT_WSL_OPENCODE_SERVER_URL,
    });
    expect(result.profile).toMatchObject({
      id: WSL_OPENCODE_PROFILE_ID,
      label: WSL_OPENCODE_PROFILE_LABEL,
      serverUrl: DEFAULT_WSL_OPENCODE_SERVER_URL,
      binaryPath: BINARY_PATH,
    });
    expect(result.snapshot).toMatchObject({
      state: "ready",
      serviceName: JCODE_OPENCODE_SERVICE_NAME,
      binaryPath: BINARY_PATH,
      serverUrl: DEFAULT_WSL_OPENCODE_SERVER_URL,
      profileId: WSL_OPENCODE_PROFILE_ID,
      checkedAt: NOW,
    });
  });

  it("repairs idempotently without duplicating the profile", async () => {
    const existingWslProfile = makeWslOpenCodeRuntimeProfilePatch({
      binaryPath: "/old/opencode",
    });
    const { adapter, calls } = recordingAdapter();

    const result = await repairWslOpenCodeRuntime(adapter, {
      provider: "opencode",
      forceReinstall: true,
    });
    const nextProfiles = upsertWslOpenCodeRuntimeProfile([existingWslProfile], result.profile);

    expect(nextProfiles).toHaveLength(1);
    expect(nextProfiles[0]).toMatchObject({
      id: WSL_OPENCODE_PROFILE_ID,
      binaryPath: BINARY_PATH,
    });
    expect(calls.map((call) => call.name)).toEqual([
      "ensureRuntimeDirectory",
      "resolveOpenCodeBinary",
      "writeExecutableFile",
      "writeFile",
      "systemctlUser",
      "systemctlUser",
      "smokeRuntime",
    ]);
    expect(calls[1]).toEqual({ name: "resolveOpenCodeBinary", forceReinstall: true });
    expect(calls[4]).toEqual({ name: "systemctlUser", args: ["daemon-reload"] });
    expect(calls[5]).toEqual({
      name: "systemctlUser",
      args: ["restart", JCODE_OPENCODE_SERVICE_NAME],
    });
    expect(calls[6]).toEqual({
      name: "smokeRuntime",
      serverUrl: DEFAULT_WSL_OPENCODE_SERVER_URL,
    });
    expect(result.snapshot.state).toBe("ready");
  });

  it("redacts caught bootstrap failures before surfacing them", async () => {
    const { adapter } = recordingAdapter({
      failSmokeWith: "token=abc password=secret client_secret=hidden",
    });

    await expect(bootstrapWslOpenCodeRuntime(adapter, { provider: "opencode" })).rejects.toThrow(
      "token=<redacted>",
    );
    await expect(
      bootstrapWslOpenCodeRuntime(adapter, { provider: "opencode" }),
    ).rejects.not.toThrow("secret");
  });
});
