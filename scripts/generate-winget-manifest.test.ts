import { describe, expect, it } from "vitest";

import {
  createWingetInstallerManifest,
  createWingetLocaleManifest,
  createWingetVersionManifest,
  repositoryToWingetId,
} from "./generate-winget-manifest.ts";

describe("generate-winget-manifest", () => {
  const input = {
    hash: "a".repeat(64),
    releaseDate: "2026-06-07",
    version: "0.0.50",
  };

  it("renders a Winget version manifest", () => {
    const manifest = createWingetVersionManifest(input);

    expect(manifest).toContain("PackageIdentifier: Jay1.JCode");
    expect(manifest).toContain('PackageVersion: "0.0.50"');
    expect(manifest).toContain("DefaultLocale: en-US");
    expect(manifest).toContain("ManifestType: version");
    expect(manifest).toContain("ManifestVersion: 1.10.0");
  });

  it("renders a Winget installer manifest with the Windows x64 installer URL and hash", () => {
    const manifest = createWingetInstallerManifest(input);

    expect(manifest).toContain(
      'InstallerUrl: "https://github.com/Jay1/jcode/releases/download/v0.0.50/JCode-0.0.50-x64.exe"',
    );
    expect(manifest).toContain(`InstallerSha256: ${"A".repeat(64)}`);
    expect(manifest).toContain("InstallerType: nullsoft");
    expect(manifest).toContain("  Silent: /S");
    expect(manifest).toContain('ReleaseDate: "2026-06-07"');
    expect(manifest).toContain("  - Architecture: x64");
  });

  it("renders a Winget locale manifest with package metadata", () => {
    const manifest = createWingetLocaleManifest(input);

    expect(manifest).toContain("PackageIdentifier: Jay1.JCode");
    expect(manifest).toContain("Publisher: Jay1");
    expect(manifest).toContain("PackageName: JCode");
    expect(manifest).toContain("License: MIT");
    expect(manifest).toContain("Moniker: jcode");
    expect(manifest).toContain("  - agent");
    expect(manifest).toContain("  - coding-agent");
  });

  it("uses a custom repository slug when provided", () => {
    const custom = { ...input, repository: "MyOrg/my-app" };
    const version = createWingetVersionManifest(custom);
    const installer = createWingetInstallerManifest(custom);
    const locale = createWingetLocaleManifest(custom);

    expect(version).toContain("PackageIdentifier: MyOrg.My-app");
    expect(installer).toContain("PackageIdentifier: MyOrg.My-app");
    expect(locale).toContain("PackageIdentifier: MyOrg.My-app");
    expect(installer).toContain(
      'InstallerUrl: "https://github.com/MyOrg/my-app/releases/download/v0.0.50/JCode-0.0.50-x64.exe"',
    );
    expect(locale).toContain("Publisher: MyOrg");
  });

  it("rejects invalid installer hashes", () => {
    expect(() =>
      createWingetInstallerManifest({
        hash: "not-a-sha256",
        releaseDate: "2026-06-07",
        version: "0.0.50",
      }),
    ).toThrow(/Expected a 64-character SHA256 hash/);
  });

  it("rejects invalid versions", () => {
    expect(() =>
      createWingetInstallerManifest({
        hash: "a".repeat(64),
        releaseDate: "2026-06-07",
        version: "not-a-version",
      }),
    ).toThrow(/Invalid version/);
  });

  it("rejects invalid repository slugs", () => {
    expect(() =>
      createWingetInstallerManifest({
        hash: "a".repeat(64),
        releaseDate: "2026-06-07",
        repository: "bad slug",
        version: "0.0.50",
      }),
    ).toThrow(/Invalid GitHub repository slug/);
  });

  it("rejects invalid repository slugs when deriving Winget IDs directly", () => {
    expect(() => repositoryToWingetId("bad slug")).toThrow(/Invalid GitHub repository slug/);
  });
});
