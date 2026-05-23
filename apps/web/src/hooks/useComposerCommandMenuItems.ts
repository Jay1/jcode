import type {
  ProjectEntry,
  ProviderNativeCommandDescriptor,
  ProviderKind,
  ProviderMentionReference,
  ProviderPluginDescriptor,
  ProviderSkillDescriptor,
} from "@jcode/contracts";
import { getAgentMentionAutocompleteAliases } from "@jcode/contracts";
import { useMemo } from "react";
import {
  buildCommandSearchBlob,
  buildPluginSearchBlob,
  buildSkillSearchBlob,
  isInstalledProviderPlugin,
  normalizeProviderDiscoveryText,
} from "~/lib/providerDiscovery";
import {
  LOCAL_FOLDER_MENTION_NAME,
  matchesLocalFolderMentionShortcut,
} from "~/lib/localFolderMentions";
import { basenameOfPath } from "../file-icons";
import type { ComposerTrigger } from "../composer-logic";
import {
  filterComposerSlashCommands,
  getAvailableComposerSlashCommands,
  getProviderNativeSlashCommandSearchTerms,
  shouldHideProviderNativeCommandFromComposerMenu,
} from "../composerSlashCommands";
import type { ComposerCommandItem } from "../components/chat/ComposerCommandMenu.logic";

type ComposerPluginSuggestion = {
  plugin: ProviderPluginDescriptor;
  mention: ProviderMentionReference;
};

type SearchableModelOption = {
  provider: ProviderKind;
  providerLabel: string;
  slug: string;
  name: string;
  searchSlug: string;
  searchName: string;
  searchProvider: string;
  searchUpstreamProvider: string;
};

export function useComposerCommandMenuItems(input: {
  composerTrigger: ComposerTrigger | null;
  provider: ProviderKind;
  providerPlugins: readonly ComposerPluginSuggestion[];
  providerNativeCommands: readonly ProviderNativeCommandDescriptor[];
  providerSkills: readonly ProviderSkillDescriptor[];
  workspaceEntries: readonly ProjectEntry[];
  searchableModelOptions: readonly SearchableModelOption[];
  supportsFastSlashCommand: boolean;
  canOfferCompactCommand: boolean;
  canOfferReviewCommand: boolean;
  canOfferForkCommand: boolean;
  canOfferSideCommand: boolean;
  dynamicAgents: readonly { name: string; displayName: string; description?: string }[];
}): ComposerCommandItem[] {
  const {
    composerTrigger,
    provider,
    providerPlugins,
    providerNativeCommands,
    providerSkills,
    workspaceEntries,
    searchableModelOptions,
    supportsFastSlashCommand,
    canOfferCompactCommand,
    canOfferReviewCommand,
    canOfferForkCommand,
    canOfferSideCommand,
    dynamicAgents,
  } = input;

  return useMemo<ComposerCommandItem[]>(() => {
    if (!composerTrigger) return [];

    // Keep trigger-specific discovery outside ChatView so the view mostly orchestrates state.
    if (composerTrigger.kind === "mention") {
      const query = normalizeProviderDiscoveryText(composerTrigger.query);

      const agentItems: ComposerCommandItem[] = (() => {
        // Use dynamic agents when available, fallback to static
        if (dynamicAgents.length > 0) {
          return dynamicAgents.reduce<ComposerCommandItem[]>((items, { name, displayName }) => {
            if (query) {
              const searchBlob = `${name} ${displayName}`.toLowerCase();
              if (!searchBlob.includes(query)) return items;
            }
            items.push({
              id: `agent:${provider}:${name}`,
              type: "agent" as const,
              provider,
              alias: name,
              color: "violet" as const,
              label: `@${name}`,
              description: displayName,
            });
            return items;
          }, []);
        }
        // Static fallback
        return getAgentMentionAutocompleteAliases(provider).reduce<ComposerCommandItem[]>(
          (items, { alias, displayName, color }) => {
            if (query) {
              const searchBlob = `${alias} ${displayName}`.toLowerCase();
              if (!searchBlob.includes(query)) return items;
            }
            items.push({
              id: `agent:${provider}:${alias}`,
              type: "agent" as const,
              provider,
              alias,
              color,
              label: `@${alias}`,
              description: displayName,
            });
            return items;
          },
          [],
        );
      })();

      const pluginItems = providerPlugins.reduce<ComposerCommandItem[]>(
        (items, { plugin, mention }) => {
          if (!isInstalledProviderPlugin(plugin)) return items;
          if (query && !buildPluginSearchBlob(plugin).includes(query)) return items;
          items.push({
            id: `plugin:${plugin.id}`,
            type: "plugin" as const,
            plugin,
            mention,
            label: plugin.interface?.displayName ?? plugin.name,
            description: plugin.interface?.shortDescription ?? plugin.source.path,
          });
          return items;
        },
        [],
      );
      const localRootItems =
        matchesLocalFolderMentionShortcut(composerTrigger.query) && composerTrigger.query !== "/"
          ? [
              {
                id: "local-root",
                type: "local-root" as const,
                label: `@${LOCAL_FOLDER_MENTION_NAME}`,
                description: "Browse folders on this computer",
              },
            ]
          : [];
      const pathItems = workspaceEntries.map((entry) => ({
        id: `path:${entry.kind}:${entry.path}`,
        type: "path" as const,
        path: entry.path,
        pathKind: entry.kind,
        label: basenameOfPath(entry.path),
        description: entry.parentPath ?? "",
      }));
      // Keep mention suggestions ordered by primary intent: plugins first,
      // then local context, then subagent delegation targets.
      return [...pluginItems, ...localRootItems, ...pathItems, ...agentItems];
    }

    if (composerTrigger.kind === "slash-command") {
      const query = normalizeProviderDiscoveryText(composerTrigger.query);
      const availableCommands = getAvailableComposerSlashCommands({
        provider,
        supportsFastSlashCommand,
        canOfferCompactCommand,
        canOfferReviewCommand,
        canOfferForkCommand,
        canOfferSideCommand,
        providerNativeCommandNames: providerNativeCommands.map((command) => command.name),
      });
      const builtInItems = filterComposerSlashCommands(
        composerTrigger.query,
        availableCommands,
      ).map((definition) => ({
        id: `slash:${definition.command}`,
        type: "slash-command" as const,
        command: definition.command,
        label: definition.label,
        description: definition.description,
        source: definition.source,
      }));
      const providerCommandItems = providerNativeCommands.reduce<ComposerCommandItem[]>(
        (items, command) => {
          if (shouldHideProviderNativeCommandFromComposerMenu(provider, command.name)) return items;
          if (
            query &&
            !buildCommandSearchBlob(command).includes(query) &&
            !getProviderNativeSlashCommandSearchTerms(provider, command.name).some((term) =>
              term.includes(query),
            )
          ) {
            return items;
          }
          items.push({
            id: `provider-command:${provider}:${command.name}`,
            type: "provider-native-command" as const,
            provider,
            command: command.name,
            label: `/${command.name}`,
            description: command.description ?? `Run ${provider} native command`,
          });
          return items;
        },
        [],
      );
      // For the Claude provider, skills use `/` prefix just like slash commands,
      // so merge them into the same dropdown.
      const skillItems =
        provider === "claudeAgent"
          ? providerSkills.reduce<ComposerCommandItem[]>((items, skill) => {
              if (query && !buildSkillSearchBlob(skill).includes(query)) return items;
              items.push({
                id: `skill:${skill.path}`,
                type: "skill" as const,
                skill,
                label: skill.interface?.displayName ?? skill.name,
                description: skill.interface?.shortDescription ?? skill.description ?? skill.path,
              });
              return items;
            }, [])
          : [];
      return [...builtInItems, ...providerCommandItems, ...skillItems];
    }

    if (composerTrigger.kind === "skill") {
      const query = normalizeProviderDiscoveryText(composerTrigger.query);
      return providerSkills.reduce<ComposerCommandItem[]>((items, skill) => {
        if (query && !buildSkillSearchBlob(skill).includes(query)) return items;
        items.push({
          id: `skill:${skill.path}`,
          type: "skill" as const,
          skill,
          label: skill.interface?.displayName ?? skill.name,
          description: skill.interface?.shortDescription ?? skill.description ?? skill.path,
        });
        return items;
      }, []);
    }

    const query = composerTrigger.query.trim().toLowerCase();
    return searchableModelOptions.reduce<ComposerCommandItem[]>(
      (
        items,
        {
          provider,
          providerLabel,
          slug,
          name,
          searchSlug,
          searchName,
          searchProvider,
          searchUpstreamProvider,
        },
      ) => {
        if (
          query &&
          !searchSlug.includes(query) &&
          !searchName.includes(query) &&
          !searchProvider.includes(query) &&
          !searchUpstreamProvider.includes(query)
        ) {
          return items;
        }
        items.push({
          id: `model:${provider}:${slug}`,
          type: "model" as const,
          provider,
          model: slug,
          label: name,
          description: `${providerLabel} · ${slug}`,
        });
        return items;
      },
      [],
    );
  }, [
    canOfferForkCommand,
    canOfferCompactCommand,
    canOfferReviewCommand,
    canOfferSideCommand,
    composerTrigger,
    dynamicAgents,
    provider,
    providerPlugins,
    providerNativeCommands,
    providerSkills,
    searchableModelOptions,
    supportsFastSlashCommand,
    workspaceEntries,
  ]);
}
