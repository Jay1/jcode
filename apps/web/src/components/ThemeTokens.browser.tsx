import "../index.css";

import { describe, expect, it } from "vitest";

import { CODE_THEME_OPTIONS, buildThemeCssVariables, getCodeThemeSeed } from "../theme/theme.logic";
import { APP_AFFORDANCE_TOKEN_PAIRS } from "../theme/themeTokenTestFixtures";

describe("theme app-depth browser tokens", () => {
  it("resolves bundled app-depth affordances independently from generic Codex aliases", () => {
    const host = document.createElement("section");
    document.body.append(host);

    try {
      for (const option of CODE_THEME_OPTIONS) {
        for (const variant of option.variants) {
          const { variables } = buildThemeCssVariables(
            {
              codeThemeId: option.id,
              theme: getCodeThemeSeed(option.id, variant),
            },
            variant,
          );
          applyCssVariables(host, variables);

          for (const [appToken, codexToken] of APP_AFFORDANCE_TOKEN_PAIRS) {
            expect(
              readToken(host, appToken),
              `${option.id}/${variant}/${appToken} should not resolve to ${codexToken}`,
            ).not.toBe(readToken(host, codexToken));
          }
        }
      }
    } finally {
      host.remove();
    }
  });

  it("renders representative theme surfaces with visible hierarchy and accents", () => {
    const fixture = document.createElement("section");
    const canvas = document.createElement("div");
    const sidebar = document.createElement("div");
    const toolbarHover = document.createElement("div");
    const chip = document.createElement("div");
    const workRow = document.createElement("div");

    canvas.style.background = "var(--app-surface-canvas)";
    sidebar.style.background = "var(--app-surface-sidebar)";
    toolbarHover.style.background = "var(--app-surface-toolbar-hover)";
    chip.style.background = "var(--app-chat-chip-bg)";
    workRow.style.borderColor = "var(--app-work-row-border)";

    fixture.append(canvas, sidebar, toolbarHover, chip, workRow);
    document.body.append(fixture);

    try {
      const representatives = [
        ["catppuccin", "dark"],
        ["dracula", "dark"],
        ["github", "dark"],
        ["gruvbox", "dark"],
        ["nord", "dark"],
        ["raycast", "dark"],
        ["raycast", "light"],
        ["rose-pine", "dark"],
        ["sentry", "dark"],
        ["tokyo-night", "dark"],
        ["vercel", "light"],
        ["matrix", "dark"],
      ] as const;

      for (const [codeThemeId, variant] of representatives) {
        const { variables } = buildThemeCssVariables(
          {
            codeThemeId,
            theme: getCodeThemeSeed(codeThemeId, variant),
          },
          variant,
        );
        applyCssVariables(fixture, variables);

        const computedCanvas = getComputedStyle(canvas).backgroundColor;
        const computedSidebar = getComputedStyle(sidebar).backgroundColor;
        const computedToolbarHover = getComputedStyle(toolbarHover).backgroundColor;
        const computedChip = getComputedStyle(chip).backgroundColor;
        const computedWorkRowBorder = getComputedStyle(workRow).borderColor;

        expect(computedSidebar, `${codeThemeId}/${variant}/sidebar`).not.toBe(computedCanvas);
        expect(computedToolbarHover, `${codeThemeId}/${variant}/toolbar hover`).not.toBe(
          computedCanvas,
        );
        expect(computedChip, `${codeThemeId}/${variant}/chat chip`).toContain("rgba");
        expect(computedWorkRowBorder, `${codeThemeId}/${variant}/work row border`).toContain("rgb");
      }
    } finally {
      fixture.remove();
    }
  });

  it("renders requested hand-authored official palette roles as computed CSS", () => {
    const fixture = document.createElement("section");
    const canvas = document.createElement("div");
    const sidebar = document.createElement("div");
    const toolbarHover = document.createElement("div");
    const token = document.createElement("span");
    const warning = document.createElement("span");

    canvas.style.background = "var(--app-surface-canvas)";
    sidebar.style.background = "var(--app-surface-sidebar)";
    toolbarHover.style.background = "var(--app-surface-toolbar-hover)";
    token.style.color = "var(--app-chat-token)";
    warning.style.color = "var(--app-chat-warning)";

    fixture.append(canvas, sidebar, toolbarHover, token, warning);
    document.body.append(fixture);

    try {
      const expectations = [
        ["dracula", "dark", "#21222c", "#282a36", "#44475a", "#8be9fd", "#f1fa8c"],
        ["nord", "dark", "#2e3440", "#3b4252", "#434c5e", "#8fbcbb", "#ebcb8b"],
        ["raycast", "dark", "#07080a", "#101111", "#252829", "#55b3ff", "#ffbc33"],
        ["raycast", "light", "#ffffff", "#f7f7f7", "#ffe7e7", "#55b3ff", "#ffbc33"],
        ["sentry", "dark", "#1B1821", "#24202B", "#393442", "#3DDC97", "#FFB938"],
        ["gruvbox", "dark", "#1d2021", "#282828", "#504945", "#689d6a", "#fabd2f"],
        ["gruvbox", "light", "#fbf1c7", "#f9f5d7", "#d5c4a1", "#689d6a", "#b57614"],
        ["tokyo-night", "dark", "#1a1b26", "#16161e", "#202330", "#73daca", "#e0af68"],
      ] as const;

      for (const [
        codeThemeId,
        variant,
        expectedCanvas,
        expectedSidebar,
        expectedHover,
        expectedToken,
        expectedWarning,
      ] of expectations) {
        const { variables } = buildThemeCssVariables(
          {
            codeThemeId,
            theme: getCodeThemeSeed(codeThemeId, variant),
          },
          variant,
        );
        applyCssVariables(fixture, variables);

        expect(getComputedStyle(canvas).backgroundColor, `${codeThemeId}/${variant}/canvas`).toBe(
          hexToRgb(expectedCanvas),
        );
        expect(getComputedStyle(sidebar).backgroundColor, `${codeThemeId}/${variant}/sidebar`).toBe(
          hexToRgb(expectedSidebar),
        );
        expect(
          getComputedStyle(toolbarHover).backgroundColor,
          `${codeThemeId}/${variant}/hover`,
        ).toBe(hexToRgb(expectedHover));
        expect(getComputedStyle(token).color, `${codeThemeId}/${variant}/token`).toBe(
          hexToRgb(expectedToken),
        );
        expect(getComputedStyle(warning).color, `${codeThemeId}/${variant}/warning`).toBe(
          hexToRgb(expectedWarning),
        );
      }
    } finally {
      fixture.remove();
    }
  });
});

function applyCssVariables(element: HTMLElement, variables: Record<string, string>): void {
  element.removeAttribute("style");
  for (const [name, value] of Object.entries(variables)) {
    element.style.setProperty(name, value);
  }
}

function readToken(element: HTMLElement, tokenName: string): string {
  return getComputedStyle(element).getPropertyValue(tokenName).trim();
}

function hexToRgb(hex: string): string {
  const normalized = hex.slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgb(${red}, ${green}, ${blue})`;
}
