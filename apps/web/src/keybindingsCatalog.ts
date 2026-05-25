import type {
  KeybindingCommand,
  KeybindingRule,
  ResolvedKeybindingsConfig,
} from "@jcode/contracts";
import type { KeybindingCatalogEntry } from "./keybindingsSettings";

function entry(
  command: KeybindingCommand,
  label: string,
  description: string,
  category: string,
): KeybindingCatalogEntry {
  return { command, label, description, category, editable: true };
}

export const KEYBINDING_COMMAND_CATALOG: readonly KeybindingCatalogEntry[] = [
  entry("sidebar.toggle", "Toggle sidebar", "Show or hide the project sidebar.", "Navigation"),
  entry("sidebar.search", "Search projects and threads", "Open sidebar search.", "Navigation"),
  entry(
    "sidebar.addProject",
    "Add project",
    "Import a local project into the sidebar.",
    "Navigation",
  ),
  entry(
    "sidebar.importThread",
    "Import thread",
    "Bring an existing conversation into JCode.",
    "Navigation",
  ),
  entry("terminal.toggle", "Toggle terminal", "Show or hide the terminal.", "Terminal"),
  entry("terminal.split", "Split terminal", "Split the focused terminal pane.", "Terminal"),
  entry(
    "terminal.splitRight",
    "Split terminal right",
    "Create a terminal pane to the right.",
    "Terminal",
  ),
  entry(
    "terminal.splitLeft",
    "Split terminal left",
    "Create a terminal pane to the left.",
    "Terminal",
  ),
  entry("terminal.splitDown", "Split terminal down", "Create a terminal pane below.", "Terminal"),
  entry("terminal.splitUp", "Split terminal up", "Create a terminal pane above.", "Terminal"),
  entry(
    "terminal.new",
    "New terminal",
    "Create a new terminal tab while terminal focus is active.",
    "Terminal",
  ),
  entry("terminal.close", "Close terminal", "Close the focused terminal.", "Terminal"),
  entry(
    "terminal.workspace.newFullWidth",
    "New full-width terminal",
    "Open a full-width terminal workspace.",
    "Terminal",
  ),
  entry(
    "terminal.workspace.closeActive",
    "Close active workspace terminal",
    "Close the active workspace terminal tab.",
    "Terminal",
  ),
  entry(
    "terminal.workspace.terminal",
    "Focus workspace terminal",
    "Focus the terminal side of the workspace.",
    "Terminal",
  ),
  entry(
    "terminal.workspace.chat",
    "Focus workspace chat",
    "Focus the chat side of the workspace.",
    "Terminal",
  ),
  entry("browser.toggle", "Toggle browser", "Show or hide the embedded browser.", "Workspace"),
  entry("diff.toggle", "Toggle diff", "Show or hide the diff view.", "Workspace"),
  entry("chat.new", "New thread", "Start a fresh thread in the current project.", "Chat"),
  entry(
    "chat.newLatestProject",
    "New thread in latest project",
    "Start a thread in the most recently used project.",
    "Chat",
  ),
  entry("chat.newChat", "New chat", "Open a blank chat landing view.", "Chat"),
  entry("chat.newLocal", "New local chat", "Open a blank local chat.", "Chat"),
  entry(
    "chat.newTerminal",
    "New terminal thread",
    "Start a thread directly in terminal mode.",
    "Chat",
  ),
  entry(
    "chat.newClaude",
    "New Claude thread",
    "Start a fresh thread with Claude selected.",
    "Chat",
  ),
  entry("chat.newCodex", "New Codex thread", "Start a fresh thread with Codex selected.", "Chat"),
  entry(
    "chat.newCursor",
    "New Cursor thread",
    "Start a fresh thread with Cursor selected.",
    "Chat",
  ),
  entry(
    "chat.newGemini",
    "New Gemini thread",
    "Start a fresh thread with Gemini selected.",
    "Chat",
  ),
  entry("chat.split", "Split chat", "Open the current chat in a split view.", "Chat"),
  entry("thread.jump.1", "Jump to thread 1", "Open the first visible thread.", "Threads"),
  entry("thread.jump.2", "Jump to thread 2", "Open the second visible thread.", "Threads"),
  entry("thread.jump.3", "Jump to thread 3", "Open the third visible thread.", "Threads"),
  entry("thread.jump.4", "Jump to thread 4", "Open the fourth visible thread.", "Threads"),
  entry("thread.jump.5", "Jump to thread 5", "Open the fifth visible thread.", "Threads"),
  entry("thread.jump.6", "Jump to thread 6", "Open the sixth visible thread.", "Threads"),
  entry("thread.jump.7", "Jump to thread 7", "Open the seventh visible thread.", "Threads"),
  entry("thread.jump.8", "Jump to thread 8", "Open the eighth visible thread.", "Threads"),
  entry("thread.jump.9", "Jump to thread 9", "Open the ninth visible thread.", "Threads"),
  entry("chat.visible.next", "Next visible thread", "Move to the next visible thread.", "Threads"),
  entry(
    "chat.visible.previous",
    "Previous visible thread",
    "Move to the previous visible thread.",
    "Threads",
  ),
  entry(
    "editor.openFavorite",
    "Open favorite editor",
    "Open the current project in your favorite editor.",
    "Workspace",
  ),
];

const DEFAULT_KEYBINDING_RULES: readonly KeybindingRule[] = [
  { key: "mod+b", command: "sidebar.toggle" },
  { key: "mod+k", command: "sidebar.search" },
  { key: "mod+shift+o", command: "sidebar.addProject" },
  { key: "mod+i", command: "sidebar.importThread" },
  { key: "mod+j", command: "terminal.toggle" },
  { key: "mod+d", command: "terminal.split" },
  { key: "mod+shift+arrowright", command: "terminal.splitRight" },
  { key: "mod+shift+arrowleft", command: "terminal.splitLeft" },
  { key: "mod+shift+arrowdown", command: "terminal.splitDown" },
  { key: "mod+shift+arrowup", command: "terminal.splitUp" },
  { key: "mod+t", command: "terminal.new" },
  { key: "mod+w", command: "terminal.close" },
  { key: "mod+shift+j", command: "terminal.workspace.newFullWidth" },
  { key: "mod+w", command: "terminal.workspace.closeActive" },
  { key: "mod+1", command: "terminal.workspace.terminal" },
  { key: "mod+2", command: "terminal.workspace.chat" },
  { key: "mod+shift+b", command: "browser.toggle" },
  { key: "mod+d", command: "diff.toggle" },
  { key: "mod+n", command: "chat.new" },
  { key: "mod+shift+n", command: "chat.newLatestProject" },
  { key: "mod+alt+n", command: "chat.newChat" },
  { key: "mod+shift+t", command: "chat.newTerminal" },
  { key: "mod+alt+c", command: "chat.newClaude" },
  { key: "mod+alt+x", command: "chat.newCodex" },
  { key: "mod+alt+r", command: "chat.newCursor" },
  { key: "mod+alt+g", command: "chat.newGemini" },
  { key: "mod+\\", command: "chat.split" },
  { key: "mod+1", command: "thread.jump.1" },
  { key: "mod+2", command: "thread.jump.2" },
  { key: "mod+3", command: "thread.jump.3" },
  { key: "mod+4", command: "thread.jump.4" },
  { key: "mod+5", command: "thread.jump.5" },
  { key: "mod+6", command: "thread.jump.6" },
  { key: "mod+7", command: "thread.jump.7" },
  { key: "mod+8", command: "thread.jump.8" },
  { key: "mod+9", command: "thread.jump.9" },
  { key: "mod+shift+]", command: "chat.visible.next" },
  { key: "mod+shift+[", command: "chat.visible.previous" },
  { key: "mod+o", command: "editor.openFavorite" },
];

function parseDefaultShortcut(value: string) {
  const tokens = value.split("+");
  const key = tokens.at(-1) ?? value;
  const modifiers = new Set(tokens.slice(0, -1));
  return {
    key,
    metaKey: modifiers.has("meta"),
    ctrlKey: modifiers.has("ctrl"),
    shiftKey: modifiers.has("shift"),
    altKey: modifiers.has("alt"),
    modKey: modifiers.has("mod"),
  };
}

export const DEFAULT_KEYBINDING_SETTINGS: ResolvedKeybindingsConfig = DEFAULT_KEYBINDING_RULES.map(
  (rule) => ({
    command: rule.command,
    shortcut: parseDefaultShortcut(rule.key),
  }),
);
