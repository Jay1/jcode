# Keybindings

| Field           | Value                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                                                                  |
| Type            | API/runtime contract reference                                                                                                          |
| Owner           | Engineering                                                                                                                             |
| Audience        | Runtime maintainers, web client maintainers, and automation agents                                                                      |
| Scope           | User keybinding config shape, default bindings, command IDs, shortcut syntax, and precedence                                            |
| Canonical path  | `docs/api/keybindings.md`                                                                                                               |
| Last reviewed   | 2026-06-04                                                                                                                              |
| Review cadence  | Event-driven; review when keybinding contracts, defaults, command handling, or shortcut UI behavior changes                             |
| Source of truth | `packages/contracts/src/keybindings.ts` and `apps/server/src/keybindings.ts`                                                            |
| Verification    | Cross-check `DEFAULT_KEYBINDINGS`, `KeybindingCommand`, and focused formatting with `bunx oxfmt@0.52.0 --check docs/api/keybindings.md` |

JCode reads keybindings from:

- `~/.jcode/userdata/keybindings.json`

The file must be a JSON array of rules:

```json
[
  { "key": "mod+g", "command": "terminal.toggle" },
  { "key": "mod+shift+g", "command": "terminal.new", "when": "terminalFocus" }
]
```

See the full schema for more details: [`packages/contracts/src/keybindings.ts`](../../packages/contracts/src/keybindings.ts)

## Defaults

```json
[
  { "key": "mod+b", "command": "sidebar.toggle", "when": "!terminalFocus" },
  { "key": "mod+k", "command": "sidebar.search" },
  { "key": "mod+shift+o", "command": "sidebar.addProject", "when": "!terminalFocus" },
  { "key": "mod+i", "command": "sidebar.importThread", "when": "!terminalFocus" },
  { "key": "mod+j", "command": "terminal.toggle" },
  { "key": "mod+d", "command": "terminal.split", "when": "terminalFocus" },
  { "key": "mod+shift+arrowright", "command": "terminal.splitRight", "when": "terminalFocus" },
  { "key": "mod+shift+arrowleft", "command": "terminal.splitLeft", "when": "terminalFocus" },
  { "key": "mod+shift+arrowdown", "command": "terminal.splitDown", "when": "terminalFocus" },
  { "key": "mod+shift+arrowup", "command": "terminal.splitUp", "when": "terminalFocus" },
  { "key": "mod+t", "command": "terminal.new", "when": "terminalFocus" },
  { "key": "mod+w", "command": "terminal.close", "when": "terminalFocus" },
  { "key": "mod+shift+j", "command": "terminal.workspace.newFullWidth" },
  { "key": "mod+w", "command": "terminal.workspace.closeActive", "when": "terminalWorkspaceOpen" },
  { "key": "mod+1", "command": "terminal.workspace.terminal", "when": "terminalWorkspaceOpen" },
  { "key": "mod+2", "command": "terminal.workspace.chat", "when": "terminalWorkspaceOpen" },
  { "key": "mod+shift+b", "command": "browser.toggle", "when": "!terminalFocus" },
  { "key": "mod+d", "command": "diff.toggle", "when": "!terminalFocus" },
  { "key": "mod+n", "command": "chat.new", "when": "!terminalFocus" },
  { "key": "mod+shift+n", "command": "chat.newLatestProject", "when": "!terminalFocus" },
  { "key": "mod+alt+n", "command": "chat.newChat", "when": "!terminalFocus" },
  { "key": "mod+shift+t", "command": "chat.newTerminal", "when": "!terminalFocus" },
  { "key": "mod+alt+c", "command": "chat.newClaude", "when": "!terminalFocus" },
  { "key": "mod+alt+x", "command": "chat.newCodex", "when": "!terminalFocus" },
  { "key": "mod+alt+r", "command": "chat.newCursor", "when": "!terminalFocus" },
  { "key": "mod+alt+g", "command": "chat.newGemini", "when": "!terminalFocus" },
  { "key": "mod+\\", "command": "chat.split", "when": "!terminalFocus" },
  {
    "key": "mod+1",
    "command": "thread.jump.1",
    "when": "!terminalFocus && !terminalWorkspaceOpen"
  },
  {
    "key": "mod+2",
    "command": "thread.jump.2",
    "when": "!terminalFocus && !terminalWorkspaceOpen"
  },
  {
    "key": "mod+3",
    "command": "thread.jump.3",
    "when": "!terminalFocus && !terminalWorkspaceOpen"
  },
  {
    "key": "mod+4",
    "command": "thread.jump.4",
    "when": "!terminalFocus && !terminalWorkspaceOpen"
  },
  {
    "key": "mod+5",
    "command": "thread.jump.5",
    "when": "!terminalFocus && !terminalWorkspaceOpen"
  },
  {
    "key": "mod+6",
    "command": "thread.jump.6",
    "when": "!terminalFocus && !terminalWorkspaceOpen"
  },
  {
    "key": "mod+7",
    "command": "thread.jump.7",
    "when": "!terminalFocus && !terminalWorkspaceOpen"
  },
  {
    "key": "mod+8",
    "command": "thread.jump.8",
    "when": "!terminalFocus && !terminalWorkspaceOpen"
  },
  {
    "key": "mod+9",
    "command": "thread.jump.9",
    "when": "!terminalFocus && !terminalWorkspaceOpen"
  },
  { "key": "mod+shift+]", "command": "chat.visible.next", "when": "!terminalFocus" },
  { "key": "mod+shift+[", "command": "chat.visible.previous", "when": "!terminalFocus" },
  { "key": "mod+o", "command": "editor.openFavorite" }
]
```

For most up to date defaults, see [`DEFAULT_KEYBINDINGS` in `apps/server/src/keybindings.ts`](../../apps/server/src/keybindings.ts)

## Configuration

### Rule Shape

Each entry supports:

- `key` (required): shortcut string, like `mod+j`, `ctrl+k`, `cmd+shift+d`
- `command` (required): action ID
- `when` (optional): boolean expression controlling when the shortcut is active

Invalid rules are ignored. Invalid config files are ignored. Warnings are logged by the server.

### Available Commands

- Sidebar: `sidebar.toggle`, `sidebar.search`, `sidebar.addProject`, `sidebar.importThread`
- Terminal drawer: `terminal.toggle`, `terminal.split`, `terminal.splitRight`, `terminal.splitLeft`, `terminal.splitDown`, `terminal.splitUp`, `terminal.new`, `terminal.close`
- Terminal workspace: `terminal.workspace.newFullWidth`, `terminal.workspace.closeActive`, `terminal.workspace.terminal`, `terminal.workspace.chat`
- Browser and diff panels: `browser.toggle`, `diff.toggle`
- Chat creation and layout: `chat.new`, `chat.newLatestProject`, `chat.newChat`, `chat.newLocal`, `chat.newTerminal`, `chat.newClaude`, `chat.newCodex`, `chat.newCursor`, `chat.newGemini`, `chat.split`
- Thread jumps: `thread.jump.1`, `thread.jump.2`, `thread.jump.3`, `thread.jump.4`, `thread.jump.5`, `thread.jump.6`, `thread.jump.7`, `thread.jump.8`, `thread.jump.9`
- Visible chat navigation: `chat.visible.next`, `chat.visible.previous`
- Editor: `editor.openFavorite`
- Project scripts: `script.{id}.run`, where `{id}` matches a script ID such as `test` in `script.test.run`

### Key Syntax

Supported modifiers:

- `mod` (`cmd` on macOS, `ctrl` on non-macOS)
- `cmd` / `meta`
- `ctrl` / `control`
- `shift`
- `alt` / `option`

Examples:

- `mod+j`
- `mod+shift+d`
- `ctrl+l`
- `cmd+k`

### `when` Conditions

Currently available context keys:

- `terminalFocus`
- `terminalOpen`
- `terminalWorkspaceOpen`

Supported operators:

- `!` (not)
- `&&` (and)
- `||` (or)
- parentheses: `(` `)`

Examples:

- `"when": "terminalFocus"`
- `"when": "terminalOpen && !terminalFocus"`
- `"when": "terminalFocus || terminalOpen"`

Unknown condition keys evaluate to `false`.

### Precedence

- Rules are evaluated in array order.
- For a key event, the last rule where both `key` matches and `when` evaluates to `true` wins.
- That means precedence is across commands, not only within the same command.
