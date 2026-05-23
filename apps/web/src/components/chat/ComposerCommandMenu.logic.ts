import {
  type ProjectEntry,
  type ModelSlug,
  type ProviderNativeCommandDescriptor,
  type ProviderMentionReference,
  type ProviderKind,
  type ProviderPluginDescriptor,
  type ProviderSkillDescriptor,
} from "@jcode/contracts";
import { type ComposerTriggerKind } from "../../composer-logic";
import { type ComposerSlashCommand } from "../../composerSlashCommands";

export type ComposerCommandItem =
  | {
      id: string;
      type: "path";
      path: string;
      pathKind: ProjectEntry["kind"];
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "local-root";
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "slash-command";
      command: ComposerSlashCommand;
      label: string;
      description: string;
      source: "app" | "shared";
    }
  | {
      id: string;
      type: "provider-native-command";
      provider: ProviderKind;
      command: ProviderNativeCommandDescriptor["name"];
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "fork-target";
      target: "local" | "worktree";
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "review-target";
      target: "changes" | "base-branch";
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "model";
      provider: ProviderKind;
      model: ModelSlug;
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "plugin";
      plugin: ProviderPluginDescriptor;
      mention: ProviderMentionReference;
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "skill";
      skill: ProviderSkillDescriptor;
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "agent";
      provider: ProviderKind;
      alias: string;
      color: string;
      label: string;
      description: string;
    };

export type ComposerCommandGroupModel = {
  id: string;
  label: string | null;
  items: ComposerCommandItem[];
};

export function groupCommandItems(
  items: ComposerCommandItem[],
  triggerKind: ComposerTriggerKind | null,
  groupSlashCommandSections: boolean,
): ComposerCommandGroupModel[] {
  if (triggerKind === "mention") {
    const pluginItems = items.filter((item) => item.type === "plugin");
    const localItems = items.filter((item) => item.type === "local-root" || item.type === "path");
    const agentItems = items.filter((item) => item.type === "agent");
    const otherItems = items.filter(
      (item) =>
        item.type !== "plugin" &&
        item.type !== "local-root" &&
        item.type !== "path" &&
        item.type !== "agent",
    );

    const groups: ComposerCommandGroupModel[] = [];
    if (pluginItems.length > 0) {
      groups.push({ id: "plugins", label: "Plugins", items: pluginItems });
    }
    if (localItems.length > 0) {
      groups.push({ id: "local", label: "Local", items: localItems });
    }
    if (agentItems.length > 0) {
      groups.push({ id: "subagents", label: "Subagents", items: agentItems });
    }
    if (otherItems.length > 0) {
      groups.push({ id: "other", label: null, items: otherItems });
    }
    return groups;
  }

  if (triggerKind !== "slash-command" || !groupSlashCommandSections) {
    return [{ id: "default", label: null, items }];
  }

  const builtInItems = items.filter((item) => item.type === "slash-command");
  const providerItems = items.filter((item) => item.type === "provider-native-command");
  const otherItems = items.filter(
    (item) => item.type !== "slash-command" && item.type !== "provider-native-command",
  );

  const groups: ComposerCommandGroupModel[] = [];
  if (builtInItems.length > 0) {
    groups.push({ id: "built-in", label: "Built-in", items: builtInItems });
  }
  if (providerItems.length > 0) {
    groups.push({ id: "provider", label: "Provider", items: providerItems });
  }
  if (otherItems.length > 0) {
    groups.push({ id: "other", label: null, items: otherItems });
  }
  return groups;
}
