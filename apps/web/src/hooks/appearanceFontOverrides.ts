// FILE: appearanceFontOverrides.ts
// Purpose: Centralizes Appearance font setting CSS variable writes.
// Layer: Web appearance override helpers
// Exports: font override variable names and DOM style writers

import { normalizeFontFamilyCssValue } from "../lib/fontFamily";

export const UI_FONT_OVERRIDE_VARIABLE = "--app-font-ui-override";
export const CHAT_CODE_FONT_OVERRIDE_VARIABLE = "--app-font-chat-code-override";

export type FontOverrideStyle = {
  setProperty(propertyName: string, value: string): void;
  removeProperty(propertyName: string): void;
};

export function applyFontFamilyOverride(
  style: FontOverrideStyle,
  variableName: string,
  fontFamily: string,
) {
  const cssFontFamily = normalizeFontFamilyCssValue(fontFamily);
  if (cssFontFamily) {
    style.setProperty(variableName, cssFontFamily);
  } else {
    style.removeProperty(variableName);
  }
}

export function applyUIFontOverride(style: FontOverrideStyle, uiFontFamily: string) {
  applyFontFamilyOverride(style, UI_FONT_OVERRIDE_VARIABLE, uiFontFamily);
}

export function applyChatCodeFontOverride(style: FontOverrideStyle, chatCodeFontFamily: string) {
  applyFontFamilyOverride(style, CHAT_CODE_FONT_OVERRIDE_VARIABLE, chatCodeFontFamily);
}
