import * as NodeServices from "@effect/platform-node/NodeServices";
import { DEFAULT_MODEL_BY_PROVIDER, type ServerSettingsPatch } from "@jcode/contracts";
import { Effect, FileSystem, Layer } from "effect";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { ServerSecretStoreLive } from "./auth/Layers/ServerSecretStore";
import { ServerSecretStore } from "./auth/Services/ServerSecretStore";
import { ServerConfig } from "./config";
import {
  readOpenClawSecretMetadata,
  rotateOpenClawDeviceKey,
  setOpenClawPairedToken,
  setOpenClawPassword,
  setOpenClawToken,
} from "./provider/openclawSecrets";
import { ServerSettingsLive, ServerSettingsService } from "./serverSettings";

const serverConfigLayer = ServerConfig.layerTest(process.cwd(), {
  prefix: "jcode-settings-test-",
}).pipe(Layer.provide(NodeServices.layer));
const makeTestLayer = Layer.merge(NodeServices.layer, serverConfigLayer);
const secretStoreLayer = ServerSecretStoreLive.pipe(Layer.provide(makeTestLayer));
const serviceDependenciesLayer = Layer.merge(makeTestLayer, secretStoreLayer);
const testLayer = Layer.merge(
  serviceDependenciesLayer,
  ServerSettingsLive.pipe(Layer.provide(serviceDependenciesLayer)),
);

const runWithSettings = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    ServerSettingsService | ServerConfig | FileSystem.FileSystem | ServerSecretStore
  >,
) => Effect.runPromise(effect.pipe(Effect.provide(testLayer)) as Effect.Effect<A, E, never>);

describe("ServerSettingsService", () => {
  it("loads defaults when settings file does not exist", async () => {
    const settings = await runWithSettings(
      Effect.gen(function* () {
        const service = yield* ServerSettingsService;
        yield* service.start;
        return yield* service.getSettings;
      }),
    );

    expect(settings.providers.codex.binaryPath).toBe("codex");
    expect(settings.defaultThreadEnvMode).toBe("local");
    expect(settings.providers.opencode.runtimeProfiles).toEqual([]);
    expect(settings.providers.opencode.activeRuntimeProfileId).toBe("");
  });

  it("falls back to default chat and provider update settings when the settings file is malformed", async () => {
    const settings = await runWithSettings(
      Effect.gen(function* () {
        const service = yield* ServerSettingsService;
        const { settingsPath } = yield* ServerConfig;
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory(dirname(settingsPath), { recursive: true });
        yield* fs.writeFileString(settingsPath, "{not-json");

        yield* service.start;
        return yield* service.getSettings;
      }),
    );

    expect(settings.chatMarkdownWordWrap).toBe(true);
    expect(settings.enableProviderUpdateChecks).toBe(true);
    expect(settings.diffWordWrap).toBe(false);
  });

  it("persists updates and reloads them", async () => {
    const result = await runWithSettings(
      Effect.gen(function* () {
        const service = yield* ServerSettingsService;
        const { settingsPath } = yield* ServerConfig;
        const fs = yield* FileSystem.FileSystem;
        yield* service.start;

        const updated = yield* service.updateSettings({
          enableAssistantStreaming: true,
          providers: {
            codex: {
              binaryPath: "/usr/local/bin/codex",
              customModels: ["gpt-custom"],
            },
          },
        });
        const raw = yield* fs.readFileString(settingsPath);
        return { updated, parsed: JSON.parse(raw) as unknown };
      }),
    );

    expect(result.updated.enableAssistantStreaming).toBe(true);
    expect(result.updated.providers.codex.binaryPath).toBe("/usr/local/bin/codex");
    expect(result.parsed).toMatchObject({
      enableAssistantStreaming: true,
      providers: {
        codex: {
          binaryPath: "/usr/local/bin/codex",
          customModels: ["gpt-custom"],
        },
      },
    });
  });

  it("persists only non-secret OpenClaw settings metadata", async () => {
    const result = await runWithSettings(
      Effect.gen(function* () {
        const service = yield* ServerSettingsService;
        const { settingsPath } = yield* ServerConfig;
        const fs = yield* FileSystem.FileSystem;
        yield* service.start;

        const patch = {
          providers: {
            openclaw: {
              gatewayUrl: "ws://user:pass@127.0.0.1:18789/path?token=secret#fragment",
              authMode: "token",
              hasSecret: true,
              paired: false,
              token: "token-secret",
              password: "password-secret",
            },
          },
        } as unknown as ServerSettingsPatch;

        const updated = yield* service.updateSettings(patch);
        const raw = yield* fs.readFileString(settingsPath);
        return { updated, raw, parsed: JSON.parse(raw) as unknown };
      }),
    );

    expect(result.updated.providers.openclaw).toEqual({
      enabled: true,
      gatewayUrl: "ws://127.0.0.1:18789/path",
      authMode: "token",
      hasSecret: false,
      paired: false,
    });
    expect(result.raw).not.toContain("token-secret");
    expect(result.raw).not.toContain("password-secret");
    expect(result.parsed).toMatchObject({
      providers: {
        openclaw: {
          gatewayUrl: "ws://127.0.0.1:18789/path",
          authMode: "token",
        },
      },
    });
  });

  it("resolves text generation selection away from disabled providers", async () => {
    const settings = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ServerSettingsService;
        return yield* service.getSettings;
      }).pipe(
        Effect.provide(
          ServerSettingsService.layerTest({
            textGenerationModelSelection: {
              provider: "gemini",
              model: DEFAULT_MODEL_BY_PROVIDER.gemini,
            },
            providers: {
              gemini: { enabled: false },
            },
          }),
        ),
      ),
    );

    expect(settings.textGenerationModelSelection.provider).toBe("codex");
    expect(settings.textGenerationModelSelection.model).toBe(DEFAULT_MODEL_BY_PROVIDER.codex);
  });

  it("persists sanitized OpenClaw gateway URLs", async () => {
    const result = await runWithSettings(
      Effect.gen(function* () {
        const service = yield* ServerSettingsService;
        const { settingsPath } = yield* ServerConfig;
        const fs = yield* FileSystem.FileSystem;
        yield* service.start;

        const updated = yield* service.updateSettings({
          providers: {
            openclaw: {
              gatewayUrl: "https://user:secret@gateway.example.test/path?token=must-not-leak#hash",
            },
          },
        });
        const raw = yield* fs.readFileString(settingsPath);
        return { updated, raw };
      }),
    );

    expect(result.updated.providers.openclaw.gatewayUrl).toBe("https://gateway.example.test/path");
    expect(result.raw).toContain("https://gateway.example.test/path");
    expect(result.raw).not.toContain("user");
    expect(result.raw).not.toContain("secret");
    expect(result.raw).not.toContain("must-not-leak");
  });

  it("sanitizes legacy credential-bearing OpenClaw gateway URLs when loading settings", async () => {
    const settings = await runWithSettings(
      Effect.gen(function* () {
        const service = yield* ServerSettingsService;
        const { settingsPath } = yield* ServerConfig;
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory(dirname(settingsPath), {
          recursive: true,
        });
        yield* fs.writeFileString(
          settingsPath,
          `${JSON.stringify({
            providers: {
              openclaw: {
                gatewayUrl: "ws://user:pass@gateway.example.test/path?token=must-not-leak#fragment",
                authMode: "token",
                hasSecret: true,
                paired: true,
              },
            },
          })}\n`,
        );

        yield* service.start;
        return yield* service.getSettings;
      }),
    );

    expect(settings.providers.openclaw).toEqual({
      enabled: true,
      gatewayUrl: "ws://gateway.example.test/path",
      authMode: "token",
      hasSecret: false,
      paired: false,
    });
  });

  it("clears OpenClaw secrets and metadata when the gateway URL changes", async () => {
    const result = await runWithSettings(
      Effect.gen(function* () {
        const service = yield* ServerSettingsService;
        yield* service.start;

        yield* service.updateSettings({
          providers: { openclaw: { gatewayUrl: "https://gateway.example.test/path" } },
        });
        yield* setOpenClawToken("token-secret");
        yield* setOpenClawPassword("password-secret");
        yield* rotateOpenClawDeviceKey;
        yield* setOpenClawPairedToken("device-token-secret");

        yield* service.updateOpenClawSecretMetadata({ hasSecret: true, paired: true });
        const settings = yield* service.updateSettings({
          providers: { openclaw: { gatewayUrl: "https://other-gateway.example.test/path" } },
        });

        const metadata = yield* readOpenClawSecretMetadata;
        return { metadata, settings };
      }),
    );

    expect(result.metadata).toEqual({
      hasToken: false,
      hasPassword: false,
      hasDeviceKey: false,
      hasDeviceToken: false,
      paired: false,
    });
    expect(result.settings.providers.openclaw.hasSecret).toBe(false);
    expect(result.settings.providers.openclaw.paired).toBe(false);
  });

  it("rehydrates OpenClaw secret metadata from the server secret store on startup", async () => {
    const settings = await runWithSettings(
      Effect.gen(function* () {
        yield* setOpenClawToken("token-secret");
        yield* rotateOpenClawDeviceKey;
        yield* setOpenClawPairedToken("device-token-secret");

        const service = yield* ServerSettingsService;
        yield* service.start;
        return yield* service.getSettings;
      }),
    );

    expect(settings.providers.openclaw.hasSecret).toBe(true);
    expect(settings.providers.openclaw.paired).toBe(true);
  });

  it("persists server-owned OpenClaw secret metadata", async () => {
    const settings = await runWithSettings(
      Effect.gen(function* () {
        const service = yield* ServerSettingsService;
        yield* service.start;
        return yield* service.updateOpenClawSecretMetadata({
          hasSecret: true,
          paired: true,
        });
      }),
    );

    expect(settings.providers.openclaw.hasSecret).toBe(true);
    expect(settings.providers.openclaw.paired).toBe(true);
  });

  it("persists OpenCode runtime profiles", async () => {
    const settings = await runWithSettings(
      Effect.gen(function* () {
        const service = yield* ServerSettingsService;
        yield* service.start;
        return yield* service.updateSettings({
          providers: {
            opencode: {
              activeRuntimeProfileId: "external-opencode",
              runtimeProfiles: [
                {
                  id: "external-opencode",
                  label: "External OpenCode",
                  provider: "opencode",
                  mode: "external",
                  configMode: "inherit",
                  serverUrl: "http://127.0.0.1:4096",
                  skillRoots: [],
                  pluginRoots: [],
                  requiredCommands: [],
                  capabilityPolicy: "warn",
                  requiredSkills: ["superpowers"],
                  requiredPlugins: [],
                  requiredAgents: [],
                  requiredModels: [],
                  requiredEnv: [],
                  requirements: [],
                },
              ],
            },
          },
        });
      }),
    );

    expect(settings.providers.opencode.activeRuntimeProfileId).toBe("external-opencode");
    expect(settings.providers.opencode.runtimeProfiles).toMatchObject([
      {
        id: "external-opencode",
        mode: "external",
        serverUrl: "http://127.0.0.1:4096",
        requiredSkills: ["superpowers"],
      },
    ]);
  });
});
