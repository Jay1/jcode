// FILE: storageKeyMigration.test.ts
// Purpose: Verify legacy DPCode/T3Code localStorage keys are copied to jcode:* without
// overwriting existing JCode values, so app boot never silently loses persisted state.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_LOCAL_STORAGE = globalThis.localStorage;

function createMemoryStorage(): Storage {
  const storage = new Map<string, string>();
  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() {
      return storage.size;
    },
  } as Storage;
}

async function importMigrationFresh() {
  vi.resetModules();
  return await import("./storageKeyMigration");
}

describe("storageKeyMigration", () => {
  beforeEach(() => {
    globalThis.localStorage = createMemoryStorage();
  });

  afterEach(() => {
    globalThis.localStorage = ORIGINAL_LOCAL_STORAGE;
    vi.resetModules();
  });

  it("copies a legacy t3code value to the jcode key when missing", async () => {
    globalThis.localStorage.setItem(
      "t3code:split-view-state:v1",
      JSON.stringify({ state: {}, version: 2 }),
    );

    await importMigrationFresh();

    expect(globalThis.localStorage.getItem("jcode:split-view-state:v1")).toBe(
      JSON.stringify({ state: {}, version: 2 }),
    );
    // Legacy key is intentionally left in place so a downgrade still has its data.
    expect(globalThis.localStorage.getItem("t3code:split-view-state:v1")).toBe(
      JSON.stringify({ state: {}, version: 2 }),
    );
  });

  it("prefers dpcode over older t3code values when both legacy keys exist", async () => {
    globalThis.localStorage.setItem("t3code:theme", "dark");
    globalThis.localStorage.setItem("dpcode:theme", "light");

    await importMigrationFresh();

    expect(globalThis.localStorage.getItem("jcode:theme")).toBe("light");
    expect(globalThis.localStorage.getItem("dpcode:theme")).toBe("light");
    expect(globalThis.localStorage.getItem("t3code:theme")).toBe("dark");
  });

  it("does not overwrite an existing jcode value when legacy keys still hold data", async () => {
    globalThis.localStorage.setItem("dpcode:theme", "light");
    globalThis.localStorage.setItem("jcode:theme", "system");

    await importMigrationFresh();

    expect(globalThis.localStorage.getItem("jcode:theme")).toBe("system");
    expect(globalThis.localStorage.getItem("dpcode:theme")).toBe("light");
  });

  it("is a no-op when the legacy key is absent", async () => {
    globalThis.localStorage.setItem("jcode:renderer-state:v8", '{"projectNamesByCwd":{}}');

    await importMigrationFresh();

    expect(globalThis.localStorage.getItem("jcode:renderer-state:v8")).toBe(
      '{"projectNamesByCwd":{}}',
    );
    expect(globalThis.localStorage.getItem("t3code:renderer-state:v8")).toBeNull();
  });

  it("migrates several keys in one pass", async () => {
    globalThis.localStorage.setItem("t3code:composer-drafts:v1", "drafts");
    globalThis.localStorage.setItem("t3code:pinned-threads:v1", "pinned");
    globalThis.localStorage.setItem("t3code:last-editor", "vscode");

    await importMigrationFresh();

    expect(globalThis.localStorage.getItem("jcode:composer-drafts:v1")).toBe("drafts");
    expect(globalThis.localStorage.getItem("jcode:pinned-threads:v1")).toBeNull();
    expect(globalThis.localStorage.getItem("jcode:last-editor")).toBe("vscode");
  });

  it("never copies a legacy pinned-thread payload into current storage", async () => {
    // Given
    const sourceKey = "dpcode:pinned-threads:v1";
    const destinationKey = "jcode:pinned-threads:v1";
    const legacyPayload = JSON.stringify({ state: { pinnedThreadIds: ["thread-2"] }, version: 0 });
    globalThis.localStorage.setItem(sourceKey, legacyPayload);

    // When
    await importMigrationFresh();

    // Then
    expect(globalThis.localStorage.getItem(sourceKey)).toBe(legacyPayload);
    expect(globalThis.localStorage.getItem(destinationKey)).toBeNull();
  });

  it("does not resurrect legacy pin or project-order authority after migration is marked", async () => {
    // Given
    globalThis.localStorage.setItem("jcode:sidebar-layout-migrated:v1", "1");
    globalThis.localStorage.setItem("dpcode:pinned-threads:v1", "legacy pins");
    globalThis.localStorage.setItem(
      "t3code:renderer-state:v8",
      JSON.stringify({ projectOrderCwds: ["/stale/project"] }),
    );

    // When
    await importMigrationFresh();

    // Then
    expect(globalThis.localStorage.getItem("jcode:pinned-threads:v1")).toBeNull();
    expect(
      JSON.parse(globalThis.localStorage.getItem("jcode:renderer-state:v8") ?? "null"),
    ).toEqual({});
  });

  it("migrates marked legacy renderer presentation without restoring project order", async () => {
    // Given: a marked old profile only has a T3Code renderer payload.
    globalThis.localStorage.setItem("jcode:sidebar-layout-migrated:v1", "1");
    globalThis.localStorage.setItem(
      "t3code:renderer-state:v8",
      JSON.stringify({
        expandedProjectCwds: ["/repo/a"],
        projectNamesByCwd: { "/repo/a": "Local A" },
        projectOrderCwds: ["/repo/a"],
      }),
    );

    // When: namespace bootstrap runs.
    await importMigrationFresh();

    // Then: presentation migrates to JCode while ordering authority stays retired.
    expect(
      JSON.parse(globalThis.localStorage.getItem("jcode:renderer-state:v8") ?? "null"),
    ).toEqual({
      expandedProjectCwds: ["/repo/a"],
      projectNamesByCwd: { "/repo/a": "Local A" },
    });
  });

  it("swallows storage errors so the app can still boot", async () => {
    const failingStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
      clear: () => {
        throw new Error("denied");
      },
      key: () => null,
      length: 0,
    } as Storage;
    globalThis.localStorage = failingStorage;

    await expect(importMigrationFresh()).resolves.toBeDefined();
  });
});
