# Keybindings Settings Design

| Field           | Value                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| Status          | Draft                                                                                                       |
| Type            | Design specification                                                                                        |
| Owner           | Engineering                                                                                                 |
| Audience        | Maintainers, UI implementers, and automation agents                                                         |
| Canonical path  | `docs/superpowers/specs/2026-05-24-keybindings-settings-design.md`                                          |
| Last reviewed   | 2026-05-24                                                                                                  |
| Review cadence  | Event-driven; review when keybinding persistence, command taxonomy, or settings navigation changes          |
| Source of truth | `CONTEXT.md`, `packages/contracts/src/keybindings.ts`, `apps/server/src/keybindings.ts`, and Settings route |

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans before implementation. Do not replace the existing server-owned `keybindings.json` model; build the UI on top of it.

**Goal:** Make keybindings a first-class settings experience where users can search, inspect, edit, reset, and troubleshoot shortcuts without opening JSON for routine changes.

## Context

JCode already has a real keybindings system, but the user-facing settings surface is under-developed. The current Settings → Advanced panel only exposes an “Open file” action for the persisted `keybindings.json` file.

Existing building blocks:

- `packages/contracts/src/keybindings.ts` defines valid keybinding commands, rule shape, shortcut limits, and resolved bindings.
- `apps/server/src/keybindings.ts` owns default bindings, parsing, validation, persistence, file watching, startup default sync, and `upsertKeybindingRule`.
- `apps/web/src/keybindings.ts` resolves active commands from server-provided keybindings and current context.
- `apps/web/src/components/ShortcutsDialog.tsx` already renders a searchable reference of active shortcuts.
- `apps/web/src/settingsNavigation.ts` has no dedicated `keybindings` section yet.

The current model is powerful but developer-oriented. Ordinary users should not need to know the JSON schema to change common shortcuts.

## Chosen Approach

Build a first-class **Settings → Keybindings** section with command-palette-style editing affordances.

This combines two needs:

- a durable settings home for keybindings, not just an Advanced file shortcut
- a rich editor experience that feels closer to VS Code’s keyboard shortcut editor than a static table

The persisted `keybindings.json` remains the durable source of truth and advanced escape hatch. The UI edits the same model through server APIs rather than inventing a separate client-only shortcut store.

## Product Shape

The Keybindings settings section should include:

- Search across command name, command id, shortcut label, and category.
- Command categories such as Sidebar, Chat, Terminal, Diff, Browser, Threads, Project scripts, and Editor.
- A row per command showing human title, command id, active shortcut, context condition, and source state.
- Key recorder control for assigning a shortcut from actual keyboard input.
- Conflict visibility before saving, including which command currently owns the same shortcut in the same effective context.
- Per-command reset to default.
- Global reset to defaults with confirmation.
- “Open keybindings file” as an advanced action, not the primary editing path.
- Link or affordance to the existing Keyboard Shortcuts reference dialog.

## Source States

Each visible command should communicate where its effective binding comes from:

- **Default:** supplied by server defaults.
- **Custom:** explicitly present in persisted `keybindings.json`.
- **Unavailable:** command exists but has no active shortcut after conflict/context resolution.
- **Invalid:** persisted rule exists but did not compile or failed validation.

The UI should not hide invalid state. If the config has issues, the settings page should surface the same issue details currently exposed through server config warnings and still offer “Open file”.

## Editing Rules

Phase 1 should support the common safe edits:

- assign or replace a shortcut for a known command
- clear a custom shortcut by resetting that command to default
- reset all keybindings to server defaults
- open raw `keybindings.json` for advanced edits
- filter to all commands, customized commands, and conflicted commands

Phase 1 should not require users to author raw `when` expressions. Existing context conditions can be displayed read-only. Advanced context editing stays in the raw file until a later phase has a dedicated safe expression builder.

The key recorder should require at least one modifier for ordinary letter/number keys. Function keys, arrows, Escape, Enter, Tab, Backspace, Delete, Home, End, PageUp, and PageDown can be recorded without an additional modifier when the target command and context make that safe.

Clearing a shortcut in Phase 1 means removing the custom override and returning the command to its default effective binding. Intentional unbinding of a default command is a Phase 2+ feature because it needs explicit persisted semantics distinct from reset-to-default.

## Conflict Semantics

Shortcut conflicts must be evaluated with the same effective rules used at runtime:

- platform-aware `mod` handling must distinguish macOS Command from Ctrl elsewhere
- context conditions matter; the same shortcut can be acceptable when contexts do not overlap
- later persisted rules can override earlier rules, matching existing resolution semantics
- default fallback bindings should be considered when showing what will happen after a reset

When a user records a conflicting shortcut, the UI should show a blocking or high-friction warning before save. Do not silently steal a shortcut without naming the affected command.

## Phasing

### Phase 1: First-Class Settings Section

- Add `keybindings` to the settings navigation.
- Render searchable grouped commands and active shortcuts.
- Add key recorder editing for known commands.
- Add conflict warnings using the existing resolution helpers where possible.
- Add per-command reset and open-file action.
- Add all/customized/conflicted filters.
- Keep context conditions read-only.

### Phase 2: Rich Editor Polish

- Add command-palette-like quick filter and “record keys” modal polish.
- Add better conflict diffing and “show only conflicts/customized” filters.
- Add intentional unbinding once the persisted model can distinguish “reset to default” from “disable this command.”
- Add import/export or copy JSON snippets if still useful.
- Add project-script command affordances once script command labels are reliable.

### Phase 3: Advanced Context Editing

- Add a safe context-condition builder for terminal/chat/sidebar contexts.
- Add preview/testing mode for “press a shortcut and show what command would run here.”

## Non-Goals

- Do not replace `keybindings.json` with localStorage or a web-only settings store.
- Do not create a second shortcut resolution engine that can drift from runtime behavior.
- Do not make raw `when` expression authoring the mainline UX in the first implementation.
- Do not remove the existing Keyboard Shortcuts dialog; it remains the lightweight in-context reference.

## Review Focus

- Confirm whether Phase 1 should include project-script commands, or whether those should wait until script command labels and grouping are cleaner.
- Confirm whether the first implementation should reuse the current settings page composition or extract a standalone `KeybindingsSettingsPanel` component immediately.

## Success Criteria

- A user can find any built-in command from Settings → Keybindings.
- A user can change a common shortcut without opening JSON.
- A user sees conflicts before saving.
- A user can reset a command back to default.
- The existing raw file workflow remains available for advanced cases.
- The app continues to use the server-provided resolved keybindings at runtime.
