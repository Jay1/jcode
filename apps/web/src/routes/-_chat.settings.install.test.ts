import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settingsRouteSource = readFileSync(new URL("./_chat.settings.tsx", import.meta.url), "utf8");
const defaultProviderSectionSource = settingsRouteSource.slice(
  settingsRouteSource.indexOf('title="Default provider"'),
  settingsRouteSource.indexOf('title="New threads"'),
);

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

  it("keeps OpenClaw gateway settings non-secret in install settings", () => {
    expect(settingsRouteSource).toContain('provider: "openclaw"');
    expect(settingsRouteSource).toContain('gatewayUrlKey: "openClawGatewayUrl"');
    expect(settingsRouteSource).toContain('authModeKey: "openClawAuthMode"');
    expect(settingsRouteSource).toContain('aria-label="Enable OpenClaw gateway"');
    expect(settingsRouteSource).toContain('aria-label="OpenClaw gateway URL"');
    expect(settingsRouteSource).toContain("openClawGatewayUrl: event.target.value");
    expect(settingsRouteSource).toContain("openClawAuthMode: value");
    expect(settingsRouteSource).not.toContain("openClawSecret");
  });
});

describe("settings default provider contracts", () => {
  it("keeps OpenClaw accepted and visible in the default provider select", () => {
    expect(defaultProviderSectionSource).toContain('value !== "openclaw"');
    expect(defaultProviderSectionSource).toContain('settings.defaultProvider === "openclaw"');
    expect(defaultProviderSectionSource).toContain('<SelectItem hideIndicator value="openclaw">');
    expect(defaultProviderSectionSource.indexOf('value="kilo"')).toBeLessThan(
      defaultProviderSectionSource.indexOf('value="opencode"'),
    );
    expect(defaultProviderSectionSource.indexOf('value="opencode"')).toBeLessThan(
      defaultProviderSectionSource.indexOf('value="openclaw"'),
    );
    expect(defaultProviderSectionSource.indexOf('value="openclaw"')).toBeLessThan(
      defaultProviderSectionSource.indexOf('value="pi"'),
    );
  });
});
