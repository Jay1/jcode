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
  type LucideIcon,
  PaletteIcon,
  PlugIcon,
  SettingsIcon,
  WrenchIcon,
  WorktreeIcon,
} from "./lib/icons";

const SETTINGS_SECTION_IDS = [
  "general",
  "appearance",
  "notifications",
  "behavior",
  "worktrees",
  "connections",
  "archived",
  "models",
  "providers",
  "advanced",
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];
// The group id is internal-only and predates the JCode rename; keep it stable
// because it is used as a UI grouping key while the visible label is JCode.
export type SettingsNavGroupId = "app" | "dpcode";

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
  { id: "dpcode", label: "JCode" },
] as const;

export const SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] = [
  {
    id: "general",
    group: "app",
    label: "General",
    description: "Default provider, thread mode, and sidebar organization.",
    icon: SettingsIcon,
    eyebrow: "Workflow defaults",
  },
  {
    id: "appearance",
    group: "app",
    label: "Appearance",
    description: "Theme, typography, and timestamp formatting.",
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
    id: "connections",
    group: "app",
    label: "Connections",
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
    group: "dpcode",
    label: "Models",
    description: "Git writing defaults and custom model slugs.",
    icon: BrainIcon,
    eyebrow: "AI configuration",
  },
  {
    id: "providers",
    group: "dpcode",
    label: "Providers",
    description: "Choose visible providers, review CLI installs, and update provider tools.",
    icon: PlugIcon,
    eyebrow: "Picker visibility",
  },
  {
    id: "advanced",
    group: "dpcode",
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
