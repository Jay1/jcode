import { type NativeApi } from "@jcode/contracts";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isInitialModelDiscoveryPending,
  providerModelsQueryOptions,
  providerPluginsQueryOptions,
  providerReadPluginQueryOptions,
  providerSkillsQueryOptions,
  searchSkillsCatalogQueryOptions,
  supportsSkillInstall,
  supportsSkillToggle,
  supportsSkillUninstall,
} from "./providerDiscoveryReactQuery";
import * as nativeApi from "../nativeApi";

const providerOptionsWithSecrets = {
  codex: {
    binaryPath: "/bin/custom-codex",
    homePath: "/tmp/custom-codex-home",
    launchArgs: "--profile custom",
  },
  kilo: {
    binaryPath: "/bin/kilo",
    serverUrl: "http://127.0.0.1:4111",
    serverPassword: "kilo-secret-password",
  },
  opencode: {
    binaryPath: "/bin/opencode",
    serverUrl: "http://127.0.0.1:4112",
    serverPassword: "opencode-secret-password",
  },
} as const;

const alternateCodexOptionsWithSecrets = {
  ...providerOptionsWithSecrets,
  codex: {
    ...providerOptionsWithSecrets.codex,
    launchArgs: "--profile alternate",
  },
} as const;

function expectSecretSafeCodexKey(queryKey: readonly unknown[]) {
  const keyText = JSON.stringify(queryKey);

  expect(keyText).toContain("/bin/custom-codex");
  expect(keyText).toContain("/tmp/custom-codex-home");
  expect(keyText).toContain("--profile custom");
  expect(keyText).not.toContain("kilo-secret-password");
  expect(keyText).not.toContain("opencode-secret-password");
  expect(keyText).not.toContain("serverPassword");
  expect(keyText).not.toContain("kilo");
  expect(keyText).not.toContain("opencode");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isInitialModelDiscoveryPending", () => {
  it("treats placeholder refetches as initial discovery", () => {
    expect(
      isInitialModelDiscoveryPending({
        isLoading: false,
        isFetching: true,
        isPlaceholderData: true,
      }),
    ).toBe(true);
  });

  it("does not treat later background refetches as initial discovery", () => {
    expect(
      isInitialModelDiscoveryPending({
        isLoading: false,
        isFetching: true,
        isPlaceholderData: false,
      }),
    ).toBe(false);
  });
});

describe("providerSkillsQueryOptions", () => {
  it("keys skill discovery by thread when thread context is supplied", () => {
    const firstThread = providerSkillsQueryOptions({
      provider: "opencode",
      cwd: "/repo",
      threadId: "thread-a",
      query: "",
    });
    const secondThread = providerSkillsQueryOptions({
      provider: "opencode",
      cwd: "/repo",
      threadId: "thread-b",
      query: "",
    });

    expect(firstThread.queryKey).not.toEqual(secondThread.queryKey);
  });

  it("keys skill discovery by Codex discovery options without unrelated provider secrets", () => {
    const defaultOptions = providerSkillsQueryOptions({
      provider: "codex",
      cwd: "/repo",
      query: "",
    });
    const customOptions = providerSkillsQueryOptions({
      provider: "codex",
      cwd: "/repo",
      query: "",
      providerOptions: providerOptionsWithSecrets,
    });
    const alternateOptions = providerSkillsQueryOptions({
      provider: "codex",
      cwd: "/repo",
      query: "",
      providerOptions: alternateCodexOptionsWithSecrets,
    });

    expect(defaultOptions.queryKey).not.toEqual(customOptions.queryKey);
    expect(customOptions.queryKey).not.toEqual(alternateOptions.queryKey);
    expectSecretSafeCodexKey(customOptions.queryKey);
  });
});

describe("providerPluginsQueryOptions", () => {
  it("keys plugin discovery by Codex discovery options without unrelated provider secrets", () => {
    const customOptions = providerPluginsQueryOptions({
      provider: "codex",
      cwd: "/repo",
      providerOptions: providerOptionsWithSecrets,
    });
    const alternateOptions = providerPluginsQueryOptions({
      provider: "codex",
      cwd: "/repo",
      providerOptions: alternateCodexOptionsWithSecrets,
    });

    expect(customOptions.queryKey).not.toEqual(alternateOptions.queryKey);
    expectSecretSafeCodexKey(customOptions.queryKey);
  });
});

describe("providerReadPluginQueryOptions", () => {
  it("keys plugin detail discovery by Codex discovery options without unrelated provider secrets", () => {
    const customOptions = providerReadPluginQueryOptions({
      provider: "codex",
      marketplacePath: "/marketplace.json",
      pluginName: "github",
      providerOptions: providerOptionsWithSecrets,
    });
    const alternateOptions = providerReadPluginQueryOptions({
      provider: "codex",
      marketplacePath: "/marketplace.json",
      pluginName: "github",
      providerOptions: alternateCodexOptionsWithSecrets,
    });

    expect(customOptions.queryKey).not.toEqual(alternateOptions.queryKey);
    expectSecretSafeCodexKey(customOptions.queryKey);
  });

  it("passes provider options to plugin detail reads", async () => {
    const readPlugin = vi.fn().mockResolvedValue({
      plugin: {
        marketplaceName: "openai-curated",
        marketplacePath: "/marketplace.json",
        summary: {
          id: "plugin/github",
          name: "github",
          source: { type: "local", path: "/plugins/github" },
          installed: true,
          enabled: true,
          installPolicy: "INSTALLED_BY_DEFAULT",
          authPolicy: "ON_USE",
          interface: {
            displayName: "GitHub",
            shortDescription: "Inspect repositories",
            capabilities: [],
            defaultPrompt: [],
          },
        },
        skills: [],
        apps: [],
        mcpServers: [],
      },
      source: "codex-app-server",
      cached: false,
    });
    vi.spyOn(nativeApi, "ensureNativeApi").mockReturnValue({
      provider: {
        readPlugin,
      },
    } as unknown as NativeApi);
    const queryClient = new QueryClient();

    await queryClient.fetchQuery(
      providerReadPluginQueryOptions({
        provider: "codex",
        marketplacePath: "/marketplace.json",
        pluginName: "github",
        providerOptions: providerOptionsWithSecrets,
      }),
    );

    expect(readPlugin).toHaveBeenCalledWith({
      provider: "codex",
      marketplacePath: "/marketplace.json",
      pluginName: "github",
      providerOptions: providerOptionsWithSecrets,
    });
    queryClient.clear();
  });
});

describe("providerModelsQueryOptions", () => {
  it("keys model discovery by Codex discovery options without unrelated provider secrets", () => {
    const defaultOptions = providerModelsQueryOptions({ provider: "codex" });
    const customOptions = providerModelsQueryOptions({
      provider: "codex",
      providerOptions: providerOptionsWithSecrets,
    });
    const alternateOptions = providerModelsQueryOptions({
      provider: "codex",
      providerOptions: alternateCodexOptionsWithSecrets,
    });

    expect(defaultOptions.queryKey).not.toEqual(customOptions.queryKey);
    expect(customOptions.queryKey).not.toEqual(alternateOptions.queryKey);
    expectSecretSafeCodexKey(customOptions.queryKey);
  });
});

describe("skill management capabilities", () => {
  it("exposes install, uninstall, and toggle support only when providers opt in", () => {
    const capabilities = {
      provider: "opencode" as const,
      supportsSkillMentions: true,
      supportsSkillDiscovery: true,
      supportsNativeSlashCommandDiscovery: true,
      supportsPluginMentions: false,
      supportsPluginDiscovery: false,
      supportsRuntimeModelList: false,
    };

    expect(supportsSkillInstall({ ...capabilities, supportsSkillInstall: true })).toBe(true);
    expect(supportsSkillInstall(undefined)).toBe(false);
    expect(supportsSkillUninstall(capabilities)).toBe(false);
    expect(supportsSkillToggle(capabilities)).toBe(false);
  });
});

describe("searchSkillsCatalogQueryOptions", () => {
  it("keys catalog searches by provider, cwd, and query text", () => {
    const first = searchSkillsCatalogQueryOptions({
      provider: "opencode",
      cwd: "/repo",
      query: "analyze",
    });
    const second = searchSkillsCatalogQueryOptions({
      provider: "codex",
      cwd: "/repo",
      query: "review",
    });

    expect(first.queryKey).not.toEqual(second.queryKey);
    expect(first.queryKey).toContain("catalog-search");
    expect(first.enabled).toBe(true);
  });

  it("disables catalog searches without a cwd", () => {
    const options = searchSkillsCatalogQueryOptions({
      provider: "opencode",
      cwd: "",
      query: "analyze",
    });

    expect(options.enabled).toBe(false);
  });
});
