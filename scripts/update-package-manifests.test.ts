import { afterAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { computeSha256FromResponse, updatePackageManifests } from "./update-package-manifests.ts";

describe("update-package-manifests", () => {
  const testOutputDir = join(tmpdir(), `jcode-update-manifests-test-${Date.now()}`);

  afterAll(() => {
    rmSync(testOutputDir, { recursive: true, force: true });
  });

  it("downloads the installer, computes SHA-256, and generates Scoop + Winget manifests", async () => {
    const fakeExe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);

    const mockFetch = async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("JCode-0.0.50-x64.exe")) {
        return new Response(fakeExe, { status: 200 });
      }
      return new Response("not found", { status: 404 });
    };

    const result = await updatePackageManifests(
      {
        outputDir: testOutputDir,
        releaseDate: "2026-06-07",
        version: "0.0.50",
      },
      mockFetch as typeof globalThis.fetch,
    );

    expect(result.hash).toBeTruthy();
    expect(result.scoopManifestPath).toBeTruthy();
    expect(result.wingetVersionPath).toBeTruthy();
    expect(result.wingetInstallerPath).toBeTruthy();
    expect(result.wingetLocalePath).toBeTruthy();

    expect(existsSync(result.scoopManifestPath!)).toBe(true);
    expect(existsSync(result.wingetVersionPath!)).toBe(true);
    expect(existsSync(result.wingetInstallerPath!)).toBe(true);
    expect(existsSync(result.wingetLocalePath!)).toBe(true);

    const scoopManifest = JSON.parse(readFileSync(result.scoopManifestPath!, "utf-8"));
    expect(scoopManifest.version).toBe("0.0.50");
    expect(scoopManifest.license).toBe("MIT");
    expect(scoopManifest.architecture["64bit"].hash).toBeTruthy();
    expect(scoopManifest.architecture["64bit"].url).toContain("JCode-0.0.50-x64.exe");

    const wingetInstaller = readFileSync(result.wingetInstallerPath!, "utf-8");
    expect(wingetInstaller).toContain("PackageIdentifier: Jay1.JCode");
    expect(wingetInstaller).toContain("JCode-0.0.50-x64.exe");
    expect(wingetInstaller).toContain('ReleaseDate: "2026-06-07"');

    const wingetVersion = readFileSync(result.wingetVersionPath!, "utf-8");
    expect(wingetVersion).toContain("ManifestType: version");

    const wingetLocale = readFileSync(result.wingetLocalePath!, "utf-8");
    expect(wingetLocale).toContain("Moniker: jcode");
  });

  it("throws on failed download", async () => {
    const mockFetch = async () => new Response("not found", { status: 404 });

    await expect(
      updatePackageManifests(
        {
          outputDir: testOutputDir,
          releaseDate: "2026-06-07",
          version: "0.0.99",
        },
        mockFetch as typeof globalThis.fetch,
      ),
    ).rejects.toThrow(/Failed to download Windows installer/);
  });

  it("uses a custom repository when provided", async () => {
    const fakeExe = new Uint8Array([0x4d, 0x5a]);
    const mockFetch = async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("MyOrg/my-app")) {
        return new Response(fakeExe, { status: 200 });
      }
      return new Response("not found", { status: 404 });
    };

    const result = await updatePackageManifests(
      {
        outputDir: testOutputDir,
        releaseDate: "2026-06-07",
        repository: "MyOrg/my-app",
        version: "0.0.50",
      },
      mockFetch as typeof globalThis.fetch,
    );

    const wingetInstaller = readFileSync(result.wingetInstallerPath!, "utf-8");
    expect(wingetInstaller).toContain("PackageIdentifier: MyOrg.My-app");
  });
});

describe("computeSha256FromResponse", () => {
  it("computes SHA-256 from a streaming response body", async () => {
    const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const response = new Response(data);
    const hash = await computeSha256FromResponse(response);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe("9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a");
  });

  it("throws on a response with no body", async () => {
    const response = new Response(null, { status: 200 });

    await expect(computeSha256FromResponse(response)).rejects.toThrow(
      /Response body is not readable/,
    );
  });
});
