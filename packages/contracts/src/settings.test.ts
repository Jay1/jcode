import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import { ServerSettings, ServerSettingsPatch } from "./settings";

const decodeServerSettings = Schema.decodeUnknownSync(ServerSettings);
const decodeServerSettingsPatch = Schema.decodeUnknownSync(ServerSettingsPatch);

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
