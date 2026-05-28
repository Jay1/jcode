import { assert, describe, it } from "@effect/vitest";

import { createScoopManifest } from "./generate-scoop-manifest.ts";

describe("generate-scoop-manifest", () => {
  it("renders a Scoop manifest for the Windows x64 installer release asset", () => {
    const manifest = JSON.parse(
      createScoopManifest({
        hash: "a".repeat(64),
        version: "0.0.50",
      }),
    );

    assert.equal(manifest.version, "0.0.50");
    assert.equal(manifest.license, "MIT");
    assert.equal(
      manifest.architecture["64bit"].url,
      "https://github.com/Jay1/jcode/releases/download/v0.0.50/JCode-0.0.50-x64.exe",
    );
    assert.equal(manifest.architecture["64bit"].hash, "a".repeat(64));
    assert.deepStrictEqual(manifest.installer.script, [
      'Start-Process "$dir\\$fname" -ArgumentList @(\'/S\', "/D=$dir") -Wait',
    ]);
    assert.deepStrictEqual(manifest.uninstaller.script, [
      'if (Test-Path "$dir\\Uninstall JCode.exe") {',
      "  Start-Process \"$dir\\Uninstall JCode.exe\" -ArgumentList '/S' -Wait",
      "}",
    ]);
    assert.equal(
      manifest.autoupdate.architecture["64bit"].url,
      "https://github.com/Jay1/jcode/releases/download/v$version/JCode-$version-x64.exe",
    );
  });

  it("rejects invalid installer hashes", () => {
    assert.throws(
      () =>
        createScoopManifest({
          hash: "not-a-sha256",
          version: "0.0.50",
        }),
      /Expected a 64-character SHA256 hash/,
    );
  });
});
