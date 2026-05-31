// FILE: useChatCodeFont.ts
// Purpose: Applies the optional chat-only code font family CSS variable from app settings.
// Layer: Web chat presentation hook
// Exports: useChatCodeFont

import { useEffect } from "react";
import { useAppSettings } from "../appSettings";
import { applyChatCodeFontOverride } from "./appearanceFontOverrides";

export function useChatCodeFont() {
  const { settings } = useAppSettings();
  const chatCodeFontFamily = settings.chatCodeFontFamily;

  useEffect(() => {
    applyChatCodeFontOverride(document.documentElement.style, chatCodeFontFamily);
  }, [chatCodeFontFamily]);
}
