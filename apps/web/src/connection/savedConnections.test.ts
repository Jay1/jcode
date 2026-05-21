import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SAVED_CONNECTIONS_STORAGE_KEY,
  clearSavedConnectionSecret,
  clearSavedConnectionSecretAsync,
  readSavedConnectionProfiles,
  readSavedConnectionSecret,
  readSavedConnectionSecretAsync,
  readActiveSavedConnectionProfileId,
  removeSavedConnectionProfile,
  setActiveSavedConnectionProfileId,
  upsertSavedConnectionProfile,
  writeSavedConnectionSecret,
  writeSavedConnectionSecretAsync,
} from "./savedConnections";

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

describe("savedConnections", () => {
  beforeEach(() => {
    globalThis.localStorage = createMemoryStorage();
  });

  afterEach(() => {
    globalThis.localStorage = ORIGINAL_LOCAL_STORAGE;
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("persists profiles while keeping bearer secrets out of the public profile", () => {
    upsertSavedConnectionProfile({
      id: "env-1",
      label: "Remote",
      httpBaseUrl: "https://backend.example.com/",
      wsBaseUrl: "wss://backend.example.com/",
      createdAt: "2026-05-21T12:00:00.000Z",
      lastConnectedAt: null,
      role: "client",
    });
    expect(writeSavedConnectionSecret("env-1", "session-token")).toBe(true);

    expect(readSavedConnectionProfiles()).toEqual([
      {
        id: "env-1",
        label: "Remote",
        httpBaseUrl: "https://backend.example.com/",
        wsBaseUrl: "wss://backend.example.com/",
        createdAt: "2026-05-21T12:00:00.000Z",
        lastConnectedAt: null,
        role: "client",
      },
    ]);
    expect(readSavedConnectionSecret("env-1")).toBe("session-token");
    expect(globalThis.localStorage.getItem(SAVED_CONNECTIONS_STORAGE_KEY)).toContain(
      "session-token",
    );
  });

  it("preserves an existing secret when updating a profile", () => {
    upsertSavedConnectionProfile({
      id: "env-1",
      label: "Remote",
      httpBaseUrl: "https://backend.example.com/",
      wsBaseUrl: "wss://backend.example.com/",
      createdAt: "2026-05-21T12:00:00.000Z",
      lastConnectedAt: null,
    });
    writeSavedConnectionSecret("env-1", "session-token");

    upsertSavedConnectionProfile({
      id: "env-1",
      label: "Renamed",
      httpBaseUrl: "https://backend.example.com/",
      wsBaseUrl: "wss://backend.example.com/",
      createdAt: "2026-05-21T12:00:00.000Z",
      lastConnectedAt: "2026-05-21T12:30:00.000Z",
    });

    expect(readSavedConnectionProfiles()[0]).toMatchObject({
      label: "Renamed",
      lastConnectedAt: "2026-05-21T12:30:00.000Z",
    });
    expect(readSavedConnectionSecret("env-1")).toBe("session-token");
  });

  it("clears a saved secret without deleting the profile", () => {
    upsertSavedConnectionProfile({
      id: "env-1",
      label: "Remote",
      httpBaseUrl: "https://backend.example.com/",
      wsBaseUrl: "wss://backend.example.com/",
      createdAt: "2026-05-21T12:00:00.000Z",
      lastConnectedAt: null,
    });
    writeSavedConnectionSecret("env-1", "session-token");

    clearSavedConnectionSecret("env-1");

    expect(readSavedConnectionProfiles()).toHaveLength(1);
    expect(readSavedConnectionSecret("env-1")).toBeNull();
  });

  it("tracks the active saved connection and clears it when that profile is removed", () => {
    upsertSavedConnectionProfile({
      id: "env-1",
      label: "Remote",
      httpBaseUrl: "https://backend.example.com/",
      wsBaseUrl: "wss://backend.example.com/",
      createdAt: "2026-05-21T12:00:00.000Z",
      lastConnectedAt: null,
    });

    expect(setActiveSavedConnectionProfileId("missing")).toBe(false);
    expect(setActiveSavedConnectionProfileId("env-1")).toBe(true);
    expect(readActiveSavedConnectionProfileId()).toBe("env-1");

    removeSavedConnectionProfile("env-1");

    expect(readActiveSavedConnectionProfileId()).toBeNull();
  });

  it("uses desktop bridge secret storage when available", async () => {
    const secretStorage = new Map<string, string>();
    vi.stubGlobal("window", {
      desktopBridge: {
        connectionSecrets: {
          read: vi.fn((profileId: string) => Promise.resolve(secretStorage.get(profileId) ?? null)),
          write: vi.fn((input: { profileId: string; secret: string }) => {
            secretStorage.set(input.profileId, input.secret);
            return Promise.resolve(true);
          }),
          remove: vi.fn((profileId: string) => {
            secretStorage.delete(profileId);
            return Promise.resolve();
          }),
        },
      },
    });
    upsertSavedConnectionProfile({
      id: "env-1",
      label: "Remote",
      httpBaseUrl: "https://backend.example.com/",
      wsBaseUrl: "wss://backend.example.com/",
      createdAt: "2026-05-21T12:00:00.000Z",
      lastConnectedAt: null,
    });

    await expect(writeSavedConnectionSecretAsync("env-1", "desktop-token")).resolves.toBe(true);

    await expect(readSavedConnectionSecretAsync("env-1")).resolves.toBe("desktop-token");
    expect(globalThis.localStorage.getItem(SAVED_CONNECTIONS_STORAGE_KEY)).not.toContain(
      "desktop-token",
    );

    await clearSavedConnectionSecretAsync("env-1");

    await expect(readSavedConnectionSecretAsync("env-1")).resolves.toBeNull();
  });
});
