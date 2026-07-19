import { ProjectId, ThreadId, type SidebarLayout } from "@jcode/contracts";
import { describe, expect, it } from "vitest";
import {
  SIDEBAR_LAYOUT_MIGRATION_MARKER_KEY,
  confirmSidebarLayoutLegacyMigration,
  readSidebarLayoutLegacyCandidates,
} from "./sidebarLayoutLegacyMigration";

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>();

  get length(): number {
    return this.#values.size;
  }

  clear(): void {
    this.#values.clear();
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }
}

class FailingReadStorage extends MemoryStorage {
  override getItem(_key: string): string | null {
    throw new DOMException("Storage denied", "SecurityError");
  }
}

class FailOnceRemoveStorage implements Storage {
  #failed = false;

  constructor(private readonly storage: Storage) {}

  get length(): number {
    return this.storage.length;
  }

  clear(): void {
    this.storage.clear();
  }

  getItem(key: string): string | null {
    return this.storage.getItem(key);
  }

  key(index: number): string | null {
    return this.storage.key(index);
  }

  removeItem(key: string): void {
    if (!this.#failed && key === "dpcode:pinned-threads:v1") {
      this.#failed = true;
      throw new DOMException("Interrupted", "QuotaExceededError");
    }
    this.storage.removeItem(key);
  }

  setItem(key: string, value: string): void {
    this.storage.setItem(key, value);
  }
}

const projectA = ProjectId.makeUnsafe("project-a");
const projectB = ProjectId.makeUnsafe("project-b");
const threadA = ThreadId.makeUnsafe("thread-a");
const threadB = ThreadId.makeUnsafe("thread-b");
const hydrated = {
  projects: [
    { id: projectA, workspaceRoot: "/work/a" },
    { id: projectB, workspaceRoot: "C:\\Work\\B" },
  ],
  threadIds: [threadA, threadB],
} as const;
const confirmedLayout: SidebarLayout = {
  projectOrder: [projectA, projectB],
  pinnedThreadOrder: [threadA],
  revision: 1,
  updatedAt: "2026-07-18T00:00:00.000Z",
};

describe("sidebar layout legacy candidates", () => {
  it("maps mixed current, DPCode, and T3Code values to deduplicated hydrated IDs", () => {
    // Given
    const storage = new MemoryStorage();
    storage.setItem(
      "jcode:renderer-state:v8",
      JSON.stringify({ projectOrderCwds: ["/work/a/", "/unknown", "C:\\Work\\B"] }),
    );
    storage.setItem(
      "dpcode:renderer-state:v8",
      JSON.stringify({ projectOrderCwds: ["/work/a", "C:/Work/B"] }),
    );
    storage.setItem(
      "t3code:renderer-state:v7",
      JSON.stringify({ projectOrderCwds: ["C:/Work/B", "/unknown"] }),
    );
    storage.setItem(
      "dpcode:pinned-threads:v1",
      JSON.stringify({
        state: { pinnedThreadIds: ["thread-b", "unknown", "thread-b"] },
        version: 0,
      }),
    );
    storage.setItem(
      "jcode:pinned-threads:v1",
      JSON.stringify({ state: { pinnedThreadIds: ["thread-a"] }, version: 0 }),
    );
    storage.setItem("t3code:pinned-threads:v1", JSON.stringify(["thread-b"]));

    // When
    const candidates = readSidebarLayoutLegacyCandidates(storage, null, hydrated);

    // Then
    expect(candidates).toEqual({
      projectOrder: [projectA, projectB],
      pinnedThreadOrder: [threadA, threadB],
    });
  });

  it("returns empty candidates when storage is missing or malformed", () => {
    // Given
    const storage = new MemoryStorage();
    storage.setItem("jcode:renderer-state:v8", "not-json");
    storage.setItem("dpcode:renderer-state:v8", JSON.stringify({ projectOrderCwds: [7, null] }));
    storage.setItem("jcode:pinned-threads:v1", JSON.stringify({ state: { pinnedThreadIds: 4 } }));

    // When
    const candidates = readSidebarLayoutLegacyCandidates(storage, null, hydrated);

    // Then
    expect(candidates).toEqual({ projectOrder: [], pinnedThreadOrder: [] });
  });

  it("does not return initialization candidates when the server layout is already initialized", () => {
    // Given
    const storage = new MemoryStorage();
    storage.setItem("jcode:renderer-state:v8", JSON.stringify({ projectOrderCwds: ["/work/a"] }));

    // When
    const candidates = readSidebarLayoutLegacyCandidates(storage, confirmedLayout, hydrated);

    // Then
    expect(candidates).toBeNull();
  });

  it("does not return initialization candidates after a marked reload", () => {
    // Given
    const storage = new MemoryStorage();
    storage.setItem(SIDEBAR_LAYOUT_MIGRATION_MARKER_KEY, "1");
    storage.setItem("dpcode:pinned-threads:v1", JSON.stringify(["thread-a"]));

    // When
    const candidates = readSidebarLayoutLegacyCandidates(storage, null, hydrated);

    // Then
    expect(candidates).toBeNull();
  });

  it("does not return initialization candidates when storage access fails", () => {
    // Given
    const storage = new FailingReadStorage();

    // When
    const candidates = readSidebarLayoutLegacyCandidates(storage, null, hydrated);

    // Then
    expect(candidates).toBeNull();
  });
});

describe("sidebar layout legacy cleanup", () => {
  it("preserves expansion and local names while removing only legacy authority fields", () => {
    // Given
    const storage = new MemoryStorage();
    storage.setItem(
      "jcode:renderer-state:v8",
      JSON.stringify({
        expandedProjectCwds: ["/work/a"],
        projectOrderCwds: ["/work/b", "/work/a"],
        projectNamesByCwd: { "/work/a": "Local A" },
      }),
    );
    storage.setItem(
      "t3code:renderer-state:v7",
      JSON.stringify({ expandedProjectCwds: ["/work/b"], projectOrderCwds: ["/work/b"] }),
    );
    storage.setItem("jcode:pinned-threads:v1", "current pins");
    storage.setItem("dpcode:pinned-threads:v1", "dp pins");
    storage.setItem("t3code:pinned-threads:v1", "t3 pins");

    // When
    const cleaned = confirmSidebarLayoutLegacyMigration(storage, confirmedLayout);

    // Then
    expect(cleaned).toBe(true);
    expect(JSON.parse(storage.getItem("jcode:renderer-state:v8") ?? "null")).toEqual({
      expandedProjectCwds: ["/work/a"],
      projectNamesByCwd: { "/work/a": "Local A" },
    });
    expect(JSON.parse(storage.getItem("t3code:renderer-state:v7") ?? "null")).toEqual({
      expandedProjectCwds: ["/work/b"],
    });
    expect(storage.getItem("jcode:pinned-threads:v1")).toBeNull();
    expect(storage.getItem("dpcode:pinned-threads:v1")).toBeNull();
    expect(storage.getItem("t3code:pinned-threads:v1")).toBeNull();
    expect(storage.getItem(SIDEBAR_LAYOUT_MIGRATION_MARKER_KEY)).toBe("1");
  });

  it("does not clean any field before initialized server state is confirmed", () => {
    // Given
    const storage = new MemoryStorage();
    const rendererValue = JSON.stringify({ projectOrderCwds: ["/work/a"], extra: true });
    storage.setItem("jcode:renderer-state:v8", rendererValue);
    storage.setItem("jcode:pinned-threads:v1", "pins");

    // When
    const cleaned = confirmSidebarLayoutLegacyMigration(storage, null);

    // Then
    expect(cleaned).toBe(false);
    expect(storage.getItem("jcode:renderer-state:v8")).toBe(rendererValue);
    expect(storage.getItem("jcode:pinned-threads:v1")).toBe("pins");
    expect(storage.getItem(SIDEBAR_LAYOUT_MIGRATION_MARKER_KEY)).toBeNull();
  });

  it("retries remaining field cleanup after an interrupted marked attempt", () => {
    // Given
    const storage = new MemoryStorage();
    storage.setItem("jcode:renderer-state:v8", JSON.stringify({ projectOrderCwds: ["/work/a"] }));
    storage.setItem("dpcode:pinned-threads:v1", "pins");
    const interruptedStorage = new FailOnceRemoveStorage(storage);

    // When
    const firstAttempt = confirmSidebarLayoutLegacyMigration(interruptedStorage, confirmedLayout);
    const retry = confirmSidebarLayoutLegacyMigration(interruptedStorage, confirmedLayout);

    // Then
    expect(firstAttempt).toBe(false);
    expect(retry).toBe(true);
    expect(storage.getItem(SIDEBAR_LAYOUT_MIGRATION_MARKER_KEY)).toBe("1");
    expect(storage.getItem("dpcode:pinned-threads:v1")).toBeNull();
    expect(JSON.parse(storage.getItem("jcode:renderer-state:v8") ?? "null")).toEqual({});
  });

  it("does not replay stale candidates after cleanup is interrupted once the marker is durable", () => {
    // Given: cleanup can write the marker but is interrupted while removing a pin key.
    const storage = new MemoryStorage();
    storage.setItem(
      "jcode:renderer-state:v8",
      JSON.stringify({ expandedProjectCwds: ["/work/a"], projectOrderCwds: ["/work/a"] }),
    );
    storage.setItem("dpcode:pinned-threads:v1", JSON.stringify(["thread-a"]));
    const interruptedStorage = new FailOnceRemoveStorage(storage);

    // When: an initialized layout is confirmed and an old profile reload sees a null snapshot.
    const cleaned = confirmSidebarLayoutLegacyMigration(interruptedStorage, confirmedLayout);
    const reloadedCandidates = readSidebarLayoutLegacyCandidates(storage, null, hydrated);

    // Then: stale values cannot initialize again, while presentation state remains intact.
    expect(cleaned).toBe(false);
    expect(storage.getItem(SIDEBAR_LAYOUT_MIGRATION_MARKER_KEY)).toBe("1");
    expect(reloadedCandidates).toBeNull();
    expect(JSON.parse(storage.getItem("jcode:renderer-state:v8") ?? "null")).toEqual({
      expandedProjectCwds: ["/work/a"],
    });
  });
});
