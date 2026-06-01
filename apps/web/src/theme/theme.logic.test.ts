// FILE: theme.logic.test.ts
// Purpose: Locks down Codex-style theme parsing, normalization, and CSS token derivation.
// Layer: Web appearance domain tests
// Exports: Vitest coverage for theme.logic.

import { describe, expect, it } from "vitest";
import {
  CODE_THEME_OPTIONS,
  DEFAULT_THEME_STATE,
  buildResolvedThemeTokens,
  buildThemeCssVariables,
  createThemeShareString,
  getCodeThemeSeed,
  getCodeThemeSeedPatch,
  normalizeThemeState,
  parseStoredThemeState,
  parseThemeShareString,
  parseThemeShareStringForVariant,
  resolveThemePack,
  setThemeCodeThemeId,
  updateThemePackFromShareString,
} from "./theme.logic";

const PROVIDED_THEME_STRING =
  'codex-theme-v1:{"codeThemeId":"linear","theme":{"accent":"#606acc","contrast":30,"fonts":{"code":"\\"Jetbrains Mono\\"","ui":"Inter"},"ink":"#e3e4e6","opaqueWindows":true,"semanticColors":{"diffAdded":"#69c967","diffRemoved":"#ff7e78","skill":"#c2a1ff"},"surface":"#0f0f11"},"variant":"dark"}';

const REQUIRED_APP_DEPTH_TOKENS = [
  "--app-surface-canvas",
  "--app-surface-sidebar",
  "--app-surface-topbar",
  "--app-surface-panel",
  "--app-surface-card",
  "--app-surface-card-header",
  "--app-surface-composer",
  "--app-surface-toolbar",
  "--app-surface-toolbar-hover",
  "--app-surface-toolbar-active",
  "--app-surface-toolbar-border",
  "--app-chrome-control-bg",
  "--app-chrome-control-border",
  "--app-chrome-control-fg",
  "--app-chrome-control-hover-bg",
  "--app-chrome-control-hover-fg",
  "--app-chrome-control-active-bg",
  "--app-state-hover",
  "--app-state-selected",
  "--app-state-selected-border",
  "--app-state-focus",
  "--app-metadata-fg",
  "--app-metadata-muted-fg",
  "--app-text-metadata",
  "--app-text-metadata-strong",
  "--app-control-icon-fg",
  "--app-control-icon-hover-fg",
  "--app-control-icon-bg",
  "--app-control-icon-hover-bg",
  "--app-control-icon-border",
  "--app-work-row-bg",
  "--app-work-row-hover-bg",
  "--app-work-row-border",
  "--app-work-row-icon",
  "--app-status-error-bg",
  "--app-status-error-border",
  "--app-status-error-dot",
  "--app-status-error-fg",
  "--app-status-input-bg",
  "--app-status-input-border",
  "--app-status-input-dot",
  "--app-status-input-fg",
  "--app-status-muted-bg",
  "--app-status-muted-border",
  "--app-status-muted-dot",
  "--app-status-muted-fg",
  "--app-status-plan-bg",
  "--app-status-plan-border",
  "--app-status-plan-dot",
  "--app-status-plan-fg",
  "--app-status-success-bg",
  "--app-status-success-border",
  "--app-status-success-dot",
  "--app-status-success-fg",
  "--app-status-working-bg",
  "--app-status-working-border",
  "--app-status-working-dot",
  "--app-status-working-fg",
  "--app-status-warning-bg",
  "--app-status-warning-border",
  "--app-status-warning-dot",
  "--app-status-warning-fg",
  "--app-chat-heading",
  "--app-chat-link",
  "--app-chat-file",
  "--app-chat-token",
  "--app-chat-command",
  "--app-chat-success",
  "--app-chat-success-bg",
  "--app-chat-warning",
  "--app-chat-warning-bg",
  "--app-chat-error",
  "--app-chat-error-bg",
  "--app-chat-chip-bg",
  "--app-chat-chip-border",
  "--app-chat-code-bg",
  "--app-chat-code-border",
  "--app-chat-code-copy-bg",
  "--app-chat-code-copy-fg",
  "--app-diff-card-bg",
  "--app-diff-card-header-bg",
  "--app-diff-title",
  "--app-plugin-glyph-border",
  "--app-plugin-glyph-gradient-from",
  "--app-plugin-glyph-gradient-to",
  "--app-plugin-glyph-text",
  "--app-scroll-button-bg",
  "--app-scroll-button-border",
  "--app-scroll-button-fg",
  "--app-scroll-button-hover-bg",
  "--app-scroll-button-hover-fg",
  "--app-scrollbar-thumb",
  "--app-scrollbar-thumb-hover",
  "--app-terminal-search-active-match-bg",
  "--app-terminal-search-active-match-border",
  "--app-terminal-search-active-match-overview",
  "--app-terminal-search-match-bg",
  "--app-terminal-search-match-border",
  "--app-terminal-search-match-overview",
  "--app-wordmark-prefix",
  "--app-agent-chip-amber-bg",
  "--app-agent-chip-amber-fg",
  "--app-agent-chip-cyan-bg",
  "--app-agent-chip-cyan-fg",
  "--app-agent-chip-default-bg",
  "--app-agent-chip-default-fg",
  "--app-agent-chip-fuchsia-bg",
  "--app-agent-chip-fuchsia-fg",
  "--app-agent-chip-orange-bg",
  "--app-agent-chip-orange-fg",
  "--app-agent-chip-teal-bg",
  "--app-agent-chip-teal-fg",
  "--app-agent-chip-violet-bg",
  "--app-agent-chip-violet-fg",
  "--app-subagent-accent-0",
  "--app-subagent-accent-1",
  "--app-subagent-accent-2",
  "--app-subagent-accent-3",
  "--app-subagent-accent-4",
  "--app-subagent-accent-5",
  "--app-subagent-accent-6",
  "--app-subagent-accent-7",
  "--app-accent-soft",
  "--app-accent-muted",
  "--app-accent-strong",
] as const;

describe("parseStoredThemeState", () => {
  it("migrates the legacy mode-only value into the new theme store", () => {
    expect(parseStoredThemeState("dark")).toEqual({
      ...DEFAULT_THEME_STATE,
      mode: "dark",
    });
  });

  it("normalizes partial stored packs against the per-variant defaults", () => {
    expect(
      normalizeThemeState({
        mode: "light",
        codeThemeIds: {
          dark: "linear",
        },
        chromeThemes: {
          dark: {
            accent: "#606acc",
          },
        },
      }),
    ).toMatchObject({
      chromeThemes: {
        dark: {
          accent: "#606acc",
          contrast: 60,
        },
        light: DEFAULT_THEME_STATE.chromeThemes.light,
      },
      codeThemeIds: {
        dark: "linear",
        light: DEFAULT_THEME_STATE.codeThemeIds.light,
      },
      mode: "light",
    });
  });

  it("migrates the legacy packs shape into split codeThemeId and chromeTheme stores", () => {
    const migrated = normalizeThemeState({
      mode: "dark",
      packs: {
        dark: {
          codeThemeId: "linear",
          theme: {
            accent: "#606acc",
          },
        },
      },
    });

    expect(migrated.mode).toBe("dark");
    expect(migrated.codeThemeIds.dark).toBe("linear");
    expect(migrated.chromeThemes.dark.accent).toBe("#606acc");
  });
});

describe("theme share strings", () => {
  it("round-trips a normalized pack through the share-string format", () => {
    const shareString = createThemeShareString(
      "dark",
      resolveThemePack(DEFAULT_THEME_STATE, "dark"),
    );

    expect(parseThemeShareString(shareString)).toEqual({
      codeThemeId: "codex",
      theme: resolveThemePack(DEFAULT_THEME_STATE, "dark").theme,
      variant: "dark",
    });
  });

  it("parses the provided dark Linear theme and preserves its normalized values", () => {
    expect(parseThemeShareString(PROVIDED_THEME_STRING)).toEqual({
      codeThemeId: "linear",
      theme: {
        accent: "#606acc",
        contrast: 30,
        fonts: {
          code: '"Jetbrains Mono"',
          ui: "Inter",
        },
        ink: "#e3e4e6",
        opaqueWindows: true,
        semanticColors: {
          diffAdded: "#69c967",
          diffRemoved: "#ff7e78",
          skill: "#c2a1ff",
        },
        surface: "#0f0f11",
      },
      variant: "dark",
    });
  });

  it("rejects a share string whose variant does not match the target editor variant", () => {
    expect(() => parseThemeShareStringForVariant(PROVIDED_THEME_STRING, "light")).toThrow(
      /variant mismatch/i,
    );
  });

  it("updates only the matching variant pack when importing", () => {
    const nextState = updateThemePackFromShareString(
      DEFAULT_THEME_STATE,
      PROVIDED_THEME_STRING,
      "dark",
    );

    expect(nextState.codeThemeIds.dark).toBe("linear");
    expect(nextState.chromeThemes.light).toEqual(DEFAULT_THEME_STATE.chromeThemes.light);
  });
});

describe("code theme seeds", () => {
  it("loads the exact normalized seed for a bundled code theme", () => {
    expect(getCodeThemeSeed("linear", "dark")).toEqual({
      accent: "#606acc",
      contrast: 60,
      fonts: {
        code: null,
        ui: "Inter",
      },
      ink: "#e3e4e6",
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#69c967",
        diffRemoved: "#ff7e78",
        skill: "#c2a1ff",
      },
      surface: "#0f0f11",
    });
  });

  it("exposes only the raw seed fields that Codex merges on theme switching", () => {
    expect(getCodeThemeSeedPatch("linear", "dark")).toEqual({
      accent: "#606acc",
      fonts: {
        ui: "Inter",
      },
      ink: "#e3e4e6",
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#69c967",
        diffRemoved: "#ff7e78",
        skill: "#c2a1ff",
      },
      surface: "#0f0f11",
    });
  });

  it("merges the selected theme seed into the current pack instead of hard-resetting", () => {
    const nextState = setThemeCodeThemeId(
      {
        ...DEFAULT_THEME_STATE,
        chromeThemes: {
          ...DEFAULT_THEME_STATE.chromeThemes,
          dark: {
            ...DEFAULT_THEME_STATE.chromeThemes.dark,
            fonts: {
              code: '"JetBrains Mono"',
              ui: "Old UI",
            },
            accent: "#ff00aa",
            contrast: 12,
            opaqueWindows: false,
          },
        },
      },
      "dark",
      "linear",
    );

    expect(resolveThemePack(nextState, "dark")).toEqual({
      codeThemeId: "linear",
      theme: {
        accent: "#606acc",
        contrast: 12,
        fonts: {
          code: '"JetBrains Mono"',
          ui: "Inter",
        },
        ink: "#e3e4e6",
        opaqueWindows: true,
        semanticColors: {
          diffAdded: "#69c967",
          diffRemoved: "#ff7e78",
          skill: "#c2a1ff",
        },
        surface: "#0f0f11",
      },
    });
  });

  it("preserves current optional values when the new seed does not define them", () => {
    const nextState = setThemeCodeThemeId(
      {
        ...DEFAULT_THEME_STATE,
        chromeThemes: {
          ...DEFAULT_THEME_STATE.chromeThemes,
          dark: {
            ...DEFAULT_THEME_STATE.chromeThemes.dark,
            fonts: {
              code: '"JetBrains Mono"',
              ui: "Current UI",
            },
            contrast: 22,
            opaqueWindows: true,
          },
        },
      },
      "dark",
      "lobster",
    );

    expect(resolveThemePack(nextState, "dark")).toEqual({
      codeThemeId: "lobster",
      theme: {
        ...DEFAULT_THEME_STATE.chromeThemes.dark,
        accent: getCodeThemeSeed("lobster", "dark").accent,
        contrast: 22,
        fonts: {
          code: '"JetBrains Mono"',
          ui: "Satoshi",
        },
        ink: getCodeThemeSeed("lobster", "dark").ink,
        opaqueWindows: true,
        semanticColors: getCodeThemeSeed("lobster", "dark").semanticColors,
        surface: getCodeThemeSeed("lobster", "dark").surface,
      },
    });
  });

  it("applies explicit contrast overrides when a seed defines them", () => {
    const nextState = setThemeCodeThemeId(
      {
        ...DEFAULT_THEME_STATE,
        chromeThemes: {
          ...DEFAULT_THEME_STATE.chromeThemes,
          dark: {
            ...DEFAULT_THEME_STATE.chromeThemes.dark,
            contrast: 12,
          },
        },
      },
      "dark",
      "vercel",
    );

    expect(resolveThemePack(nextState, "dark")).toEqual({
      codeThemeId: "vercel",
      theme: getCodeThemeSeed("vercel", "dark"),
    });
  });
});

describe("buildThemeCssVariables", () => {
  it("derives the renderer token map from the imported theme pack", () => {
    const importedTheme = parseThemeShareString(PROVIDED_THEME_STRING);
    const cssVariables = buildThemeCssVariables(
      {
        codeThemeId: importedTheme.codeThemeId,
        theme: importedTheme.theme,
      },
      importedTheme.variant,
      { electron: true },
    );

    expect(cssVariables.material).toBe("opaque");
    expect(cssVariables.variables["--codex-base-accent"]).toBe("#606acc");
    expect(cssVariables.variables["--background"]).toBe("#0d0d0f");
    expect(cssVariables.variables["--card"]).toBe("#151517");
    expect(cssVariables.variables["--sidebar-accent"]).toBe(
      cssVariables.variables["--sidebar-accent-active"],
    );
    expect(cssVariables.variables["--theme-font-ui-family"]).toBe("Inter");
    expect(cssVariables.variables["--theme-font-code-family"]).toBe('"Jetbrains Mono"');
    expect(cssVariables.variables["--app-wordmark-prefix"]).toBe("#d00000");
  });

  it("exposes a structured derived-token surface for retrieving non-stored colors", () => {
    const importedTheme = parseThemeShareString(PROVIDED_THEME_STRING);
    const tokens = buildResolvedThemeTokens(
      {
        codeThemeId: importedTheme.codeThemeId,
        theme: importedTheme.theme,
      },
      importedTheme.variant,
    );

    expect(tokens.computed.surfaceUnder).toBe("#0d0d0f");
    expect(tokens.computed.panel).toBe("#151517");
    expect(tokens.derived.textForegroundSecondary).toBe("rgba(227, 228, 230, 0.645)");
    expect(tokens.derived.buttonSecondaryBackground).toBe("rgba(227, 228, 230, 0.039)");
    expect(tokens.aliases["--color-token-side-bar-background"]).toBe("#0d0d0f");
    expect(tokens.aliases["--color-token-list-hover-background"]).toBe(
      tokens.derived.buttonSecondaryBackground,
    );
    expect(tokens.aliases["--color-token-input-background"]).toBe("rgba(36, 36, 38, 0.96)");
  });

  it("uses the light-theme foreground color for the primary button background", () => {
    const tokens = buildResolvedThemeTokens(
      {
        codeThemeId: "codex",
        theme: DEFAULT_THEME_STATE.chromeThemes.light,
      },
      "light",
    );

    expect(tokens.derived.buttonPrimaryBackground).toBe(DEFAULT_THEME_STATE.chromeThemes.light.ink);
    expect(tokens.derived.textButtonPrimary).toBe(DEFAULT_THEME_STATE.chromeThemes.light.surface);
    expect(tokens.derived.textButtonPrimary).not.toBe(tokens.derived.buttonPrimaryBackground);
  });

  it("derives semantic chrome control tokens from non-palette theme math", () => {
    const importedTheme = parseThemeShareString(PROVIDED_THEME_STRING);
    const pack = {
      codeThemeId: importedTheme.codeThemeId,
      theme: importedTheme.theme,
    };
    const tokens = buildResolvedThemeTokens(pack, importedTheme.variant);
    const cssVariables = buildThemeCssVariables(pack, importedTheme.variant);

    expect(cssVariables.variables["--app-chrome-control-bg"]).toBe(
      tokens.derived.controlBackground,
    );
    expect(cssVariables.variables["--app-chrome-control-border"]).toBe(tokens.derived.borderLight);
    expect(cssVariables.variables["--app-chrome-control-fg"]).toBe(
      tokens.derived.textForegroundSecondary,
    );
    expect(cssVariables.variables["--app-chrome-control-hover-bg"]).toBe(
      tokens.derived.buttonSecondaryBackgroundHover,
    );
    expect(cssVariables.variables["--app-chrome-control-hover-fg"]).toBe(
      tokens.derived.textForeground,
    );
    expect(cssVariables.variables["--app-chrome-control-active-bg"]).toBe(
      tokens.derived.buttonSecondaryBackgroundActive,
    );
  });

  it("emits Catppuccin Mocha app-depth tokens from official palette layers", () => {
    const cssVariables = buildThemeCssVariables(
      {
        codeThemeId: "catppuccin",
        theme: getCodeThemeSeed("catppuccin", "dark"),
      },
      "dark",
    );

    expect(cssVariables.variables["--app-surface-canvas"]).toBe("#11111b");
    expect(cssVariables.variables["--app-surface-sidebar"]).toBe("#181825");
    expect(cssVariables.variables["--app-surface-topbar"]).toBe("#181825");
    expect(cssVariables.variables["--app-surface-card"]).toBe("#1e1e2e");
    expect(cssVariables.variables["--app-surface-card-header"]).toBe("#313244");
    expect(cssVariables.variables["--app-surface-toolbar"]).toBe("#181825");
    expect(cssVariables.variables["--app-surface-toolbar-hover"]).toBe("#313244");
    expect(cssVariables.variables["--app-surface-toolbar-active"]).toBe("#45475a");
    expect(cssVariables.variables["--app-surface-toolbar-border"]).toBe("#45475a");
    expect(cssVariables.variables["--app-chrome-control-bg"]).toBe("#313244");
    expect(cssVariables.variables["--app-chrome-control-border"]).toBe("#45475a");
    expect(cssVariables.variables["--app-chrome-control-fg"]).toBe("#cdd6f4");
    expect(cssVariables.variables["--app-chrome-control-hover-bg"]).toBe("#45475a");
    expect(cssVariables.variables["--app-chrome-control-hover-fg"]).toBe("#cdd6f4");
    expect(cssVariables.variables["--app-chrome-control-active-bg"]).toBe(
      "rgba(203, 166, 247, 0.14)",
    );
    expect(cssVariables.variables["--app-metadata-fg"]).toBe("rgba(205, 214, 244, 0.86)");
    expect(cssVariables.variables["--app-metadata-muted-fg"]).toBe("rgba(205, 214, 244, 0.62)");
    expect(cssVariables.variables["--app-text-metadata"]).toBe("rgba(205, 214, 244, 0.62)");
    expect(cssVariables.variables["--app-text-metadata-strong"]).toBe("rgba(205, 214, 244, 0.86)");
    expect(cssVariables.variables["--app-control-icon-fg"]).toBe("rgba(205, 214, 244, 0.62)");
    expect(cssVariables.variables["--app-control-icon-hover-fg"]).toBe("rgba(205, 214, 244, 0.86)");
    expect(cssVariables.variables["--app-control-icon-bg"]).toBe("transparent");
    expect(cssVariables.variables["--app-control-icon-hover-bg"]).toBe("#313244");
    expect(cssVariables.variables["--app-control-icon-border"]).toBe("rgba(69, 71, 90, 0.55)");
    expect(cssVariables.variables["--app-work-row-bg"]).toBe("rgba(30, 30, 46, 0.82)");
    expect(cssVariables.variables["--app-work-row-hover-bg"]).toBe("#313244");
    expect(cssVariables.variables["--app-work-row-border"]).toBe("rgba(69, 71, 90, 0.52)");
    expect(cssVariables.variables["--app-work-row-icon"]).toBe("rgba(205, 214, 244, 0.48)");
    expect(cssVariables.variables["--app-state-hover"]).toBe("#313244");
    expect(cssVariables.variables["--app-state-selected"]).toBe("rgba(203, 166, 247, 0.14)");
    expect(cssVariables.variables["--app-state-selected-border"]).toBe("#cba6f7");
    expect(cssVariables.variables["--app-status-error-bg"]).toBe("rgba(243, 139, 168, 0.14)");
    expect(cssVariables.variables["--app-status-working-fg"]).toBe("#89b4fa");
    expect(cssVariables.variables["--app-status-working-dot"]).toBe("#89b4fa");
    expect(cssVariables.variables["--app-status-success-fg"]).toBe("#a6e3a1");
    expect(cssVariables.variables["--app-status-warning-fg"]).toBe("#fab387");
    expect(cssVariables.variables["--app-status-input-fg"]).toBe("#94e2d5");
    expect(cssVariables.variables["--app-status-plan-fg"]).toBe("#cba6f7");
    expect(cssVariables.variables["--app-status-error-fg"]).toBe("#f38ba8");
    expect(cssVariables.variables["--app-status-muted-fg"]).toBe("#45475a");
    expect(cssVariables.variables["--app-diff-card-bg"]).toBe("#181825");
    expect(cssVariables.variables["--app-diff-title"]).toBe("#89b4fa");
    expect(cssVariables.variables["--app-wordmark-prefix"]).toBe("#d00000");
    expect(cssVariables.variables["--app-wordmark-prefix"]).not.toBe("#f38ba8");
    expect(cssVariables.variables["--app-agent-chip-violet-fg"]).toBe("#cba6f7");
    expect(cssVariables.variables["--app-agent-chip-cyan-fg"]).toBe("#89b4fa");
    expect(cssVariables.variables["--app-agent-chip-default-fg"]).toBe("#f9e2af");
    expect(cssVariables.variables["--app-subagent-accent-0"]).toBe("#f38ba8");
    expect(cssVariables.variables["--app-subagent-accent-7"]).toBe("#f9e2af");
    expect(cssVariables.variables["--app-terminal-search-match-bg"]).toBe("#45475a");
    expect(cssVariables.variables["--app-terminal-search-active-match-border"]).toBe("#f9e2af");
    expect(cssVariables.variables["--app-plugin-glyph-gradient-from"]).toBe("#cba6f7");
    expect(cssVariables.variables["--app-plugin-glyph-gradient-to"]).toBe("#89b4fa");
    expect(cssVariables.variables["--app-scroll-button-bg"]).toBe("#313244");
    expect(cssVariables.variables["--app-scroll-button-hover-fg"]).toBe("#cba6f7");
    expect(cssVariables.variables["--app-scrollbar-thumb"]).toBe("rgba(69, 71, 90, 0.72)");
    expect(cssVariables.variables["--app-scrollbar-thumb-hover"]).toBe("rgba(69, 71, 90, 0.92)");
    expect(cssVariables.variables["--app-plugin-glyph-text"]).toBe("#cdd6f4");
    expect(cssVariables.variables["--app-terminal-search-active-match-bg"]).toBe("#45475a");
  });

  it("emits Catppuccin Mocha chat semantic role tokens from official palette roles", () => {
    const cssVariables = buildThemeCssVariables(
      {
        codeThemeId: "catppuccin",
        theme: getCodeThemeSeed("catppuccin", "dark"),
      },
      "dark",
    );

    expect(cssVariables.variables["--app-chat-heading"]).toBe("#cba6f7");
    expect(cssVariables.variables["--app-chat-link"]).toBe("#89b4fa");
    expect(cssVariables.variables["--app-chat-file"]).toBe("#89b4fa");
    expect(cssVariables.variables["--app-chat-token"]).toBe("#94e2d5");
    expect(cssVariables.variables["--app-chat-command"]).toBe("#cba6f7");
    expect(cssVariables.variables["--app-chat-success"]).toBe("#a6e3a1");
    expect(cssVariables.variables["--app-chat-success-bg"]).toBe("rgba(166, 227, 161, 0.12)");
    expect(cssVariables.variables["--app-chat-warning"]).toBe("#fab387");
    expect(cssVariables.variables["--app-chat-warning-bg"]).toBe("rgba(250, 179, 135, 0.12)");
    expect(cssVariables.variables["--app-chat-error"]).toBe("#f38ba8");
    expect(cssVariables.variables["--app-chat-error-bg"]).toBe("rgba(243, 139, 168, 0.12)");
    expect(cssVariables.variables["--app-chat-chip-bg"]).toBe("rgba(49, 50, 68, 0.58)");
    expect(cssVariables.variables["--app-chat-chip-border"]).toBe("rgba(69, 71, 90, 0.74)");
    expect(cssVariables.variables["--app-chat-code-bg"]).toBe("#181825");
    expect(cssVariables.variables["--app-chat-code-border"]).toBe("#313244");
  });

  it("emits Tokyo Night app-depth tokens from official night palette roles", () => {
    const cssVariables = buildThemeCssVariables(
      {
        codeThemeId: "tokyo-night",
        theme: getCodeThemeSeed("tokyo-night", "dark"),
      },
      "dark",
    );

    expect(cssVariables.variables["--app-surface-canvas"]).toBe("#0C0E14");
    expect(cssVariables.variables["--app-surface-sidebar"]).toBe("#16161e");
    expect(cssVariables.variables["--app-surface-topbar"]).toBe("#16161e");
    expect(cssVariables.variables["--app-surface-card"]).toBe("#1a1b26");
    expect(cssVariables.variables["--app-surface-card-header"]).toBe("#292e42");
    expect(cssVariables.variables["--app-chat-heading"]).toBe("#bb9af7");
    expect(cssVariables.variables["--app-chat-link"]).toBe("#7aa2f7");
    expect(cssVariables.variables["--app-chat-token"]).toBe("#1abc9c");
    expect(cssVariables.variables["--app-chat-warning"]).toBe("#e0af68");
    expect(cssVariables.variables["--app-chat-error"]).toBe("#f7768e");
    expect(cssVariables.variables["--app-state-focus"]).toBe("#27a1b9");
    expect(cssVariables.variables["--app-terminal-search-match-bg"]).toBe("#292e42");
    expect(cssVariables.variables["--app-terminal-search-active-match-bg"]).toBe("#283457");
  });

  it("lets Tokyo Night theme edits drive accent and semantic depth tokens", () => {
    const pack = {
      codeThemeId: "tokyo-night",
      theme: getCodeThemeSeed("tokyo-night", "dark"),
    };
    const cssVariables = buildThemeCssVariables(
      {
        ...pack,
        theme: {
          ...pack.theme,
          accent: "#ff00aa",
          ink: "#f8f8f2",
          semanticColors: {
            ...pack.theme.semanticColors,
            diffAdded: "#00ff66",
            diffRemoved: "#ff3355",
            skill: "#d787ff",
          },
        },
      },
      "dark",
    );

    expect(cssVariables.variables["--app-accent-strong"]).toBe("#ff00aa");
    expect(cssVariables.variables["--app-state-selected-border"]).toBe("#ff00aa");
    expect(cssVariables.variables["--app-state-selected"]).toBe("rgba(255, 0, 170, 0.18)");
    expect(cssVariables.variables["--app-metadata-fg"]).toBe("rgba(248, 248, 242, 0.86)");
    expect(cssVariables.variables["--app-chat-heading"]).toBe("#d787ff");
    expect(cssVariables.variables["--app-chat-success"]).toBe("#00ff66");
    expect(cssVariables.variables["--app-chat-error"]).toBe("#ff3355");
    expect(cssVariables.variables["--app-status-success-fg"]).toBe("#00ff66");
    expect(cssVariables.variables["--app-status-error-fg"]).toBe("#ff3355");
  });

  it("keeps source-backed bundled theme seed roles on their palette colors", () => {
    expect(getCodeThemeSeed("gruvbox", "dark").semanticColors.diffAdded).toBe("#98971a");
    expect(getCodeThemeSeed("gruvbox", "light").semanticColors.diffAdded).toBe("#79740e");
    expect(getCodeThemeSeed("rose-pine", "dark").semanticColors.diffRemoved).toBe("#eb6f92");
    expect(getCodeThemeSeed("rose-pine", "light").semanticColors.diffRemoved).toBe("#b4637a");
    expect(getCodeThemeSeed("solarized", "dark").accent).toBe("#268bd2");
    expect(getCodeThemeSeed("solarized", "light").accent).toBe("#268bd2");
    expect(getCodeThemeSeed("night-owl", "dark").accent).toBe("#82aaff");
  });

  it("emits non-empty app-depth tokens for non-Catppuccin themes", () => {
    const cssVariables = buildThemeCssVariables(
      {
        codeThemeId: "codex",
        theme: DEFAULT_THEME_STATE.chromeThemes.dark,
      },
      "dark",
    );

    for (const tokenName of REQUIRED_APP_DEPTH_TOKENS) {
      expect(cssVariables.variables[tokenName], tokenName).toEqual(expect.any(String));
      expect(cssVariables.variables[tokenName]?.length, tokenName).toBeGreaterThan(0);
    }
  });

  it("emits complete app-depth tokens for every bundled theme variant", () => {
    for (const option of CODE_THEME_OPTIONS) {
      for (const variant of option.variants) {
        const cssVariables = buildThemeCssVariables(
          {
            codeThemeId: option.id,
            theme: getCodeThemeSeed(option.id, variant),
          },
          variant,
        );

        for (const tokenName of REQUIRED_APP_DEPTH_TOKENS) {
          const value = cssVariables.variables[tokenName];
          expect(value, `${option.id}/${variant}/${tokenName}`).toEqual(expect.any(String));
          expect(value?.length, `${option.id}/${variant}/${tokenName}`).toBeGreaterThan(0);
          expect(value, `${option.id}/${variant}/${tokenName}`).not.toContain("NaN");
        }
      }
    }
  });

  it("separates major app-depth surfaces for every bundled theme variant", () => {
    for (const option of CODE_THEME_OPTIONS) {
      for (const variant of option.variants) {
        const variables = buildThemeCssVariables(
          {
            codeThemeId: option.id,
            theme: getCodeThemeSeed(option.id, variant),
          },
          variant,
        ).variables;

        expect(variables["--app-surface-sidebar"], `${option.id}/${variant}/sidebar`).not.toBe(
          variables["--app-surface-canvas"],
        );
        expect(variables["--app-surface-topbar"], `${option.id}/${variant}/topbar`).not.toBe(
          variables["--app-surface-canvas"],
        );
        expect(variables["--app-surface-card-header"], `${option.id}/${variant}/header`).not.toBe(
          variables["--app-surface-card"],
        );
      }
    }
  });

  it("locks representative bundled theme-depth profile values", () => {
    const expectations = [
      ["dp-code", "dark", "#0b0b0b", "#141414", "#313131", "rgba(96, 115, 204, 0.14)", "#f5b44a"],
      ["dp-code", "light", "#eeeeee", "#e8e8e8", "#f0f0f0", "rgba(82, 111, 255, 0.1)", "#d97706"],
      ["codex", "dark", "#0e0e0e", "#181818", "#303030", "rgba(1, 105, 204, 0.12)", "#f5b44a"],
      ["codex", "light", "#f5f5f5", "#eeeeee", "#f0f0f0", "rgba(1, 105, 204, 0.09)", "#d97706"],
      ["linear", "dark", "#0d0d0e", "#161617", "#2b2b2d", "rgba(96, 106, 204, 0.12)", "#f5b44a"],
      ["github", "light", "#f6f6f6", "#efefef", "#f2f2f2", "rgba(9, 105, 218, 0.09)", "#d97706"],
      ["github", "dark", "#0b0e13", "#15181d", "#2e3339", "rgba(31, 111, 235, 0.13)", "#f5b44a"],
      ["gruvbox", "dark", "#222222", "#2c2b29", "#47453f", "rgba(69, 133, 136, 0.14)", "#fabd2f"],
      [
        "rose-pine",
        "dark",
        "#1d1c2d",
        "#272637",
        "#424055",
        "rgba(234, 154, 151, 0.14)",
        "#f6c177",
      ],
      [
        "tokyo-night",
        "dark",
        "#0C0E14",
        "#16161e",
        "#292e42",
        "rgba(122, 162, 247, 0.18)",
        "#e0af68",
      ],
      ["vercel", "light", "#f7f7f7", "#f0f0f0", "#f1f1f1", "rgba(0, 106, 255, 0.09)", "#d97706"],
      ["vercel", "dark", "#000000", "#090909", "#1e1e1e", "rgba(0, 110, 254, 0.12)", "#f5b44a"],
      [
        "vscode-plus",
        "light",
        "#f5f5f5",
        "#ededed",
        "#f0f0f0",
        "rgba(0, 122, 204, 0.09)",
        "#d97706",
      ],
      [
        "vscode-plus",
        "dark",
        "#191919",
        "#212121",
        "#3a3a3a",
        "rgba(0, 122, 204, 0.13)",
        "#f5b44a",
      ],
      ["matrix", "dark", "#030704", "#0d150f", "#233326", "rgba(30, 255, 90, 0.16)", "#b7ff5a"],
      ["lobster", "dark", "#0e1421", "#1a1f2c", "#353b48", "rgba(255, 92, 92, 0.16)", "#f5b44a"],
    ] as const;

    for (const [
      codeThemeId,
      variant,
      canvas,
      sidebar,
      cardHeader,
      selected,
      warning,
    ] of expectations) {
      const variables = buildThemeCssVariables(
        {
          codeThemeId,
          theme: getCodeThemeSeed(codeThemeId, variant),
        },
        variant,
      ).variables;

      expect(variables["--app-surface-canvas"], `${codeThemeId}/${variant}/canvas`).toBe(canvas);
      expect(variables["--app-surface-sidebar"], `${codeThemeId}/${variant}/sidebar`).toBe(sidebar);
      expect(variables["--app-surface-card-header"], `${codeThemeId}/${variant}/header`).toBe(
        cardHeader,
      );
      expect(variables["--app-state-selected"], `${codeThemeId}/${variant}/selected`).toBe(
        selected,
      );
      expect(variables["--app-chat-warning"], `${codeThemeId}/${variant}/warning`).toBe(warning);
    }
  });

  it("keeps custom imported themes on complete fallback app-depth derivation", () => {
    const variables = buildThemeCssVariables(
      {
        codeThemeId: "custom-aurora",
        theme: {
          accent: "#66d9ef",
          contrast: 50,
          fonts: { code: null, ui: null },
          ink: "#f8f8f2",
          opaqueWindows: false,
          semanticColors: {
            diffAdded: "#a6e22e",
            diffRemoved: "#f92672",
            skill: "#ae81ff",
          },
          surface: "#1b1d2a",
        },
      },
      "dark",
    ).variables;

    for (const tokenName of REQUIRED_APP_DEPTH_TOKENS) {
      expect(variables[tokenName], tokenName).toEqual(expect.any(String));
      expect(variables[tokenName]?.length, tokenName).toBeGreaterThan(0);
      expect(variables[tokenName], tokenName).not.toContain("NaN");
    }
    expect(variables["--app-surface-sidebar"]).not.toBe(variables["--app-surface-canvas"]);
    expect(variables["--app-surface-card-header"]).not.toBe(variables["--app-surface-card"]);
  });

  it("lets Catppuccin theme edits drive accent and selected-state depth tokens", () => {
    const pack = {
      codeThemeId: "catppuccin",
      theme: getCodeThemeSeed("catppuccin", "dark"),
    };
    const cssVariables = buildThemeCssVariables(
      {
        ...pack,
        theme: {
          ...pack.theme,
          accent: "#ff00aa",
        },
      },
      "dark",
    );

    expect(cssVariables.variables["--app-accent-strong"]).toBe("#ff00aa");
    expect(cssVariables.variables["--app-state-selected-border"]).toBe("#ff00aa");
    expect(cssVariables.variables["--app-state-selected"]).toBe("rgba(255, 0, 170, 0.14)");
  });
});
