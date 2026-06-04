import type {
  ProviderComposerCapabilities,
  ProviderInstallSkillInput,
  ProviderInstallSkillResult,
  ProviderKind,
  ProviderListAgentsResult,
  ProviderListCommandsResult,
  ProviderListModelsResult,
  ProviderListPluginsResult,
  ProviderListSkillsResult,
  ProviderReadPluginResult,
  ProviderSearchCatalogInput,
  ProviderSearchCatalogResult,
  ProviderSetSkillEnabledInput,
  ProviderSetSkillEnabledResult,
  ProviderStartOptions,
  ProviderUninstallSkillInput,
  ProviderUninstallSkillResult,
} from "@jcode/contracts";
import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { ensureNativeApi } from "~/nativeApi";
import { buildCodexProviderOptionsKey } from "./providerOptions";

const EMPTY_SKILLS_RESULT: ProviderListSkillsResult = {
  skills: [],
  source: "empty",
  cached: false,
};

const EMPTY_COMMANDS_RESULT: ProviderListCommandsResult = {
  commands: [],
  source: "empty",
  cached: false,
};

const EMPTY_MODELS_RESULT: ProviderListModelsResult = {
  models: [],
  source: "empty",
  cached: false,
};

const EMPTY_AGENTS_RESULT: ProviderListAgentsResult = {
  agents: [],
  source: "empty",
  cached: false,
};

const EMPTY_PLUGINS_RESULT: ProviderListPluginsResult = {
  marketplaces: [],
  marketplaceLoadErrors: [],
  remoteSyncError: null,
  featuredPluginIds: [],
  source: "empty",
  cached: false,
};

export const providerDiscoveryQueryKeys = {
  all: ["provider-discovery"] as const,
  composerCapabilities: (provider: ProviderKind) =>
    ["provider-discovery", "composer-capabilities", provider] as const,
  commands: (
    provider: ProviderKind,
    cwd: string | null,
    query: string,
    agentDir: string | null,
    providerOptionsKey: string | null,
  ) =>
    ["provider-discovery", "commands", provider, cwd, query, agentDir, providerOptionsKey] as const,
  skills: (
    provider: ProviderKind,
    cwd: string | null,
    query: string,
    agentDir: string | null,
    threadId: string | null,
    providerOptionsKey: string | null,
  ) =>
    [
      "provider-discovery",
      "skills",
      provider,
      cwd,
      query,
      agentDir,
      threadId,
      providerOptionsKey,
    ] as const,
  plugins: (
    provider: ProviderKind,
    cwd: string | null,
    threadId: string | null,
    providerOptionsKey: string | null,
  ) => ["provider-discovery", "plugins", provider, cwd, threadId, providerOptionsKey] as const,
  catalogSearch: (
    provider: ProviderKind,
    cwd: string | null,
    query: string,
    providerOptionsKey: string | null,
  ) => ["provider-discovery", "catalog-search", provider, cwd, query, providerOptionsKey] as const,
  plugin: (
    provider: ProviderKind,
    marketplacePath: string,
    pluginName: string,
    providerOptionsKey: string | null,
  ) =>
    [
      "provider-discovery",
      "plugin",
      provider,
      marketplacePath,
      pluginName,
      providerOptionsKey,
    ] as const,
  models: (
    provider: ProviderKind,
    binaryPath: string | null,
    apiEndpoint: string | null,
    agentDir: string | null,
    serverUrl: string | null,
    providerOptionsKey: string | null,
  ) =>
    [
      "provider-discovery",
      "models",
      provider,
      binaryPath,
      apiEndpoint,
      agentDir,
      serverUrl,
      providerOptionsKey,
    ] as const,
  agents: (provider: ProviderKind, binaryPath: string | null, serverUrl: string | null) =>
    ["provider-discovery", "agents", provider, binaryPath, serverUrl] as const,
};

export function providerComposerCapabilitiesQueryOptions(provider: ProviderKind) {
  return queryOptions({
    queryKey: providerDiscoveryQueryKeys.composerCapabilities(provider),
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.provider.getComposerCapabilities({ provider });
    },
    staleTime: Infinity,
  });
}

export function providerSkillsQueryOptions(input: {
  provider: ProviderKind;
  cwd: string | null;
  threadId?: string | null;
  agentDir?: string | null;
  providerOptions?: ProviderStartOptions | null | undefined;
  query: string;
  enabled?: boolean;
}) {
  const providerOptionsKey = buildCodexProviderOptionsKey(input.providerOptions);
  return queryOptions({
    queryKey: providerDiscoveryQueryKeys.skills(
      input.provider,
      input.cwd,
      input.query,
      input.agentDir ?? null,
      input.threadId ?? null,
      providerOptionsKey,
    ),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd) {
        throw new Error("Skill discovery is unavailable.");
      }
      return api.provider.listSkills({
        provider: input.provider,
        cwd: input.cwd,
        ...(input.threadId ? { threadId: input.threadId } : {}),
        ...(input.agentDir ? { agentDir: input.agentDir } : {}),
        ...(input.providerOptions ? { providerOptions: input.providerOptions } : {}),
      });
    },
    enabled: (input.enabled ?? true) && input.cwd !== null,
    staleTime: 30_000,
    placeholderData: (previous) => previous ?? EMPTY_SKILLS_RESULT,
  });
}

export function providerCommandsQueryOptions(input: {
  provider: ProviderKind;
  cwd: string | null;
  threadId?: string | null;
  agentDir?: string | null;
  providerOptions?: ProviderStartOptions | null | undefined;
  query: string;
  enabled?: boolean;
}) {
  const providerOptionsKey = buildCodexProviderOptionsKey(input.providerOptions);
  return queryOptions({
    queryKey: providerDiscoveryQueryKeys.commands(
      input.provider,
      input.cwd,
      input.query,
      input.agentDir ?? null,
      providerOptionsKey,
    ),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd) {
        throw new Error("Command discovery is unavailable.");
      }
      return api.provider.listCommands({
        provider: input.provider,
        cwd: input.cwd,
        ...(input.threadId ? { threadId: input.threadId } : {}),
        ...(input.agentDir ? { agentDir: input.agentDir } : {}),
        ...(input.providerOptions ? { providerOptions: input.providerOptions } : {}),
      });
    },
    enabled: (input.enabled ?? true) && input.cwd !== null,
    staleTime: 30_000,
    placeholderData: (previous) => previous ?? EMPTY_COMMANDS_RESULT,
  });
}

export function providerModelsQueryOptions(input: {
  provider: ProviderKind;
  binaryPath?: string | null;
  apiEndpoint?: string | null;
  agentDir?: string | null;
  serverUrl?: string | null;
  serverPassword?: string | null;
  providerOptions?: ProviderStartOptions | null | undefined;
  enabled?: boolean;
}) {
  const providerOptionsKey = buildCodexProviderOptionsKey(input.providerOptions);
  return queryOptions({
    queryKey: providerDiscoveryQueryKeys.models(
      input.provider,
      input.binaryPath ?? null,
      input.apiEndpoint ?? null,
      input.agentDir ?? null,
      input.serverUrl ?? null,
      providerOptionsKey,
    ),
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.provider.listModels({
        provider: input.provider,
        ...(input.binaryPath ? { binaryPath: input.binaryPath } : {}),
        ...(input.apiEndpoint ? { apiEndpoint: input.apiEndpoint } : {}),
        ...(input.agentDir ? { agentDir: input.agentDir } : {}),
        ...(input.serverUrl ? { serverUrl: input.serverUrl } : {}),
        ...(input.serverPassword ? { serverPassword: input.serverPassword } : {}),
        ...(input.providerOptions ? { providerOptions: input.providerOptions } : {}),
      });
    },
    enabled: input.enabled ?? true,
    retry: input.provider === "cursor" ? 1 : 3,
    staleTime: 60_000,
    placeholderData: (previous) => previous ?? EMPTY_MODELS_RESULT,
  });
}

export function isInitialModelDiscoveryPending(query: {
  isLoading: boolean;
  isFetching: boolean;
  isPlaceholderData: boolean;
}): boolean {
  return query.isLoading || (query.isFetching && query.isPlaceholderData);
}

export function providerAgentsQueryOptions(input: {
  provider: ProviderKind;
  binaryPath?: string | null;
  serverUrl?: string | null;
  serverPassword?: string | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: providerDiscoveryQueryKeys.agents(
      input.provider,
      input.binaryPath ?? null,
      input.serverUrl ?? null,
    ),
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.provider.listAgents({
        provider: input.provider,
        ...(input.binaryPath ? { binaryPath: input.binaryPath } : {}),
        ...(input.serverUrl ? { serverUrl: input.serverUrl } : {}),
        ...(input.serverPassword ? { serverPassword: input.serverPassword } : {}),
      });
    },
    enabled: input.enabled ?? true,
    staleTime: 60_000,
    placeholderData: (previous) => previous ?? EMPTY_AGENTS_RESULT,
  });
}

export function providerPluginsQueryOptions(input: {
  provider: ProviderKind;
  cwd: string | null;
  threadId?: string | null;
  providerOptions?: ProviderStartOptions | null | undefined;
  enabled?: boolean;
}) {
  const providerOptionsKey = buildCodexProviderOptionsKey(input.providerOptions);
  return queryOptions({
    queryKey: providerDiscoveryQueryKeys.plugins(
      input.provider,
      input.cwd,
      input.threadId ?? null,
      providerOptionsKey,
    ),
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.provider.listPlugins({
        provider: input.provider,
        ...(input.cwd ? { cwd: input.cwd } : {}),
        ...(input.threadId ? { threadId: input.threadId } : {}),
        ...(input.providerOptions ? { providerOptions: input.providerOptions } : {}),
      });
    },
    enabled: input.enabled ?? true,
    staleTime: 30_000,
    placeholderData: (previous) => previous ?? EMPTY_PLUGINS_RESULT,
  });
}

export function providerReadPluginQueryOptions(input: {
  provider: ProviderKind;
  marketplacePath: string;
  pluginName: string;
  providerOptions?: ProviderStartOptions | null | undefined;
  enabled?: boolean;
}) {
  const providerOptionsKey = buildCodexProviderOptionsKey(input.providerOptions);
  return queryOptions({
    queryKey: providerDiscoveryQueryKeys.plugin(
      input.provider,
      input.marketplacePath,
      input.pluginName,
      providerOptionsKey,
    ),
    queryFn: async (): Promise<ProviderReadPluginResult> => {
      const api = ensureNativeApi();
      return api.provider.readPlugin({
        provider: input.provider,
        marketplacePath: input.marketplacePath,
        pluginName: input.pluginName,
        ...(input.providerOptions ? { providerOptions: input.providerOptions } : {}),
      });
    },
    enabled: input.enabled ?? true,
    staleTime: 60_000,
  });
}

export function supportsSkillDiscovery(
  capabilities: ProviderComposerCapabilities | undefined,
): boolean {
  return capabilities?.supportsSkillDiscovery === true;
}

export function supportsNativeSlashCommandDiscovery(
  capabilities: ProviderComposerCapabilities | undefined,
): boolean {
  return capabilities?.supportsNativeSlashCommandDiscovery === true;
}

export function supportsPluginDiscovery(
  capabilities: ProviderComposerCapabilities | undefined,
): boolean {
  return capabilities?.supportsPluginDiscovery === true;
}

export function supportsThreadCompaction(
  capabilities: ProviderComposerCapabilities | undefined,
): boolean {
  return capabilities?.supportsThreadCompaction === true;
}

export function supportsThreadImport(
  capabilities: ProviderComposerCapabilities | undefined,
): boolean {
  return capabilities?.supportsThreadImport === true;
}

export function supportsSkillInstall(
  capabilities: ProviderComposerCapabilities | undefined,
): boolean {
  return capabilities?.supportsSkillInstall === true;
}

export function supportsSkillUninstall(
  capabilities: ProviderComposerCapabilities | undefined,
): boolean {
  return capabilities?.supportsSkillUninstall === true;
}

export function supportsSkillToggle(
  capabilities: ProviderComposerCapabilities | undefined,
): boolean {
  return capabilities?.supportsSkillToggle === true;
}

export function installSkillMutationOptions() {
  return mutationOptions<ProviderInstallSkillResult, Error, ProviderInstallSkillInput>({
    mutationFn: (input) => ensureNativeApi().provider.installSkill(input),
  });
}

export function uninstallSkillMutationOptions() {
  return mutationOptions<ProviderUninstallSkillResult, Error, ProviderUninstallSkillInput>({
    mutationFn: (input) => ensureNativeApi().provider.uninstallSkill(input),
  });
}

export function setSkillEnabledMutationOptions() {
  return mutationOptions<ProviderSetSkillEnabledResult, Error, ProviderSetSkillEnabledInput>({
    mutationFn: (input) => ensureNativeApi().provider.setSkillEnabled(input),
  });
}

export function searchSkillsCatalogQueryOptions(input: ProviderSearchCatalogInput) {
  const providerOptionsKey = buildCodexProviderOptionsKey(input.providerOptions);
  return queryOptions({
    queryKey: providerDiscoveryQueryKeys.catalogSearch(
      input.provider,
      input.cwd,
      input.query,
      providerOptionsKey,
    ),
    queryFn: () => ensureNativeApi().provider.searchSkillsCatalog(input),
    enabled: input.query.trim().length > 0 && input.cwd.trim().length > 0,
  });
}
