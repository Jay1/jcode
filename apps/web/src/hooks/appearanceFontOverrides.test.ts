import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { getChatTranscriptTextStyle } from "../components/chat/chatTypography";
import {
  applyChatCodeFontOverride,
  applyUIFontOverride,
  CHAT_CODE_FONT_OVERRIDE_VARIABLE,
  UI_FONT_OVERRIDE_VARIABLE,
  type FontOverrideStyle,
} from "./appearanceFontOverrides";

function createStyleSpy(): FontOverrideStyle & {
  removeProperty: ReturnType<typeof vi.fn>;
  setProperty: ReturnType<typeof vi.fn>;
} {
  return {
    removeProperty: vi.fn((_propertyName: string) => {}),
    setProperty: vi.fn((_propertyName: string, _value: string) => {}),
  };
}

describe("Appearance font override contracts", () => {
  it("writes and clears the UI font override variable", () => {
    const style = createStyleSpy();

    applyUIFontOverride(style, "IBM Plex Sans");
    applyUIFontOverride(style, "  ");

    expect(style.setProperty).toHaveBeenCalledWith(UI_FONT_OVERRIDE_VARIABLE, '"IBM Plex Sans"');
    expect(style.removeProperty).toHaveBeenCalledWith(UI_FONT_OVERRIDE_VARIABLE);
  });

  it("writes and clears the chat code font override variable", () => {
    const style = createStyleSpy();

    applyChatCodeFontOverride(style, "monospace");
    applyChatCodeFontOverride(style, "");

    expect(style.setProperty).toHaveBeenCalledWith(CHAT_CODE_FONT_OVERRIDE_VARIABLE, "monospace");
    expect(style.removeProperty).toHaveBeenCalledWith(CHAT_CODE_FONT_OVERRIDE_VARIABLE);
  });

  it("keeps chat prose on the body variable and inline code on the code variable", () => {
    const indexCss = readFileSync(new URL("../index.css", import.meta.url), "utf8");
    const chatTextStyle = getChatTranscriptTextStyle();

    expect(chatTextStyle.fontFamily).toBe("var(--font-chat-body-family)");
    expect(indexCss).toMatch(/--font-chat-body-family:\s*var\(\s*--font-ui-family\s*\);/);
    expect(indexCss).toContain("--font-chat-code-family: var(");
    expect(indexCss).toContain("font-family: var(--font-chat-code-family);");
    expect(indexCss).toContain("font-family: var(--font-chat-code-family) !important;");
  });

  it("keeps Appearance settings fields mapped to their distinct font settings", () => {
    const settingsSource = readFileSync(
      new URL("../routes/_chat.settings.tsx", import.meta.url),
      "utf8",
    );

    expect(settingsSource).toContain('title="UI font"');
    expect(settingsSource).toContain("value={settings.uiFontFamily}");
    expect(settingsSource).toContain("updateSettings({ uiFontFamily: event.target.value })");
    expect(settingsSource).toContain('aria-label="Custom UI font family"');

    expect(settingsSource).toContain('title="Code font"');
    expect(settingsSource).toContain("value={settings.chatCodeFontFamily}");
    expect(settingsSource).toContain("updateSettings({ chatCodeFontFamily: event.target.value })");
    expect(settingsSource).toContain('aria-label="Custom chat code font family"');
    expect(settingsSource).toContain("Set a custom font for code blocks and inline code in chat");
  });

  it("keeps font hooks wired through the shared override helpers", () => {
    const uiHookSource = readFileSync(new URL("./useUIFont.ts", import.meta.url), "utf8");
    const codeHookSource = readFileSync(new URL("./useChatCodeFont.ts", import.meta.url), "utf8");

    expect(uiHookSource).toContain(
      "applyUIFontOverride(document.documentElement.style, uiFontFamily)",
    );
    expect(codeHookSource).toContain(
      "applyChatCodeFontOverride(document.documentElement.style, chatCodeFontFamily)",
    );
  });
});
