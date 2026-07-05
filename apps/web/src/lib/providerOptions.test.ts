import { describe, expect, it } from "vitest";

import { buildCodexProviderOptionsKey, buildProviderOptionsKey } from "./providerOptions";

describe("buildCodexProviderOptionsKey", () => {
  it("keys only Codex launch options without leaking unrelated provider secrets", () => {
    const key = buildCodexProviderOptionsKey({
      codex: {
        binaryPath: "/bin/custom-codex",
        homePath: "/tmp/custom-codex-home",
        launchArgs: "--profile custom",
      },
      kilo: {
        serverPassword: "kilo-secret-password",
      },
      opencode: {
        serverPassword: "opencode-secret-password",
      },
    });

    expect(key).toBe(
      JSON.stringify({
        binaryPath: "/bin/custom-codex",
        homePath: "/tmp/custom-codex-home",
        launchArgs: "--profile custom",
      }),
    );
    expect(key).not.toContain("kilo-secret-password");
    expect(key).not.toContain("opencode-secret-password");
    expect(key).not.toContain("serverPassword");
  });

  it("returns null when Codex options are absent", () => {
    expect(buildCodexProviderOptionsKey(null)).toBeNull();
    expect(buildCodexProviderOptionsKey({ kilo: { serverPassword: "secret" } })).toBeNull();
  });
});

describe("buildProviderOptionsKey", () => {
  it("keys OpenCode runtime options without leaking secrets or unrelated providers", () => {
    const key = buildProviderOptionsKey("opencode", {
      codex: {
        binaryPath: "/bin/custom-codex",
        homePath: "/tmp/custom-codex-home",
        launchArgs: "--profile custom",
      },
      opencode: {
        binaryPath: "/bin/opencode",
        serverUrl: "http://127.0.0.1:4112",
        serverPassword: "opencode-secret-password",
      },
    });

    expect(key).toBe(
      JSON.stringify({
        binaryPath: "/bin/opencode",
        serverUrl: "http://127.0.0.1:4112",
      }),
    );
    expect(key).not.toContain("opencode-secret-password");
    expect(key).not.toContain("serverPassword");
    expect(key).not.toContain("custom-codex");
  });
});
