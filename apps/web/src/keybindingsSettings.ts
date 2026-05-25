import type {
  KeybindingCommand,
  KeybindingShortcut,
  ResolvedKeybindingRule,
  ResolvedKeybindingsConfig,
} from "@jcode/contracts";

export type KeybindingSettingsFilter = "all" | "customized" | "conflicted";
export type KeybindingRowSource = "default" | "custom" | "unavailable";

export interface KeybindingCatalogEntry {
  readonly command: KeybindingCommand;
  readonly label: string;
  readonly description: string;
  readonly category: string;
  readonly editable: boolean;
}

export interface KeybindingSettingsRow extends KeybindingCatalogEntry {
  readonly activeBinding: ResolvedKeybindingRule | null;
  readonly defaultBinding: ResolvedKeybindingRule | null;
  readonly conflicts: readonly ResolvedKeybindingRule[];
  readonly source: KeybindingRowSource;
}

export interface BuildKeybindingRowsInput {
  readonly catalog: readonly KeybindingCatalogEntry[];
  readonly defaultKeybindings: ResolvedKeybindingsConfig;
  readonly keybindings: ResolvedKeybindingsConfig;
}

export interface FilterKeybindingRowsInput {
  readonly search: string;
  readonly filter: KeybindingSettingsFilter;
}

type RecordedShortcutValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "letter-number-requires-modifier" };

function shortcutFingerprint(shortcut: KeybindingShortcut): string {
  return [
    shortcut.key.toLowerCase(),
    shortcut.metaKey ? "meta" : "",
    shortcut.ctrlKey ? "ctrl" : "",
    shortcut.shiftKey ? "shift" : "",
    shortcut.altKey ? "alt" : "",
    shortcut.modKey ? "mod" : "",
  ]
    .filter(Boolean)
    .join("+");
}

function isSameBinding(
  left: ResolvedKeybindingRule | null,
  right: ResolvedKeybindingRule | null,
): boolean {
  if (!left || !right) return left === right;
  return shortcutFingerprint(left.shortcut) === shortcutFingerprint(right.shortcut);
}

function latestByCommand(
  keybindings: ResolvedKeybindingsConfig,
): Map<KeybindingCommand, ResolvedKeybindingRule> {
  const byCommand = new Map<KeybindingCommand, ResolvedKeybindingRule>();
  for (const binding of keybindings) {
    byCommand.set(binding.command, binding);
  }
  return byCommand;
}

export function detectShortcutConflicts(input: {
  readonly command: KeybindingCommand;
  readonly shortcut: KeybindingShortcut;
  readonly keybindings: ResolvedKeybindingsConfig;
}): readonly ResolvedKeybindingRule[] {
  const target = shortcutFingerprint(input.shortcut);
  return input.keybindings.filter(
    (binding) =>
      binding.command !== input.command && shortcutFingerprint(binding.shortcut) === target,
  );
}

export function buildKeybindingRows(
  input: BuildKeybindingRowsInput,
): readonly KeybindingSettingsRow[] {
  const activeByCommand = latestByCommand(input.keybindings);
  const defaultByCommand = latestByCommand(input.defaultKeybindings);

  return input.catalog.map((entry) => {
    const activeBinding = activeByCommand.get(entry.command) ?? null;
    const defaultBinding = defaultByCommand.get(entry.command) ?? null;
    const conflicts = activeBinding
      ? detectShortcutConflicts({
          command: entry.command,
          shortcut: activeBinding.shortcut,
          keybindings: input.keybindings,
        })
      : [];
    const source: KeybindingRowSource = !activeBinding
      ? "unavailable"
      : isSameBinding(activeBinding, defaultBinding)
        ? "default"
        : "custom";

    return {
      ...entry,
      activeBinding,
      defaultBinding,
      conflicts,
      source,
    };
  });
}

export function filterKeybindingRows(
  rows: readonly KeybindingSettingsRow[],
  input: FilterKeybindingRowsInput,
): readonly KeybindingSettingsRow[] {
  const normalizedSearch = input.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (input.filter === "customized" && row.source !== "custom") return false;
    if (input.filter === "conflicted" && row.conflicts.length === 0) return false;
    if (!normalizedSearch) return true;
    const searchable =
      `${row.label} ${row.description} ${row.command} ${row.category}`.toLowerCase();
    return searchable.includes(normalizedSearch);
  });
}

export function validateRecordedShortcut(shortcut: KeybindingShortcut): RecordedShortcutValidation {
  const key = shortcut.key.toLowerCase();
  const hasModifier =
    shortcut.modKey || shortcut.metaKey || shortcut.ctrlKey || shortcut.shiftKey || shortcut.altKey;
  if (!hasModifier && /^[a-z0-9]$/.test(key)) {
    return { ok: false, reason: "letter-number-requires-modifier" };
  }
  return { ok: true };
}
