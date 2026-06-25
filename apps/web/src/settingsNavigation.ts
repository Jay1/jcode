// FILE: settingsNavigation.ts
// Purpose: Share the settings topic taxonomy between the main sidebar and the settings screen.
// Layer: Route/UI support
// Exports: section ids, nav items, and search normalization helper

import {
  AdjustmentsIcon,
  ArchiveIcon,
  BellIcon,
  BrainIcon,
  GlobeIcon,
  ListChecksIcon,
  type LucideIcon,
  PaletteIcon,
  PlugIcon,
  SettingsIcon,
  WrenchIcon,
  WorktreeIcon,
} from "./lib/icons";

export const SETTINGS_SECTION_IDS = [
  "general",
  "appearance",
  "notifications",
  "behavior",
  "worktrees",
  "keybindings",
  "connections",
  "archived",
  "models",
  "skills",
  "providers",
  "advanced",
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];
export type SettingsNavGroupId = "app" | "jcode";

export type SettingsNavItem = {
  id: SettingsSectionId;
  group: SettingsNavGroupId;
  label: string;
  description: string;
  icon: LucideIcon;
  eyebrow: string;
};

export const SETTINGS_NAV_GROUPS: ReadonlyArray<{
  id: SettingsNavGroupId;
  label: string;
}> = [
  { id: "app", label: "App" },
  { id: "jcode", label: "JCode" },
] as const;

export const SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] = [
  {
    id: "general",
    group: "app",
    label: "General",
    description: "Default provider, thread mode, time controls, and sidebar organization.",
    icon: SettingsIcon,
    eyebrow: "Workflow defaults",
  },
  {
    id: "appearance",
    group: "app",
    label: "Appearance",
    description: "Theme and typography.",
    icon: PaletteIcon,
    eyebrow: "Visual language",
  },
  {
    id: "notifications",
    group: "app",
    label: "Notifications",
    description: "In-app toasts and desktop alerts.",
    icon: BellIcon,
    eyebrow: "Alerts",
  },
  {
    id: "behavior",
    group: "app",
    label: "Behavior",
    description: "Streaming, diff handling, and destructive confirmations.",
    icon: AdjustmentsIcon,
    eyebrow: "Interaction rules",
  },
  {
    id: "worktrees",
    group: "app",
    label: "Worktrees",
    description: "Review and clean up the worktrees created by JCode.",
    icon: WorktreeIcon,
    eyebrow: "Workspace management",
  },
  {
    id: "keybindings",
    group: "app",
    label: "Keybindings",
    description: "Search, edit, reset, and troubleshoot keyboard shortcuts.",
    icon: ListChecksIcon,
    eyebrow: "Command shortcuts",
  },
  {
    id: "connections",
    group: "jcode",
    label: "Host & Coupling",
    description: "Pair browsers and remote backends.",
    icon: GlobeIcon,
    eyebrow: "Network access",
  },
  {
    id: "archived",
    group: "app",
    label: "Archived",
    description: "View and restore archived threads.",
    icon: ArchiveIcon,
    eyebrow: "Thread management",
  },
  {
    id: "models",
    group: "jcode",
    label: "Models",
    description: "Git writing defaults and custom model slugs.",
    icon: BrainIcon,
    eyebrow: "AI configuration",
  },
  {
    id: "skills",
    group: "jcode",
    label: "Skill Library",
    description: "Browse installed skills across providers.",
    icon: ListChecksIcon,
    eyebrow: "Installed capabilities",
  },
  {
    id: "providers",
    group: "jcode",
    label: "Providers",
    description: "Choose visible providers, review CLI installs, and update provider tools.",
    icon: PlugIcon,
    eyebrow: "Picker visibility",
  },
  {
    id: "advanced",
    group: "jcode",
    label: "Advanced",
    description: "Keybindings, recovery, and version info.",
    icon: WrenchIcon,
    eyebrow: "System tools",
  },
] as const;

export function normalizeSettingsSection(value: unknown): SettingsSectionId {
  if (typeof value !== "string") {
    return "general";
  }
  return SETTINGS_SECTION_IDS.find((candidate) => candidate === value) ?? "general";
}
