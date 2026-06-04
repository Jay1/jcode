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

Representative defaults summarize the active binding groups without duplicating the full source array:

| Pattern                         | Example                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| Global sidebar and chat actions | `mod+b` -> `sidebar.toggle`; `mod+n` -> `chat.new` when `!terminalFocus`            |
| Terminal-focused actions        | `mod+d` / `mod+shift+arrow*` splits with `terminalFocus`; `mod+t` -> `terminal.new` |
| Terminal workspace routing      | `mod+1` / `mod+2` with `terminalWorkspaceOpen`                                      |
| Thread switching                | `mod+1..9` with `!terminalFocus && !terminalWorkspaceOpen`                          |
| Visible chat navigation         | `mod+shift+]` / `mod+shift+[` when `!terminalFocus`                                 |

For most up-to-date defaults, see [`DEFAULT_KEYBINDINGS` in `apps/server/src/keybindings.ts`](../../apps/server/src/keybindings.ts).

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
