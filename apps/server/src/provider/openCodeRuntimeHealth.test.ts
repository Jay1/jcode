import type { ServerSettings } from "@jcode/contracts";
import { DEFAULT_SERVER_SETTINGS } from "@jcode/contracts";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  OPENCODE_CLI_SPEC,
  OpenCodeRuntimeError,
  type OpenCodeRuntimeShape,
} from "./opencodeRuntime.ts";
import { checkOpenCodeRuntimeHealth } from "./openCodeRuntimeHealth.ts";

function makeRuntime(overrides: Partial<OpenCodeRuntimeShape> = {}): OpenCodeRuntimeShape {
  return {
    startOpenCodeServerProcess: () =>
      Effect.fail(
        new OpenCodeRuntimeError({
          operation: "startOpenCodeServerProcess",
          detail: "unexpected start",
        }),
      ),
    connectToOpenCodeServer: () =>
      Effect.succeed({
        url: "http://127.0.0.1:4096",
        exitCode: null,
        external: true,
      }),
    runOpenCodeCommand: () =>
      Effect.fail(
        new OpenCodeRuntimeError({
          operation: "runOpenCodeCommand",
          detail: "unexpected command",
        }),
      ),
    createOpenCodeSdkClient: () => ({}) as never,
    loadOpenCodeInventory: () =>
      Effect.succeed({
        providerList: { connected: [], all: [], default: {} },
        agents: [{ name: "build", mode: "primary" }] as never,
        consoleState: {
          commands: [{ name: "review" }],
          skills: [{ name: "superpowers" }],
          plugins: [{ name: "oh-my-openagent" }],
        } as never,
      }),
    listOpenCodeCliModels: () =>
      Effect.succeed([
        {
          slug: "opencode/gpt-test",
          providerID: "opencode",
          modelID: "gpt-test",
          name: "GPT Test",
          variants: [],
          supportedReasoningEfforts: [],
        },
      ]),
    loadOpenCodeCredentialProviderIDs: () => Effect.succeed([]),
    ...overrides,
  };
}

function settingsWithOpenCodeProfile(
  profile: ServerSettings["providers"]["opencode"]["runtimeProfiles"][number],
  options?: { readonly serverPassword?: string },
): ServerSettings {
  return {
    ...DEFAULT_SERVER_SETTINGS,
    providers: {
      ...DEFAULT_SERVER_SETTINGS.providers,
      opencode: {
        ...DEFAULT_SERVER_SETTINGS.providers.opencode,
        activeRuntimeProfileId: profile.id,
        runtimeProfiles: [profile],
        ...(options?.serverPassword ? { serverPassword: options.serverPassword } : {}),
      },
    },
  };
}

describe("checkOpenCodeRuntimeHealth", () => {
  it("returns unreachable health instead of throwing", async () => {
    const settings = settingsWithOpenCodeProfile({
      id: "external",
      label: "External",
      provider: "opencode",
      mode: "external",
      serverUrl: "http://127.0.0.1:4096",
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
    });
    const runtime = makeRuntime({
      connectToOpenCodeServer: () =>
        Effect.fail(
          new OpenCodeRuntimeError({
            operation: "connectToOpenCodeServer",
            detail: "connection refused",
          }),
        ),
    });

    const health = await Effect.runPromise(
      checkOpenCodeRuntimeHealth({
        settings,
        runtime,
        cliSpec: OPENCODE_CLI_SPEC,
        defaultBinaryPath: "opencode",
      }),
    );

    expect(health.status).toBe("unreachable");
    expect(health.mismatches[0]?.id).toBe("runtime-unreachable");
  });

  it("reports missing required capabilities as degraded", async () => {
    const settings = settingsWithOpenCodeProfile({
      id: "external",
      label: "External",
      provider: "opencode",
      mode: "external",
      serverUrl: "http://127.0.0.1:4096",
      configMode: "inherit",
      skillRoots: [],
      pluginRoots: [],
      requiredCommands: ["review"],
      requiredSkills: ["superpowers", "missing-skill"],
      requiredPlugins: ["oh-my-openagent"],
      requiredAgents: ["build"],
      requiredModels: ["opencode/gpt-test"],
      requiredEnv: [],
      requirements: [],
      capabilityPolicy: "warn",
    });

    const health = await Effect.runPromise(
      checkOpenCodeRuntimeHealth({
        settings,
        runtime: makeRuntime(),
        cliSpec: OPENCODE_CLI_SPEC,
        defaultBinaryPath: "opencode",
      }),
    );

    expect(health.status).toBe("degraded");
    expect(health.capabilities.skills?.names).toContain("superpowers");
    expect(
      health.mismatches.some((mismatch) => mismatch.id === "missing-skill-missing-skill"),
    ).toBe(true);
  });

  it("reports healthy when required capabilities are present", async () => {
    const settings = settingsWithOpenCodeProfile({
      id: "external",
      label: "External",
      provider: "opencode",
      mode: "external",
      serverUrl: "http://127.0.0.1:4096",
      configMode: "inherit",
      skillRoots: [],
      pluginRoots: [],
      requiredCommands: ["review"],
      requiredSkills: ["superpowers"],
      requiredPlugins: ["oh-my-openagent"],
      requiredAgents: ["build"],
      requiredModels: ["opencode/gpt-test"],
      requiredEnv: [],
      requirements: [],
      capabilityPolicy: "warn",
    });

    const health = await Effect.runPromise(
      checkOpenCodeRuntimeHealth({
        settings,
        runtime: makeRuntime(),
        cliSpec: OPENCODE_CLI_SPEC,
        defaultBinaryPath: "opencode",
      }),
    );

    expect(health.status).toBe("healthy");
    expect(health.mismatches).toEqual([]);
  });

  it("passes managed profile password to spawned server connection and SDK client", async () => {
    const connectCalls: Array<Parameters<OpenCodeRuntimeShape["connectToOpenCodeServer"]>[0]> = [];
    const clientCalls: Array<Parameters<OpenCodeRuntimeShape["createOpenCodeSdkClient"]>[0]> = [];
    const settings = settingsWithOpenCodeProfile(
      {
        id: "managed",
        label: "Managed",
        provider: "opencode",
        mode: "managed",
        configMode: "generated",
        binaryPath: "/managed/bin/opencode",
        cwdDefault: "/managed/workspace",
        opencodeConfigDir: "/managed/config",
        opencodeDataDir: "/managed/data",
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
      { serverPassword: "profile-password" },
    );
    const runtime = makeRuntime({
      connectToOpenCodeServer: (input) => {
        connectCalls.push(input);
        return Effect.succeed({
          url: "http://127.0.0.1:4096",
          exitCode: null,
          external: false,
        });
      },
      createOpenCodeSdkClient: (input) => {
        clientCalls.push(input);
        return {} as never;
      },
    });

    const health = await Effect.runPromise(
      checkOpenCodeRuntimeHealth({
        settings,
        runtime,
        cliSpec: OPENCODE_CLI_SPEC,
        defaultBinaryPath: "opencode",
      }),
    );

    expect(health.external).toBe(false);
    expect(connectCalls[0]).toMatchObject({
      serverPassword: "profile-password",
    });
    expect(clientCalls[0]).toMatchObject({
      baseUrl: "http://127.0.0.1:4096",
      directory: "/managed/workspace",
      serverPassword: "profile-password",
    });
  });

  it("generates a memory-only password for managed profiles without a configured password", async () => {
    const connectCalls: Array<Parameters<OpenCodeRuntimeShape["connectToOpenCodeServer"]>[0]> = [];
    const clientCalls: Array<Parameters<OpenCodeRuntimeShape["createOpenCodeSdkClient"]>[0]> = [];
    const settings = settingsWithOpenCodeProfile({
      id: "managed",
      label: "Managed",
      provider: "opencode",
      mode: "managed",
      configMode: "generated",
      binaryPath: "/managed/bin/opencode",
      cwdDefault: "/managed/workspace",
      opencodeConfigDir: "/managed/config",
      opencodeDataDir: "/managed/data",
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
    const runtime = makeRuntime({
      connectToOpenCodeServer: (input) => {
        connectCalls.push(input);
        return Effect.succeed({
          url: "http://127.0.0.1:4096",
          exitCode: null,
          external: false,
        });
      },
      createOpenCodeSdkClient: (input) => {
        clientCalls.push(input);
        return {} as never;
      },
    });

    const health = await Effect.runPromise(
      checkOpenCodeRuntimeHealth({
        settings,
        runtime,
        cliSpec: OPENCODE_CLI_SPEC,
        defaultBinaryPath: "opencode",
      }),
    );

    expect(health.external).toBe(false);
    expect(connectCalls[0]?.serverPassword).toEqual(expect.any(String));
    expect(connectCalls[0]?.serverPassword).toHaveLength(32);
    expect(clientCalls[0]?.serverPassword).toBe(connectCalls[0]?.serverPassword);
    expect(settings.providers.opencode.serverPassword).toBe("");
  });
});
