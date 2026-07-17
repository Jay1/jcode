import { ServerSettings } from "@jcode/contracts";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  AppSettingsSchema,
  DEFAULT_CHAT_FONT_SIZE_PX,
  DEFAULT_SHOW_INTERFACE_CLOCK,
  DEFAULT_SIDEBAR_PROJECT_SORT_ORDER,
  DEFAULT_SIDEBAR_THREAD_SORT_ORDER,
  DEFAULT_TIMESTAMP_FORMAT,
  appSettingsPatchToServerSettingsPatch,
  getAppModelOptions,
  getDefaultNativeFontSmoothing,
  getCustomModelOptionsByProvider,
  getCustomModelsByProvider,
  getCustomModelsForProvider,
  getDefaultCustomModelsForProvider,
  getGitTextGenerationModelOptions,
  getProviderStartOptions,
  MODEL_PROVIDER_SETTINGS,
  normalizeChatFontSizePx,
  normalizeCustomModelSlugs,
  normalizeStoredAppSettings,
  patchCustomModels,
  resolveAppModelSelection,
  serverSettingsToAppSettings,
} from "./appSettings";
import { DEFAULT_PROVIDER_ORDER } from "./providerOrdering";

describe("normalizeCustomModelSlugs", () => {
  it("normalizes aliases, removes built-ins, and deduplicates values", () => {
    expect(
      normalizeCustomModelSlugs([
        " custom/internal-model ",
        "gpt-5.3-codex",
        "5.3",
        "custom/internal-model",
        "",
        null,
      ]),
    ).toEqual(["custom/internal-model"]);
  });

  it("normalizes provider-specific aliases for claude", () => {
    expect(normalizeCustomModelSlugs(["sonnet"], "claudeAgent")).toEqual([]);
    expect(normalizeCustomModelSlugs(["claude/custom-sonnet"], "claudeAgent")).toEqual([
      "claude/custom-sonnet",
    ]);
  });
});

describe("Claude custom model settings", () => {
  it("uses the canonical Sonnet 5 model ID as the example", () => {
    const claudeSettings = MODEL_PROVIDER_SETTINGS.find(
      (settings) => settings.provider === "claudeAgent",
    );

    expect(claudeSettings?.example).toBe("claude-sonnet-5");
  });
});

describe("getAppModelOptions", () => {
  it("appends saved custom models after the built-in options", () => {
    const options = getAppModelOptions("codex", ["custom/internal-model"]);

    expect(options.map((option) => option.slug)).toEqual([
      "gpt-5.5",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.3-codex",
      "gpt-5.3-codex-spark",
      "gpt-5.2-codex",
      "gpt-5.2",
      "custom/internal-model",
    ]);
  });

  it("keeps the currently selected custom model available even if it is no longer saved", () => {
    const options = getAppModelOptions("codex", [], "custom/selected-model");

    expect(options.at(-1)).toEqual({
      slug: "custom/selected-model",
      name: "custom/selected-model",
      provider: "codex",
      isCustom: true,
    });
  });

  it("formats unknown GPT custom models with a readable label", () => {
    const options = getAppModelOptions("codex", ["gpt-5.1-codex-max"]);

    expect(options.at(-1)).toEqual({
      slug: "gpt-5.1-codex-max",
      name: "GPT-5.1 Codex Max",
      provider: "codex",
      isCustom: true,
    });
  });

  it("keeps a saved custom provider model available as an exact slug option", () => {
    const options = getAppModelOptions("claudeAgent", ["claude/custom-opus"], "claude/custom-opus");

    expect(options.some((option) => option.slug === "claude/custom-opus" && option.isCustom)).toBe(
      true,
    );
  });
});

describe("getGitTextGenerationModelOptions", () => {
  it("merges codex and OpenCode model options for git writing settings", () => {
    const options = getGitTextGenerationModelOptions({
      customCodexModels: ["custom/codex-model"],
      customKiloModels: [],
      customOpenCodeModels: ["openrouter/gpt-oss-120b"],
      textGenerationModel: "openai/gpt-5",
      textGenerationProvider: "opencode",
    });

    expect(options.some((option) => option.slug === "gpt-5.4-mini")).toBe(true);
    expect(options.some((option) => option.slug === "openai/gpt-5")).toBe(true);
    expect(options.some((option) => option.slug === "openrouter/gpt-oss-120b")).toBe(true);
  });

  it("preserves a currently selected transient git writing model", () => {
    const options = getGitTextGenerationModelOptions({
      customCodexModels: [],
      customKiloModels: [],
      customOpenCodeModels: [],
      textGenerationModel: "openrouter/custom-model",
      textGenerationProvider: "opencode",
    });

    expect(options.at(-1)).toEqual({
      slug: "openrouter/custom-model",
      name: "Custom Model",
      provider: "opencode",
      isCustom: true,
    });
  });

  it("humanizes transient OpenCode git-writing models instead of showing the raw slug", () => {
    const options = getGitTextGenerationModelOptions({
      customCodexModels: [],
      customKiloModels: [],
      customOpenCodeModels: [],
      textGenerationModel: "opencode-go/kimi-k2.6",
      textGenerationProvider: "opencode",
    });

    expect(options.at(-1)).toEqual({
      slug: "opencode-go/kimi-k2.6",
      name: "Kimi K2.6",
      provider: "opencode",
      isCustom: true,
    });
  });

  it("does not add OpenClaw gateway to git-writing model options", () => {
    const options = getGitTextGenerationModelOptions({
      customCodexModels: [],
      customKiloModels: [],
      customOpenCodeModels: [],
      textGenerationModel: "gateway",
      textGenerationProvider: "openclaw",
    });

    expect(options.some((option) => option.provider === "openclaw")).toBe(false);
  });
});

describe("resolveAppModelSelection", () => {
  it("preserves saved custom model slugs instead of falling back to the default", () => {
    expect(
      resolveAppModelSelection(
        "codex",
        {
          codex: ["galapagos-alpha"],
          claudeAgent: [],
          cursor: [],
          devin: [],
          gemini: [],
          kilo: [],
          opencode: [],
          openclaw: [],
          pi: [],
        },
        "galapagos-alpha",
      ),
    ).toBe("galapagos-alpha");
  });

  it("falls back to the provider default when no model is selected", () => {
    expect(
      resolveAppModelSelection(
        "codex",
        {
          codex: [],
          claudeAgent: [],
          cursor: [],
          devin: [],
          gemini: [],
          kilo: [],
          opencode: [],
          openclaw: [],
          pi: [],
        },
        "",
      ),
    ).toBe("gpt-5.5");
  });

  it("resolves display names through the shared resolver", () => {
    expect(
      resolveAppModelSelection(
        "codex",
        {
          codex: [],
          claudeAgent: [],
          cursor: [],
          devin: [],
          gemini: [],
          kilo: [],
          opencode: [],
          openclaw: [],
          pi: [],
        },
        "GPT-5.3 Codex",
      ),
    ).toBe("gpt-5.3-codex");
  });

  it("resolves aliases through the shared resolver", () => {
    expect(
      resolveAppModelSelection(
        "claudeAgent",
        {
          codex: [],
          claudeAgent: [],
          cursor: [],
          devin: [],
          gemini: [],
          kilo: [],
          opencode: [],
          openclaw: [],
          pi: [],
        },
        "sonnet",
      ),
    ).toBe("claude-sonnet-4-6");
  });

  it("resolves transient selected custom models included in app model options", () => {
    expect(
      resolveAppModelSelection(
        "codex",
        {
          codex: [],
          claudeAgent: [],
          cursor: [],
          devin: [],
          gemini: [],
          kilo: [],
          opencode: [],
          openclaw: [],
          pi: [],
        },
        "custom/selected-model",
      ),
    ).toBe("custom/selected-model");
  });
});

describe("timestamp format defaults", () => {
  it("defaults timestamp format to locale", () => {
    expect(DEFAULT_TIMESTAMP_FORMAT).toBe("locale");
  });
});

describe("chat font size defaults", () => {
  it("defaults chat font size to 12px", () => {
    expect(DEFAULT_CHAT_FONT_SIZE_PX).toBe(12);
  });

  it("clamps chat font size updates into the supported range", () => {
    expect(normalizeChatFontSizePx(9)).toBe(11);
    expect(normalizeChatFontSizePx(18.4)).toBe(18);
    expect(normalizeChatFontSizePx(Number.NaN)).toBe(DEFAULT_CHAT_FONT_SIZE_PX);
  });
});

describe("sidebar sort defaults", () => {
  it("defaults project sorting to manual", () => {
    expect(DEFAULT_SIDEBAR_PROJECT_SORT_ORDER).toBe("manual");
  });

  it("defaults thread sorting to updated_at", () => {
    expect(DEFAULT_SIDEBAR_THREAD_SORT_ORDER).toBe("updated_at");
  });
});

describe("normalizeStoredAppSettings", () => {
  it("defaults native font smoothing by platform", () => {
    expect(getDefaultNativeFontSmoothing("MacIntel")).toBe(true);
    expect(getDefaultNativeFontSmoothing("Win32")).toBe(false);
    expect(getDefaultNativeFontSmoothing("Linux x86_64")).toBe(false);
  });

  it("uses the current platform default for existing settings without a stored value", () => {
    const decodedSettings = Schema.decodeSync(Schema.fromJsonString(AppSettingsSchema))("{}");

    expect(decodedSettings.enableNativeFontSmoothing).toBe(getDefaultNativeFontSmoothing());
  });

  it("preserves an explicitly stored updated_at project sort order", () => {
    const decodedSettings = Schema.decodeSync(Schema.fromJsonString(AppSettingsSchema))(
      JSON.stringify({
        sidebarProjectSortOrder: "updated_at",
        chatFontSizePx: 99,
        customCodexModels: [" custom/internal-model ", "gpt-5.4", "custom/internal-model"],
      }),
    );

    expect(normalizeStoredAppSettings(decodedSettings)).toMatchObject({
      sidebarProjectSortOrder: "updated_at",
      chatFontSizePx: 18,
      customCodexModels: ["custom/internal-model"],
    });
  });
});

describe("interface clock settings", () => {
  it("defaults interface clock visibility to visible", () => {
    expect(DEFAULT_SHOW_INTERFACE_CLOCK).toBe(true);
  });

  it("fills interface clock visibility for persisted settings that predate the key", () => {
    const decode = Schema.decodeSync(Schema.fromJsonString(AppSettingsSchema));

    expect(decode("{}").showInterfaceClock).toBe(true);
  });

  it("keeps interface clock visibility local-only when building server patches", () => {
    expect(appSettingsPatchToServerSettingsPatch({ showInterfaceClock: false })).toEqual({});
    expect(
      appSettingsPatchToServerSettingsPatch({
        showInterfaceClock: false,
        addProjectBaseDirectory: "/home/jay/code",
      }),
    ).toEqual({ addProjectBaseDirectory: "/home/jay/code" });
  });
});

describe("server-backed app settings", () => {
  it("maps the Project Folder setting from server settings", () => {
    expect(
      serverSettingsToAppSettings(
        Schema.decodeSync(ServerSettings)({
          addProjectBaseDirectory: "/home/jay/code",
          defaultThreadEnvMode: "local",
          enableAssistantStreaming: false,
          providers: {
            claudeAgent: { enabled: true, binaryPath: "claude", launchArgs: "", customModels: [] },
            codex: {
              enabled: true,
              binaryPath: "codex",
              homePath: "",
              launchArgs: "",
              customModels: [],
            },
            cursor: { enabled: true, binaryPath: "agent", apiEndpoint: "", customModels: [] },
            gemini: { enabled: true, binaryPath: "gemini", customModels: [] },
            kilo: {
              enabled: true,
              binaryPath: "kilo",
              serverUrl: "",
              serverPassword: "",
              customModels: [],
            },
            opencode: {
              enabled: true,
              binaryPath: "opencode",
              serverUrl: "",
              serverPassword: "",
              runtimeProfiles: [],
              activeRuntimeProfileId: "",
              customModels: [],
            },
            openclaw: {
              enabled: true,
              gatewayUrl: "ws://127.0.0.1:18789",
              authMode: "device",
              hasSecret: true,
              paired: false,
            },
            pi: { enabled: true, binaryPath: "pi", agentDir: "", customModels: [] },
          },
          textGenerationModelSelection: { provider: "codex", model: "gpt-5.4" },
        }),
      ),
    ).toMatchObject({
      addProjectBaseDirectory: "/home/jay/code",
      openClawAuthMode: "device",
      openClawGatewayUrl: "ws://127.0.0.1:18789",
      openClawHasSecret: true,
      openClawPaired: false,
    });
  });

  it("defaults optional Codex launch args from server settings", () => {
    expect(
      serverSettingsToAppSettings(
        Schema.decodeSync(ServerSettings)({
          addProjectBaseDirectory: "/home/jay/code",
          defaultThreadEnvMode: "local",
          enableAssistantStreaming: false,
          providers: {
            claudeAgent: { enabled: true, binaryPath: "claude", launchArgs: "", customModels: [] },
            codex: {
              enabled: true,
              binaryPath: "codex",
              homePath: "",
              customModels: [],
            },
            cursor: { enabled: true, binaryPath: "agent", apiEndpoint: "", customModels: [] },
            gemini: { enabled: true, binaryPath: "gemini", customModels: [] },
            kilo: {
              enabled: true,
              binaryPath: "kilo",
              serverUrl: "",
              serverPassword: "",
              customModels: [],
            },
            opencode: {
              enabled: true,
              binaryPath: "opencode",
              serverUrl: "",
              serverPassword: "",
              runtimeProfiles: [],
              activeRuntimeProfileId: "",
              customModels: [],
            },
            openclaw: {
              enabled: true,
              gatewayUrl: "",
              authMode: "none",
              hasSecret: false,
              paired: false,
            },
            pi: { enabled: true, binaryPath: "pi", agentDir: "", customModels: [] },
          },
          textGenerationModelSelection: { provider: "codex", model: "gpt-5.4" },
        }),
      ).codexLaunchArgs,
    ).toBe("");
  });

  it("maps Project Folder updates to server settings patches", () => {
    expect(
      appSettingsPatchToServerSettingsPatch({ addProjectBaseDirectory: "/home/jay/code" }),
    ).toEqual({ addProjectBaseDirectory: "/home/jay/code" });
  });

  it("does not map OpenClaw server-derived metadata to server settings patches", () => {
    expect(
      appSettingsPatchToServerSettingsPatch({
        openClawGatewayUrl: "https://gateway.example.test",
        openClawAuthMode: "token",
        openClawHasSecret: true,
        openClawPaired: false,
      }),
    ).toEqual({
      providers: {
        openclaw: {
          gatewayUrl: "https://gateway.example.test",
          authMode: "token",
        },
      },
    });
  });

  it("maps new UI preference fields from server settings", () => {
    expect(
      serverSettingsToAppSettings(
        Schema.decodeSync(ServerSettings)({
          addProjectBaseDirectory: "/home/jay/code",
          defaultThreadEnvMode: "local",
          enableAssistantStreaming: false,
          chatMarkdownWordWrap: false,
          chatFontSizePx: 16,
          chatCodeFontFamily: "JetBrains Mono",
          uiFontFamily: "Inter",
          enableNativeFontSmoothing: true,
          timestampFormat: "24-hour",
          sidebarSide: "right",
          sidebarProjectSortOrder: "updated_at",
          sidebarThreadSortOrder: "created_at",
          confirmThreadDelete: false,
          confirmThreadArchive: false,
          confirmTerminalTabClose: false,
          diffWordWrap: true,
          enableProviderUpdateChecks: false,
          enableTaskCompletionToasts: false,
          enableSystemTaskCompletionNotifications: false,
          defaultProvider: "claudeAgent",
          providers: {
            claudeAgent: { enabled: true, binaryPath: "claude", launchArgs: "", customModels: [] },
            codex: {
              enabled: true,
              binaryPath: "codex",
              homePath: "",
              launchArgs: "",
              customModels: [],
            },
            cursor: { enabled: true, binaryPath: "agent", apiEndpoint: "", customModels: [] },
            gemini: { enabled: true, binaryPath: "gemini", customModels: [] },
            kilo: {
              enabled: true,
              binaryPath: "kilo",
              serverUrl: "",
              serverPassword: "",
              customModels: [],
            },
            opencode: {
              enabled: true,
              binaryPath: "opencode",
              serverUrl: "",
              serverPassword: "",
              runtimeProfiles: [],
              activeRuntimeProfileId: "",
              customModels: [],
            },
            pi: { enabled: true, binaryPath: "pi", agentDir: "", customModels: [] },
          },
          textGenerationModelSelection: { provider: "codex", model: "gpt-5.4" },
        }),
      ),
    ).toMatchObject({
      chatFontSizePx: 16,
      chatMarkdownWordWrap: false,
      chatCodeFontFamily: "JetBrains Mono",
      uiFontFamily: "Inter",
      enableNativeFontSmoothing: true,
      timestampFormat: "24-hour",
      sidebarSide: "right",
      sidebarProjectSortOrder: "updated_at",
      sidebarThreadSortOrder: "created_at",
      confirmThreadDelete: false,
      confirmThreadArchive: false,
      confirmTerminalTabClose: false,
      diffWordWrap: true,
      enableProviderUpdateChecks: false,
      enableTaskCompletionToasts: false,
      enableSystemTaskCompletionNotifications: false,
      defaultProvider: "claudeAgent",
    });
  });

  it("computes hiddenProviders from providers with enabled: false", () => {
    expect(
      serverSettingsToAppSettings(
        Schema.decodeSync(ServerSettings)({
          addProjectBaseDirectory: "",
          defaultThreadEnvMode: "local",
          enableAssistantStreaming: false,
          providers: {
            claudeAgent: { enabled: true, binaryPath: "claude", launchArgs: "", customModels: [] },
            codex: {
              enabled: false,
              binaryPath: "codex",
              homePath: "",
              launchArgs: "",
              customModels: [],
            },
            cursor: { enabled: true, binaryPath: "agent", apiEndpoint: "", customModels: [] },
            gemini: { enabled: false, binaryPath: "gemini", customModels: [] },
            kilo: {
              enabled: true,
              binaryPath: "kilo",
              serverUrl: "",
              serverPassword: "",
              customModels: [],
            },
            opencode: {
              enabled: true,
              binaryPath: "opencode",
              serverUrl: "",
              serverPassword: "",
              runtimeProfiles: [],
              activeRuntimeProfileId: "",
              customModels: [],
            },
            pi: { enabled: true, binaryPath: "pi", agentDir: "", customModels: [] },
          },
          textGenerationModelSelection: { provider: "codex", model: "gpt-5.4" },
        }),
      ),
    ).toMatchObject({
      hiddenProviders: ["codex", "gemini"],
    });
  });

  it("maps new UI preference fields to server settings patches", () => {
    expect(
      appSettingsPatchToServerSettingsPatch({
        chatFontSizePx: 15,
        chatMarkdownWordWrap: false,
        chatCodeFontFamily: "Fira Code",
        uiFontFamily: "IBM Plex Sans",
        enableNativeFontSmoothing: false,
        timestampFormat: "12-hour",
        sidebarSide: "right",
        sidebarProjectSortOrder: "created_at",
        sidebarThreadSortOrder: "created_at",
        confirmThreadDelete: false,
        confirmThreadArchive: true,
        confirmTerminalTabClose: false,
        diffWordWrap: true,
        enableProviderUpdateChecks: false,
        enableTaskCompletionToasts: true,
        enableSystemTaskCompletionNotifications: true,
        defaultProvider: "gemini",
      }),
    ).toEqual({
      chatFontSizePx: 15,
      chatMarkdownWordWrap: false,
      chatCodeFontFamily: "Fira Code",
      uiFontFamily: "IBM Plex Sans",
      enableNativeFontSmoothing: false,
      timestampFormat: "12-hour",
      sidebarSide: "right",
      sidebarProjectSortOrder: "created_at",
      sidebarThreadSortOrder: "created_at",
      confirmThreadDelete: false,
      confirmThreadArchive: true,
      confirmTerminalTabClose: false,
      diffWordWrap: true,
      enableProviderUpdateChecks: false,
      enableTaskCompletionToasts: true,
      enableSystemTaskCompletionNotifications: true,
      defaultProvider: "gemini",
    });
  });

  it("converts hiddenProviders to per-provider enabled flags in server patch", () => {
    const patch = appSettingsPatchToServerSettingsPatch({
      hiddenProviders: ["codex", "gemini"],
    });

    expect(patch.providers).toMatchObject({
      codex: { enabled: false },
      gemini: { enabled: false },
    });
    expect(patch.providers!.codex!.enabled).toBe(false);
    expect(patch.providers!.gemini!.enabled).toBe(false);
  });

  it("re-enables previously hidden providers when hiddenProviders becomes empty", () => {
    const patch = appSettingsPatchToServerSettingsPatch({
      hiddenProviders: [],
    });

    for (const provider of DEFAULT_PROVIDER_ORDER) {
      expect(patch.providers![provider]!.enabled).toBe(true);
    }
  });

  it("handles non-default providers in hiddenProviders", () => {
    const patch = appSettingsPatchToServerSettingsPatch({
      hiddenProviders: ["devin", "codex"],
    });

    expect(patch.providers!.devin!.enabled).toBe(false);
    expect(patch.providers!.codex!.enabled).toBe(false);
    expect(patch.providers!.claudeAgent!.enabled).toBe(true);
  });

  it("re-enables non-default providers when hiddenProviders becomes empty", () => {
    const patch = appSettingsPatchToServerSettingsPatch({
      hiddenProviders: [],
    });

    for (const provider of DEFAULT_PROVIDER_ORDER) {
      expect(patch.providers![provider]!.enabled).toBe(true);
    }
  });

  it("maps providerOrder to server settings patch", () => {
    expect(
      appSettingsPatchToServerSettingsPatch({
        providerOrder: ["claudeAgent", "codex", "gemini", "cursor", "kilo", "opencode"],
      }),
    ).toEqual({
      providerOrder: [
        "claudeAgent",
        "codex",
        "gemini",
        "cursor",
        "kilo",
        "opencode",
        "openclaw",
        "pi",
      ],
    });
  });
});

describe("provider-specific custom models", () => {
  it("includes provider-specific custom slugs in non-codex model lists", () => {
    const claudeOptions = getAppModelOptions("claudeAgent", ["claude/custom-opus"]);

    expect(claudeOptions.some((option) => option.slug === "claude/custom-opus")).toBe(true);
  });
});

describe("getProviderStartOptions", () => {
  it("returns only populated provider overrides", () => {
    expect(
      getProviderStartOptions({
        claudeBinaryPath: "/usr/local/bin/claude",
        codexBinaryPath: "",
        codexHomePath: "/Users/you/.codex",
        codexLaunchArgs: "--ask-for-approval never --sandbox danger-full-access",
        cursorApiEndpoint: "http://localhost:3000",
        cursorBinaryPath: "/usr/local/bin/agent",
        geminiBinaryPath: "/usr/local/bin/gemini",
        kiloBinaryPath: "",
        kiloServerPassword: "",
        kiloServerUrl: "",
        openCodeBinaryPath: "",
        openCodeServerPassword: "",
        openCodeServerUrl: "",
        openClawGatewayUrl: "ws://127.0.0.1:18789",
        piAgentDir: "",
        piBinaryPath: "",
      }),
    ).toEqual({
      claudeAgent: {
        binaryPath: "/usr/local/bin/claude",
      },
      codex: {
        homePath: "/Users/you/.codex",
        launchArgs: "--ask-for-approval never --sandbox danger-full-access",
      },
      cursor: {
        apiEndpoint: "http://localhost:3000",
        binaryPath: "/usr/local/bin/agent",
      },
      gemini: {
        binaryPath: "/usr/local/bin/gemini",
      },
    });
  });

  it("does not include only OpenClaw gateway URLs in provider start options", () => {
    expect(
      getProviderStartOptions({
        claudeBinaryPath: "",
        codexBinaryPath: "",
        codexHomePath: "",
        codexLaunchArgs: "",
        cursorApiEndpoint: "",
        cursorBinaryPath: "",
        geminiBinaryPath: "",
        kiloBinaryPath: "",
        kiloServerPassword: "",
        kiloServerUrl: "",
        openCodeBinaryPath: "",
        openCodeServerPassword: "",
        openCodeServerUrl: "",
        openClawGatewayUrl: "https://gateway.example.test",
        piAgentDir: "",
        piBinaryPath: "",
      }),
    ).toBeUndefined();
  });

  it("returns undefined when no provider overrides are configured", () => {
    expect(
      getProviderStartOptions({
        claudeBinaryPath: "",
        codexBinaryPath: "",
        codexHomePath: "",
        codexLaunchArgs: "",
        cursorApiEndpoint: "",
        cursorBinaryPath: "",
        geminiBinaryPath: "",
        kiloBinaryPath: "",
        kiloServerPassword: "",
        kiloServerUrl: "",
        openCodeBinaryPath: "",
        openCodeServerPassword: "",
        openCodeServerUrl: "",
        openClawGatewayUrl: "",
        piAgentDir: "",
        piBinaryPath: "",
      }),
    ).toBeUndefined();
  });
});

describe("provider-indexed custom model settings", () => {
  const settings = {
    customCodexModels: ["custom/codex-model"],
    customClaudeModels: ["claude/custom-opus"],
    customCursorModels: ["cursor/custom-model"],
    customGeminiModels: ["gemini/custom-flash"],
    customKiloModels: ["kilo/kilo-auto/free"],
    customOpenCodeModels: ["openrouter/gpt-oss-120b"],
    customPiModels: ["anthropic/custom-pi"],
    customDevinModels: [],
  } as const;

  it("exports custom model configs only for providers that support custom models", () => {
    expect(MODEL_PROVIDER_SETTINGS.map((config) => config.provider)).toEqual([
      "codex",
      "claudeAgent",
      "cursor",
      "gemini",
      "kilo",
      "opencode",
      "pi",
      "devin",
    ]);
    expect(MODEL_PROVIDER_SETTINGS.map((config) => config.provider as string)).not.toContain(
      "openclaw",
    );
  });

  it("reads custom models for each provider", () => {
    expect(getCustomModelsForProvider(settings, "codex")).toEqual(["custom/codex-model"]);
    expect(getCustomModelsForProvider(settings, "claudeAgent")).toEqual(["claude/custom-opus"]);
    expect(getCustomModelsForProvider(settings, "cursor")).toEqual(["cursor/custom-model"]);
    expect(getCustomModelsForProvider(settings, "gemini")).toEqual(["gemini/custom-flash"]);
    expect(getCustomModelsForProvider(settings, "kilo")).toEqual(["kilo/kilo-auto/free"]);
    expect(getCustomModelsForProvider(settings, "opencode")).toEqual(["openrouter/gpt-oss-120b"]);
    expect(getCustomModelsForProvider(settings, "pi")).toEqual(["anthropic/custom-pi"]);
  });

  it("reads default custom models for each provider", () => {
    const defaults = {
      customCodexModels: ["default/codex-model"],
      customClaudeModels: ["claude/default-opus"],
      customCursorModels: ["cursor/default-model"],
      customGeminiModels: ["gemini/default-flash"],
      customKiloModels: ["kilo/default-auto"],
      customOpenCodeModels: ["openai/gpt-5"],
      customPiModels: ["anthropic/default-pi"],
      customDevinModels: [],
    } as const;

    expect(getDefaultCustomModelsForProvider(defaults, "codex")).toEqual(["default/codex-model"]);
    expect(getDefaultCustomModelsForProvider(defaults, "claudeAgent")).toEqual([
      "claude/default-opus",
    ]);
    expect(getDefaultCustomModelsForProvider(defaults, "cursor")).toEqual(["cursor/default-model"]);
    expect(getDefaultCustomModelsForProvider(defaults, "gemini")).toEqual(["gemini/default-flash"]);
    expect(getDefaultCustomModelsForProvider(defaults, "kilo")).toEqual(["kilo/default-auto"]);
    expect(getDefaultCustomModelsForProvider(defaults, "opencode")).toEqual(["openai/gpt-5"]);
    expect(getDefaultCustomModelsForProvider(defaults, "pi")).toEqual(["anthropic/default-pi"]);
  });

  it("patches custom models for codex", () => {
    expect(patchCustomModels("codex", ["custom/codex-model"])).toEqual({
      customCodexModels: ["custom/codex-model"],
    });
  });

  it("patches custom models for claude", () => {
    expect(patchCustomModels("claudeAgent", ["claude/custom-opus"])).toEqual({
      customClaudeModels: ["claude/custom-opus"],
    });
  });

  it("patches custom models for gemini", () => {
    expect(patchCustomModels("gemini", ["gemini/custom-flash"])).toEqual({
      customGeminiModels: ["gemini/custom-flash"],
    });
  });

  it("patches custom models for cursor", () => {
    expect(patchCustomModels("cursor", ["cursor/custom-model"])).toEqual({
      customCursorModels: ["cursor/custom-model"],
    });
  });

  it("patches custom models for opencode", () => {
    expect(patchCustomModels("opencode", ["openrouter/gpt-oss-120b"])).toEqual({
      customOpenCodeModels: ["openrouter/gpt-oss-120b"],
    });
  });

  it("patches custom models for kilo", () => {
    expect(patchCustomModels("kilo", ["kilo/kilo-auto/free"])).toEqual({
      customKiloModels: ["kilo/kilo-auto/free"],
    });
  });

  it("patches custom models for pi", () => {
    expect(patchCustomModels("pi", ["anthropic/custom-pi"])).toEqual({
      customPiModels: ["anthropic/custom-pi"],
    });
  });

  it("builds a complete provider-indexed custom model record", () => {
    expect(getCustomModelsByProvider(settings)).toEqual({
      codex: ["custom/codex-model"],
      claudeAgent: ["claude/custom-opus"],
      cursor: ["cursor/custom-model"],
      devin: [],
      gemini: ["gemini/custom-flash"],
      kilo: ["kilo/kilo-auto/free"],
      opencode: ["openrouter/gpt-oss-120b"],
      openclaw: [],
      pi: ["anthropic/custom-pi"],
    });
  });

  it("builds provider-indexed model options including custom models", () => {
    const modelOptionsByProvider = getCustomModelOptionsByProvider(settings);

    expect(
      modelOptionsByProvider.codex.some((option) => option.slug === "custom/codex-model"),
    ).toBe(true);
    expect(
      modelOptionsByProvider.claudeAgent.some((option) => option.slug === "claude/custom-opus"),
    ).toBe(true);
    expect(
      modelOptionsByProvider.cursor.some((option) => option.slug === "cursor/custom-model"),
    ).toBe(true);
    expect(
      modelOptionsByProvider.gemini.some((option) => option.slug === "gemini/custom-flash"),
    ).toBe(true);
    expect(
      modelOptionsByProvider.kilo.some((option) => option.slug === "kilo/kilo-auto/free"),
    ).toBe(true);
    expect(
      modelOptionsByProvider.opencode.some((option) => option.slug === "openrouter/gpt-oss-120b"),
    ).toBe(true);
    expect(modelOptionsByProvider.pi.some((option) => option.slug === "anthropic/custom-pi")).toBe(
      true,
    );
  });

  it("normalizes and deduplicates custom model options per provider", () => {
    const modelOptionsByProvider = getCustomModelOptionsByProvider({
      customCodexModels: ["  custom/codex-model ", "gpt-5.4", "custom/codex-model"],
      customClaudeModels: [" sonnet ", "claude/custom-opus", "claude/custom-opus"],
      customCursorModels: [" composer-2 ", "cursor/custom-model", "cursor/custom-model"],
      customGeminiModels: [" auto-gemini-3 ", "gemini/custom-flash", "gemini/custom-flash"],
      customKiloModels: [" kilo/kilo-auto/free ", "kilo/kilo-auto/free"],
      customOpenCodeModels: [
        " openai/gpt-5 ",
        "openrouter/gpt-oss-120b",
        "openrouter/gpt-oss-120b",
      ],
      customPiModels: [
        " anthropic/claude-sonnet-4-5 ",
        "anthropic/custom-pi",
        "anthropic/custom-pi",
      ],
      customDevinModels: [],
    });

    expect(
      modelOptionsByProvider.codex.filter((option) => option.slug === "custom/codex-model"),
    ).toHaveLength(1);
    expect(modelOptionsByProvider.codex.some((option) => option.slug === "gpt-5.4")).toBe(true);
    expect(
      modelOptionsByProvider.claudeAgent.filter((option) => option.slug === "claude/custom-opus"),
    ).toHaveLength(1);
    expect(
      modelOptionsByProvider.claudeAgent.some((option) => option.slug === "claude-sonnet-4-6"),
    ).toBe(true);
    expect(
      modelOptionsByProvider.gemini.filter((option) => option.slug === "gemini/custom-flash"),
    ).toHaveLength(1);
    expect(
      modelOptionsByProvider.cursor.filter((option) => option.slug === "cursor/custom-model"),
    ).toHaveLength(1);
    expect(modelOptionsByProvider.gemini.some((option) => option.slug === "auto-gemini-3")).toBe(
      true,
    );
    expect(
      modelOptionsByProvider.kilo.filter((option) => option.slug === "kilo/kilo-auto/free"),
    ).toHaveLength(1);
    expect(
      modelOptionsByProvider.opencode.filter((option) => option.slug === "openrouter/gpt-oss-120b"),
    ).toHaveLength(1);
    expect(modelOptionsByProvider.openclaw).toEqual([]);
    expect(
      modelOptionsByProvider.pi.filter((option) => option.slug === "anthropic/custom-pi"),
    ).toHaveLength(1);
  });
});

describe("AppSettingsSchema", () => {
  it("fills decoding defaults for persisted settings that predate newer keys", () => {
    const decode = Schema.decodeSync(Schema.fromJsonString(AppSettingsSchema));

    expect(
      decode(
        JSON.stringify({
          codexBinaryPath: "/usr/local/bin/codex",
          confirmThreadDelete: false,
        }),
      ),
    ).toMatchObject({
      claudeBinaryPath: "",
      chatFontSizePx: DEFAULT_CHAT_FONT_SIZE_PX,
      codexBinaryPath: "/usr/local/bin/codex",
      codexLaunchArgs: "",
      codexHomePath: "",
      geminiBinaryPath: "",
      defaultThreadEnvMode: "local",
      confirmThreadDelete: false,
      confirmTerminalTabClose: true,
      enableAssistantStreaming: false,
      sidebarProjectSortOrder: DEFAULT_SIDEBAR_PROJECT_SORT_ORDER,
      sidebarThreadSortOrder: DEFAULT_SIDEBAR_THREAD_SORT_ORDER,
      timestampFormat: DEFAULT_TIMESTAMP_FORMAT,
      showInterfaceClock: DEFAULT_SHOW_INTERFACE_CLOCK,
      customCodexModels: [],
      customClaudeModels: [],
      customCursorModels: [],
      customGeminiModels: [],
      customKiloModels: [],
      customOpenCodeModels: [],
      customPiModels: [],
      openClawAuthMode: "none",
      openClawGatewayUrl: "",
      openClawHasSecret: false,
      openClawPaired: false,
      addProjectBaseDirectory: "",
    });
  });
});
