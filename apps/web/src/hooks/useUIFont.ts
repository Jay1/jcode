// FILE: useUIFont.ts
// Purpose: Applies the optional UI-font override without stomping the active theme's base font.
// Layer: Web appearance override hook
// Exports: useUIFont

import { useEffect } from "react";
import { useAppSettings } from "../appSettings";
import { applyUIFontOverride } from "./appearanceFontOverrides";

export function useUIFont() {
  const { settings } = useAppSettings();
  const uiFontFamily = settings.uiFontFamily;

  useEffect(() => {
    applyUIFontOverride(document.documentElement.style, uiFontFamily);
  }, [uiFontFamily]);
}
