import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import { DEFAULT_SERVER_SETTINGS, ServerSettings, ServerSettingsPatch } from "./settings";

const decodeServerSettings = Schema.decodeUnknownSync(ServerSettings);
const decodeServerSettingsPatch = Schema.decodeUnknownSync(ServerSettingsPatch);

describe("ServerSettings chat word wrap", () => {
  it("defaults chat markdown word wrap on when the setting is missing", () => {
    expect(decodeServerSettings({}).chatMarkdownWordWrap).toBe(true);
    expect(DEFAULT_SERVER_SETTINGS.chatMarkdownWordWrap).toBe(true);
  });

  it("accepts chat markdown word wrap patches independently from diff word wrap", () => {
    const parsed = decodeServerSettingsPatch({
      chatMarkdownWordWrap: false,
      diffWordWrap: true,
    });

    expect(parsed.chatMarkdownWordWrap).toBe(false);
    expect(parsed.diffWordWrap).toBe(true);
  });
});

describe("ServerSettings provider update checks", () => {
  it("defaults provider update checks on when the setting is missing", () => {
    expect(decodeServerSettings({}).enableProviderUpdateChecks).toBe(true);
    expect(DEFAULT_SERVER_SETTINGS.enableProviderUpdateChecks).toBe(true);
  });

  it("accepts provider update check patches", () => {
    expect(decodeServerSettingsPatch({ enableProviderUpdateChecks: false })).toEqual({
      enableProviderUpdateChecks: false,
    });
  });
});

describe("ServerSettings OpenClaw provider settings", () => {
  it("decodes OpenClaw non-secret settings with redacted secret metadata", () => {
    const parsed = decodeServerSettings({
      providers: {
        openclaw: {
          enabled: true,
          gatewayUrl: "ws://127.0.0.1:18789",
          authMode: "token",
          hasSecret: true,
          paired: false,
        },
      },
    });

    expect(parsed.providers.openclaw.gatewayUrl).toBe("ws://127.0.0.1:18789");
    expect(parsed.providers.openclaw.authMode).toBe("token");
    expect(parsed.providers.openclaw.hasSecret).toBe(true);
    expect(parsed.providers.openclaw.paired).toBe(false);
    expect("token" in parsed.providers.openclaw).toBe(false);
    expect("password" in parsed.providers.openclaw).toBe(false);
  });

  it("decodes OpenClaw settings patches without secret values", () => {
    const parsed = decodeServerSettingsPatch({
      providers: {
        openclaw: {
          gatewayUrl: "https://gateway.example.test",
          authMode: "password",
          hasSecret: true,
          paired: true,
        },
      },
    });

    expect(parsed.providers?.openclaw?.gatewayUrl).toBe("https://gateway.example.test");
    expect(parsed.providers?.openclaw?.authMode).toBe("password");
    expect("token" in (parsed.providers?.openclaw ?? {})).toBe(false);
    expect("password" in (parsed.providers?.openclaw ?? {})).toBe(false);
    expect("hasSecret" in (parsed.providers?.openclaw ?? {})).toBe(false);
    expect("paired" in (parsed.providers?.openclaw ?? {})).toBe(false);
  });
});
