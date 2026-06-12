// FILE: providerDiscovery.ts
// Purpose: Defines provider discovery request/response contracts shared across web and server.
// Layer: Shared contracts
// Exports: provider discovery schemas and inferred types used by the WS/native API.

import { Schema } from "effect";
import { NonNegativeInt, TrimmedNonEmptyString } from "./baseSchemas";
import { ProviderOptionDescriptor } from "./model";

const ProviderDiscoveryKind = Schema.Literals([
  "codex",
  "claudeAgent",
  "cursor",
  "devin",
  "gemini",
  "kilo",
  "opencode",
  "openclaw",
  "pi",
]);

export const ProviderSkillInterface = Schema.Struct({
  displayName: Schema.optional(TrimmedNonEmptyString),
  shortDescription: Schema.optional(TrimmedNonEmptyString),
});
export type ProviderSkillInterface = typeof ProviderSkillInterface.Type;

export const ProviderSkillDescriptor = Schema.Struct({
  name: TrimmedNonEmptyString,
  description: Schema.optional(TrimmedNonEmptyString),
  path: TrimmedNonEmptyString,
  enabled: Schema.Boolean,
  scope: Schema.optional(TrimmedNonEmptyString),
  interface: Schema.optional(ProviderSkillInterface),
  dependencies: Schema.optional(Schema.Unknown),
});
export type ProviderSkillDescriptor = typeof ProviderSkillDescriptor.Type;

export const ProviderSkillReference = Schema.Struct({
  name: TrimmedNonEmptyString,
  path: TrimmedNonEmptyString,
});
export type ProviderSkillReference = typeof ProviderSkillReference.Type;

export const ProviderMentionReference = Schema.Struct({
  name: TrimmedNonEmptyString,
  path: TrimmedNonEmptyString,
});
export type ProviderMentionReference = typeof ProviderMentionReference.Type;

export const ProviderComposerCapabilities = Schema.Struct({
  provider: ProviderDiscoveryKind,
  supportsSkillMentions: Schema.Boolean,
  supportsSkillDiscovery: Schema.Boolean,
  supportsNativeSlashCommandDiscovery: Schema.Boolean,
  supportsPluginMentions: Schema.Boolean,
  supportsPluginDiscovery: Schema.Boolean,
  supportsRuntimeModelList: Schema.Boolean,
  supportsThreadCompaction: Schema.optional(Schema.Boolean),
  supportsThreadImport: Schema.optional(Schema.Boolean),
  supportsSkillInstall: Schema.optional(Schema.Boolean),
  supportsSkillUninstall: Schema.optional(Schema.Boolean),
  supportsSkillToggle: Schema.optional(Schema.Boolean),
});
export type ProviderComposerCapabilities = typeof ProviderComposerCapabilities.Type;

export const ProviderGetComposerCapabilitiesInput = Schema.Struct({
  provider: ProviderDiscoveryKind,
});
export type ProviderGetComposerCapabilitiesInput = typeof ProviderGetComposerCapabilitiesInput.Type;

export const CodexProviderStartOptions = Schema.Struct({
  binaryPath: Schema.optional(TrimmedNonEmptyString),
  homePath: Schema.optional(TrimmedNonEmptyString),
  launchArgs: Schema.optional(TrimmedNonEmptyString),
});

export const ClaudeProviderStartOptions = Schema.Struct({
  binaryPath: Schema.optional(TrimmedNonEmptyString),
  permissionMode: Schema.optional(TrimmedNonEmptyString),
  maxThinkingTokens: Schema.optional(NonNegativeInt),
});

export const GeminiProviderStartOptions = Schema.Struct({
  binaryPath: Schema.optional(TrimmedNonEmptyString),
});

export const CursorProviderStartOptions = Schema.Struct({
  binaryPath: Schema.optional(TrimmedNonEmptyString),
  apiEndpoint: Schema.optional(TrimmedNonEmptyString),
});

export const OpenCodeProviderStartOptions = Schema.Struct({
  binaryPath: Schema.optional(TrimmedNonEmptyString),
  serverUrl: Schema.optional(TrimmedNonEmptyString),
  serverPassword: Schema.optional(TrimmedNonEmptyString),
});

export const KiloProviderStartOptions = Schema.Struct({
  binaryPath: Schema.optional(TrimmedNonEmptyString),
  serverUrl: Schema.optional(TrimmedNonEmptyString),
  serverPassword: Schema.optional(TrimmedNonEmptyString),
});

export const PiProviderStartOptions = Schema.Struct({
  binaryPath: Schema.optional(TrimmedNonEmptyString),
  agentDir: Schema.optional(TrimmedNonEmptyString),
});

export const OpenClawProviderStartOptions = Schema.Struct({});

export const ProviderStartOptions = Schema.Struct({
  codex: Schema.optional(CodexProviderStartOptions),
  claudeAgent: Schema.optional(ClaudeProviderStartOptions),
  cursor: Schema.optional(CursorProviderStartOptions),
  gemini: Schema.optional(GeminiProviderStartOptions),
  kilo: Schema.optional(KiloProviderStartOptions),
  opencode: Schema.optional(OpenCodeProviderStartOptions),
  openclaw: Schema.optional(OpenClawProviderStartOptions),
  pi: Schema.optional(PiProviderStartOptions),
});
export type ProviderStartOptions = typeof ProviderStartOptions.Type;

export const ProviderListSkillsInput = Schema.Struct({
  provider: ProviderDiscoveryKind,
  cwd: TrimmedNonEmptyString,
  threadId: Schema.optional(TrimmedNonEmptyString),
  agentDir: Schema.optional(TrimmedNonEmptyString),
  forceReload: Schema.optional(Schema.Boolean),
  providerOptions: Schema.optional(ProviderStartOptions),
});
export type ProviderListSkillsInput = typeof ProviderListSkillsInput.Type;

export const ProviderListSkillsResult = Schema.Struct({
  skills: Schema.Array(ProviderSkillDescriptor),
  source: Schema.optional(TrimmedNonEmptyString),
  cached: Schema.optional(Schema.Boolean),
});
export type ProviderListSkillsResult = typeof ProviderListSkillsResult.Type;

export const ProviderInstallSkillInput = Schema.Struct({
  provider: ProviderDiscoveryKind,
  cwd: TrimmedNonEmptyString,
  packageRef: TrimmedNonEmptyString,
  skillName: Schema.optional(TrimmedNonEmptyString),
  global: Schema.optional(Schema.Boolean),
  providerOptions: Schema.optional(ProviderStartOptions),
});
export type ProviderInstallSkillInput = typeof ProviderInstallSkillInput.Type;

export const ProviderInstallSkillResult = Schema.Struct({
  skill: ProviderSkillDescriptor,
});
export type ProviderInstallSkillResult = typeof ProviderInstallSkillResult.Type;

export const ProviderUninstallSkillInput = Schema.Struct({
  provider: ProviderDiscoveryKind,
  cwd: TrimmedNonEmptyString,
  skillPath: TrimmedNonEmptyString,
  global: Schema.optional(Schema.Boolean),
  providerOptions: Schema.optional(ProviderStartOptions),
});
export type ProviderUninstallSkillInput = typeof ProviderUninstallSkillInput.Type;

export const ProviderUninstallSkillResult = Schema.Struct({
  success: Schema.Boolean,
});
export type ProviderUninstallSkillResult = typeof ProviderUninstallSkillResult.Type;

export const ProviderSetSkillEnabledInput = Schema.Struct({
  provider: ProviderDiscoveryKind,
  cwd: TrimmedNonEmptyString,
  skillPath: TrimmedNonEmptyString,
  enabled: Schema.Boolean,
  providerOptions: Schema.optional(ProviderStartOptions),
});
export type ProviderSetSkillEnabledInput = typeof ProviderSetSkillEnabledInput.Type;

export const ProviderSetSkillEnabledResult = Schema.Struct({
  skill: ProviderSkillDescriptor,
});
export type ProviderSetSkillEnabledResult = typeof ProviderSetSkillEnabledResult.Type;

export const CatalogSkillEntry = Schema.Struct({
  packageRef: TrimmedNonEmptyString,
  skillName: TrimmedNonEmptyString,
  displayName: Schema.optional(TrimmedNonEmptyString),
  description: Schema.optional(TrimmedNonEmptyString),
  installCount: Schema.optional(Schema.Number),
  url: Schema.optional(TrimmedNonEmptyString),
});
export type CatalogSkillEntry = typeof CatalogSkillEntry.Type;

export const ProviderSearchCatalogInput = Schema.Struct({
  provider: ProviderDiscoveryKind,
  cwd: Schema.optional(TrimmedNonEmptyString),
  query: TrimmedNonEmptyString,
  providerOptions: Schema.optional(ProviderStartOptions),
});
export type ProviderSearchCatalogInput = typeof ProviderSearchCatalogInput.Type;

export const ProviderSearchCatalogResult = Schema.Struct({
  results: Schema.Array(CatalogSkillEntry),
});
export type ProviderSearchCatalogResult = typeof ProviderSearchCatalogResult.Type;

export const ProviderNativeCommandDescriptor = Schema.Struct({
  name: TrimmedNonEmptyString,
  description: Schema.optional(TrimmedNonEmptyString),
});
export type ProviderNativeCommandDescriptor = typeof ProviderNativeCommandDescriptor.Type;

export const ProviderListCommandsInput = Schema.Struct({
  provider: ProviderDiscoveryKind,
  cwd: TrimmedNonEmptyString,
  threadId: Schema.optional(TrimmedNonEmptyString),
  agentDir: Schema.optional(TrimmedNonEmptyString),
  forceReload: Schema.optional(Schema.Boolean),
  providerOptions: Schema.optional(ProviderStartOptions),
});
export type ProviderListCommandsInput = typeof ProviderListCommandsInput.Type;

export const ProviderListCommandsResult = Schema.Struct({
  commands: Schema.Array(ProviderNativeCommandDescriptor),
  source: Schema.optional(TrimmedNonEmptyString),
  cached: Schema.optional(Schema.Boolean),
});
export type ProviderListCommandsResult = typeof ProviderListCommandsResult.Type;

// Plugin discovery mirrors Codex app-server's marketplace + plugin summary surface.
export const ProviderPluginMarketplaceInterface = Schema.Struct({
  displayName: Schema.optional(TrimmedNonEmptyString),
});
export type ProviderPluginMarketplaceInterface = typeof ProviderPluginMarketplaceInterface.Type;

export const ProviderPluginInstallPolicy = Schema.Literals([
  "NOT_AVAILABLE",
  "AVAILABLE",
  "INSTALLED_BY_DEFAULT",
]);
export type ProviderPluginInstallPolicy = typeof ProviderPluginInstallPolicy.Type;

export const ProviderPluginAuthPolicy = Schema.Literals(["ON_INSTALL", "ON_USE"]);
export type ProviderPluginAuthPolicy = typeof ProviderPluginAuthPolicy.Type;

export const ProviderPluginSource = Schema.Struct({
  type: Schema.Literal("local"),
  path: TrimmedNonEmptyString,
});
export type ProviderPluginSource = typeof ProviderPluginSource.Type;

export const ProviderPluginInterface = Schema.Struct({
  displayName: Schema.optional(TrimmedNonEmptyString),
  shortDescription: Schema.optional(TrimmedNonEmptyString),
  longDescription: Schema.optional(TrimmedNonEmptyString),
  developerName: Schema.optional(TrimmedNonEmptyString),
  category: Schema.optional(TrimmedNonEmptyString),
  capabilities: Schema.optional(Schema.Array(TrimmedNonEmptyString)),
  websiteUrl: Schema.optional(TrimmedNonEmptyString),
  privacyPolicyUrl: Schema.optional(TrimmedNonEmptyString),
  termsOfServiceUrl: Schema.optional(TrimmedNonEmptyString),
  defaultPrompt: Schema.optional(Schema.Array(TrimmedNonEmptyString)),
  brandColor: Schema.optional(TrimmedNonEmptyString),
  composerIcon: Schema.optional(TrimmedNonEmptyString),
  logo: Schema.optional(TrimmedNonEmptyString),
  screenshots: Schema.optional(Schema.Array(TrimmedNonEmptyString)),
});
export type ProviderPluginInterface = typeof ProviderPluginInterface.Type;

export const ProviderPluginDescriptor = Schema.Struct({
  id: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  source: ProviderPluginSource,
  installed: Schema.Boolean,
  enabled: Schema.Boolean,
  installPolicy: ProviderPluginInstallPolicy,
  authPolicy: ProviderPluginAuthPolicy,
  interface: Schema.optional(ProviderPluginInterface),
});
export type ProviderPluginDescriptor = typeof ProviderPluginDescriptor.Type;

export const ProviderPluginMarketplaceLoadError = Schema.Struct({
  marketplacePath: TrimmedNonEmptyString,
  message: TrimmedNonEmptyString,
});
export type ProviderPluginMarketplaceLoadError = typeof ProviderPluginMarketplaceLoadError.Type;

export const ProviderPluginMarketplaceDescriptor = Schema.Struct({
  name: TrimmedNonEmptyString,
  path: TrimmedNonEmptyString,
  interface: Schema.optional(ProviderPluginMarketplaceInterface),
  plugins: Schema.Array(ProviderPluginDescriptor),
});
export type ProviderPluginMarketplaceDescriptor = typeof ProviderPluginMarketplaceDescriptor.Type;

export const ProviderPluginAppSummary = Schema.Struct({
  id: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  description: Schema.optional(TrimmedNonEmptyString),
  installUrl: Schema.optional(TrimmedNonEmptyString),
  needsAuth: Schema.Boolean,
});
export type ProviderPluginAppSummary = typeof ProviderPluginAppSummary.Type;

export const ProviderListPluginsInput = Schema.Struct({
  provider: ProviderDiscoveryKind,
  cwd: Schema.optional(TrimmedNonEmptyString),
  threadId: Schema.optional(TrimmedNonEmptyString),
  forceRemoteSync: Schema.optional(Schema.Boolean),
  forceReload: Schema.optional(Schema.Boolean),
  providerOptions: Schema.optional(ProviderStartOptions),
});
export type ProviderListPluginsInput = typeof ProviderListPluginsInput.Type;

export const ProviderListPluginsResult = Schema.Struct({
  marketplaces: Schema.Array(ProviderPluginMarketplaceDescriptor),
  marketplaceLoadErrors: Schema.Array(ProviderPluginMarketplaceLoadError),
  remoteSyncError: Schema.NullOr(TrimmedNonEmptyString),
  featuredPluginIds: Schema.Array(TrimmedNonEmptyString),
  source: Schema.optional(TrimmedNonEmptyString),
  cached: Schema.optional(Schema.Boolean),
});
export type ProviderListPluginsResult = typeof ProviderListPluginsResult.Type;

export const ProviderReadPluginInput = Schema.Struct({
  provider: ProviderDiscoveryKind,
  marketplacePath: TrimmedNonEmptyString,
  pluginName: TrimmedNonEmptyString,
  providerOptions: Schema.optional(ProviderStartOptions),
});
export type ProviderReadPluginInput = typeof ProviderReadPluginInput.Type;

export const ProviderPluginDetail = Schema.Struct({
  marketplaceName: TrimmedNonEmptyString,
  marketplacePath: TrimmedNonEmptyString,
  summary: ProviderPluginDescriptor,
  description: Schema.optional(TrimmedNonEmptyString),
  skills: Schema.Array(ProviderSkillDescriptor),
  apps: Schema.Array(ProviderPluginAppSummary),
  mcpServers: Schema.Array(TrimmedNonEmptyString),
});
export type ProviderPluginDetail = typeof ProviderPluginDetail.Type;

export const ProviderReadPluginResult = Schema.Struct({
  plugin: ProviderPluginDetail,
  source: Schema.optional(TrimmedNonEmptyString),
  cached: Schema.optional(Schema.Boolean),
});
export type ProviderReadPluginResult = typeof ProviderReadPluginResult.Type;

export const ProviderListModelsInput = Schema.Struct({
  provider: ProviderDiscoveryKind,
  binaryPath: Schema.optional(TrimmedNonEmptyString),
  apiEndpoint: Schema.optional(TrimmedNonEmptyString),
  agentDir: Schema.optional(TrimmedNonEmptyString),
  serverUrl: Schema.optional(TrimmedNonEmptyString),
  serverPassword: Schema.optional(TrimmedNonEmptyString),
  providerOptions: Schema.optional(ProviderStartOptions),
});
export type ProviderListModelsInput = typeof ProviderListModelsInput.Type;

export const ProviderReasoningEffortDescriptor = Schema.Struct({
  value: TrimmedNonEmptyString,
  label: Schema.optional(TrimmedNonEmptyString),
  description: Schema.optional(TrimmedNonEmptyString),
});
export type ProviderReasoningEffortDescriptor = typeof ProviderReasoningEffortDescriptor.Type;

export const ProviderContextWindowDescriptor = Schema.Struct({
  value: TrimmedNonEmptyString,
  label: TrimmedNonEmptyString,
  isDefault: Schema.optional(Schema.Literal(true)),
});
export type ProviderContextWindowDescriptor = typeof ProviderContextWindowDescriptor.Type;

export const ProviderModelDescriptor = Schema.Struct({
  slug: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  upstreamProviderId: Schema.optional(TrimmedNonEmptyString),
  upstreamProviderName: Schema.optional(TrimmedNonEmptyString),
  optionDescriptors: Schema.optional(Schema.Array(ProviderOptionDescriptor)),
  // Codex model/list results are normalized here so the web app can consume both
  // the legacy string array and Remodex-style reasoning objects uniformly.
  supportedReasoningEfforts: Schema.optional(Schema.Array(ProviderReasoningEffortDescriptor)),
  defaultReasoningEffort: Schema.optional(TrimmedNonEmptyString),
  supportsFastMode: Schema.optional(Schema.Boolean),
  supportsThinkingToggle: Schema.optional(Schema.Boolean),
  contextWindowOptions: Schema.optional(Schema.Array(ProviderContextWindowDescriptor)),
  defaultContextWindow: Schema.optional(TrimmedNonEmptyString),
});
export type ProviderModelDescriptor = typeof ProviderModelDescriptor.Type;

export const ProviderListModelsResult = Schema.Struct({
  models: Schema.Array(ProviderModelDescriptor),
  source: Schema.optional(TrimmedNonEmptyString),
  cached: Schema.optional(Schema.Boolean),
});
export type ProviderListModelsResult = typeof ProviderListModelsResult.Type;

export const ProviderListAgentsInput = Schema.Struct({
  provider: ProviderDiscoveryKind,
  binaryPath: Schema.optional(TrimmedNonEmptyString),
  serverUrl: Schema.optional(TrimmedNonEmptyString),
  serverPassword: Schema.optional(TrimmedNonEmptyString),
});
export type ProviderListAgentsInput = typeof ProviderListAgentsInput.Type;

export const ProviderAgentDescriptor = Schema.Struct({
  name: TrimmedNonEmptyString,
  displayName: TrimmedNonEmptyString,
  description: Schema.optional(TrimmedNonEmptyString),
  model: Schema.optional(TrimmedNonEmptyString),
});
export type ProviderAgentDescriptor = typeof ProviderAgentDescriptor.Type;

export const ProviderListAgentsResult = Schema.Struct({
  agents: Schema.Array(ProviderAgentDescriptor),
  source: Schema.optional(TrimmedNonEmptyString),
  cached: Schema.optional(Schema.Boolean),
});
export type ProviderListAgentsResult = typeof ProviderListAgentsResult.Type;

export const ProviderRuntimeMode = Schema.Literals(["managed", "external", "remote"]);
export type ProviderRuntimeMode = typeof ProviderRuntimeMode.Type;

export const OpenCodeRuntimeConfigMode = Schema.Literals(["inherit", "generated", "blank"]);
export type OpenCodeRuntimeConfigMode = typeof OpenCodeRuntimeConfigMode.Type;

export const OpenCodeRuntimeCapabilityPolicy = Schema.Literals([
  "warn",
  "blockNewThreads",
  "blockAll",
]);
export type OpenCodeRuntimeCapabilityPolicy = typeof OpenCodeRuntimeCapabilityPolicy.Type;

export const OpenCodeRuntimeMismatchSeverity = Schema.Literals([
  "info",
  "warning",
  "error",
  "blocking",
]);
export type OpenCodeRuntimeMismatchSeverity = typeof OpenCodeRuntimeMismatchSeverity.Type;

export const OpenCodeRuntimeHealthStatus = Schema.Literals([
  "unknown",
  "checking",
  "healthy",
  "degraded",
  "unreachable",
  "misconfigured",
]);
export type OpenCodeRuntimeHealthStatus = typeof OpenCodeRuntimeHealthStatus.Type;

export const OpenCodeRuntimeCapabilityRequirement = Schema.Struct({
  kind: Schema.Literals(["command", "skill", "plugin", "agent", "model", "env", "path"]),
  name: TrimmedNonEmptyString,
  severity: OpenCodeRuntimeMismatchSeverity.pipe(
    Schema.withDecodingDefault(() => "error" as const),
  ),
});
export type OpenCodeRuntimeCapabilityRequirement = typeof OpenCodeRuntimeCapabilityRequirement.Type;

export const OpenCodeRuntimeProfile = Schema.Struct({
  id: TrimmedNonEmptyString,
  label: TrimmedNonEmptyString,
  provider: Schema.Literal("opencode").pipe(Schema.withDecodingDefault(() => "opencode" as const)),
  mode: ProviderRuntimeMode,
  configMode: OpenCodeRuntimeConfigMode.pipe(Schema.withDecodingDefault(() => "inherit" as const)),
  serverUrl: Schema.optional(TrimmedNonEmptyString),
  binaryPath: Schema.optional(TrimmedNonEmptyString),
  cwdDefault: Schema.optional(TrimmedNonEmptyString),
  homePath: Schema.optional(TrimmedNonEmptyString),
  configHome: Schema.optional(TrimmedNonEmptyString),
  opencodeConfigDir: Schema.optional(TrimmedNonEmptyString),
  opencodeDataDir: Schema.optional(TrimmedNonEmptyString),
  skillRoots: Schema.Array(TrimmedNonEmptyString).pipe(Schema.withDecodingDefault(() => [])),
  pluginRoots: Schema.Array(TrimmedNonEmptyString).pipe(Schema.withDecodingDefault(() => [])),
  requiredCommands: Schema.Array(TrimmedNonEmptyString).pipe(Schema.withDecodingDefault(() => [])),
  requiredSkills: Schema.Array(TrimmedNonEmptyString).pipe(Schema.withDecodingDefault(() => [])),
  requiredPlugins: Schema.Array(TrimmedNonEmptyString).pipe(Schema.withDecodingDefault(() => [])),
  requiredAgents: Schema.Array(TrimmedNonEmptyString).pipe(Schema.withDecodingDefault(() => [])),
  requiredModels: Schema.Array(TrimmedNonEmptyString).pipe(Schema.withDecodingDefault(() => [])),
  requiredEnv: Schema.Array(TrimmedNonEmptyString).pipe(Schema.withDecodingDefault(() => [])),
  requirements: Schema.Array(OpenCodeRuntimeCapabilityRequirement).pipe(
    Schema.withDecodingDefault(() => []),
  ),
  capabilityPolicy: OpenCodeRuntimeCapabilityPolicy.pipe(
    Schema.withDecodingDefault(() => "warn" as const),
  ),
  notes: Schema.optional(Schema.String.check(Schema.isMaxLength(4096))),
});
export type OpenCodeRuntimeProfile = typeof OpenCodeRuntimeProfile.Type;

export const OpenCodeRuntimeProfilePatch = Schema.Struct({
  id: Schema.optionalKey(TrimmedNonEmptyString),
  label: Schema.optionalKey(TrimmedNonEmptyString),
  provider: Schema.optionalKey(Schema.Literal("opencode")),
  mode: Schema.optionalKey(ProviderRuntimeMode),
  configMode: Schema.optionalKey(OpenCodeRuntimeConfigMode),
  serverUrl: Schema.optionalKey(TrimmedNonEmptyString),
  binaryPath: Schema.optionalKey(TrimmedNonEmptyString),
  cwdDefault: Schema.optionalKey(TrimmedNonEmptyString),
  homePath: Schema.optionalKey(TrimmedNonEmptyString),
  configHome: Schema.optionalKey(TrimmedNonEmptyString),
  opencodeConfigDir: Schema.optionalKey(TrimmedNonEmptyString),
  opencodeDataDir: Schema.optionalKey(TrimmedNonEmptyString),
  skillRoots: Schema.optionalKey(Schema.Array(TrimmedNonEmptyString)),
  pluginRoots: Schema.optionalKey(Schema.Array(TrimmedNonEmptyString)),
  requiredCommands: Schema.optionalKey(Schema.Array(TrimmedNonEmptyString)),
  requiredSkills: Schema.optionalKey(Schema.Array(TrimmedNonEmptyString)),
  requiredPlugins: Schema.optionalKey(Schema.Array(TrimmedNonEmptyString)),
  requiredAgents: Schema.optionalKey(Schema.Array(TrimmedNonEmptyString)),
  requiredModels: Schema.optionalKey(Schema.Array(TrimmedNonEmptyString)),
  requiredEnv: Schema.optionalKey(Schema.Array(TrimmedNonEmptyString)),
  requirements: Schema.optionalKey(Schema.Array(OpenCodeRuntimeCapabilityRequirement)),
  capabilityPolicy: Schema.optionalKey(OpenCodeRuntimeCapabilityPolicy),
  notes: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(4096))),
});
export type OpenCodeRuntimeProfilePatch = typeof OpenCodeRuntimeProfilePatch.Type;

export const OpenCodeRuntimeResolvedPaths = Schema.Struct({
  home: Schema.optional(TrimmedNonEmptyString),
  xdgConfigHome: Schema.optional(TrimmedNonEmptyString),
  opencodeConfigDir: Schema.optional(TrimmedNonEmptyString),
  opencodeDataDir: Schema.optional(TrimmedNonEmptyString),
  cwdDefault: Schema.optional(TrimmedNonEmptyString),
});
export type OpenCodeRuntimeResolvedPaths = typeof OpenCodeRuntimeResolvedPaths.Type;

export const OpenCodeRuntimeCapabilitySummary = Schema.Struct({
  count: Schema.Number,
  names: Schema.Array(TrimmedNonEmptyString),
});
export type OpenCodeRuntimeCapabilitySummary = typeof OpenCodeRuntimeCapabilitySummary.Type;

export const OpenCodeRuntimeModelCapabilitySummary = Schema.Struct({
  count: Schema.Number,
  slugs: Schema.Array(TrimmedNonEmptyString),
});
export type OpenCodeRuntimeModelCapabilitySummary =
  typeof OpenCodeRuntimeModelCapabilitySummary.Type;

export const OpenCodeRuntimeMismatch = Schema.Struct({
  id: TrimmedNonEmptyString,
  severity: OpenCodeRuntimeMismatchSeverity,
  message: TrimmedNonEmptyString,
  expected: Schema.optional(Schema.Unknown),
  actual: Schema.optional(Schema.Unknown),
});
export type OpenCodeRuntimeMismatch = typeof OpenCodeRuntimeMismatch.Type;

export const OpenCodeRuntimeHealth = Schema.Struct({
  provider: Schema.Literal("opencode"),
  profileId: TrimmedNonEmptyString,
  profileLabel: TrimmedNonEmptyString,
  mode: ProviderRuntimeMode,
  configMode: OpenCodeRuntimeConfigMode,
  status: OpenCodeRuntimeHealthStatus,
  serverUrl: Schema.optional(TrimmedNonEmptyString),
  external: Schema.Boolean,
  version: Schema.optional(TrimmedNonEmptyString),
  binaryPath: Schema.optional(TrimmedNonEmptyString),
  resolvedPaths: Schema.optional(OpenCodeRuntimeResolvedPaths),
  capabilities: Schema.Struct({
    commands: Schema.optional(OpenCodeRuntimeCapabilitySummary),
    skills: Schema.optional(OpenCodeRuntimeCapabilitySummary),
    plugins: Schema.optional(OpenCodeRuntimeCapabilitySummary),
    agents: Schema.optional(OpenCodeRuntimeCapabilitySummary),
    models: Schema.optional(OpenCodeRuntimeModelCapabilitySummary),
  }),
  mismatches: Schema.Array(OpenCodeRuntimeMismatch),
  checkedAt: TrimmedNonEmptyString,
});
export type OpenCodeRuntimeHealth = typeof OpenCodeRuntimeHealth.Type;

export const OpenCodeRuntimeProbeResult = OpenCodeRuntimeHealth;
export type OpenCodeRuntimeProbeResult = typeof OpenCodeRuntimeProbeResult.Type;

export const ProviderGetRuntimeHealthInput = Schema.Struct({
  provider: Schema.Literal("opencode"),
  profileId: Schema.optional(TrimmedNonEmptyString),
  cwd: Schema.optional(TrimmedNonEmptyString),
  forceRefresh: Schema.optional(Schema.Boolean),
});
export type ProviderGetRuntimeHealthInput = typeof ProviderGetRuntimeHealthInput.Type;

export const OpenCodeRuntimeBootstrapLane = Schema.Literal("wsl-service");
export type OpenCodeRuntimeBootstrapLane = typeof OpenCodeRuntimeBootstrapLane.Type;

export const OpenCodeRuntimeBootstrapState = Schema.Literals([
  "unsupported",
  "notInstalled",
  "installing",
  "starting",
  "ready",
  "error",
]);
export type OpenCodeRuntimeBootstrapState = typeof OpenCodeRuntimeBootstrapState.Type;

export const ProviderRuntimeBootstrapStatusInput = Schema.Struct({
  provider: Schema.Literal("opencode"),
});
export type ProviderRuntimeBootstrapStatusInput = typeof ProviderRuntimeBootstrapStatusInput.Type;

export const ProviderRuntimeBootstrapInput = Schema.Struct({
  provider: Schema.Literal("opencode"),
  forceReinstall: Schema.optional(Schema.Boolean),
});
export type ProviderRuntimeBootstrapInput = typeof ProviderRuntimeBootstrapInput.Type;

export const ProviderRuntimeBootstrapSnapshot = Schema.Struct({
  provider: Schema.Literal("opencode"),
  lane: OpenCodeRuntimeBootstrapLane,
  state: OpenCodeRuntimeBootstrapState,
  serviceName: Schema.optional(TrimmedNonEmptyString),
  binaryPath: Schema.optional(TrimmedNonEmptyString),
  serverUrl: Schema.optional(TrimmedNonEmptyString),
  profileId: Schema.optional(TrimmedNonEmptyString),
  message: Schema.optional(Schema.String.check(Schema.isMaxLength(4096))),
  checkedAt: TrimmedNonEmptyString,
});
export type ProviderRuntimeBootstrapSnapshot = typeof ProviderRuntimeBootstrapSnapshot.Type;
