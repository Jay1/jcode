import "../index.css";

import type {
  AuthAccessStreamEvent,
  DesktopAdvertisedEndpoint,
  DesktopServerExposureState,
  NativeApi,
} from "@jcode/contracts";
import { AuthSessionId } from "@jcode/contracts";
import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { SAVED_CONNECTIONS_STORAGE_KEY } from "../connection/savedConnections";
import { ConnectionsSettingsPanel } from "./ConnectionsSettingsPanel";

const NOW_ISO = "2026-05-21T12:00:00.000Z";
const NOW_UTC = NOW_ISO as never;
const SESSION_ID = AuthSessionId.makeUnsafe("session-1");

let authAccessListener: ((event: AuthAccessStreamEvent) => void) | null = null;
let desktopExposureState: DesktopServerExposureState;
let desktopAdvertisedEndpoints: ReadonlyArray<DesktopAdvertisedEndpoint>;
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
    desktopExposureState = {
      mode: "network-accessible",
      activeMode: "local-only",
      endpointUrl: "http://192.168.1.44:58090",
      advertisedHost: "192.168.1.44",
      bindHost: "0.0.0.0",
      port: 58090,
      requiresRestart: true,
    };
    desktopAdvertisedEndpoints = [
      {
        id: "desktop-loopback:58090",
        label: "This machine",
        httpBaseUrl: "http://127.0.0.1:58090",
        wsBaseUrl: "ws://127.0.0.1:58090",
        reachability: "loopback",
        isDefault: false,
        description: "Loopback endpoint",
      },
      {
        id: "desktop-lan:192.168.1.44:58090",
        label: "Local network",
        httpBaseUrl: "http://192.168.1.44:58090",
        wsBaseUrl: "ws://192.168.1.44:58090",
        reachability: "lan",
        isDefault: true,
        description: "LAN endpoint",
      },
    ];
    for (const method of Object.values(nativeApi.server)) {
      if (typeof method === "function" && "mockClear" in method) {
        (method as { mockClear: () => void }).mockClear();
      }
    }
    window.nativeApi = nativeApi;
    window.desktopBridge = {
      getWsUrl: () => null,
      getServerExposureState: vi.fn(async () => desktopExposureState),
      setServerExposureMode: vi.fn(async (mode) => {
        desktopExposureState = { ...desktopExposureState, mode };
        return desktopExposureState;
      }),
      getAdvertisedEndpoints: vi.fn(async () => desktopAdvertisedEndpoints),
    } as unknown as NonNullable<typeof window.desktopBridge>;
    window.localStorage.removeItem(SAVED_CONNECTIONS_STORAGE_KEY);
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "nativeApi");
    Reflect.deleteProperty(window, "desktopBridge");
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
      expect(document.body.textContent).toContain(
        "http://192.168.1.44:58090/pair#token=PAIR-CODE",
      );
    });

    await screen.unmount();
  });

  it("shows desktop advertised endpoints and updates exposure mode", async () => {
    const screen = await render(<ConnectionsSettingsPanel />);

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Desktop network access");
      expect(document.body.textContent).toContain("http://192.168.1.44:58090");
      expect(document.body.textContent).toContain("Restart JCode to apply");
    });

    await page.getByRole("button", { name: "Local only" }).click();

    await vi.waitFor(() => {
      expect(window.desktopBridge?.setServerExposureMode).toHaveBeenCalledWith("local-only");
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
            role: "client",
            subject: "owner",
            createdAt: NOW_UTC,
            expiresAt: NOW_UTC,
          },
        ],
        clientSessions: [
          {
            sessionId: SESSION_ID,
            subject: "owner",
            role: "owner",
            method: "bearer-session-token",
            client: { label: "Current browser", deviceType: "unknown" },
            current: true,
            connected: true,
            issuedAt: NOW_UTC,
            expiresAt: NOW_UTC,
            lastConnectedAt: NOW_UTC,
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
