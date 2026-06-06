import { DEFAULT_MODEL_BY_PROVIDER, DEFAULT_SERVER_SETTINGS } from "@jcode/contracts";
import { describe, expect, it } from "vitest";

import { applyServerSettingsPatch } from "./serverSettings";

describe("applyServerSettingsPatch", () => {
  it("sanitizes OpenClaw gateway URLs before persistence and exposure", () => {
    const next = applyServerSettingsPatch(DEFAULT_SERVER_SETTINGS, {
      providers: {
        openclaw: {
          gatewayUrl: "https://user:pass@gateway.example.test/path?token=secret#fragment",
        },
      },
    });

    expect(next.providers.openclaw.gatewayUrl).toBe("https://gateway.example.test/path");
  });

  it("scrubs credentials and query data from malformed OpenClaw gateway URLs", () => {
    const next = applyServerSettingsPatch(DEFAULT_SERVER_SETTINGS, {
      providers: {
        openclaw: {
          gatewayUrl: "https://user:pass@gateway.example.test/%zz?token=secret#fragment",
        },
      },
    });

    expect(next.providers.openclaw.gatewayUrl).toBe("https://gateway.example.test/%zz");
  });

  it("normalizes Git text-generation selections away from OpenClaw and Pi", () => {
    const openClawNext = applyServerSettingsPatch(DEFAULT_SERVER_SETTINGS, {
      textGenerationModelSelection: { provider: "openclaw", model: "gateway" },
    });
    const piNext = applyServerSettingsPatch(
      {
        ...DEFAULT_SERVER_SETTINGS,
        textGenerationModelSelection: { provider: "pi", model: "pi-model" },
      },
      {},
    );

    expect(openClawNext.textGenerationModelSelection).toEqual({
      provider: "codex",
      model: DEFAULT_MODEL_BY_PROVIDER.codex,
    });
    expect(piNext.textGenerationModelSelection).toEqual({
      provider: "codex",
      model: DEFAULT_MODEL_BY_PROVIDER.codex,
    });
  });
});
