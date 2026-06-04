import {
  type ProviderComposerCapabilities,
  ProviderGetComposerCapabilitiesInput,
  ProviderInstallSkillInput,
  ProviderListAgentsInput,
  ProviderListCommandsInput,
  ProviderListModelsInput,
  ProviderListPluginsInput,
  ProviderListSkillsInput,
  ProviderReadPluginInput,
  type ProviderSearchCatalogResult,
  ProviderSearchCatalogInput,
  ProviderSetSkillEnabledInput,
  ProviderUninstallSkillInput,
} from "@jcode/contracts";
import { Effect, Layer, Schema, SchemaIssue } from "effect";

import { ProviderValidationError } from "../Errors.ts";
import { ProviderAdapterRegistry } from "../Services/ProviderAdapterRegistry.ts";
import {
  ProviderDiscoveryService,
  type ProviderDiscoveryServiceShape,
} from "../Services/ProviderDiscoveryService.ts";
import {
  SkillManagementService,
  type SkillManagementAgent,
} from "../Services/SkillManagementService.ts";

function isSkillsCliProvider(provider: string): provider is SkillManagementAgent {
  return provider === "codex" || provider === "opencode";
}

const decodeInputOrValidationError = <S extends Schema.Top>(input: {
  readonly operation: string;
  readonly schema: S;
  readonly payload: unknown;
}) =>
  Schema.decodeUnknownEffect(input.schema)(input.payload).pipe(
    Effect.mapError(
      (schemaError) =>
        new ProviderValidationError({
          operation: input.operation,
          issue: SchemaIssue.makeFormatterDefault()(schemaError.issue),
          cause: schemaError,
        }),
    ),
  );

const disabledCapabilitiesForProvider = (
  provider: ProviderComposerCapabilities["provider"],
): ProviderComposerCapabilities => ({
  provider,
  supportsSkillMentions: false,
  supportsSkillDiscovery: false,
  supportsNativeSlashCommandDiscovery: false,
  supportsPluginMentions: false,
  supportsPluginDiscovery: false,
  supportsRuntimeModelList: false,
  supportsThreadCompaction: false,
  supportsThreadImport: false,
});

const make = Effect.gen(function* () {
  const registry = yield* ProviderAdapterRegistry;
  const skillManagement = yield* SkillManagementService;

  const getComposerCapabilities: ProviderDiscoveryServiceShape["getComposerCapabilities"] = (
    input,
  ) =>
    Effect.gen(function* () {
      const parsed = yield* decodeInputOrValidationError({
        operation: "ProviderDiscoveryService.getComposerCapabilities",
        schema: ProviderGetComposerCapabilitiesInput,
        payload: input,
      });
      const adapter = yield* registry.getByProvider(parsed.provider);
      if (adapter.getComposerCapabilities) {
        return yield* adapter.getComposerCapabilities();
      }
      return disabledCapabilitiesForProvider(parsed.provider);
    });

  const listSkills: ProviderDiscoveryServiceShape["listSkills"] = (input) =>
    Effect.gen(function* () {
      const parsed = yield* decodeInputOrValidationError({
        operation: "ProviderDiscoveryService.listSkills",
        schema: ProviderListSkillsInput,
        payload: input,
      });
      const adapter = yield* registry.getByProvider(parsed.provider);
      if (!adapter.listSkills) {
        return {
          skills: [],
          source: "unsupported",
          cached: false,
        };
      }
      return yield* adapter.listSkills(parsed);
    });

  const listCommands: ProviderDiscoveryServiceShape["listCommands"] = (input) =>
    Effect.gen(function* () {
      const parsed = yield* decodeInputOrValidationError({
        operation: "ProviderDiscoveryService.listCommands",
        schema: ProviderListCommandsInput,
        payload: input,
      });
      const adapter = yield* registry.getByProvider(parsed.provider);
      if (!adapter.listCommands) {
        return {
          commands: [],
          source: "unsupported",
          cached: false,
        };
      }
      return yield* adapter.listCommands(parsed);
    });

  const listPlugins: ProviderDiscoveryServiceShape["listPlugins"] = (input) =>
    Effect.gen(function* () {
      const parsed = yield* decodeInputOrValidationError({
        operation: "ProviderDiscoveryService.listPlugins",
        schema: ProviderListPluginsInput,
        payload: input,
      });
      const adapter = yield* registry.getByProvider(parsed.provider);
      if (!adapter.listPlugins) {
        return {
          marketplaces: [],
          marketplaceLoadErrors: [],
          remoteSyncError: null,
          featuredPluginIds: [],
          source: "unsupported",
          cached: false,
        };
      }
      return yield* adapter.listPlugins(parsed);
    });

  const readPlugin: ProviderDiscoveryServiceShape["readPlugin"] = (input) =>
    Effect.gen(function* () {
      const parsed = yield* decodeInputOrValidationError({
        operation: "ProviderDiscoveryService.readPlugin",
        schema: ProviderReadPluginInput,
        payload: input,
      });
      const adapter = yield* registry.getByProvider(parsed.provider);
      if (!adapter.readPlugin) {
        return yield* new ProviderValidationError({
          operation: "ProviderDiscoveryService.readPlugin",
          issue: `Plugin discovery is unavailable for provider '${parsed.provider}'.`,
        });
      }
      return yield* adapter.readPlugin(parsed);
    });

  const listModels: ProviderDiscoveryServiceShape["listModels"] = (input) =>
    Effect.gen(function* () {
      const parsed = yield* decodeInputOrValidationError({
        operation: "ProviderDiscoveryService.listModels",
        schema: ProviderListModelsInput,
        payload: input,
      });
      const adapter = yield* registry.getByProvider(parsed.provider);
      if (!adapter.listModels) {
        return {
          models: [],
          source: "unsupported",
          cached: false,
        };
      }
      return yield* adapter.listModels(parsed);
    });

  const listAgents: ProviderDiscoveryServiceShape["listAgents"] = (input) =>
    Effect.gen(function* () {
      const parsed = yield* decodeInputOrValidationError({
        operation: "ProviderDiscoveryService.listAgents",
        schema: ProviderListAgentsInput,
        payload: input,
      });
      const adapter = yield* registry.getByProvider(parsed.provider);
      if (!adapter.listAgents) {
        return {
          agents: [],
          source: "unsupported",
          cached: false,
        };
      }
      return yield* adapter.listAgents(parsed);
    });

  const installSkill: ProviderDiscoveryServiceShape["installSkill"] = (input) =>
    Effect.gen(function* () {
      const parsed = yield* decodeInputOrValidationError({
        operation: "ProviderDiscoveryService.installSkill",
        schema: ProviderInstallSkillInput,
        payload: input,
      });
      const adapter = yield* registry.getByProvider(parsed.provider);
      if (adapter.installSkill) {
        return yield* adapter.installSkill(parsed);
      }
      if (!isSkillsCliProvider(parsed.provider) || !adapter.listSkills) {
        return yield* new ProviderValidationError({
          operation: "ProviderDiscoveryService.installSkill",
          issue: `Skill install is unavailable for provider '${parsed.provider}'.`,
        });
      }
      yield* skillManagement.install({
        agent: parsed.provider,
        cwd: parsed.cwd,
        packageRef: parsed.packageRef,
        ...(parsed.skillName !== undefined ? { skillName: parsed.skillName } : {}),
        ...(parsed.global !== undefined ? { global: parsed.global } : {}),
      });
      const refreshed = yield* adapter.listSkills({ ...parsed, forceReload: true });
      const skill = parsed.skillName
        ? refreshed.skills.find((candidate) => candidate.name === parsed.skillName)
        : refreshed.skills[0];
      if (!skill) {
        return yield* new ProviderValidationError({
          operation: "ProviderDiscoveryService.installSkill",
          issue: "Installed skill was not returned by provider discovery.",
        });
      }
      return { skill };
    });

  const uninstallSkill: ProviderDiscoveryServiceShape["uninstallSkill"] = (input) =>
    Effect.gen(function* () {
      const parsed = yield* decodeInputOrValidationError({
        operation: "ProviderDiscoveryService.uninstallSkill",
        schema: ProviderUninstallSkillInput,
        payload: input,
      });
      const adapter = yield* registry.getByProvider(parsed.provider);
      if (adapter.uninstallSkill) {
        return yield* adapter.uninstallSkill(parsed);
      }
      if (!isSkillsCliProvider(parsed.provider) || !adapter.listSkills) {
        return yield* new ProviderValidationError({
          operation: "ProviderDiscoveryService.uninstallSkill",
          issue: `Skill uninstall is unavailable for provider '${parsed.provider}'.`,
        });
      }
      const current = yield* adapter.listSkills({ ...parsed, forceReload: true });
      const skill = current.skills.find((candidate) => candidate.path === parsed.skillPath);
      if (!skill) {
        return yield* new ProviderValidationError({
          operation: "ProviderDiscoveryService.uninstallSkill",
          issue: "Skill path is not installed for this provider.",
        });
      }
      yield* skillManagement.uninstall({
        agent: parsed.provider,
        cwd: parsed.cwd,
        skillName: skill.name,
        ...(parsed.global !== undefined ? { global: parsed.global } : {}),
      });
      yield* adapter.listSkills({ ...parsed, forceReload: true });
      return { success: true };
    });

  const setSkillEnabled: ProviderDiscoveryServiceShape["setSkillEnabled"] = (input) =>
    Effect.gen(function* () {
      const parsed = yield* decodeInputOrValidationError({
        operation: "ProviderDiscoveryService.setSkillEnabled",
        schema: ProviderSetSkillEnabledInput,
        payload: input,
      });
      const adapter = yield* registry.getByProvider(parsed.provider);
      if (!adapter.setSkillEnabled) {
        return yield* new ProviderValidationError({
          operation: "ProviderDiscoveryService.setSkillEnabled",
          issue: `Skill enable/disable is unavailable for provider '${parsed.provider}'.`,
        });
      }
      return yield* adapter.setSkillEnabled(parsed);
    });

  const searchSkillsCatalog: ProviderDiscoveryServiceShape["searchSkillsCatalog"] = (input) =>
    Effect.gen(function* () {
      const parsed = yield* decodeInputOrValidationError({
        operation: "ProviderDiscoveryService.searchSkillsCatalog",
        schema: ProviderSearchCatalogInput,
        payload: input,
      });
      const providers = yield* registry.listProviders();
      for (const provider of providers) {
        const adapter = yield* registry.getByProvider(provider);
        if (adapter.searchSkillsCatalog) {
          const result = yield* adapter
            .searchSkillsCatalog(parsed)
            .pipe(Effect.catch(() => Effect.succeed<ProviderSearchCatalogResult>({ results: [] })));
          if (result.results.length > 0) {
            return result;
          }
        }
      }
      return { results: [] };
    });

  return {
    getComposerCapabilities,
    listCommands,
    listSkills,
    installSkill,
    uninstallSkill,
    setSkillEnabled,
    searchSkillsCatalog,
    listPlugins,
    readPlugin,
    listModels,
    listAgents,
  } satisfies ProviderDiscoveryServiceShape;
});

export const ProviderDiscoveryServiceLive = Layer.effect(ProviderDiscoveryService, make);
