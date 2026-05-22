import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "vitest";

import { resolveAllowedLocalImageFile } from "./localImageFiles.ts";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("resolveAllowedLocalImageFile", () => {
  it("allows images inside the current workspace", async () => {
    const workspace = makeTempDir("jcode-image-workspace-");
    writeFileSync(path.join(workspace, ".git"), "gitdir: .git");
    const imagePath = path.join(workspace, "preview.png");
    writeFileSync(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const result = await resolveAllowedLocalImageFile({
      requestedPath: imagePath,
      cwd: workspace,
    });

    assert.equal(result?.path, realpathSync(imagePath));
    assert.equal(result?.fileName, "preview.png");
  });

  it("allows images inside Codex generated_images without a cwd", async () => {
    const codexHome = makeTempDir("jcode-codex-home-");
    const previousCodexHome = process.env.CODEX_HOME;
    process.env.CODEX_HOME = codexHome;
    try {
      const imageDir = path.join(codexHome, "generated_images", "provider-thread");
      const imagePath = path.join(imageDir, "call.png");
      mkdirSync(imageDir, { recursive: true });
      writeFileSync(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      const result = await resolveAllowedLocalImageFile({
        requestedPath: imagePath,
        cwd: null,
      });

      assert.equal(result?.path, realpathSync(imagePath));
    } finally {
      if (previousCodexHome === undefined) {
        delete process.env.CODEX_HOME;
      } else {
        process.env.CODEX_HOME = previousCodexHome;
      }
    }
  });

  it("allows images written to the JCODE_HOME codex-home-overlay generated_images root", async () => {
    // Codex app-server is launched with CODEX_HOME pointing at a JCode overlay
    // directory (see resolveJCodeCodexHomeOverlayPath). Generated images therefore
    // live under <JCODE_HOME>/codex-home-overlay/generated_images/<thread>/<call>.png,
    // which sits outside both the user's `~/.codex` source home and any workspace
    // root. The allowlist must still serve them.
    //
    // We anchor the fake homes inside the worktree (process.cwd() resolves to
    // apps/server/ when vitest runs) so neither path falls under os.tmpdir(); that
    // way only the overlay candidate can satisfy the allowlist.
    const fakeRoot = path.join(process.cwd(), `.test-codex-overlay-${process.pid}-${Date.now()}`);
    const sourceHome = path.join(fakeRoot, "source", ".codex");
    const jcodeHome = path.join(fakeRoot, "jcode", "runtime");
    const overlayImageDir = path.join(
      jcodeHome,
      "codex-home-overlay",
      "generated_images",
      "thread-overlay",
    );
    const imagePath = path.join(overlayImageDir, "call.png");
    mkdirSync(overlayImageDir, { recursive: true });
    writeFileSync(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const previousJcodeHome = process.env.JCODE_HOME;
    process.env.JCODE_HOME = jcodeHome;
    try {
      const result = await resolveAllowedLocalImageFile({
        requestedPath: imagePath,
        cwd: null,
        codexHomePath: sourceHome,
      });

      assert.equal(result?.path, realpathSync(imagePath));
    } finally {
      if (previousJcodeHome === undefined) {
        delete process.env.JCODE_HOME;
      } else {
        process.env.JCODE_HOME = previousJcodeHome;
      }
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it("rejects unsupported paths", async () => {
    const result = await resolveAllowedLocalImageFile({
      requestedPath: "/etc/hosts",
      cwd: null,
    });

    assert.equal(result, null);
  });
});
