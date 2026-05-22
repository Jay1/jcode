import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DesktopConnectionSecretStore } from "./desktopConnectionSecrets";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    FS.rmSync(dir, { recursive: true, force: true });
  }
});

function makeStore() {
  const dir = FS.mkdtempSync(Path.join(OS.tmpdir(), "jcode-desktop-secrets-"));
  tempDirs.push(dir);
  return new DesktopConnectionSecretStore(dir);
}

describe("DesktopConnectionSecretStore", () => {
  it("stores, reads, and removes saved connection secrets", () => {
    const store = makeStore();

    expect(store.write({ profileId: "env-1", secret: "bearer-token" })).toBe(true);
    expect(store.read("env-1")).toBe("bearer-token");

    store.remove("env-1");

    expect(store.read("env-1")).toBeNull();
  });

  it("ignores invalid secret payloads and corrupt files", () => {
    const store = makeStore();

    expect(store.write({ profileId: "", secret: "bearer-token" })).toBe(false);
    FS.writeFileSync(store.filePath, "{bad json");

    expect(store.read("env-1")).toBeNull();
  });
});
