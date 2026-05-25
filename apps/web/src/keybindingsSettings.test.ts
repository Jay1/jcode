import { assert, describe, it } from "vitest";

import {
  KeybindingCommand,
  type KeybindingShortcut,
  type ResolvedKeybindingsConfig,
} from "@jcode/contracts";
import { Schema } from "effect";
import { KEYBINDING_COMMAND_CATALOG } from "./keybindingsCatalog";
import {
  buildKeybindingRows,
  detectShortcutConflicts,
  filterKeybindingRows,
  validateRecordedShortcut,
} from "./keybindingsSettings";

function shortcut(
  key: string,
  overrides: Partial<Omit<KeybindingShortcut, "key">> = {},
): KeybindingShortcut {
  return {
    key,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    modKey: true,
    ...overrides,
  };
}

const DEFAULTS: ResolvedKeybindingsConfig = [
  {
    command: "sidebar.toggle",
    shortcut: shortcut("b"),
  },
  {
    command: "terminal.toggle",
    shortcut: shortcut("j"),
  },
  {
    command: "chat.new",
    shortcut: shortcut("n"),
  },
];

const CATALOG = [
  {
    command: "sidebar.toggle",
    label: "Toggle sidebar",
    description: "Show or hide the project sidebar.",
    category: "Navigation",
    editable: true,
  },
  {
    command: "terminal.toggle",
    label: "Toggle terminal",
    description: "Show or hide the terminal.",
    category: "Terminal",
    editable: true,
  },
  {
    command: "chat.new",
    label: "New thread",
    description: "Start a fresh thread.",
    category: "Chat",
    editable: true,
  },
] as const;

describe("keybindings settings helpers", () => {
  it("catalog commands are valid keybinding commands", () => {
    for (const entry of KEYBINDING_COMMAND_CATALOG) {
      assert.isTrue(Schema.is(KeybindingCommand)(entry.command), entry.command);
    }
  });

  it("derives default, custom, and unavailable row source states", () => {
    const rows = buildKeybindingRows({
      catalog: CATALOG,
      defaultKeybindings: DEFAULTS,
      keybindings: [
        {
          command: "sidebar.toggle",
          shortcut: shortcut("b"),
        },
        {
          command: "terminal.toggle",
          shortcut: shortcut("t", { shiftKey: true }),
        },
      ],
    });

    assert.equal(rows.find((row) => row.command === "sidebar.toggle")?.source, "default");
    assert.equal(rows.find((row) => row.command === "terminal.toggle")?.source, "custom");
    assert.equal(rows.find((row) => row.command === "chat.new")?.source, "unavailable");
  });

  it("filters rows by search text and customized state", () => {
    const rows = buildKeybindingRows({
      catalog: CATALOG,
      defaultKeybindings: DEFAULTS,
      keybindings: [
        {
          command: "sidebar.toggle",
          shortcut: shortcut("b"),
        },
        {
          command: "terminal.toggle",
          shortcut: shortcut("t", { shiftKey: true }),
        },
      ],
    });

    assert.deepEqual(
      filterKeybindingRows(rows, { search: "terminal", filter: "all" }).map((row) => row.command),
      ["terminal.toggle"],
    );
    assert.deepEqual(
      filterKeybindingRows(rows, { search: "", filter: "customized" }).map((row) => row.command),
      ["terminal.toggle"],
    );
  });

  it("detects shortcut conflicts against other commands", () => {
    const conflicts = detectShortcutConflicts({
      command: "terminal.toggle",
      shortcut: shortcut("b"),
      keybindings: DEFAULTS,
    });

    assert.deepEqual(
      conflicts.map((conflict) => conflict.command),
      ["sidebar.toggle"],
    );
  });

  it("rejects unmodified letters and numbers from the recorder", () => {
    assert.deepEqual(validateRecordedShortcut(shortcut("a", { modKey: false })), {
      ok: false,
      reason: "letter-number-requires-modifier",
    });
    assert.deepEqual(validateRecordedShortcut(shortcut("1", { modKey: false })), {
      ok: false,
      reason: "letter-number-requires-modifier",
    });
    assert.deepEqual(validateRecordedShortcut(shortcut("f5", { modKey: false })), { ok: true });
    assert.deepEqual(validateRecordedShortcut(shortcut("arrowup", { modKey: false })), {
      ok: true,
    });
  });
});
