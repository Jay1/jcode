import { afterEach, describe, expect, it, vi } from "vitest";

import {
  bootstrapRemoteBearerSession,
  fetchRemoteEnvironmentDescriptor,
  fetchRemoteSessionState,
  issueRemoteWebSocketToken,
  resolveRemoteWebSocketConnectionUrl,
} from "./remoteAuthApi";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
    ...init,
  });
}

describe("remoteAuthApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redeems a pairing code for a bearer session", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
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
      bootstrapRemoteBearerSession({
        httpBaseUrl: "https://backend.example.com/",
        credential: "PAIRCODE",
      }),
    ).resolves.toMatchObject({ sessionToken: "session-token" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.example.com/api/auth/bootstrap/bearer",
      {
        body: JSON.stringify({ credential: "PAIRCODE" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );
  });

  it("fetches session state with bearer authorization", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        authenticated: true,
        auth: {
          policy: "remote-reachable",
          bootstrapMethods: ["one-time-token"],
          sessionMethods: ["bearer-session-token"],
          sessionCookieName: "t3_session",
        },
        role: "client",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchRemoteSessionState({
      httpBaseUrl: "https://backend.example.com/",
      bearerToken: "session-token",
    });

    expect(fetchMock).toHaveBeenCalledWith("https://backend.example.com/api/auth/session", {
      headers: { authorization: "Bearer session-token" },
      method: "GET",
    });
  });

  it("fetches a remote environment descriptor", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        environmentId: "env-1",
        label: "Remote",
        platform: { os: "linux", arch: "x64" },
        serverVersion: "0.0.0",
        capabilities: { repositoryIdentity: true },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchRemoteEnvironmentDescriptor({ httpBaseUrl: "https://backend.example.com/" }),
    ).resolves.toMatchObject({ environmentId: "env-1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.example.com/.well-known/jcode/environment",
      {
        headers: {},
        method: "GET",
      },
    );
  });

  it("falls back to the legacy T3 environment descriptor path", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("missing", { status: 404 }))
      .mockResolvedValueOnce(
        jsonResponse({
          environmentId: "env-1",
          label: "Remote",
          platform: { os: "linux", arch: "x64" },
          serverVersion: "0.0.0",
          capabilities: { repositoryIdentity: true },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchRemoteEnvironmentDescriptor({ httpBaseUrl: "https://backend.example.com/" }),
    ).resolves.toMatchObject({ environmentId: "env-1" });

    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://backend.example.com/.well-known/t3/environment",
      {
        headers: {},
        method: "GET",
      },
    );
  });

  it("uses a short-lived websocket token for remote websocket URLs", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        token: "ws-token",
        expiresAt: "2026-05-21T18:00:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      resolveRemoteWebSocketConnectionUrl({
        httpBaseUrl: "https://backend.example.com/",
        wsBaseUrl: "wss://backend.example.com/",
        bearerToken: "session-token",
      }),
    ).resolves.toBe("wss://backend.example.com/?wsToken=ws-token");
  });

  it("requests websocket tokens with bearer authorization", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        token: "ws-token",
        expiresAt: "2026-05-21T18:00:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await issueRemoteWebSocketToken({
      httpBaseUrl: "https://backend.example.com/",
      bearerToken: "session-token",
    });

    expect(fetchMock).toHaveBeenCalledWith("https://backend.example.com/api/auth/ws-token", {
      headers: { authorization: "Bearer session-token" },
      method: "POST",
    });
  });

  it("surfaces JSON error bodies from remote auth endpoints", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse({ error: "Pairing code expired" }, { status: 401 })),
    );

    await expect(
      bootstrapRemoteBearerSession({
        httpBaseUrl: "https://backend.example.com/",
        credential: "PAIRCODE",
      }),
    ).rejects.toMatchObject({
      name: "RemoteAuthHttpError",
      message: "Pairing code expired",
      status: 401,
    });
  });
});
