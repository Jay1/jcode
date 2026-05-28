// FILE: theme.logic.test.ts
// Purpose: Locks down Codex-style theme parsing, normalization, and CSS token derivation.
// Layer: Web appearance domain tests
// Exports: Vitest coverage for theme.logic.

import { describe, expect, it } from "vitest";
import {
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
    expect(cssVariables.variables["--app-state-hover"]).toBe("#313244");
    expect(cssVariables.variables["--app-state-selected"]).toBe("rgba(203, 166, 247, 0.14)");
    expect(cssVariables.variables["--app-state-selected-border"]).toBe("#cba6f7");
    expect(cssVariables.variables["--app-status-error-bg"]).toBe("rgba(243, 139, 168, 0.14)");
    expect(cssVariables.variables["--app-diff-card-bg"]).toBe("#181825");
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

  it("emits non-empty app-depth tokens for non-Catppuccin themes", () => {
    const cssVariables = buildThemeCssVariables(
      {
        codeThemeId: "codex",
        theme: DEFAULT_THEME_STATE.chromeThemes.dark,
      },
      "dark",
    );

    const depthTokenNames = [
      "--app-surface-canvas",
      "--app-surface-sidebar",
      "--app-surface-topbar",
      "--app-surface-panel",
      "--app-surface-card",
      "--app-surface-card-header",
      "--app-surface-composer",
      "--app-state-hover",
      "--app-state-selected",
      "--app-state-selected-border",
      "--app-state-focus",
      "--app-status-error-bg",
      "--app-status-error-border",
      "--app-status-warning-bg",
      "--app-status-warning-border",
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
      "--app-accent-soft",
      "--app-accent-muted",
      "--app-accent-strong",
    ];

    for (const tokenName of depthTokenNames) {
      expect(cssVariables.variables[tokenName], tokenName).toEqual(expect.any(String));
      expect(cssVariables.variables[tokenName]?.length, tokenName).toBeGreaterThan(0);
    }
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
