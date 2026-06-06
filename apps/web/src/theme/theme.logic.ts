// FILE: theme.logic.ts
// Purpose: Owns the Codex-style theme model, share-string parsing, and derived CSS token math.
// Layer: Web appearance domain logic
// Exports: Theme types, normalization helpers, import/export utilities, and CSS variable builders.

import { THEME_SEED_CATALOG } from "./theme.seed.generated";
import { normalizeFontFamilyCssValue } from "../lib/fontFamily";

export type ThemeMode = "light" | "dark" | "system";
export type ThemeVariant = "light" | "dark";
export type WindowMaterial = "opaque" | "translucent";

export interface ThemeFonts {
  ui: string | null;
  code: string | null;
}

export interface ThemeSemanticColors {
  diffAdded: string;
  diffRemoved: string;
  skill: string;
}

export interface ChromeTheme {
  accent: string;
  contrast: number;
  fonts: ThemeFonts;
  ink: string;
  opaqueWindows: boolean;
  semanticColors: ThemeSemanticColors;
  surface: string;
}

export interface ThemePack {
  codeThemeId: string;
  theme: ChromeTheme;
}

export interface ThemeState {
  chromeThemes: Record<ThemeVariant, ChromeTheme>;
  codeThemeIds: Record<ThemeVariant, string>;
  mode: ThemeMode;
}

export interface CodeThemeOption {
  id: string;
  label: string;
  variants: readonly ThemeVariant[];
}

export interface ThemeSharePayload {
  codeThemeId: string;
  theme: ChromeTheme;
  variant: ThemeVariant;
}

export interface ThemeCssVariableBuild {
  material: WindowMaterial;
  variables: Record<string, string>;
}

export interface ThemeDerivedTokens {
  accentBackground: string;
  accentBackgroundActive: string;
  accentBackgroundHover: string;
  border: string;
  borderFocus: string;
  borderHeavy: string;
  borderLight: string;
  buttonPrimaryBackground: string;
  buttonPrimaryBackgroundActive: string;
  buttonPrimaryBackgroundHover: string;
  buttonPrimaryBackgroundInactive: string;
  buttonSecondaryBackground: string;
  buttonSecondaryBackgroundActive: string;
  buttonSecondaryBackgroundHover: string;
  buttonSecondaryBackgroundInactive: string;
  buttonTertiaryBackground: string;
  buttonTertiaryBackgroundActive: string;
  buttonTertiaryBackgroundHover: string;
  controlBackground: string;
  controlBackgroundOpaque: string;
  elevatedPrimary: string;
  elevatedPrimaryOpaque: string;
  elevatedSecondary: string;
  elevatedSecondaryOpaque: string;
  iconAccent: string;
  iconPrimary: string;
  iconSecondary: string;
  iconTertiary: string;
  simpleScrim: string;
  textAccent: string;
  textButtonPrimary: string;
  textButtonSecondary: string;
  textButtonTertiary: string;
  textForeground: string;
  textForegroundSecondary: string;
  textForegroundTertiary: string;
}

export interface ResolvedThemeTokens {
  aliases: Record<string, string>;
  codexVariables: Record<string, string>;
  computed: {
    contrast: number;
    editorBackground: string;
    panel: string;
    surfaceUnder: string;
  };
  derived: ThemeDerivedTokens;
}

type ChromeThemeSeedPatch = Partial<
  Pick<ChromeTheme, "accent" | "contrast" | "ink" | "opaqueWindows" | "surface">
> & {
  fonts?: Partial<ThemeFonts>;
  semanticColors?: Partial<ThemeSemanticColors>;
};

type CodeThemeSeedPatchMetadata = {
  contrast?: true;
  fonts?: Partial<Record<keyof ThemeFonts, true>>;
  opaqueWindows?: true;
};

type RgbColor = {
  red: number;
  green: number;
  blue: number;
};

type CatppuccinPalette = {
  accent: string;
  base: string;
  blue: string;
  crust: string;
  green: string;
  mantle: string;
  mauve: string;
  peach: string;
  red: string;
  teal: string;
  surface0: string;
  surface1: string;
  yellow: string;
};

type ThemeDepthTone = "cool" | "neutral" | "vivid" | "warm";

type ThemeDepthProfile = {
  chatLink?: string;
  chatToken?: string;
  composerLift?: number;
  headerLift?: number;
  selectedAlpha?: number;
  sidebarLift?: number;
  tone: ThemeDepthTone;
  topbarLift?: number;
  warning?: string;
};

type OfficialThemeDepthPalette = {
  appBorder: string;
  canvas: string;
  cardHeader: string;
  chatCommand: string;
  chatLink: string;
  chatToken: string;
  chip: string;
  chipBorder: string;
  codeCopyBackground: string;
  composer: string;
  error: string;
  panel: string;
  rowHover: string;
  sidebar: string;
  success: string;
  toolbarActive: string;
  toolbarHover: string;
  topbar: string;
  warning: string;
};

const APP_STATUS_TOKEN_KINDS = [
  "working",
  "success",
  "warning",
  "input",
  "plan",
  "error",
  "muted",
] as const;

type AppStatusTokenKind = (typeof APP_STATUS_TOKEN_KINDS)[number];

const BLACK: RgbColor = { blue: 0, green: 0, red: 0 };
const WHITE: RgbColor = { blue: 255, green: 255, red: 255 };
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const THEME_SHARE_PREFIX = "codex-theme-v1:";
const CONTRAST_CURVE_BELOW_BASELINE = 0.7;
const CONTRAST_CURVE_ABOVE_BASELINE = 2;
const APP_WORDMARK_PREFIX_BLOOD_RED = "#d00000";
const SURFACE_UNDER_BASE_ALPHA: Record<ThemeVariant, number> = {
  dark: 0.16,
  light: 0.04,
};
const SURFACE_UNDER_CONTRAST_STEP: Record<ThemeVariant, number> = {
  dark: 0.0015,
  light: 0.0012,
};
const CATPPUCCIN_PALETTE: Record<ThemeVariant, CatppuccinPalette> = {
  dark: {
    accent: "#cba6f7",
    base: "#1e1e2e",
    blue: "#89b4fa",
    crust: "#11111b",
    green: "#a6e3a1",
    mantle: "#181825",
    mauve: "#cba6f7",
    peach: "#fab387",
    red: "#f38ba8",
    surface0: "#313244",
    surface1: "#45475a",
    teal: "#94e2d5",
    yellow: "#f9e2af",
  },
  light: {
    accent: "#8839ef",
    base: "#eff1f5",
    blue: "#1e66f5",
    crust: "#dce0e8",
    green: "#40a02b",
    mantle: "#e6e9ef",
    mauve: "#8839ef",
    peach: "#fe640b",
    red: "#d20f39",
    surface0: "#ccd0da",
    surface1: "#bcc0cc",
    teal: "#179299",
    yellow: "#df8e1d",
  },
};
// Source: tokyo-night/tokyo-night-vscode-theme themes/tokyo-night-color-theme.json.
const TOKYO_NIGHT_PALETTE = {
  bg: "#1a1b26",
  bgDark: "#16161e",
  bgDark1: "#14141b",
  bgHighlight: "#202330",
  bgPanel: "#1f2335",
  bgVisual: "#3b4261",
  blue: "#7aa2f7",
  blue1: "#2ac3de",
  blue7: "#3b4261",
  borderHighlight: "#7aa2f7",
  cyan: "#7dcfff",
  fg: "#c0caf5",
  fgDark: "#a9b1d6",
  green: "#73daca",
  magenta: "#bb9af7",
  orange: "#ff9e64",
  purple: "#9d7cd8",
  red: "#f7768e",
  terminalBlack: "#292e42",
  teal: "#73daca",
  yellow: "#e0af68",
} as const;
const OFFICIAL_THEME_DEPTH_PALETTES: Partial<
  Record<string, Partial<Record<ThemeVariant, OfficialThemeDepthPalette>>>
> = {
  // Source: spec.draculatheme.com standard and ANSI palettes.
  dracula: {
    dark: {
      appBorder: "#6272a4",
      canvas: "#21222c",
      cardHeader: "#44475a",
      chatCommand: "#bd93f9",
      chatLink: "#8be9fd",
      chatToken: "#8be9fd",
      chip: "#ff79c6",
      chipBorder: "#bd93f9",
      codeCopyBackground: "#44475a",
      composer: "#282a36",
      error: "#ff5555",
      panel: "#282a36",
      rowHover: "#44475a",
      sidebar: "#282a36",
      success: "#50fa7b",
      toolbarActive: "#6272a4",
      toolbarHover: "#44475a",
      topbar: "#282a36",
      warning: "#f1fa8c",
    },
  },
  // Source: nordtheme.com Polar Night, Frost, and Aurora palettes.
  nord: {
    dark: {
      appBorder: "#4c566a",
      canvas: "#2e3440",
      cardHeader: "#434c5e",
      chatCommand: "#b48ead",
      chatLink: "#88c0d0",
      chatToken: "#8fbcbb",
      chip: "#88c0d0",
      chipBorder: "#81a1c1",
      codeCopyBackground: "#434c5e",
      composer: "#3b4252",
      error: "#bf616a",
      panel: "#3b4252",
      rowHover: "#434c5e",
      sidebar: "#3b4252",
      success: "#a3be8c",
      toolbarActive: "#4c566a",
      toolbarHover: "#434c5e",
      topbar: "#3b4252",
      warning: "#ebcb8b",
    },
  },
  // Source: Raycast brand color references and API color names.
  raycast: {
    dark: {
      appBorder: "#2f3031",
      canvas: "#07080a",
      cardHeader: "#1b1c1e",
      chatCommand: "#ff6363",
      chatLink: "#55b3ff",
      chatToken: "#55b3ff",
      chip: "#ff6363",
      chipBorder: "#2f3031",
      codeCopyBackground: "#1b1c1e",
      composer: "#101111",
      error: "#ff6363",
      panel: "#101111",
      rowHover: "#1b1c1e",
      sidebar: "#101111",
      success: "#59d499",
      toolbarActive: "#2f3031",
      toolbarHover: "#252829",
      topbar: "#101111",
      warning: "#ffbc33",
    },
    light: {
      appBorder: "#ff6363",
      canvas: "#ffffff",
      cardHeader: "#e6e6e6",
      chatCommand: "#ff6363",
      chatLink: "#55b3ff",
      chatToken: "#55b3ff",
      chip: "#ff6363",
      chipBorder: "#ff6363",
      codeCopyBackground: "#ffe7e7",
      composer: "#ffffff",
      error: "#ff6363",
      panel: "#ffffff",
      rowHover: "#ffe7e7",
      sidebar: "#f7f7f7",
      success: "#59d499",
      toolbarActive: "#ffe3e3",
      toolbarHover: "#ffe7e7",
      topbar: "#f7f7f7",
      warning: "#ffbc33",
    },
  },
  // Source: Sentry product dark tokens from getsentry/sentry theme scraps.
  sentry: {
    dark: {
      appBorder: "#46404F",
      canvas: "#1B1821",
      cardHeader: "#393442",
      chatCommand: "#7553FF",
      chatLink: "#7553FF",
      chatToken: "#3DDC97",
      chip: "#7553FF",
      chipBorder: "#46404F",
      codeCopyBackground: "#393442",
      composer: "#2E2936",
      error: "#FF6363",
      panel: "#24202B",
      rowHover: "#393442",
      sidebar: "#24202B",
      success: "#3DDC97",
      toolbarActive: "#46404F",
      toolbarHover: "#393442",
      topbar: "#24202B",
      warning: "#FFB938",
    },
  },
  // Source: morhetz/gruvbox-contrib color.table normal and bright roles.
  gruvbox: {
    dark: {
      appBorder: "#504945",
      canvas: "#1d2021",
      cardHeader: "#3c3836",
      chatCommand: "#b16286",
      chatLink: "#83a598",
      chatToken: "#689d6a",
      chip: "#458588",
      chipBorder: "#689d6a",
      codeCopyBackground: "#3c3836",
      composer: "#282828",
      error: "#cc241d",
      panel: "#282828",
      rowHover: "#3c3836",
      sidebar: "#282828",
      success: "#98971a",
      toolbarActive: "#504945",
      toolbarHover: "#504945",
      topbar: "#282828",
      warning: "#fabd2f",
    },
    light: {
      appBorder: "#bdae93",
      canvas: "#fbf1c7",
      cardHeader: "#ebdbb2",
      chatCommand: "#b16286",
      chatLink: "#458588",
      chatToken: "#689d6a",
      chip: "#458588",
      chipBorder: "#689d6a",
      codeCopyBackground: "#ebdbb2",
      composer: "#fbf1c7",
      error: "#cc241d",
      panel: "#fbf1c7",
      rowHover: "#ebdbb2",
      sidebar: "#f9f5d7",
      success: "#79740e",
      toolbarActive: "#bdae93",
      toolbarHover: "#d5c4a1",
      topbar: "#f9f5d7",
      warning: "#b57614",
    },
  },
};
const THEME_DEPTH_PROFILES: Partial<
  Record<string, Partial<Record<ThemeVariant, ThemeDepthProfile>>>
> = {
  absolutely: {
    dark: { tone: "warm" },
    light: { tone: "warm" },
  },
  ayu: {
    dark: { tone: "warm", warning: "#e6b450" },
  },
  codex: {
    dark: { tone: "neutral" },
    light: { tone: "neutral" },
  },
  "dp-code": {
    dark: { tone: "neutral", selectedAlpha: 0.14 },
    light: { tone: "neutral", selectedAlpha: 0.1 },
  },
  dracula: {
    dark: { tone: "vivid" },
  },
  everforest: {
    dark: { tone: "warm", warning: "#dbbc7f" },
    light: { tone: "warm", warning: "#dfa000" },
  },
  github: {
    dark: { tone: "cool" },
    light: { tone: "neutral" },
  },
  gruvbox: {
    dark: { tone: "warm" },
    light: { tone: "warm" },
  },
  linear: {
    dark: { tone: "neutral" },
    light: { tone: "neutral" },
  },
  lobster: {
    dark: { selectedAlpha: 0.16, tone: "vivid" },
  },
  material: {
    dark: { tone: "cool" },
  },
  matrix: {
    dark: { chatLink: "#00ff66", selectedAlpha: 0.16, tone: "vivid", warning: "#b7ff5a" },
  },
  monokai: {
    dark: { tone: "vivid", warning: "#e6db74" },
  },
  "night-owl": {
    dark: { tone: "cool", warning: "#ecc48d" },
  },
  nord: {
    dark: { tone: "cool" },
  },
  notion: {
    dark: { tone: "neutral" },
    light: { tone: "neutral" },
  },
  one: {
    dark: { tone: "cool" },
    light: { tone: "neutral" },
  },
  oscurange: {
    dark: { selectedAlpha: 0.15, tone: "warm" },
  },
  proof: {
    light: { tone: "neutral" },
  },
  raycast: {
    dark: { tone: "vivid" },
    light: { tone: "neutral" },
  },
  "rose-pine": {
    dark: { tone: "warm", warning: "#f6c177" },
    light: { tone: "warm", warning: "#ea9d34" },
  },
  sentry: {
    dark: { tone: "vivid" },
  },
  solarized: {
    dark: { tone: "warm", warning: "#b58900" },
    light: { tone: "warm", warning: "#b58900" },
  },
  temple: {
    dark: { tone: "warm" },
  },
  "tokyo-night": {
    dark: { tone: "cool" },
  },
  vercel: {
    dark: { tone: "neutral" },
    light: { tone: "neutral" },
  },
  "vscode-plus": {
    dark: { tone: "cool" },
    light: { tone: "neutral" },
  },
};
const PANEL_BASE_ALPHA: Record<ThemeVariant, number> = {
  dark: 0.03,
  light: 0.18,
};
const PANEL_CONTRAST_STEP: Record<ThemeVariant, number> = {
  dark: 0.03,
  light: 0.008,
};
const CODE_THEME_SEED_PATCH_METADATA: Partial<
  Record<string, Partial<Record<ThemeVariant, CodeThemeSeedPatchMetadata>>>
> = {
  linear: {
    dark: { fonts: { ui: true }, opaqueWindows: true },
    light: { fonts: { ui: true }, opaqueWindows: true },
  },
  lobster: {
    dark: { fonts: { ui: true } },
  },
  matrix: {
    dark: { fonts: { code: true, ui: true }, opaqueWindows: true },
  },
  notion: {
    dark: { fonts: { code: true, ui: true }, opaqueWindows: true },
    light: { fonts: { code: true, ui: true }, opaqueWindows: true },
  },
  proof: {
    light: { fonts: { code: true, ui: true }, opaqueWindows: true },
  },
  raycast: {
    dark: { fonts: { code: true, ui: true }, opaqueWindows: true },
    light: { fonts: { code: true, ui: true }, opaqueWindows: true },
  },
  sentry: {
    dark: { fonts: { code: true, ui: true } },
  },
  vercel: {
    dark: { contrast: true, fonts: { code: true, ui: true }, opaqueWindows: true },
    light: { contrast: true, fonts: { code: true, ui: true }, opaqueWindows: true },
  },
  // Theme ids are stored in localStorage and share strings. Keep the inherited
  // id stable while presenting the theme under the JCode label.
  "dp-code": {
    dark: { contrast: true },
    light: { contrast: true },
  },
};

// Mirror the packaged Codex catalog closely enough that share-string validation
// can preserve the "known theme + variant availability" behavior.
export const CODE_THEME_OPTIONS: readonly CodeThemeOption[] = [
  { id: "absolutely", label: "Absolutely", variants: ["light", "dark"] },
  { id: "ayu", label: "Ayu", variants: ["dark"] },
  { id: "catppuccin", label: "Catppuccin", variants: ["light", "dark"] },
  { id: "codex", label: "Codex", variants: ["light", "dark"] },
  { id: "dp-code", label: "JCode", variants: ["light", "dark"] },
  { id: "dracula", label: "Dracula", variants: ["dark"] },
  { id: "everforest", label: "Everforest", variants: ["light", "dark"] },
  { id: "github", label: "GitHub", variants: ["light", "dark"] },
  { id: "gruvbox", label: "Gruvbox", variants: ["light", "dark"] },
  { id: "linear", label: "Linear", variants: ["light", "dark"] },
  { id: "lobster", label: "Lobster", variants: ["dark"] },
  { id: "material", label: "Material", variants: ["dark"] },
  { id: "matrix", label: "Matrix", variants: ["dark"] },
  { id: "monokai", label: "Monokai", variants: ["dark"] },
  { id: "night-owl", label: "Night Owl", variants: ["dark"] },
  { id: "nord", label: "Nord", variants: ["dark"] },
  { id: "notion", label: "Notion", variants: ["light", "dark"] },
  { id: "one", label: "One", variants: ["light", "dark"] },
  { id: "oscurange", label: "Oscurange", variants: ["dark"] },
  { id: "proof", label: "Proof", variants: ["light"] },
  { id: "raycast", label: "Raycast", variants: ["light", "dark"] },
  { id: "rose-pine", label: "Rose Pine", variants: ["light", "dark"] },
  { id: "sentry", label: "Sentry", variants: ["dark"] },
  { id: "solarized", label: "Solarized", variants: ["light", "dark"] },
  { id: "temple", label: "Temple", variants: ["dark"] },
  { id: "tokyo-night", label: "Tokyo Night", variants: ["dark"] },
  { id: "vercel", label: "Vercel", variants: ["light", "dark"] },
  { id: "vscode-plus", label: "VS Code Plus", variants: ["light", "dark"] },
] as const;

export const DEFAULT_CHROME_THEME_BY_VARIANT: Record<ThemeVariant, ChromeTheme> = {
  dark: {
    accent: "#339cff",
    contrast: 60,
    fonts: { code: null, ui: null },
    ink: "#ffffff",
    opaqueWindows: false,
    semanticColors: {
      diffAdded: "#40c977",
      diffRemoved: "#fa423e",
      skill: "#ad7bf9",
    },
    surface: "#181818",
  },
  light: {
    accent: "#339cff",
    contrast: 45,
    fonts: { code: null, ui: null },
    ink: "#1a1c1f",
    opaqueWindows: false,
    semanticColors: {
      diffAdded: "#00a240",
      diffRemoved: "#ba2623",
      skill: "#924ff7",
    },
    surface: "#ffffff",
  },
};

export const DEFAULT_THEME_STATE: ThemeState = {
  chromeThemes: {
    dark: getCodeThemeSeed("codex", "dark"),
    light: getCodeThemeSeed("codex", "light"),
  },
  codeThemeIds: {
    dark: "codex",
    light: "codex",
  },
  mode: "system",
};

// ─── Theme catalog helpers ────────────────────────────────────────────────

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function isThemeVariant(value: unknown): value is ThemeVariant {
  return value === "light" || value === "dark";
}

export function getThemeSharePrefix(): string {
  return THEME_SHARE_PREFIX;
}

export function getAvailableCodeThemes(variant: ThemeVariant): readonly CodeThemeOption[] {
  return CODE_THEME_OPTIONS.filter((option) => option.variants.includes(variant));
}

export function isCodeThemeAvailable(codeThemeId: string, variant: ThemeVariant): boolean {
  const normalizedCodeThemeId = codeThemeId.trim().toLowerCase();
  return CODE_THEME_OPTIONS.some(
    (option) => option.id === normalizedCodeThemeId && option.variants.includes(variant),
  );
}

export function normalizeCodeThemeId(
  codeThemeId: unknown,
  variant: ThemeVariant,
  fallback = DEFAULT_THEME_STATE.codeThemeIds[variant],
): string {
  const normalizedCodeThemeId =
    typeof codeThemeId === "string" ? codeThemeId.trim().toLowerCase() : "";
  return isCodeThemeAvailable(normalizedCodeThemeId, variant) ? normalizedCodeThemeId : fallback;
}

// ─── Theme normalization ──────────────────────────────────────────────────

export function normalizeThemeFonts(value: unknown): ThemeFonts {
  const fonts = isRecord(value) ? value : {};
  return {
    code: normalizeFontSelection(fonts.code),
    ui: normalizeFontSelection(fonts.ui),
  };
}

export function normalizeSemanticColors(
  value: unknown,
  fallback: ThemeSemanticColors,
): ThemeSemanticColors {
  const semanticColors = isRecord(value) ? value : {};
  return {
    diffAdded: normalizeHexColor(semanticColors.diffAdded) ?? fallback.diffAdded,
    diffRemoved: normalizeHexColor(semanticColors.diffRemoved) ?? fallback.diffRemoved,
    skill: normalizeHexColor(semanticColors.skill) ?? fallback.skill,
  };
}

export function normalizeChromeTheme(value: unknown, variant: ThemeVariant): ChromeTheme {
  const fallback = DEFAULT_CHROME_THEME_BY_VARIANT[variant];
  const theme = isRecord(value) ? value : {};

  return {
    accent: normalizeHexColor(theme.accent) ?? fallback.accent,
    contrast: normalizeStoredContrast(theme.contrast, fallback.contrast),
    fonts: normalizeThemeFonts(theme.fonts),
    ink: normalizeHexColor(theme.ink) ?? fallback.ink,
    opaqueWindows:
      theme.opaqueWindows === true || theme.opaqueWindows === false
        ? theme.opaqueWindows
        : fallback.opaqueWindows,
    semanticColors: normalizeSemanticColors(theme.semanticColors, fallback.semanticColors),
    surface: normalizeHexColor(theme.surface) ?? fallback.surface,
  };
}

export function normalizeThemePack(value: unknown, variant: ThemeVariant): ThemePack {
  const pack = isRecord(value) ? value : {};
  return {
    codeThemeId: normalizeCodeThemeId(pack.codeThemeId, variant),
    theme: normalizeChromeTheme(pack.theme, variant),
  };
}

export function normalizeThemeState(value: unknown): ThemeState {
  const state = isRecord(value) ? value : {};
  const codeThemeIds = isRecord(state.codeThemeIds) ? state.codeThemeIds : {};
  const chromeThemes = isRecord(state.chromeThemes) ? state.chromeThemes : {};
  const packs = isRecord(state.packs) ? state.packs : {};
  const legacyDarkPack = normalizeThemePack(packs.dark, "dark");
  const legacyLightPack = normalizeThemePack(packs.light, "light");
  return {
    chromeThemes: {
      dark: isRecord(chromeThemes.dark)
        ? normalizeChromeTheme(chromeThemes.dark, "dark")
        : isRecord(packs.dark)
          ? legacyDarkPack.theme
          : DEFAULT_THEME_STATE.chromeThemes.dark,
      light: isRecord(chromeThemes.light)
        ? normalizeChromeTheme(chromeThemes.light, "light")
        : isRecord(packs.light)
          ? legacyLightPack.theme
          : DEFAULT_THEME_STATE.chromeThemes.light,
    },
    codeThemeIds: {
      dark: normalizeCodeThemeId(codeThemeIds.dark ?? legacyDarkPack.codeThemeId, "dark"),
      light: normalizeCodeThemeId(codeThemeIds.light ?? legacyLightPack.codeThemeId, "light"),
    },
    mode: isThemeMode(state.mode) ? state.mode : DEFAULT_THEME_STATE.mode,
  };
}

export function parseStoredThemeState(rawValue: string | null | undefined): ThemeState {
  if (!rawValue) {
    return DEFAULT_THEME_STATE;
  }
  if (isThemeMode(rawValue)) {
    return {
      ...DEFAULT_THEME_STATE,
      mode: rawValue,
    };
  }

  try {
    return normalizeThemeState(JSON.parse(rawValue));
  } catch {
    return DEFAULT_THEME_STATE;
  }
}

export function serializeThemeState(state: ThemeState): string {
  return JSON.stringify(state);
}

// ─── Share-string import / export ─────────────────────────────────────────

export function createThemeShareString(variant: ThemeVariant, pack: ThemePack): string {
  return `${THEME_SHARE_PREFIX}${JSON.stringify({
    codeThemeId: pack.codeThemeId,
    theme: pack.theme,
    variant,
  })}`;
}

export function parseThemeShareString(rawValue: string): ThemeSharePayload {
  const value = rawValue.trim();
  if (!value.startsWith(THEME_SHARE_PREFIX)) {
    throw new Error("Theme share string must start with codex-theme-v1:");
  }

  const payloadText = value.slice(THEME_SHARE_PREFIX.length);
  const jsonText = payloadText.startsWith("{") ? payloadText : decodeURIComponent(payloadText);
  let payload: unknown;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    throw new Error("Theme share string does not contain valid JSON.");
  }

  const themeShare = parseThemeSharePayload(payload);
  if (!isCodeThemeAvailable(themeShare.codeThemeId, themeShare.variant)) {
    throw new Error(
      `Code theme "${themeShare.codeThemeId}" is not available for ${themeShare.variant}.`,
    );
  }

  return {
    codeThemeId: themeShare.codeThemeId,
    theme: normalizeChromeTheme(themeShare.theme, themeShare.variant),
    variant: themeShare.variant,
  };
}

export function canParseThemeShareString(value: string, targetVariant?: ThemeVariant): boolean {
  try {
    parseThemeShareStringForVariant(value, targetVariant);
    return true;
  } catch {
    return false;
  }
}

export function parseThemeShareStringForVariant(
  value: string,
  targetVariant?: ThemeVariant,
): ThemeSharePayload {
  const payload = parseThemeShareString(value);
  if (targetVariant && payload.variant !== targetVariant) {
    throw new Error(
      `Theme variant mismatch. Expected ${targetVariant}, received ${payload.variant}.`,
    );
  }
  return payload;
}

export function updateThemePackFromShareString(
  state: ThemeState,
  value: string,
  targetVariant: ThemeVariant,
): ThemeState {
  const payload = parseThemeShareStringForVariant(value, targetVariant);
  return {
    ...state,
    chromeThemes: {
      ...state.chromeThemes,
      [targetVariant]: payload.theme,
    },
    codeThemeIds: {
      ...state.codeThemeIds,
      [targetVariant]: payload.codeThemeId,
    },
  };
}

// ─── Granular pack mutators ───────────────────────────────────────────────

export function updateChromeTheme(
  state: ThemeState,
  variant: ThemeVariant,
  patch: Partial<ChromeTheme>,
): ThemeState {
  const previousTheme = state.chromeThemes[variant];
  const nextPatch: ChromeThemeSeedPatch = { ...patch };
  if (patch.fonts) {
    nextPatch.fonts = patch.fonts;
  }
  if (patch.semanticColors) {
    nextPatch.semanticColors = patch.semanticColors;
  }
  return {
    ...state,
    chromeThemes: {
      ...state.chromeThemes,
      [variant]: normalizeChromeTheme(mergeThemeSeedPatch(previousTheme, nextPatch), variant),
    },
  };
}

export function setThemeCodeThemeId(
  state: ThemeState,
  variant: ThemeVariant,
  codeThemeId: string,
): ThemeState {
  const normalized = normalizeCodeThemeId(codeThemeId, variant);
  const previousTheme = resolveThemePack(state, variant).theme;
  const nextTheme = normalizeChromeTheme(
    mergeThemeSeedPatch(previousTheme, getCodeThemeSeedPatch(normalized, variant)),
    variant,
  );
  return {
    ...state,
    chromeThemes: {
      ...state.chromeThemes,
      [variant]: nextTheme,
    },
    codeThemeIds: {
      ...state.codeThemeIds,
      [variant]: normalized,
    },
  };
}

export function getCodeThemeSeed(codeThemeId: string, variant: ThemeVariant): ChromeTheme {
  const fallback = DEFAULT_CHROME_THEME_BY_VARIANT[variant];
  const themeSeed = THEME_SEED_CATALOG[codeThemeId]?.[variant];
  return themeSeed ? normalizeChromeTheme(themeSeed, variant) : fallback;
}

export function getCodeThemeSeedPatch(
  codeThemeId: string,
  variant: ThemeVariant,
): ChromeThemeSeedPatch {
  const themeSeed = THEME_SEED_CATALOG[codeThemeId]?.[variant];
  if (!themeSeed) {
    return {};
  }

  const normalizedSeed = normalizeChromeTheme(themeSeed, variant);
  const metadata = CODE_THEME_SEED_PATCH_METADATA[codeThemeId]?.[variant];
  const patch: ChromeThemeSeedPatch = {
    accent: normalizedSeed.accent,
    ink: normalizedSeed.ink,
    semanticColors: normalizedSeed.semanticColors,
    surface: normalizedSeed.surface,
  };

  if (metadata?.contrast) {
    patch.contrast = normalizedSeed.contrast;
  }

  if (metadata?.opaqueWindows) {
    patch.opaqueWindows = normalizedSeed.opaqueWindows;
  }

  if (metadata?.fonts) {
    const fontPatch: Partial<ThemeFonts> = {};
    if (metadata.fonts.code) {
      fontPatch.code = normalizedSeed.fonts.code;
    }
    if (metadata.fonts.ui) {
      fontPatch.ui = normalizedSeed.fonts.ui;
    }
    if (Object.keys(fontPatch).length > 0) {
      patch.fonts = fontPatch;
    }
  }

  return patch;
}

function mergeThemeSeedPatch(
  currentTheme: ChromeTheme,
  seedPatch: ChromeThemeSeedPatch,
): ChromeThemeSeedPatch {
  return {
    ...currentTheme,
    ...seedPatch,
    fonts: seedPatch.fonts ? { ...currentTheme.fonts, ...seedPatch.fonts } : currentTheme.fonts,
    semanticColors: seedPatch.semanticColors
      ? { ...currentTheme.semanticColors, ...seedPatch.semanticColors }
      : currentTheme.semanticColors,
  };
}

export function setThemeFonts(
  state: ThemeState,
  variant: ThemeVariant,
  patch: Partial<ThemeFonts>,
): ThemeState {
  const previousTheme = state.chromeThemes[variant];
  return {
    ...state,
    chromeThemes: {
      ...state.chromeThemes,
      [variant]: normalizeChromeTheme(
        {
          ...previousTheme,
          fonts: { ...previousTheme.fonts, ...patch },
        },
        variant,
      ),
    },
  };
}

export function resetThemeVariant(state: ThemeState, variant: ThemeVariant): ThemeState {
  return {
    ...state,
    chromeThemes: {
      ...state.chromeThemes,
      [variant]: DEFAULT_THEME_STATE.chromeThemes[variant],
    },
    codeThemeIds: {
      ...state.codeThemeIds,
      [variant]: DEFAULT_THEME_STATE.codeThemeIds[variant],
    },
  };
}

export function resolveThemePack(state: ThemeState, variant: ThemeVariant): ThemePack {
  return {
    codeThemeId: normalizeCodeThemeId(state.codeThemeIds[variant], variant),
    theme: normalizeChromeTheme(state.chromeThemes[variant], variant),
  };
}

export function areThemePacksEqual(left: ThemePack, right: ThemePack): boolean {
  return (
    left.codeThemeId === right.codeThemeId &&
    left.theme.accent === right.theme.accent &&
    left.theme.contrast === right.theme.contrast &&
    left.theme.fonts.code === right.theme.fonts.code &&
    left.theme.fonts.ui === right.theme.fonts.ui &&
    left.theme.ink === right.theme.ink &&
    left.theme.opaqueWindows === right.theme.opaqueWindows &&
    left.theme.semanticColors.diffAdded === right.theme.semanticColors.diffAdded &&
    left.theme.semanticColors.diffRemoved === right.theme.semanticColors.diffRemoved &&
    left.theme.semanticColors.skill === right.theme.semanticColors.skill &&
    left.theme.surface === right.theme.surface
  );
}

// ─── Theme derivation ─────────────────────────────────────────────────────

export function resolveThemeVariant(mode: ThemeMode, systemDark: boolean): ThemeVariant {
  if (mode === "system") {
    return systemDark ? "dark" : "light";
  }
  return mode;
}

export function buildThemeCssVariables(
  pack: ThemePack,
  variant: ThemeVariant,
  options?: { electron?: boolean; isMac?: boolean },
): ThemeCssVariableBuild {
  const resolvedTokens = buildResolvedThemeTokens(pack, variant);
  const codexVariables = resolvedTokens.codexVariables;
  const readCodexVariable = (name: string) => getRequiredVariable(codexVariables, name);
  const material: WindowMaterial =
    options?.electron === true && options.isMac === true && !pack.theme.opaqueWindows
      ? "translucent"
      : "opaque";
  const warningColor = variant === "dark" ? "#f5b44a" : "#d97706";
  const sidebarSurfaceUnder = readCodexVariable("--color-background-surface-under");
  const composerFocusBorder = buildComposerFocusBorder(
    pack,
    variant,
    resolvedTokens.computed.panel,
  );
  const appDepthVariables = buildAppDepthVariables(pack, variant, resolvedTokens);
  const appVariables: Record<string, string> = {
    "--accent": readCodexVariable("--color-background-accent"),
    "--accent-foreground": readCodexVariable("--color-text-foreground"),
    "--app-shell-background":
      material === "translucent"
        ? "transparent"
        : readCodexVariable("--color-background-surface-under"),
    "--app-composer-focus-border": composerFocusBorder,
    "--app-sidebar-backdrop-filter":
      material === "translucent" ? "blur(8px) saturate(135%)" : "none",
    "--app-sidebar-shadow":
      material === "translucent"
        ? variant === "dark"
          ? "inset 0 1px 0 rgba(255,255,255,0.024)"
          : "inset 0 1px 0 rgba(0,0,0,0.025)"
        : variant === "dark"
          ? "inset 0 1px 0 rgba(255,255,255,0.025)"
          : "inset 0 1px 0 rgba(0,0,0,0.03)",
    "--app-sidebar-surface":
      material === "translucent"
        ? variant === "dark"
          ? `color-mix(in srgb, ${sidebarSurfaceUnder} 72%, transparent)`
          : `color-mix(in srgb, ${sidebarSurfaceUnder} 64%, transparent)`
        : sidebarSurfaceUnder,
    "--background": readCodexVariable("--color-background-surface-under"),
    "--border": readCodexVariable("--color-border"),
    "--card": readCodexVariable("--color-background-panel"),
    "--card-foreground": readCodexVariable("--color-text-foreground"),
    "--destructive": pack.theme.semanticColors.diffRemoved,
    "--destructive-foreground": pack.theme.surface,
    "--foreground": readCodexVariable("--color-text-foreground"),
    "--info": pack.theme.accent,
    // Keep legacy app-level "info" consumers on Codex's accent-text path so
    // links, file labels, and similar affordances inherit the real light/dark logic.
    "--info-foreground": readCodexVariable("--color-text-accent"),
    "--input": readCodexVariable("--color-background-control-opaque"),
    "--muted": readCodexVariable("--color-background-elevated-secondary"),
    "--muted-foreground": readCodexVariable("--color-text-foreground-secondary"),
    "--popover": readCodexVariable("--color-background-elevated-primary-opaque"),
    "--popover-foreground": readCodexVariable("--color-text-foreground"),
    "--primary": readCodexVariable("--color-background-button-primary"),
    "--primary-foreground": readCodexVariable("--color-text-button-primary"),
    "--ring": readCodexVariable("--color-border-focus"),
    "--secondary": readCodexVariable("--color-background-button-secondary"),
    "--secondary-foreground": readCodexVariable("--color-text-button-secondary"),
    "--sidebar": readCodexVariable("--color-background-surface-under"),
    "--sidebar-accent": readCodexVariable("--color-background-button-secondary"),
    "--sidebar-accent-active": readCodexVariable("--color-background-button-secondary"),
    "--sidebar-accent-foreground": readCodexVariable("--color-text-foreground"),
    "--sidebar-border": readCodexVariable("--color-border"),
    "--sidebar-foreground": readCodexVariable("--color-text-foreground"),
    "--success": pack.theme.semanticColors.diffAdded,
    "--success-foreground": pack.theme.surface,
    "--theme-font-code-family": normalizeFontFamilyCssValue(pack.theme.fonts.code) ?? "",
    "--theme-font-ui-family": normalizeFontFamilyCssValue(pack.theme.fonts.ui) ?? "",
    "--warning": warningColor,
    "--warning-foreground": pack.theme.surface,
  };

  return {
    material,
    variables: {
      ...codexVariables,
      ...resolvedTokens.aliases,
      ...appDepthVariables,
      ...appVariables,
    },
  };
}

function buildAppDepthVariables(
  pack: ThemePack,
  variant: ThemeVariant,
  resolvedTokens: ResolvedThemeTokens,
): Record<string, string> {
  if (pack.codeThemeId === "catppuccin") {
    const palette = CATPPUCCIN_PALETTE[variant];
    const accent = parseHexColor(pack.theme.accent);
    const diffRemoved = parseHexColor(pack.theme.semanticColors.diffRemoved);
    const chipBgAlpha = variant === "dark" ? 0.58 : 0.44;
    const chipBorderAlpha = variant === "dark" ? 0.74 : 0.58;
    const surface0 = parseHexColor(palette.surface0);
    const surface1 = parseHexColor(palette.surface1);
    return {
      "--app-accent-muted": formatRgba(accent, variant === "dark" ? 0.28 : 0.2),
      "--app-accent-soft": formatRgba(accent, variant === "dark" ? 0.14 : 0.1),
      "--app-accent-strong": pack.theme.accent,
      ...buildAgentChipVariables({
        amber: palette.yellow,
        cyan: palette.blue,
        default: palette.yellow,
        fuchsia: palette.mauve,
        orange: palette.peach,
        teal: palette.teal,
        violet: palette.mauve,
      }),
      "--app-chat-chip-bg": formatRgba(parseHexColor(palette.surface0), chipBgAlpha),
      "--app-chat-chip-border": formatRgba(parseHexColor(palette.surface1), chipBorderAlpha),
      "--app-chat-code-bg": palette.mantle,
      "--app-chat-code-border": palette.surface0,
      "--app-chat-code-copy-bg": formatRgba(parseHexColor(palette.surface0), 0.88),
      "--app-chat-code-copy-fg": palette.blue,
      "--app-chat-command": palette.mauve,
      "--app-chat-error": palette.red,
      "--app-chat-error-bg": formatRgba(
        parseHexColor(palette.red),
        variant === "dark" ? 0.12 : 0.08,
      ),
      "--app-chat-file": palette.blue,
      "--app-chat-heading": palette.mauve,
      "--app-chat-link": palette.blue,
      "--app-chat-success": palette.green,
      "--app-chat-success-bg": formatRgba(
        parseHexColor(palette.green),
        variant === "dark" ? 0.12 : 0.08,
      ),
      "--app-chat-token": palette.teal,
      "--app-chat-warning": palette.peach,
      "--app-chat-warning-bg": formatRgba(
        parseHexColor(palette.peach),
        variant === "dark" ? 0.12 : 0.08,
      ),
      "--app-assistant-message-bg": formatRgba(
        parseHexColor(palette.base),
        variant === "dark" ? 0.42 : 0.58,
      ),
      "--app-assistant-message-border": formatRgba(surface1, variant === "dark" ? 0.36 : 0.48),
      "--app-assistant-message-accent": formatRgba(accent, variant === "dark" ? 0.42 : 0.34),
      "--app-user-message-bg": formatRgba(
        parseHexColor(palette.surface0),
        variant === "dark" ? 0.76 : 0.72,
      ),
      "--app-user-message-bg-muted": formatRgba(
        parseHexColor(palette.base),
        variant === "dark" ? 0.82 : 0.9,
      ),
      "--app-user-message-border": formatRgba(accent, variant === "dark" ? 0.28 : 0.22),
      "--app-user-message-accent": pack.theme.accent,
      "--app-user-message-shadow":
        variant === "dark" ? `0 10px 28px ${formatRgba(accent, 0.12)}` : "none",
      "--app-diff-card-bg": palette.mantle,
      "--app-diff-card-header-bg": palette.surface0,
      "--app-diff-title": palette.blue,
      "--app-plugin-glyph-border": formatRgba(surface1, variant === "dark" ? 0.55 : 0.46),
      "--app-plugin-glyph-gradient-from": palette.mauve,
      "--app-plugin-glyph-gradient-to": palette.blue,
      "--app-plugin-glyph-text": pack.theme.ink,
      "--app-scroll-button-bg": palette.surface0,
      "--app-scroll-button-border": palette.surface1,
      "--app-scroll-button-fg": palette.blue,
      "--app-scroll-button-hover-bg": palette.surface1,
      "--app-scroll-button-hover-fg": palette.mauve,
      "--app-scrollbar-thumb": formatRgba(surface1, variant === "dark" ? 0.72 : 0.64),
      "--app-scrollbar-thumb-hover": formatRgba(surface1, variant === "dark" ? 0.92 : 0.82),
      "--app-runtime-chip-bg": formatRgba(
        parseHexColor(palette.surface0),
        variant === "dark" ? 0.72 : 0.64,
      ),
      "--app-runtime-chip-border": formatRgba(surface1, variant === "dark" ? 0.68 : 0.52),
      "--app-chrome-control-bg": palette.surface0,
      "--app-chrome-control-border": palette.surface1,
      "--app-chrome-control-fg": pack.theme.ink,
      "--app-chrome-control-hover-bg": palette.surface1,
      "--app-chrome-control-hover-fg": pack.theme.ink,
      "--app-chrome-control-active-bg": formatRgba(accent, variant === "dark" ? 0.14 : 0.12),
      "--app-control-icon-bg": "transparent",
      "--app-control-icon-border": formatRgba(surface1, variant === "dark" ? 0.55 : 0.46),
      "--app-control-icon-fg": formatRgba(parseHexColor(pack.theme.ink), 0.62),
      "--app-control-icon-hover-bg": palette.surface0,
      "--app-control-icon-hover-fg": formatRgba(parseHexColor(pack.theme.ink), 0.86),
      "--app-state-focus": palette.blue,
      "--app-state-hover": palette.surface0,
      "--app-state-selected": formatRgba(accent, variant === "dark" ? 0.14 : 0.12),
      "--app-state-selected-border": pack.theme.accent,
      "--app-metadata-fg": formatRgba(parseHexColor(pack.theme.ink), 0.86),
      "--app-metadata-muted-fg": formatRgba(parseHexColor(pack.theme.ink), 0.62),
      "--app-text-metadata": formatRgba(parseHexColor(pack.theme.ink), 0.62),
      "--app-text-metadata-strong": formatRgba(parseHexColor(pack.theme.ink), 0.86),
      "--app-status-error-bg": formatRgba(diffRemoved, variant === "dark" ? 0.14 : 0.1),
      "--app-status-error-border": formatRgba(diffRemoved, variant === "dark" ? 0.42 : 0.32),
      ...buildStatusVariables(
        {
          error: palette.red,
          input: palette.teal,
          muted: palette.surface1,
          plan: palette.mauve,
          success: palette.green,
          warning: palette.peach,
          working: palette.blue,
        },
        variant,
        { mutedBackground: palette.surface0 },
      ),
      "--app-status-warning-bg": formatRgba(
        parseHexColor(palette.peach),
        variant === "dark" ? 0.13 : 0.1,
      ),
      "--app-status-warning-border": formatRgba(
        parseHexColor(palette.peach),
        variant === "dark" ? 0.38 : 0.28,
      ),
      "--app-surface-canvas": variant === "dark" ? palette.crust : palette.base,
      "--app-surface-card": palette.base,
      "--app-surface-card-header": palette.surface0,
      "--app-surface-composer": variant === "dark" ? palette.base : "#ffffff",
      "--app-surface-panel": variant === "dark" ? palette.mantle : "#ffffff",
      "--app-surface-sidebar": variant === "dark" ? palette.mantle : palette.mantle,
      "--app-surface-topbar": variant === "dark" ? palette.mantle : palette.mantle,
      "--app-surface-toolbar": variant === "dark" ? palette.mantle : palette.mantle,
      "--app-surface-toolbar-active": palette.surface1,
      "--app-surface-toolbar-border": palette.surface1,
      "--app-surface-toolbar-hover": palette.surface0,
      "--app-sidebar-row-active-bg": formatRgba(accent, variant === "dark" ? 0.16 : 0.12),
      "--app-sidebar-row-bg": formatRgba(
        parseHexColor(palette.base),
        variant === "dark" ? 0.42 : 0.7,
      ),
      "--app-sidebar-row-hover-bg": formatRgba(
        parseHexColor(palette.surface0),
        variant === "dark" ? 0.68 : 0.58,
      ),
      "--app-transcript-edge-fade": variant === "dark" ? palette.crust : palette.base,
      "--app-transcript-stage-bg": formatRgba(
        parseHexColor(variant === "dark" ? palette.mantle : palette.base),
        variant === "dark" ? 0.52 : 0.62,
      ),
      "--app-transcript-stage-border": formatRgba(surface1, variant === "dark" ? 0.34 : 0.42),
      ...buildSubagentAccentVariables([
        palette.red,
        palette.green,
        palette.blue,
        palette.peach,
        palette.mauve,
        palette.teal,
        palette.surface1,
        palette.yellow,
      ]),
      "--app-terminal-search-active-match-bg": palette.surface1,
      "--app-terminal-search-active-match-border": palette.yellow,
      "--app-terminal-search-active-match-overview": palette.yellow,
      "--app-terminal-search-match-bg": palette.surface1,
      "--app-terminal-search-match-border": palette.blue,
      "--app-terminal-search-match-overview": palette.peach,
      "--app-work-row-bg": formatRgba(parseHexColor(palette.base), 0.82),
      "--app-work-row-border": formatRgba(surface1, 0.52),
      "--app-work-row-hover-bg": palette.surface0,
      "--app-work-row-icon": formatRgba(parseHexColor(pack.theme.ink), 0.48),
      "--app-wordmark-prefix": APP_WORDMARK_PREFIX_BLOOD_RED,
    };
  }

  if (pack.codeThemeId === "tokyo-night" && variant === "dark") {
    return buildTokyoNightAppDepthVariables(pack);
  }

  return buildProfileAppDepthVariables(
    pack,
    variant,
    resolvedTokens,
    getThemeDepthProfile(pack.codeThemeId, variant),
  );
}

function buildTokyoNightAppDepthVariables(pack: ThemePack): Record<string, string> {
  const palette = TOKYO_NIGHT_PALETTE;
  const accent = parseHexColor(pack.theme.accent);
  const fg = parseHexColor(pack.theme.ink);
  const terminalBlack = parseHexColor(palette.terminalBlack);
  const blue7 = parseHexColor(palette.blue7);
  const red = parseHexColor(pack.theme.semanticColors.diffRemoved);
  const green = parseHexColor(pack.theme.semanticColors.diffAdded);
  const yellow = parseHexColor(palette.yellow);
  const bg = parseHexColor(palette.bg);

  return {
    "--app-accent-muted": formatRgba(accent, 0.3),
    "--app-accent-soft": formatRgba(accent, 0.14),
    "--app-accent-strong": pack.theme.accent,
    ...buildAgentChipVariables({
      amber: palette.yellow,
      cyan: palette.cyan,
      default: palette.yellow,
      fuchsia: palette.magenta,
      orange: palette.orange,
      teal: palette.teal,
      violet: palette.purple,
    }),
    "--app-chat-chip-bg": formatRgba(parseHexColor(pack.theme.semanticColors.skill), 0.18),
    "--app-chat-chip-border": formatRgba(parseHexColor(pack.theme.semanticColors.skill), 0.42),
    "--app-chat-code-bg": palette.bgDark1,
    "--app-chat-code-border": palette.terminalBlack,
    "--app-chat-code-copy-bg": palette.bgDark1,
    "--app-chat-code-copy-fg": pack.theme.accent,
    "--app-chat-command": pack.theme.semanticColors.skill,
    "--app-chat-error": pack.theme.semanticColors.diffRemoved,
    "--app-chat-error-bg": formatRgba(red, 0.12),
    "--app-chat-file": pack.theme.accent,
    "--app-chat-heading": pack.theme.semanticColors.skill,
    "--app-chat-link": pack.theme.accent,
    "--app-chat-success": pack.theme.semanticColors.diffAdded,
    "--app-chat-success-bg": formatRgba(green, 0.12),
    "--app-chat-token": palette.teal,
    "--app-chat-warning": palette.yellow,
    "--app-chat-warning-bg": formatRgba(yellow, 0.12),
    "--app-assistant-message-bg": formatRgba(parseHexColor(palette.bg), 0.42),
    "--app-assistant-message-border": formatRgba(terminalBlack, 0.36),
    "--app-assistant-message-accent": formatRgba(accent, 0.42),
    "--app-diff-card-bg": palette.bgPanel,
    "--app-user-message-bg": formatRgba(parseHexColor(palette.bgHighlight), 0.76),
    "--app-user-message-bg-muted": formatRgba(parseHexColor(palette.bg), 0.82),
    "--app-user-message-border": formatRgba(accent, 0.28),
    "--app-user-message-accent": pack.theme.accent,
    "--app-user-message-shadow": `0 10px 28px ${formatRgba(accent, 0.1)}`,
    "--app-diff-card-header-bg": palette.bgHighlight,
    "--app-diff-title": pack.theme.accent,
    "--app-plugin-glyph-border": formatRgba(terminalBlack, 0.55),
    "--app-plugin-glyph-gradient-from": pack.theme.semanticColors.skill,
    "--app-plugin-glyph-gradient-to": pack.theme.accent,
    "--app-plugin-glyph-text": pack.theme.ink,
    "--app-scroll-button-bg": palette.bgHighlight,
    "--app-scroll-button-border": palette.terminalBlack,
    "--app-scroll-button-fg": pack.theme.accent,
    "--app-scroll-button-hover-bg": palette.terminalBlack,
    "--app-scroll-button-hover-fg": palette.magenta,
    "--app-scrollbar-thumb": formatRgba(terminalBlack, 0.72),
    "--app-scrollbar-thumb-hover": formatRgba(terminalBlack, 0.92),
    "--app-runtime-chip-bg": formatRgba(parseHexColor(palette.bgHighlight), 0.72),
    "--app-runtime-chip-border": formatRgba(terminalBlack, 0.68),
    "--app-chrome-control-bg": palette.bgHighlight,
    "--app-chrome-control-border": palette.terminalBlack,
    "--app-chrome-control-fg": pack.theme.ink,
    "--app-chrome-control-hover-bg": palette.terminalBlack,
    "--app-chrome-control-hover-fg": pack.theme.ink,
    "--app-chrome-control-active-bg": formatRgba(accent, 0.18),
    "--app-control-icon-bg": "transparent",
    "--app-control-icon-border": formatRgba(terminalBlack, 0.55),
    "--app-control-icon-fg": formatRgba(fg, 0.62),
    "--app-control-icon-hover-bg": palette.bgHighlight,
    "--app-control-icon-hover-fg": formatRgba(fg, 0.88),
    "--app-state-focus": palette.borderHighlight,
    "--app-state-hover": palette.bgHighlight,
    "--app-state-selected":
      pack.theme.accent.toLowerCase() === palette.blue
        ? palette.bgVisual
        : formatRgba(accent, 0.18),
    "--app-state-selected-border": pack.theme.accent,
    "--app-metadata-fg": formatRgba(fg, 0.86),
    "--app-metadata-muted-fg": formatRgba(fg, 0.62),
    "--app-text-metadata": formatRgba(fg, 0.62),
    "--app-text-metadata-strong": formatRgba(fg, 0.86),
    "--app-status-error-bg": formatRgba(red, 0.14),
    "--app-status-error-border": formatRgba(red, 0.38),
    ...buildStatusVariables(
      {
        error: pack.theme.semanticColors.diffRemoved,
        input: palette.teal,
        muted: palette.terminalBlack,
        plan: pack.theme.semanticColors.skill,
        success: pack.theme.semanticColors.diffAdded,
        warning: palette.yellow,
        working: pack.theme.accent,
      },
      "dark",
      { mutedBackground: palette.bgHighlight },
    ),
    "--app-status-warning-bg": formatRgba(yellow, 0.13),
    "--app-status-warning-border": formatRgba(yellow, 0.38),
    ...buildSubagentAccentVariables([
      palette.red,
      pack.theme.semanticColors.diffAdded,
      pack.theme.accent,
      palette.orange,
      pack.theme.semanticColors.skill,
      palette.teal,
      palette.purple,
      palette.yellow,
    ]),
    "--app-surface-canvas": palette.bg,
    "--app-surface-card": palette.bgPanel,
    "--app-surface-card-header": palette.bgHighlight,
    "--app-surface-composer": palette.bgDark1,
    "--app-surface-panel": palette.bgPanel,
    "--app-surface-sidebar": palette.bgDark,
    "--app-surface-topbar": palette.bgDark,
    "--app-surface-toolbar": palette.bgDark,
    "--app-surface-toolbar-active": palette.bgVisual,
    "--app-surface-toolbar-border": palette.terminalBlack,
    "--app-surface-toolbar-hover": palette.bgHighlight,
    "--app-sidebar-row-active-bg": formatRgba(accent, 0.16),
    "--app-sidebar-row-bg": formatRgba(parseHexColor(palette.bg), 0.42),
    "--app-sidebar-row-hover-bg": formatRgba(parseHexColor(palette.bgHighlight), 0.68),
    "--app-transcript-edge-fade": palette.bg,
    "--app-transcript-stage-bg": formatRgba(parseHexColor(palette.bgDark1), 0.52),
    "--app-transcript-stage-border": formatRgba(terminalBlack, 0.34),
    "--app-terminal-search-active-match-bg": palette.bgVisual,
    "--app-terminal-search-active-match-border": palette.yellow,
    "--app-terminal-search-active-match-overview": palette.yellow,
    "--app-terminal-search-match-bg": palette.bgHighlight,
    "--app-terminal-search-match-border": pack.theme.accent,
    "--app-terminal-search-match-overview": palette.orange,
    "--app-work-row-bg": formatRgba(bg, 0.82),
    "--app-work-row-border": formatRgba(blue7, 0.52),
    "--app-work-row-hover-bg": palette.bgHighlight,
    "--app-work-row-icon": formatRgba(fg, 0.48),
    "--app-wordmark-prefix": APP_WORDMARK_PREFIX_BLOOD_RED,
  };
}

function getThemeDepthProfile(codeThemeId: string, variant: ThemeVariant): ThemeDepthProfile {
  return THEME_DEPTH_PROFILES[codeThemeId]?.[variant] ?? { tone: "neutral" };
}

function buildStatusVariables(
  colors: Record<AppStatusTokenKind, string>,
  variant: ThemeVariant,
  options?: { mutedBackground?: string },
): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const kind of APP_STATUS_TOKEN_KINDS) {
    const foreground = colors[kind];
    const source = kind === "muted" ? (options?.mutedBackground ?? foreground) : foreground;
    const backgroundAlpha = statusBackgroundAlpha(kind, variant);
    const borderAlpha = statusBorderAlpha(kind, variant);
    variables[`--app-status-${kind}-fg`] = foreground;
    variables[`--app-status-${kind}-dot`] = foreground;
    variables[`--app-status-${kind}-bg`] = formatRgba(parseHexColor(source), backgroundAlpha);
    variables[`--app-status-${kind}-border`] = formatRgba(parseHexColor(foreground), borderAlpha);
  }
  return variables;
}

function statusBackgroundAlpha(kind: AppStatusTokenKind, variant: ThemeVariant): number {
  if (kind === "error") return variant === "dark" ? 0.14 : 0.1;
  if (kind === "warning") return variant === "dark" ? 0.13 : 0.1;
  if (kind === "muted") return variant === "dark" ? 0.28 : 0.22;
  return variant === "dark" ? 0.12 : 0.08;
}

function statusBorderAlpha(kind: AppStatusTokenKind, variant: ThemeVariant): number {
  if (kind === "error") return variant === "dark" ? 0.42 : 0.32;
  if (kind === "warning") return variant === "dark" ? 0.38 : 0.28;
  if (kind === "muted") return variant === "dark" ? 0.34 : 0.26;
  return variant === "dark" ? 0.34 : 0.24;
}

function buildAgentChipVariables(colors: {
  amber: string;
  cyan: string;
  default: string;
  fuchsia: string;
  orange: string;
  teal: string;
  violet: string;
}): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const [name, color] of Object.entries(colors)) {
    variables[`--app-agent-chip-${name}-bg`] = formatRgba(parseHexColor(color), 0.15);
    variables[`--app-agent-chip-${name}-fg`] = color;
  }
  return variables;
}

function buildSubagentAccentVariables(colors: readonly string[]): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const [index, color] of colors.entries()) {
    variables[`--app-subagent-accent-${index}`] = color;
  }
  return variables;
}

function buildProfileAppDepthVariables(
  pack: ThemePack,
  variant: ThemeVariant,
  resolvedTokens: ResolvedThemeTokens,
  profile: ThemeDepthProfile,
): Record<string, string> {
  const accent = parseHexColor(pack.theme.accent);
  const ink = parseHexColor(pack.theme.ink);
  const officialPalette = OFFICIAL_THEME_DEPTH_PALETTES[pack.codeThemeId]?.[variant];
  const warningColor =
    officialPalette?.warning ?? profile.warning ?? (variant === "dark" ? "#f5b44a" : "#d97706");
  const warning = parseHexColor(warningColor);
  const toneLift = getThemeDepthToneLift(profile.tone, variant);
  const sidebarLift = profile.sidebarLift ?? toneLift.sidebar;
  const topbarLift = profile.topbarLift ?? toneLift.topbar;
  const headerLift = profile.headerLift ?? toneLift.header;
  const composerLift = profile.composerLift ?? toneLift.composer;
  const selectedAlpha = profile.selectedAlpha ?? toneLift.selectedAlpha;
  const canvas = officialPalette?.canvas ?? resolvedTokens.computed.surfaceUnder;
  const panel = officialPalette?.panel ?? resolvedTokens.computed.panel;
  const sidebar = officialPalette?.sidebar ?? mixHex(canvas, pack.theme.ink, sidebarLift);
  const topbar = officialPalette?.topbar ?? mixHex(canvas, pack.theme.ink, topbarLift);
  const cardHeader = officialPalette?.cardHeader ?? mixHex(panel, pack.theme.ink, headerLift);
  const composer =
    officialPalette?.composer ??
    mixHex(resolvedTokens.computed.panel, pack.theme.ink, composerLift);
  const chipColor = parseHexColor(officialPalette?.chip ?? pack.theme.accent);
  const chipBorderColor = parseHexColor(officialPalette?.chipBorder ?? pack.theme.accent);
  const appBorderColor = parseHexColor(officialPalette?.appBorder ?? pack.theme.accent);
  const chipBackground = formatRgba(chipColor, variant === "dark" ? 0.1 : 0.07);
  const chipBorder = formatRgba(chipBorderColor, variant === "dark" ? 0.24 : 0.18);
  const toolbarHover =
    officialPalette?.toolbarHover ??
    mixHex(topbar, pack.theme.accent, variant === "dark" ? 0.1 : 0.07);
  const toolbarActive =
    officialPalette?.toolbarActive ??
    mixHex(topbar, pack.theme.accent, variant === "dark" ? 0.16 : 0.1);
  const rowHover =
    officialPalette?.rowHover ?? mixHex(panel, pack.theme.accent, variant === "dark" ? 0.1 : 0.07);
  const accentBorder = formatRgba(appBorderColor, variant === "dark" ? 0.2 : 0.15);
  const chatLink = officialPalette?.chatLink ?? profile.chatLink ?? pack.theme.accent;
  const chatCommand = officialPalette?.chatCommand ?? pack.theme.accent;
  const chatToken =
    officialPalette?.chatToken ?? profile.chatToken ?? resolvedTokens.derived.textAccent;
  const chatError = officialPalette?.error ?? pack.theme.semanticColors.diffRemoved;
  const chatSuccess = officialPalette?.success ?? pack.theme.semanticColors.diffAdded;
  const chatErrorColor = parseHexColor(chatError);
  const chatSuccessColor = parseHexColor(chatSuccess);
  const codeCopyBackground =
    officialPalette?.codeCopyBackground ??
    mixHex(cardHeader, pack.theme.accent, variant === "dark" ? 0.08 : 0.05);
  const activeSearchBackground = mixHex(
    cardHeader,
    pack.theme.ink,
    variant === "dark" ? 0.12 : 0.08,
  );
  const mutedAccent = mixHex(pack.theme.accent, pack.theme.ink, variant === "dark" ? 0.22 : 0.14);

  return {
    "--app-accent-muted": formatRgba(accent, variant === "dark" ? 0.28 : 0.18),
    "--app-accent-soft": formatRgba(accent, variant === "dark" ? 0.12 : 0.08),
    "--app-accent-strong": pack.theme.accent,
    ...buildAgentChipVariables({
      amber: warningColor,
      cyan: chatToken,
      default: warningColor,
      fuchsia: chatCommand,
      orange: chatError,
      teal: chatSuccess,
      violet: chatCommand,
    }),
    "--app-chat-chip-bg": chipBackground,
    "--app-chat-chip-border": chipBorder,
    "--app-chat-code-bg": sidebar,
    "--app-chat-code-border": cardHeader,
    "--app-chat-code-copy-bg": codeCopyBackground,
    "--app-chat-code-copy-fg": chatLink,
    "--app-chat-command": chatCommand,
    "--app-chat-error": chatError,
    "--app-chat-error-bg": formatRgba(chatErrorColor, variant === "dark" ? 0.12 : 0.08),
    "--app-chat-file": chatLink,
    "--app-chat-heading": chatCommand,
    "--app-chat-link": chatLink,
    "--app-chat-success": chatSuccess,
    "--app-chat-success-bg": formatRgba(chatSuccessColor, variant === "dark" ? 0.12 : 0.08),
    "--app-chat-token": chatToken,
    "--app-chat-warning": warningColor,
    "--app-chat-warning-bg": formatRgba(warning, variant === "dark" ? 0.12 : 0.08),
    "--app-assistant-message-bg": formatRgba(
      parseHexColor(panel),
      variant === "dark" ? 0.58 : 0.78,
    ),
    "--app-assistant-message-border": accentBorder,
    "--app-assistant-message-accent": formatRgba(accent, variant === "dark" ? 0.32 : 0.24),
    "--app-user-message-bg": formatRgba(accent, variant === "dark" ? 0.14 : 0.08),
    "--app-user-message-bg-muted": formatRgba(
      parseHexColor(panel),
      variant === "dark" ? 0.82 : 0.92,
    ),
    "--app-user-message-border": formatRgba(accent, variant === "dark" ? 0.3 : 0.22),
    "--app-user-message-accent": pack.theme.accent,
    "--app-user-message-shadow":
      variant === "dark" ? `0 10px 28px ${formatRgba(accent, 0.1)}` : "none",
    "--app-diff-card-bg": sidebar,
    "--app-diff-card-header-bg": cardHeader,
    "--app-diff-title": chatLink,
    "--app-plugin-glyph-border": resolvedTokens.derived.borderHeavy,
    "--app-plugin-glyph-gradient-from": chatCommand,
    "--app-plugin-glyph-gradient-to": chatSuccess,
    "--app-plugin-glyph-text": pack.theme.ink,
    "--app-scroll-button-bg": cardHeader,
    "--app-scroll-button-border": resolvedTokens.derived.border,
    "--app-scroll-button-fg": pack.theme.accent,
    "--app-scroll-button-hover-bg": resolvedTokens.derived.buttonSecondaryBackgroundHover,
    "--app-scroll-button-hover-fg": pack.theme.accent,
    "--app-scrollbar-thumb": resolvedTokens.derived.iconTertiary,
    "--app-scrollbar-thumb-hover": resolvedTokens.derived.iconSecondary,
    "--app-runtime-chip-bg": chipBackground,
    "--app-runtime-chip-border": chipBorder,
    "--app-chrome-control-bg": resolvedTokens.derived.controlBackground,
    "--app-chrome-control-border": resolvedTokens.derived.borderLight,
    "--app-chrome-control-fg": resolvedTokens.derived.textForegroundSecondary,
    "--app-chrome-control-hover-bg": resolvedTokens.derived.buttonSecondaryBackgroundHover,
    "--app-chrome-control-hover-fg": resolvedTokens.derived.textForeground,
    "--app-chrome-control-active-bg": resolvedTokens.derived.buttonSecondaryBackgroundActive,
    "--app-control-icon-bg": "transparent",
    "--app-control-icon-border": resolvedTokens.derived.borderLight,
    "--app-control-icon-fg": resolvedTokens.derived.textForegroundTertiary,
    "--app-control-icon-hover-bg": resolvedTokens.derived.buttonSecondaryBackgroundHover,
    "--app-control-icon-hover-fg": resolvedTokens.derived.textForeground,
    "--app-state-focus": resolvedTokens.derived.borderFocus,
    "--app-state-hover": resolvedTokens.derived.buttonSecondaryBackgroundHover,
    "--app-state-selected": formatRgba(accent, selectedAlpha),
    "--app-state-selected-border": pack.theme.accent,
    "--app-metadata-fg": formatRgba(ink, variant === "dark" ? 0.86 : 0.88),
    "--app-metadata-muted-fg": formatRgba(ink, variant === "dark" ? 0.62 : 0.66),
    "--app-text-metadata": formatRgba(ink, variant === "dark" ? 0.62 : 0.66),
    "--app-text-metadata-strong": formatRgba(ink, variant === "dark" ? 0.86 : 0.88),
    "--app-status-error-bg": formatRgba(chatErrorColor, variant === "dark" ? 0.12 : 0.08),
    "--app-status-error-border": formatRgba(chatErrorColor, variant === "dark" ? 0.36 : 0.28),
    ...buildStatusVariables(
      {
        error: chatError,
        input: pack.theme.accent,
        muted: mutedAccent,
        plan: pack.theme.accent,
        success: chatSuccess,
        warning: warningColor,
        working: pack.theme.accent,
      },
      variant,
      { mutedBackground: cardHeader },
    ),
    "--app-status-warning-bg": formatRgba(warning, variant === "dark" ? 0.12 : 0.08),
    "--app-status-warning-border": formatRgba(warning, variant === "dark" ? 0.34 : 0.24),
    ...buildSubagentAccentVariables([
      chatError,
      chatSuccess,
      pack.theme.accent,
      warningColor,
      mutedAccent,
      mixHex(chatSuccess, pack.theme.ink, variant === "dark" ? 0.18 : 0.1),
      mixHex(chatError, pack.theme.ink, variant === "dark" ? 0.18 : 0.1),
      mixHex(warningColor, pack.theme.ink, variant === "dark" ? 0.18 : 0.1),
    ]),
    "--app-surface-canvas": canvas,
    "--app-surface-card": panel,
    "--app-surface-card-header": cardHeader,
    "--app-surface-composer": composer,
    "--app-surface-panel": panel,
    "--app-surface-sidebar": sidebar,
    "--app-surface-topbar": topbar,
    "--app-surface-toolbar": topbar,
    "--app-surface-toolbar-active": toolbarActive,
    "--app-surface-toolbar-border": resolvedTokens.derived.border,
    "--app-surface-toolbar-hover": toolbarHover,
    "--app-sidebar-row-active-bg": formatRgba(accent, selectedAlpha),
    "--app-sidebar-row-bg": formatRgba(parseHexColor(panel), variant === "dark" ? 0.5 : 0.72),
    "--app-sidebar-row-hover-bg": formatRgba(accent, variant === "dark" ? 0.12 : 0.09),
    "--app-transcript-edge-fade": canvas,
    "--app-transcript-stage-bg": formatRgba(
      parseHexColor(canvas),
      variant === "dark" ? 0.52 : 0.62,
    ),
    "--app-transcript-stage-border": accentBorder,
    "--app-terminal-search-active-match-bg": activeSearchBackground,
    "--app-terminal-search-active-match-border": warningColor,
    "--app-terminal-search-active-match-overview": warningColor,
    "--app-terminal-search-match-bg": cardHeader,
    "--app-terminal-search-match-border": pack.theme.accent,
    "--app-terminal-search-match-overview": chatSuccess,
    "--app-work-row-bg": formatRgba(parseHexColor(panel), variant === "dark" ? 0.82 : 0.88),
    "--app-work-row-border": accentBorder,
    "--app-work-row-hover-bg": rowHover,
    "--app-work-row-icon": formatRgba(ink, variant === "dark" ? 0.48 : 0.52),
    "--app-wordmark-prefix": APP_WORDMARK_PREFIX_BLOOD_RED,
  };
}

function getThemeDepthToneLift(
  tone: ThemeDepthTone,
  variant: ThemeVariant,
): {
  composer: number;
  header: number;
  selectedAlpha: number;
  sidebar: number;
  topbar: number;
} {
  const dark = variant === "dark";
  switch (tone) {
    case "cool":
      return dark
        ? { composer: 0.035, header: 0.11, selectedAlpha: 0.13, sidebar: 0.045, topbar: 0.035 }
        : { composer: 0.025, header: 0.065, selectedAlpha: 0.09, sidebar: 0.035, topbar: 0.028 };
    case "vivid":
      return dark
        ? { composer: 0.045, header: 0.13, selectedAlpha: 0.15, sidebar: 0.055, topbar: 0.04 }
        : { composer: 0.03, header: 0.075, selectedAlpha: 0.11, sidebar: 0.045, topbar: 0.034 };
    case "warm":
      return dark
        ? { composer: 0.04, header: 0.12, selectedAlpha: 0.14, sidebar: 0.05, topbar: 0.038 }
        : { composer: 0.028, header: 0.07, selectedAlpha: 0.1, sidebar: 0.04, topbar: 0.03 };
    case "neutral":
      return dark
        ? { composer: 0.03, header: 0.09, selectedAlpha: 0.12, sidebar: 0.04, topbar: 0.03 }
        : { composer: 0.022, header: 0.06, selectedAlpha: 0.09, sidebar: 0.032, topbar: 0.024 };
  }
}

export function buildResolvedThemeTokens(
  pack: ThemePack,
  variant: ThemeVariant,
): ResolvedThemeTokens {
  const computedTheme = buildComputedTheme(pack.theme, variant);
  const derived =
    variant === "light"
      ? buildLightDerivedTokens(computedTheme)
      : buildDarkDerivedTokens(computedTheme);
  const panel = buildPanelBackground(computedTheme);
  const codexVariables = buildCodexCssVariables(computedTheme, derived, panel);

  return {
    aliases: buildThemeTokenAliases(codexVariables),
    codexVariables,
    computed: {
      contrast: computedTheme.contrast,
      editorBackground: formatOpaqueRgb(computedTheme.editorBackground),
      panel,
      surfaceUnder: computedTheme.surfaceUnder,
    },
    derived,
  };
}

function buildComputedTheme(theme: ChromeTheme, variant: ThemeVariant) {
  const contrast = normalizeContrastStrength(theme.contrast, variant);
  const surface = parseHexColor(theme.surface);
  const ink = parseHexColor(theme.ink);

  return {
    accent: parseHexColor(theme.accent),
    contrast,
    editorBackground:
      variant === "light" ? mixRgb(surface, WHITE, 0.12) : mixRgb(surface, ink, 0.07),
    ink,
    surface,
    surfaceUnder: buildSurfaceUnder(theme, surface, ink, variant),
    theme,
    variant,
  };
}

function buildCodexCssVariables(
  theme: ReturnType<typeof buildComputedTheme>,
  derivedTokens:
    | ReturnType<typeof buildLightDerivedTokens>
    | ReturnType<typeof buildDarkDerivedTokens>,
  panelBackground: string,
) {
  return {
    "--codex-base-accent": theme.theme.accent,
    "--codex-base-contrast": String(theme.theme.contrast),
    "--codex-base-ink": theme.theme.ink,
    "--codex-base-surface": theme.theme.surface,
    "--color-accent-blue": theme.theme.accent,
    "--color-accent-purple": theme.theme.semanticColors.skill,
    "--color-background-accent": derivedTokens.accentBackground,
    "--color-background-accent-active": derivedTokens.accentBackgroundActive,
    "--color-background-accent-hover": derivedTokens.accentBackgroundHover,
    "--color-background-button-primary": derivedTokens.buttonPrimaryBackground,
    "--color-background-button-primary-active": derivedTokens.buttonPrimaryBackgroundActive,
    "--color-background-button-primary-hover": derivedTokens.buttonPrimaryBackgroundHover,
    "--color-background-button-primary-inactive": derivedTokens.buttonPrimaryBackgroundInactive,
    "--color-background-button-secondary": derivedTokens.buttonSecondaryBackground,
    "--color-background-button-secondary-active": derivedTokens.buttonSecondaryBackgroundActive,
    "--color-background-button-secondary-hover": derivedTokens.buttonSecondaryBackgroundHover,
    "--color-background-button-secondary-inactive": derivedTokens.buttonSecondaryBackgroundInactive,
    "--color-background-button-tertiary": derivedTokens.buttonTertiaryBackground,
    "--color-background-button-tertiary-active": derivedTokens.buttonTertiaryBackgroundActive,
    "--color-background-button-tertiary-hover": derivedTokens.buttonTertiaryBackgroundHover,
    "--color-background-control": derivedTokens.controlBackground,
    "--color-background-control-opaque": derivedTokens.controlBackgroundOpaque,
    "--color-background-editor-opaque": formatOpaqueRgb(theme.editorBackground),
    "--color-background-elevated-primary": derivedTokens.elevatedPrimary,
    "--color-background-elevated-primary-opaque": derivedTokens.elevatedPrimaryOpaque,
    "--color-background-elevated-secondary": derivedTokens.elevatedSecondary,
    "--color-background-elevated-secondary-opaque": derivedTokens.elevatedSecondaryOpaque,
    "--color-background-panel": panelBackground,
    "--color-background-surface": theme.theme.surface,
    "--color-background-surface-under": theme.surfaceUnder,
    "--color-border": derivedTokens.border,
    "--color-border-focus": derivedTokens.borderFocus,
    "--color-border-heavy": derivedTokens.borderHeavy,
    "--color-border-light": derivedTokens.borderLight,
    "--color-decoration-added": theme.theme.semanticColors.diffAdded,
    "--color-decoration-deleted": theme.theme.semanticColors.diffRemoved,
    "--color-editor-added": formatRgba(
      parseHexColor(theme.theme.semanticColors.diffAdded),
      theme.variant === "light" ? 0.15 : 0.23,
    ),
    "--color-editor-deleted": formatRgba(
      parseHexColor(theme.theme.semanticColors.diffRemoved),
      theme.variant === "light" ? 0.15 : 0.23,
    ),
    "--color-icon-accent": derivedTokens.iconAccent,
    "--color-icon-primary": derivedTokens.iconPrimary,
    "--color-icon-secondary": derivedTokens.iconSecondary,
    "--color-icon-tertiary": derivedTokens.iconTertiary,
    "--color-simple-scrim": derivedTokens.simpleScrim,
    "--color-text-accent": derivedTokens.textAccent,
    "--color-text-button-primary": derivedTokens.textButtonPrimary,
    "--color-text-button-secondary": derivedTokens.textButtonSecondary,
    "--color-text-button-tertiary": derivedTokens.textButtonTertiary,
    "--color-text-foreground": derivedTokens.textForeground,
    "--color-text-foreground-secondary": derivedTokens.textForegroundSecondary,
    "--color-text-foreground-tertiary": derivedTokens.textForegroundTertiary,
  };
}

function buildThemeTokenAliases(codexVariables: Record<string, string>): Record<string, string> {
  const readCodexVariable = (name: string) => getRequiredVariable(codexVariables, name);

  return {
    "--color-token-badge-background": readCodexVariable("--color-background-accent"),
    "--color-token-badge-foreground": readCodexVariable("--color-text-foreground"),
    "--color-token-border": readCodexVariable("--color-border"),
    "--color-token-border-default": readCodexVariable("--color-border"),
    "--color-token-border-heavy": readCodexVariable("--color-border-heavy"),
    "--color-token-border-light": readCodexVariable("--color-border-light"),
    "--color-token-button-background": readCodexVariable("--color-background-button-primary"),
    "--color-token-button-border": readCodexVariable("--color-border"),
    "--color-token-button-foreground": readCodexVariable("--color-text-button-primary"),
    "--color-token-button-secondary-hover-background": readCodexVariable(
      "--color-background-button-secondary-hover",
    ),
    "--color-token-checkbox-active-background": readCodexVariable(
      "--color-background-accent-hover",
    ),
    "--color-token-checkbox-active-foreground": readCodexVariable("--color-text-foreground"),
    "--color-token-description-foreground": readCodexVariable("--color-text-foreground-secondary"),
    "--color-token-disabled-foreground": readCodexVariable("--color-text-foreground-tertiary"),
    "--color-token-dropdown-background": readCodexVariable(
      "--color-background-elevated-primary-opaque",
    ),
    "--color-token-focus-border": readCodexVariable("--color-border-focus"),
    "--color-token-foreground": readCodexVariable("--color-text-foreground"),
    "--color-token-input-background": readCodexVariable("--color-background-control"),
    "--color-token-input-border": readCodexVariable("--color-border"),
    "--color-token-input-foreground": readCodexVariable("--color-text-foreground"),
    "--color-token-input-placeholder-foreground": readCodexVariable(
      "--color-text-foreground-tertiary",
    ),
    "--color-token-link": readCodexVariable("--color-text-accent"),
    "--color-token-list-active-selection-background": readCodexVariable(
      "--color-background-button-secondary",
    ),
    "--color-token-list-active-selection-foreground": readCodexVariable("--color-text-foreground"),
    "--color-token-list-active-selection-icon-foreground":
      readCodexVariable("--color-icon-primary"),
    "--color-token-list-hover-background": readCodexVariable("--color-background-button-secondary"),
    "--color-token-main-surface-primary": readCodexVariable("--color-background-surface-under"),
    "--color-token-menu-background": readCodexVariable("--color-background-elevated-primary"),
    "--color-token-menu-border": readCodexVariable("--color-border"),
    "--color-token-progress-bar-background": readCodexVariable("--color-background-accent"),
    "--color-token-radio-active-foreground": readCodexVariable("--color-icon-accent"),
    "--color-token-scrollbar-slider-active-background": readCodexVariable("--color-border-heavy"),
    "--color-token-scrollbar-slider-background": readCodexVariable("--color-border-light"),
    "--color-token-scrollbar-slider-hover-background": readCodexVariable("--color-border"),
    "--color-token-side-bar-background": readCodexVariable("--color-background-surface-under"),
    "--color-token-text-code-block-background": readCodexVariable(
      "--color-background-elevated-secondary-opaque",
    ),
    "--color-token-text-link-active-foreground": readCodexVariable("--color-text-accent"),
    "--color-token-text-link-foreground": readCodexVariable("--color-text-accent"),
    "--color-token-text-primary": readCodexVariable("--color-text-foreground"),
    "--color-token-text-secondary": readCodexVariable("--color-text-foreground-secondary"),
    "--color-token-text-tertiary": readCodexVariable("--color-text-foreground-tertiary"),
    "--color-token-toolbar-hover-background": readCodexVariable(
      "--color-background-button-tertiary-hover",
    ),
    "--color-token-editor-background": readCodexVariable("--color-background-editor-opaque"),
    "--color-token-editor-foreground": readCodexVariable("--color-text-foreground"),
  };
}

function getRequiredVariable(variables: Record<string, string>, name: string): string {
  const value = variables[name];
  if (typeof value !== "string") {
    throw new Error(`Missing required theme variable: ${name}`);
  }
  return value;
}

function buildLightDerivedTokens(theme: ReturnType<typeof buildComputedTheme>) {
  const controlBase = mixRgb(theme.surface, theme.ink, 0.06 + theme.contrast * 0.05);
  const focusBase = mixRgb(theme.accent, WHITE, 0.3 + theme.contrast * 0.15);
  const elevatedPrimaryBase = mixRgb(theme.surface, theme.ink, 0.08 + theme.contrast * 0.08);

  return {
    accentBackground: mixHex("#000000", theme.theme.accent, 0.2 + theme.contrast * 0.08),
    accentBackgroundActive: mixHex("#000000", theme.theme.accent, 0.22 + theme.contrast * 0.12),
    accentBackgroundHover: mixHex("#000000", theme.theme.accent, 0.21 + theme.contrast * 0.1),
    border: formatRgba(theme.ink, 0.06 + theme.contrast * 0.04),
    borderFocus: formatRgba(focusBase, 0.7 + theme.contrast * 0.1),
    borderHeavy: formatRgba(theme.ink, 0.12 + theme.contrast * 0.06),
    borderLight: formatRgba(theme.ink, 0.03 + theme.contrast * 0.02),
    buttonPrimaryBackground: theme.theme.ink,
    buttonPrimaryBackgroundActive: formatRgba(theme.ink, 0.07 + theme.contrast * 0.05),
    buttonPrimaryBackgroundHover: formatRgba(theme.ink, 0.04 + theme.contrast * 0.03),
    buttonPrimaryBackgroundInactive: formatRgba(theme.ink, 0.02 + theme.contrast * 0.02),
    buttonSecondaryBackground: formatRgba(theme.ink, 0.04 + theme.contrast * 0.02),
    buttonSecondaryBackgroundActive: formatRgba(theme.ink, 0.14 + theme.contrast * 0.06),
    buttonSecondaryBackgroundHover: formatRgba(theme.ink, 0.1 + theme.contrast * 0.05),
    buttonSecondaryBackgroundInactive: formatRgba(theme.ink, 0.02 + theme.contrast * 0.03),
    buttonTertiaryBackground: formatRgba(theme.ink, 0.02 + theme.contrast * 0.015),
    buttonTertiaryBackgroundActive: formatRgba(theme.ink, 0.07 + theme.contrast * 0.05),
    buttonTertiaryBackgroundHover: formatRgba(theme.ink, 0.05 + theme.contrast * 0.03),
    controlBackground: formatRgba(controlBase, 0.96),
    controlBackgroundOpaque: formatOpaqueRgb(controlBase),
    elevatedPrimary: formatRgba(elevatedPrimaryBase, 0.96),
    elevatedPrimaryOpaque: formatOpaqueRgb(elevatedPrimaryBase),
    elevatedSecondary: formatRgba(theme.ink, 0.02 + theme.contrast * 0.02),
    elevatedSecondaryOpaque: mixHex(
      theme.theme.surface,
      theme.theme.ink,
      0.04 + theme.contrast * 0.05,
    ),
    iconAccent: theme.theme.accent,
    iconPrimary: formatRgba(theme.ink, 0.82 + theme.contrast * 0.14),
    iconSecondary: formatRgba(theme.ink, 0.65 + theme.contrast * 0.1),
    iconTertiary: formatRgba(theme.ink, 0.45 + theme.contrast * 0.1),
    simpleScrim: formatRgba(theme.ink, 0.08 + theme.contrast * 0.04),
    // Keep light-mode affordances on the real accent so links and file labels
    // match the active theme color instead of a softened focus-only variant.
    textAccent: theme.theme.accent,
    textButtonPrimary: theme.theme.surface,
    textButtonSecondary: mixHex(theme.theme.ink, theme.theme.surface, 0.7 + theme.contrast * 0.1),
    textButtonTertiary: formatRgba(theme.ink, 0.45 + theme.contrast * 0.1),
    textForeground: theme.theme.ink,
    textForegroundSecondary: formatRgba(theme.ink, 0.65 + theme.contrast * 0.1),
    textForegroundTertiary: formatRgba(theme.ink, 0.42 + theme.contrast * 0.13),
  };
}

function buildDarkDerivedTokens(theme: ReturnType<typeof buildComputedTheme>) {
  const controlBase = mixRgb(theme.surface, WHITE, 0.09 + theme.contrast * 0.04);
  const elevatedSecondaryBase = mixRgb(theme.surface, WHITE, 0.08 + theme.contrast * 0.08);
  const elevatedPrimaryBase = mixRgb(theme.surface, WHITE, 0.16 + theme.contrast * 0.12);

  return {
    accentBackground: mixHex(theme.theme.surface, theme.theme.accent, 0.11 + theme.contrast * 0.04),
    accentBackgroundActive: mixHex(
      theme.theme.surface,
      theme.theme.accent,
      0.13 + theme.contrast * 0.05,
    ),
    accentBackgroundHover: mixHex(
      theme.theme.surface,
      theme.theme.accent,
      0.12 + theme.contrast * 0.045,
    ),
    border: formatRgba(theme.ink, 0.06 + theme.contrast * 0.04),
    borderFocus: theme.theme.accent,
    borderHeavy: formatRgba(theme.ink, 0.09 + theme.contrast * 0.06),
    borderLight: formatRgba(theme.ink, 0.04 + theme.contrast * 0.02),
    buttonPrimaryBackground: theme.theme.ink,
    buttonPrimaryBackgroundActive: formatRgba(theme.ink, 0.1 + theme.contrast * 0.12),
    buttonPrimaryBackgroundHover: formatRgba(theme.ink, 0.05 + theme.contrast * 0.06),
    buttonPrimaryBackgroundInactive: formatRgba(theme.ink, 0.18 + theme.contrast * 0.14),
    buttonSecondaryBackground: formatRgba(theme.ink, 0.04 + theme.contrast * 0.02),
    buttonSecondaryBackgroundActive: formatRgba(theme.ink, 0.1 + theme.contrast * 0.06),
    buttonSecondaryBackgroundHover: formatRgba(theme.ink, 0.08 + theme.contrast * 0.05),
    buttonSecondaryBackgroundInactive: formatRgba(theme.ink, 0.01 + theme.contrast * 0.02),
    buttonTertiaryBackground: formatRgba(theme.ink, 0),
    buttonTertiaryBackgroundActive: formatRgba(theme.ink, 0.16 + theme.contrast * 0.08),
    buttonTertiaryBackgroundHover: formatRgba(theme.ink, 0.08 + theme.contrast * 0.04),
    controlBackground: formatRgba(controlBase, 0.96),
    controlBackgroundOpaque: formatOpaqueRgb(controlBase),
    elevatedPrimary: formatRgba(elevatedPrimaryBase, 0.96),
    elevatedPrimaryOpaque: formatOpaqueRgb(elevatedPrimaryBase),
    elevatedSecondary: formatRgba(elevatedSecondaryBase, 0.96),
    elevatedSecondaryOpaque: formatOpaqueRgb(elevatedSecondaryBase),
    iconAccent: theme.theme.accent,
    iconPrimary: theme.theme.ink,
    iconSecondary: formatRgba(theme.ink, 0.65 + theme.contrast * 0.1),
    iconTertiary: formatRgba(theme.ink, 0.45 + theme.contrast * 0.1),
    simpleScrim: formatRgba(BLACK, 0.08 + theme.contrast * 0.04),
    textAccent: theme.theme.accent,
    textButtonPrimary: theme.theme.surface,
    textButtonSecondary: theme.theme.ink,
    textButtonTertiary: formatRgba(theme.ink, 0.45 + theme.contrast * 0.1),
    textForeground: theme.theme.ink,
    textForegroundSecondary: formatRgba(theme.ink, 0.65 + theme.contrast * 0.1),
    textForegroundTertiary: formatRgba(theme.ink, 0.45 + theme.contrast * 0.1),
  };
}

function buildSurfaceUnder(
  theme: ChromeTheme,
  surface: RgbColor,
  ink: RgbColor,
  variant: ThemeVariant,
): string {
  const baseline = DEFAULT_CHROME_THEME_BY_VARIANT[variant].contrast;
  const mixAmount =
    SURFACE_UNDER_BASE_ALPHA[variant] +
    (theme.contrast - baseline) * SURFACE_UNDER_CONTRAST_STEP[variant];
  return variant === "light"
    ? mixHex(formatHex(surface), formatHex(ink), mixAmount)
    : mixHex(formatHex(surface), "#000000", mixAmount);
}

function buildPanelBackground(theme: ReturnType<typeof buildComputedTheme>): string {
  const anchor = theme.variant === "light" ? WHITE : theme.ink;
  return mixHex(
    theme.theme.surface,
    formatHex(anchor),
    PANEL_BASE_ALPHA[theme.variant] + theme.contrast * PANEL_CONTRAST_STEP[theme.variant],
  );
}

function buildComposerFocusBorder(
  pack: ThemePack,
  variant: ThemeVariant,
  panelBackground: string,
): string {
  const panel = parseHexColor(panelBackground);
  const anchor = variant === "dark" ? WHITE : parseHexColor(pack.theme.ink);
  const contrast = normalizeContrastStrength(pack.theme.contrast, variant);
  const mixAmount = variant === "dark" ? 0.12 + contrast * 0.06 : 0.1 + contrast * 0.05;
  return mixHex(formatHex(panel), formatHex(anchor), mixAmount);
}

function normalizeContrastStrength(value: number, variant: ThemeVariant): number {
  const baseline = DEFAULT_CHROME_THEME_BY_VARIANT[variant].contrast;
  const baselineRatio = baseline / 100;
  const curvedValue = value / 100 + ((value - baseline) / 60) * CONTRAST_CURVE_BELOW_BASELINE;

  if (value <= baseline) {
    return curvedValue;
  }

  return baselineRatio + (curvedValue - baselineRatio) * CONTRAST_CURVE_ABOVE_BASELINE;
}

// ─── Parsing helpers ──────────────────────────────────────────────────────

function parseThemeSharePayload(value: unknown): ThemeSharePayload {
  if (!isRecord(value)) {
    throw new Error("Theme share payload must be an object.");
  }

  const codeThemeId = normalizeRequiredString(value.codeThemeId, "Theme share codeThemeId");
  const variant = value.variant;
  if (!isThemeVariant(variant)) {
    throw new Error("Theme share variant must be either light or dark.");
  }

  const theme = parseStrictChromeTheme(value.theme);
  return {
    codeThemeId: codeThemeId.toLowerCase(),
    theme,
    variant,
  };
}

function parseStrictChromeTheme(value: unknown): ChromeTheme {
  if (!isRecord(value)) {
    throw new Error("Theme share theme must be an object.");
  }

  return {
    accent: parseRequiredHexColor(value.accent, "Theme accent"),
    contrast: parseRequiredContrast(value.contrast),
    fonts: parseStrictThemeFonts(value.fonts),
    ink: parseRequiredHexColor(value.ink, "Theme ink"),
    opaqueWindows: parseRequiredBoolean(value.opaqueWindows, "Theme opaqueWindows"),
    semanticColors: parseStrictSemanticColors(value.semanticColors),
    surface: parseRequiredHexColor(value.surface, "Theme surface"),
  };
}

function parseStrictThemeFonts(value: unknown): ThemeFonts {
  if (!isRecord(value)) {
    throw new Error("Theme fonts must be an object.");
  }

  return {
    code: parseNullableString(value.code, "Theme code font"),
    ui: parseNullableString(value.ui, "Theme UI font"),
  };
}

function parseStrictSemanticColors(value: unknown): ThemeSemanticColors {
  if (!isRecord(value)) {
    throw new Error("Theme semanticColors must be an object.");
  }

  return {
    diffAdded: parseRequiredHexColor(value.diffAdded, "Theme diffAdded"),
    diffRemoved: parseRequiredHexColor(value.diffRemoved, "Theme diffRemoved"),
    skill: parseRequiredHexColor(value.skill, "Theme skill"),
  };
}

function parseRequiredContrast(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error("Theme contrast must be an integer between 0 and 100.");
  }
  return value;
}

function parseRequiredBoolean(value: unknown, label: string): boolean {
  if (value !== true && value !== false) {
    throw new Error(`${label} must be a boolean.`);
  }
  return value;
}

function parseNullableString(value: unknown, label: string): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string or null.`);
  }
  return normalizeFontSelection(value);
}

function normalizeRequiredString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    throw new Error(`${label} must not be empty.`);
  }
  return trimmedValue;
}

function parseRequiredHexColor(value: unknown, label: string): string {
  const normalizedColor = normalizeHexColor(value);
  if (!normalizedColor) {
    throw new Error(`${label} must be a 6-digit hex color.`);
  }
  return normalizedColor;
}

function normalizeStoredContrast(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(0, Math.round(value)))
    : fallback;
}

function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmedValue = value.trim();
  return HEX_COLOR_RE.test(trimmedValue) ? trimmedValue.toLowerCase() : null;
}

function normalizeFontSelection(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ─── Color math ───────────────────────────────────────────────────────────

function parseHexColor(value: string): RgbColor {
  const hexValue = value.slice(1);
  return {
    blue: Number.parseInt(hexValue.slice(4, 6), 16),
    green: Number.parseInt(hexValue.slice(2, 4), 16),
    red: Number.parseInt(hexValue.slice(0, 2), 16),
  };
}

function mixHex(from: string, to: string, amount: number): string {
  return formatHex(mixRgb(parseHexColor(from), parseHexColor(to), amount));
}

function mixRgb(from: RgbColor, to: RgbColor, amount: number): RgbColor {
  const clampedAmount = Math.min(1, Math.max(0, amount));
  return {
    blue: mixChannel(from.blue, to.blue, clampedAmount),
    green: mixChannel(from.green, to.green, clampedAmount),
    red: mixChannel(from.red, to.red, clampedAmount),
  };
}

function mixChannel(from: number, to: number, amount: number): number {
  return Math.round(from + (to - from) * amount);
}

function formatHex(color: RgbColor): string {
  return `#${formatHexChannel(color.red)}${formatHexChannel(color.green)}${formatHexChannel(color.blue)}`;
}

function formatOpaqueRgb(color: RgbColor): string {
  return `rgb(${color.red}, ${color.green}, ${color.blue})`;
}

function formatRgba(color: RgbColor, opacity: number): string {
  return `rgba(${color.red}, ${color.green}, ${color.blue}, ${formatAlpha(opacity)})`;
}

function formatHexChannel(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function formatAlpha(value: number): string {
  return Math.min(1, Math.max(0, value)).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
