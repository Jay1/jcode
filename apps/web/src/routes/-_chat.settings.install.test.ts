import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settingsRouteSource = readFileSync(new URL("./_chat.settings.tsx", import.meta.url), "utf8");

describe("settings install provider contracts", () => {
  it("keeps Codex launch arguments wired into install settings", () => {
    expect(settingsRouteSource).toContain('launchArgsKey?: "codexLaunchArgs"');
    expect(settingsRouteSource).toContain('launchArgsKey: "codexLaunchArgs"');
    expect(settingsRouteSource).toContain("Optional Codex CLI arguments passed before");
    expect(settingsRouteSource).toContain("<code>app-server</code>");
    expect(settingsRouteSource).toContain("settings.codexLaunchArgs !== defaults.codexLaunchArgs");
    expect(settingsRouteSource).toContain("codexLaunchArgs: defaults.codexLaunchArgs");
    expect(settingsRouteSource).toContain("value={codexLaunchArgs}");
    expect(settingsRouteSource).toContain("codexLaunchArgs: event.target.value");
  });
});
