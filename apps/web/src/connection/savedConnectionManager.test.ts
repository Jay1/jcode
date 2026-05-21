import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addSavedConnectionFromPairing,
  getActiveSavedConnectionWebSocketUrl,
} from "./savedConnectionManager";
import {
  readActiveSavedConnectionProfileId,
  readSavedConnectionProfiles,
  readSavedConnectionSecret,
  setActiveSavedConnectionProfileId,
  upsertSavedConnectionProfile,
  writeSavedConnectionSecret,
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

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
    ...init,
  });
}

describe("savedConnectionManager", () => {
  beforeEach(() => {
    globalThis.localStorage = createMemoryStorage();
  });

  afterEach(() => {
    globalThis.localStorage = ORIGINAL_LOCAL_STORAGE;
    vi.unstubAllGlobals();
  });

  it("pairs with a remote backend and marks it active", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          environmentId: "env-1",
          label: "Remote Dev Box",
          platform: { os: "linux", arch: "x64" },
          serverVersion: "0.0.0",
          capabilities: { repositoryIdentity: true },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          authenticated: true,
          role: "client",
          sessionMethod: "bearer-session-token",
          expiresAt: "2026-05-21T18:00:00.000Z",
          sessionToken: "session-token",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      addSavedConnectionFromPairing({
        host: "backend.example.com",
        pairingCode: "PAIRCODE",
        now: () => new Date("2026-05-21T12:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      id: "env-1",
      label: "Remote Dev Box",
      httpBaseUrl: "https://backend.example.com/",
      wsBaseUrl: "wss://backend.example.com/",
      role: "client",
    });

    expect(readActiveSavedConnectionProfileId()).toBe("env-1");
    expect(readSavedConnectionSecret("env-1")).toBe("session-token");
    expect(readSavedConnectionProfiles()).toHaveLength(1);
  });

  it("mints websocket URLs for the active connection", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          environmentId: "env-1",
          label: "Remote Dev Box",
          platform: { os: "linux", arch: "x64" },
          serverVersion: "0.0.0",
          capabilities: { repositoryIdentity: true },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          authenticated: true,
          role: "client",
          sessionMethod: "bearer-session-token",
          expiresAt: "2026-05-21T18:00:00.000Z",
          sessionToken: "session-token",
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ token: "ws-token", expiresAt: "2026-05-21T18:00:00Z" }));
    vi.stubGlobal("fetch", fetchMock);

    await addSavedConnectionFromPairing({
      pairingUrl: "https://app.example.com/pair?host=https%3A%2F%2Fbackend.example.com#token=PAIRCODE",
    });

    await expect(getActiveSavedConnectionWebSocketUrl()).resolves.toBe(
      "wss://backend.example.com/?wsToken=ws-token",
    );
  });

  it("clears expired remote credentials when websocket token minting is unauthorized", async () => {
    upsertSavedConnectionProfile({
      id: "env-1",
      label: "Remote Dev Box",
      httpBaseUrl: "https://backend.example.com/",
      wsBaseUrl: "wss://backend.example.com/",
      createdAt: "2026-05-21T12:00:00.000Z",
      lastConnectedAt: "2026-05-21T12:00:00.000Z",
    });
    writeSavedConnectionSecret("env-1", "expired-token");
    setActiveSavedConnectionProfileId("env-1");

    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse({ error: "Unauthorized" }, { status: 401 })),
    );

    await expect(getActiveSavedConnectionWebSocketUrl()).rejects.toThrow(
      "Saved connection credential expired",
    );
    expect(readSavedConnectionSecret("env-1")).toBeNull();
  });
});
