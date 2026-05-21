import "../index.css";

import type { AuthAccessStreamEvent, NativeApi } from "@t3tools/contracts";
import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { SAVED_CONNECTIONS_STORAGE_KEY } from "../connection/savedConnections";
import { ConnectionsSettingsPanel } from "./ConnectionsSettingsPanel";

const NOW_ISO = "2026-05-21T12:00:00.000Z";

let authAccessListener: ((event: AuthAccessStreamEvent) => void) | null = null;
const nativeApi = {
  server: {
    getAuthSession: vi.fn(async () => ({
      authenticated: true,
      authRequired: true,
      policy: "token-required" as const,
      subject: "owner",
      role: "owner" as const,
      method: "bearer" as const,
      expiresAt: null,
    })),
    listAuthPairingLinks: vi.fn(async () => []),
    listAuthClients: vi.fn(async () => []),
    createAuthPairingToken: vi.fn(async () => ({
      id: "pairing-link-1",
      credential: "PAIR-CODE",
      pairingUrl: "http://localhost/pair#token=PAIR-CODE",
      expiresAt: NOW_ISO,
    })),
    revokeAuthPairingLink: vi.fn(async () => ({ revoked: true })),
    revokeAuthClient: vi.fn(async () => ({ revoked: true })),
    revokeOtherAuthClients: vi.fn(async () => ({ revokedCount: 0 })),
    onAuthAccess: vi.fn((listener: (event: AuthAccessStreamEvent) => void) => {
      authAccessListener = listener;
      return () => {
        if (authAccessListener === listener) authAccessListener = null;
      };
    }),
  },
} as unknown as NativeApi;

describe("ConnectionsSettingsPanel", () => {
  beforeEach(() => {
    authAccessListener = null;
    for (const method of Object.values(nativeApi.server)) {
      if (typeof method === "function" && "mockClear" in method) method.mockClear();
    }
    window.nativeApi = nativeApi;
    window.localStorage.removeItem(SAVED_CONNECTIONS_STORAGE_KEY);
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "nativeApi");
    window.localStorage.removeItem(SAVED_CONNECTIONS_STORAGE_KEY);
    document.body.innerHTML = "";
  });

  it("creates a pairing code from the Connections panel", async () => {
    const screen = await render(<ConnectionsSettingsPanel />);

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Local server session");
    });
    await page.getByRole("button", { name: "Create code" }).click();

    await vi.waitFor(() => {
      expect(nativeApi.server.createAuthPairingToken).toHaveBeenCalledWith({
        label: "In-app pairing",
      });
      expect(document.body.textContent).toContain("PAIR-CODE");
      expect(document.body.textContent).toContain("/pair#token=PAIR-CODE");
    });

    await screen.unmount();
  });

  it("updates issued access from the auth access stream", async () => {
    const screen = await render(<ConnectionsSettingsPanel />);

    await vi.waitFor(() => {
      expect(authAccessListener).not.toBeNull();
    });

    authAccessListener?.({
      type: "snapshot",
      revision: 1,
      access: {
        pairingLinks: [
          {
            id: "pairing-link-1",
            credential: "LIVE-CODE",
            label: "Browser pairing",
            createdAt: NOW_ISO,
            expiresAt: NOW_ISO,
          },
        ],
        clientSessions: [
          {
            sessionId: "session-1",
            subject: "owner",
            role: "owner",
            method: "bearer",
            client: { label: "Current browser", userAgent: null, ip: null },
            current: true,
            connected: true,
            createdAt: NOW_ISO,
            expiresAt: NOW_ISO,
            lastSeenAt: NOW_ISO,
          },
        ],
      },
    });

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("LIVE-CODE");
      expect(document.body.textContent).toContain("Current browser connected");
    });

    authAccessListener?.({ type: "pairingLinkRemoved", revision: 2, id: "pairing-link-1" });

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("No active pairing links.");
      expect(document.body.textContent).not.toContain("LIVE-CODE");
    });

    await screen.unmount();
  });
});
