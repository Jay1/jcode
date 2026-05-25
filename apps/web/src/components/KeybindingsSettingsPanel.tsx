import type {
  KeybindingCommand,
  KeybindingShortcut,
  KeybindingWhenNode,
  ResolvedKeybindingsConfig,
  ServerConfigIssue,
} from "@jcode/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { DEFAULT_KEYBINDING_SETTINGS, KEYBINDING_COMMAND_CATALOG } from "../keybindingsCatalog";
import {
  buildKeybindingRows,
  detectShortcutConflicts,
  filterKeybindingRows,
  type KeybindingSettingsFilter,
  validateRecordedShortcut,
} from "../keybindingsSettings";
import { formatShortcutLabel } from "../keybindings";
import { serverQueryKeys } from "../lib/serverReactQuery";
import { cn, isMacPlatform } from "../lib/utils";
import { ensureNativeApi } from "../nativeApi";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ShortcutKbd } from "./ui/shortcut-kbd";
import { toastManager } from "./ui/toast";

interface KeybindingsSettingsPanelProps {
  readonly keybindings: ResolvedKeybindingsConfig;
  readonly issues: readonly ServerConfigIssue[];
  readonly configPath: string | null;
  readonly isOpeningConfigFile: boolean;
  readonly openConfigFileError: string | null;
  readonly onOpenConfigFile: () => void;
}

function normalizeRecordedKey(key: string): { ruleKey: string; shortcutKey: string } | null {
  const lowered = key.toLowerCase();
  if (["control", "meta", "shift", "alt"].includes(lowered)) return null;
  if (lowered === " ") return { ruleKey: "space", shortcutKey: " " };
  if (lowered === "esc") return { ruleKey: "escape", shortcutKey: "escape" };
  return { ruleKey: lowered, shortcutKey: lowered };
}

function recordedShortcutFromEvent(
  event: KeyboardEvent<HTMLElement>,
): { ruleKey: string; shortcut: KeybindingShortcut } | null {
  const normalized = normalizeRecordedKey(event.key);
  if (!normalized) return null;

  const useMod = isMacPlatform(navigator.platform) ? event.metaKey : event.ctrlKey;
  const parts: string[] = [];
  if (useMod) parts.push("mod");
  if (event.metaKey && !useMod) parts.push("meta");
  if (event.ctrlKey && !useMod) parts.push("ctrl");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");
  parts.push(normalized.ruleKey);

  return {
    ruleKey: parts.join("+"),
    shortcut: {
      key: normalized.shortcutKey,
      metaKey: event.metaKey && !useMod,
      ctrlKey: event.ctrlKey && !useMod,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      modKey: useMod,
    },
  };
}

function issueText(issue: ServerConfigIssue): string {
  if (issue.kind === "keybindings.invalid-entry") {
    return `Entry ${issue.index + 1}: ${issue.message}`;
  }
  return issue.message;
}

function formatWhenNode(node: KeybindingWhenNode | undefined): string | null {
  if (!node) return null;
  switch (node.type) {
    case "identifier":
      return node.name;
    case "not": {
      const value = formatWhenNode(node.node);
      return value ? `!${value}` : null;
    }
    case "and": {
      const left = formatWhenNode(node.left);
      const right = formatWhenNode(node.right);
      return left && right ? `${left} && ${right}` : (left ?? right);
    }
    case "or": {
      const left = formatWhenNode(node.left);
      const right = formatWhenNode(node.right);
      return left && right ? `${left} || ${right}` : (left ?? right);
    }
  }
}

export function KeybindingsSettingsPanel(props: KeybindingsSettingsPanelProps) {
  const queryClient = useQueryClient();
  const recorderRef = useRef<HTMLButtonElement | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<KeybindingSettingsFilter>("all");
  const [recordingCommand, setRecordingCommand] = useState<KeybindingCommand | null>(null);
  const [savingCommand, setSavingCommand] = useState<KeybindingCommand | "all" | null>(null);
  const [pendingConflict, setPendingConflict] = useState<{
    readonly command: KeybindingCommand;
    readonly ruleKey: string;
    readonly shortcut: KeybindingShortcut;
    readonly conflicts: readonly KeybindingCommand[];
  } | null>(null);

  const rows = useMemo(
    () =>
      buildKeybindingRows({
        catalog: KEYBINDING_COMMAND_CATALOG,
        defaultKeybindings: DEFAULT_KEYBINDING_SETTINGS,
        keybindings: props.keybindings,
      }),
    [props.keybindings],
  );

  const visibleRows = useMemo(
    () => filterKeybindingRows(rows, { search, filter }),
    [filter, rows, search],
  );

  const groupedRows = useMemo(() => {
    const groups = new Map<string, typeof visibleRows>();
    for (const row of visibleRows) {
      groups.set(row.category, [...(groups.get(row.category) ?? []), row]);
    }
    return Array.from(groups.entries());
  }, [visibleRows]);

  const invalidateConfig = () =>
    queryClient.invalidateQueries({ queryKey: serverQueryKeys.config() });

  const saveShortcut = async (command: KeybindingCommand, ruleKey: string) => {
    setSavingCommand(command);
    try {
      await ensureNativeApi().server.upsertKeybinding({ command, key: ruleKey });
      await invalidateConfig();
      toastManager.add({ type: "success", title: "Keybinding updated" });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Could not update keybinding",
        description: error instanceof Error ? error.message : "The keybinding update failed.",
      });
    } finally {
      setSavingCommand(null);
      setRecordingCommand(null);
      setPendingConflict(null);
    }
  };

  const resetCommand = async (command: KeybindingCommand) => {
    setSavingCommand(command);
    try {
      await ensureNativeApi().server.resetKeybinding({ command });
      await invalidateConfig();
      toastManager.add({ type: "success", title: "Keybinding reset" });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Could not reset keybinding",
        description: error instanceof Error ? error.message : "The keybinding reset failed.",
      });
    } finally {
      setSavingCommand(null);
    }
  };

  const resetAll = async () => {
    if (!window.confirm("Reset all custom keybindings back to defaults?")) return;
    setSavingCommand("all");
    try {
      await ensureNativeApi().server.resetAllKeybindings();
      await invalidateConfig();
      toastManager.add({ type: "success", title: "All keybindings reset" });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Could not reset keybindings",
        description: error instanceof Error ? error.message : "The keybinding reset failed.",
      });
    } finally {
      setSavingCommand(null);
    }
  };

  const handleRecorderKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!recordingCommand) return;
    event.preventDefault();
    event.stopPropagation();
    const recorded = recordedShortcutFromEvent(event);
    if (!recorded) return;
    const validation = validateRecordedShortcut(recorded.shortcut);
    if (!validation.ok) {
      toastManager.add({
        type: "warning",
        title: "Shortcut needs a modifier",
        description: "Letters and numbers need Cmd/Ctrl, Alt, or Shift so typing stays safe.",
      });
      return;
    }
    const conflicts = detectShortcutConflicts({
      command: recordingCommand,
      shortcut: recorded.shortcut,
      keybindings: props.keybindings,
    }).map((binding) => binding.command);
    if (conflicts.length > 0) {
      setPendingConflict({
        command: recordingCommand,
        ruleKey: recorded.ruleKey,
        shortcut: recorded.shortcut,
        conflicts,
      });
      return;
    }
    void saveShortcut(recordingCommand, recorded.ruleKey);
  };

  const startRecording = (command: KeybindingCommand) => {
    setPendingConflict(null);
    setRecordingCommand(command);
    window.requestAnimationFrame(() => recorderRef.current?.focus());
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Keybindings</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Search, edit, reset, and inspect command shortcuts. The JSON file remains available
              for advanced bindings.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!props.configPath || props.isOpeningConfigFile}
              onClick={props.onOpenConfigFile}
            >
              {props.isOpeningConfigFile ? "Opening..." : "Open JSON"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={savingCommand !== null}
              onClick={() => void resetAll()}
            >
              {savingCommand === "all" ? "Resetting..." : "Reset all"}
            </Button>
          </div>
        </div>

        {props.openConfigFileError ? (
          <p className="mt-3 text-sm text-destructive">{props.openConfigFileError}</p>
        ) : null}

        {props.issues.length > 0 ? (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive">
            <p className="font-medium">Keybindings file has issues</p>
            <ul className="mt-2 space-y-1">
              {props.issues.map((issue, index) => (
                <li key={`${issue.kind}-${index}`}>{issueText(issue)}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Input
            type="search"
            placeholder="Search commands, shortcuts, or command ids"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="flex shrink-0 gap-1 rounded-lg border border-border bg-background p-1">
            {(["all", "customized", "conflicted"] as const).map((nextFilter) => (
              <button
                key={nextFilter}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  filter === nextFilter
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                type="button"
                onClick={() => setFilter(nextFilter)}
              >
                {nextFilter}
              </button>
            ))}
          </div>
        </div>

        {recordingCommand ? (
          <button
            ref={recorderRef}
            type="button"
            className="mt-4 w-full rounded-xl border border-dashed border-primary/60 bg-primary/8 p-4 text-left text-sm outline-none ring-primary/20 focus-visible:ring-2"
            onKeyDown={handleRecorderKeyDown}
          >
            Press the new shortcut for <span className="font-mono">{recordingCommand}</span>, or
            click Cancel.
          </button>
        ) : null}

        {pendingConflict ? (
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            <p className="font-medium">
              {formatShortcutLabel(pendingConflict.shortcut)} is already used by{" "}
              {pendingConflict.conflicts.join(", ")}.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="xs"
                onClick={() => void saveShortcut(pendingConflict.command, pendingConflict.ruleKey)}
              >
                Save anyway
              </Button>
              <Button size="xs" variant="outline" onClick={() => setPendingConflict(null)}>
                Choose another
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-5 space-y-6">
          {groupedRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No keybindings match the current filters.
            </p>
          ) : null}
          {groupedRows.map(([category, categoryRows]) => (
            <div key={category} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </h3>
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {categoryRows.map((row) => {
                  const shortcutLabel = row.activeBinding
                    ? formatShortcutLabel(row.activeBinding.shortcut)
                    : "Unassigned";
                  const isBusy = savingCommand === row.command;
                  return (
                    <div
                      key={row.command}
                      className="grid gap-3 bg-background p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{row.label}</p>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              row.source === "custom"
                                ? "bg-primary/12 text-primary"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {row.source}
                          </span>
                          {row.conflicts.length > 0 ? (
                            <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                              conflict
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{row.description}</p>
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                          {row.command}
                        </p>
                        {formatWhenNode(row.activeBinding?.whenAst) ? (
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                            when {formatWhenNode(row.activeBinding?.whenAst)}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        {row.activeBinding ? (
                          <ShortcutKbd shortcutLabel={shortcutLabel} />
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={!row.editable || savingCommand !== null}
                          onClick={() => startRecording(row.command)}
                        >
                          Change
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={row.source !== "custom" || isBusy}
                          onClick={() => void resetCommand(row.command)}
                        >
                          {isBusy ? "Resetting..." : "Reset"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
