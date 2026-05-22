import type {
  AuthAccessStreamEvent,
  AuthClientSession,
  AuthPairingLink,
  AuthSessionState,
  DesktopAdvertisedEndpoint,
  DesktopServerExposureState,
} from "@jcode/contracts";
import { AuthSessionId } from "@jcode/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";

import { addSavedConnectionFromPairing } from "../connection/savedConnectionManager";
import {
  readActiveSavedConnectionProfileId,
  readSavedConnectionProfiles,
  removeSavedConnectionProfile,
  setActiveSavedConnectionProfileId,
  type SavedConnectionProfile,
} from "../connection/savedConnections";
import { copyTextToClipboard } from "../hooks/useCopyToClipboard";
import { CopyIcon, Loader2Icon, PlusIcon, RefreshCwIcon, Trash2 } from "../lib/icons";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toastManager } from "./ui/toast";
import { ensureNativeApi } from "../nativeApi";
import { setPairingTokenOnUrl } from "../pairingUrl";

function formatDate(value: unknown): string {
  if (!value) return "Never";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function pairingUrlForCredential(
  credential: string,
  endpoint: DesktopAdvertisedEndpoint | null,
): string {
  const base = new URL("/pair", endpoint?.httpBaseUrl ?? window.location.origin).toString();
  return setPairingTokenOnUrl(base, credential).toString();
}

async function copyValue(value: string, label: string): Promise<void> {
  await copyTextToClipboard(value);
  toastManager.add({ type: "success", title: `${label} copied` });
}

function sortPairingLinks(links: ReadonlyArray<AuthPairingLink>) {
  return [...links].toSorted((left, right) =>
    String(left.expiresAt).localeCompare(String(right.expiresAt)),
  );
}

function sortClientSessions(sessions: ReadonlyArray<AuthClientSession>) {
  return [...sessions].toSorted((left, right) =>
    String(left.expiresAt).localeCompare(String(right.expiresAt)),
  );
}

function normalizeArrayResponse<T>(value: ReadonlyArray<T> | null | undefined): ReadonlyArray<T> {
  return Array.isArray(value) ? value : [];
}

function applyAuthAccessEvent(
  event: AuthAccessStreamEvent,
  setters: {
    readonly setPairingLinks: (links: ReadonlyArray<AuthPairingLink>) => void;
    readonly setClientSessions: (clients: ReadonlyArray<AuthClientSession>) => void;
    readonly updatePairingLinks: (
      update: (links: ReadonlyArray<AuthPairingLink>) => ReadonlyArray<AuthPairingLink>,
    ) => void;
    readonly updateClientSessions: (
      update: (clients: ReadonlyArray<AuthClientSession>) => ReadonlyArray<AuthClientSession>,
    ) => void;
  },
) {
  switch (event.type) {
    case "snapshot":
      setters.setPairingLinks(sortPairingLinks(normalizeArrayResponse(event.access.pairingLinks)));
      setters.setClientSessions(
        sortClientSessions(normalizeArrayResponse(event.access.clientSessions)),
      );
      return;
    case "pairingLinkUpserted":
      setters.updatePairingLinks((current) =>
        sortPairingLinks([
          ...current.filter((link) => link.id !== event.pairingLink.id),
          event.pairingLink,
        ]),
      );
      return;
    case "pairingLinkRemoved":
      setters.updatePairingLinks((current) => current.filter((link) => link.id !== event.id));
      return;
    case "clientUpserted":
      setters.updateClientSessions((current) =>
        sortClientSessions([
          ...current.filter((client) => client.sessionId !== event.clientSession.sessionId),
          event.clientSession,
        ]),
      );
      return;
    case "clientRemoved":
      setters.updateClientSessions((current) =>
        current.filter((client) => client.sessionId !== event.sessionId),
      );
      return;
  }
}

export function ConnectionsSettingsPanel() {
  const [sessionState, setSessionState] = useState<AuthSessionState | null>(null);
  const [pairingLinks, setPairingLinks] = useState<ReadonlyArray<AuthPairingLink>>([]);
  const [clientSessions, setClientSessions] = useState<ReadonlyArray<AuthClientSession>>([]);
  const [savedProfiles, setSavedProfiles] = useState<ReadonlyArray<SavedConnectionProfile>>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  const [createdPairing, setCreatedPairing] = useState<{ credential: string; url: string } | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingPairing, setIsCreatingPairing] = useState(false);
  const [isPairingRemote, setIsPairingRemote] = useState(false);
  const [isUpdatingExposure, setIsUpdatingExposure] = useState(false);
  const [serverExposure, setServerExposure] = useState<DesktopServerExposureState | null>(null);
  const [advertisedEndpoints, setAdvertisedEndpoints] = useState<
    ReadonlyArray<DesktopAdvertisedEndpoint>
  >([]);
  const [remoteHost, setRemoteHost] = useState("");
  const [remotePairingCode, setRemotePairingCode] = useState("");
  const [remotePairingUrl, setRemotePairingUrl] = useState("");

  const refreshSavedProfiles = useCallback(() => {
    setSavedProfiles(readSavedConnectionProfiles());
    setActiveProfileIdState(readActiveSavedConnectionProfileId());
  }, []);

  const refreshAccess = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = ensureNativeApi();
      const [session, links, clients] = await Promise.all([
        api.server.getAuthSession(),
        api.server.listAuthPairingLinks().catch(() => []),
        api.server.listAuthClients().catch(() => []),
      ]);
      setSessionState(session);
      setPairingLinks(normalizeArrayResponse(links));
      setClientSessions(normalizeArrayResponse(clients));
      refreshSavedProfiles();
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Connection state failed to load",
        description: (error as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [refreshSavedProfiles]);

  useEffect(() => {
    void refreshAccess();
  }, [refreshAccess]);

  useEffect(() => {
    const api = ensureNativeApi();
    return api.server.onAuthAccess((event) => {
      applyAuthAccessEvent(event, {
        setPairingLinks,
        setClientSessions,
        updatePairingLinks: setPairingLinks,
        updateClientSessions: setClientSessions,
      });
    });
  }, []);

  const activeProfile = useMemo(
    () => savedProfiles.find((profile) => profile.id === activeProfileId) ?? null,
    [activeProfileId, savedProfiles],
  );
  const preferredAdvertisedEndpoint = useMemo(
    () =>
      advertisedEndpoints.find((endpoint) => endpoint.isDefault) ?? advertisedEndpoints[0] ?? null,
    [advertisedEndpoints],
  );

  const refreshDesktopExposure = useCallback(async () => {
    const bridge = window.desktopBridge;
    if (!bridge?.getServerExposureState || !bridge.getAdvertisedEndpoints) return;
    const [exposure, endpoints] = await Promise.all([
      bridge.getServerExposureState(),
      bridge.getAdvertisedEndpoints(),
    ]);
    setServerExposure(exposure);
    setAdvertisedEndpoints(endpoints);
  }, []);

  useEffect(() => {
    void refreshDesktopExposure().catch(() => undefined);
  }, [refreshDesktopExposure]);

  const createPairingCredential = async () => {
    setIsCreatingPairing(true);
    try {
      const result = await ensureNativeApi().server.createAuthPairingToken({
        label: "In-app pairing",
      });
      const url = pairingUrlForCredential(result.credential, preferredAdvertisedEndpoint);
      setCreatedPairing({ credential: result.credential, url });
      await refreshAccess();
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Pairing code failed",
        description: (error as Error).message,
      });
    } finally {
      setIsCreatingPairing(false);
    }
  };

  const addRemoteConnection = async () => {
    setIsPairingRemote(true);
    try {
      const profile = await addSavedConnectionFromPairing({
        pairingUrl: remotePairingUrl,
        host: remoteHost,
        pairingCode: remotePairingCode,
      });
      refreshSavedProfiles();
      toastManager.add({
        type: "success",
        title: "Connection paired",
        description: `${profile.label} is now the active backend.`,
      });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Remote pairing failed",
        description: (error as Error).message,
      });
    } finally {
      setIsPairingRemote(false);
    }
  };

  const revokePairingLink = async (id: string) => {
    try {
      await ensureNativeApi().server.revokeAuthPairingLink({ id });
      await refreshAccess();
      toastManager.add({ type: "success", title: "Pairing link revoked" });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Revoke failed",
        description: (error as Error).message,
      });
    }
  };

  const revokeClientSession = async (sessionId: string) => {
    try {
      await ensureNativeApi().server.revokeAuthClient({
        sessionId: AuthSessionId.makeUnsafe(sessionId),
      });
      await refreshAccess();
      toastManager.add({ type: "success", title: "Client session revoked" });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Revoke failed",
        description: (error as Error).message,
      });
    }
  };

  const activateProfile = (profileId: string | null) => {
    if (!setActiveSavedConnectionProfileId(profileId)) return;
    window.location.reload();
  };

  const removeProfile = (profileId: string) => {
    removeSavedConnectionProfile(profileId);
    refreshSavedProfiles();
  };

  const setDesktopExposureMode = async (mode: "local-only" | "network-accessible") => {
    const bridge = window.desktopBridge;
    if (!bridge?.setServerExposureMode) return;
    setIsUpdatingExposure(true);
    try {
      const nextExposure = await bridge.setServerExposureMode(mode);
      setServerExposure(nextExposure);
      if (bridge.getAdvertisedEndpoints) {
        setAdvertisedEndpoints(await bridge.getAdvertisedEndpoints());
      }
      toastManager.add({
        type: "success",
        title: nextExposure.requiresRestart ? "Network access saved" : "Network access updated",
        description: nextExposure.requiresRestart
          ? "Restart JCode to apply the backend bind change."
          : undefined,
      });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Network access update failed",
        description: (error as Error).message,
      });
    } finally {
      setIsUpdatingExposure(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Connections</h2>
            <p className="text-sm text-muted-foreground">
              Pair browsers and saved remote backends with this JCode instance.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => void refreshAccess()}>
            {isLoading ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="mr-2 size-4" />
            )}
            Refresh
          </Button>
        </div>

        <div className="rounded-lg border border-border/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Current backend</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {activeProfile
                  ? `${activeProfile.label} (${activeProfile.httpBaseUrl})`
                  : sessionState?.authenticated
                    ? "Local server session"
                    : "Not authenticated"}
              </div>
            </div>
            {activeProfile ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => activateProfile(null)}
              >
                Use local backend
              </Button>
            ) : null}
          </div>
        </div>

        {serverExposure ? (
          <div className="rounded-lg border border-border/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Desktop network access</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {serverExposure.mode === "network-accessible"
                    ? serverExposure.endpointUrl
                      ? `Advertising ${serverExposure.endpointUrl}`
                      : "Network access requested, but no LAN address was detected."
                    : "Only this machine can reach the desktop backend."}
                </div>
                {serverExposure.requiresRestart ? (
                  <div className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                    Restart JCode to apply this backend bind change.
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={serverExposure.mode === "local-only" ? "default" : "outline"}
                  disabled={isUpdatingExposure}
                  onClick={() => void setDesktopExposureMode("local-only")}
                >
                  Local only
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={serverExposure.mode === "network-accessible" ? "default" : "outline"}
                  disabled={isUpdatingExposure}
                  onClick={() => void setDesktopExposureMode("network-accessible")}
                >
                  Network
                </Button>
              </div>
            </div>
            {advertisedEndpoints.length > 0 ? (
              <div className="mt-4 space-y-2">
                {advertisedEndpoints.map((endpoint) => (
                  <div
                    key={endpoint.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/30 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">
                        {endpoint.label}
                        {endpoint.isDefault ? " · default" : ""}
                      </div>
                      <div className="truncate text-muted-foreground">{endpoint.httpBaseUrl}</div>
                    </div>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => void copyValue(endpoint.httpBaseUrl, `${endpoint.label} URL`)}
                    >
                      <CopyIcon className="mr-1 size-3" />
                      Copy
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Pair another client to this backend</h3>
            <p className="text-sm text-muted-foreground">
              Generate a short-lived credential, then paste the code into another JCode client.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => void createPairingCredential()}
            disabled={isCreatingPairing}
          >
            {isCreatingPairing ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            ) : (
              <PlusIcon className="mr-2 size-4" />
            )}
            Create code
          </Button>
        </div>

        {createdPairing ? (
          <div className="grid gap-3 rounded-lg border border-border/70 p-4 lg:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <div className="font-mono text-lg font-semibold tracking-wide">
                {createdPairing.credential}
              </div>
              <div className="mt-1 truncate text-xs text-muted-foreground">
                {createdPairing.url}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copyValue(createdPairing.credential, "Pairing code")}
              >
                <CopyIcon className="mr-2 size-4" />
                Code
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copyValue(createdPairing.url, "Pairing URL")}
              >
                <CopyIcon className="mr-2 size-4" />
                URL
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Connect this app to another backend</h3>
          <p className="text-sm text-muted-foreground">
            Paste a full pairing URL, or enter the remote host and pairing code separately.
          </p>
        </div>
        <div className="grid gap-3 rounded-lg border border-border/70 p-4">
          <Input
            value={remotePairingUrl}
            onChange={(event) => setRemotePairingUrl(event.target.value)}
            placeholder="https://host/pair#token=..."
          />
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <Input
              value={remoteHost}
              onChange={(event) => setRemoteHost(event.target.value)}
              placeholder="Remote host, e.g. 192.168.1.20:58090"
            />
            <Input
              value={remotePairingCode}
              onChange={(event) => setRemotePairingCode(event.target.value)}
              placeholder="Pairing code"
            />
          </div>
          <div>
            <Button
              type="button"
              onClick={() => void addRemoteConnection()}
              disabled={isPairingRemote}
            >
              {isPairingRemote ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : null}
              Pair backend
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Saved backends</h3>
        {savedProfiles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
            No saved remote backends yet.
          </div>
        ) : (
          <div className="space-y-2">
            {savedProfiles.map((profile) => (
              <div
                key={profile.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{profile.label}</span>
                    {profile.id === activeProfileId ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        Active
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {profile.httpBaseUrl} · last used {formatDate(profile.lastConnectedAt)}
                  </div>
                </div>
                <div className="flex gap-2">
                  {profile.id !== activeProfileId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => activateProfile(profile.id)}
                    >
                      Use
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Remove ${profile.label}`}
                    title={`Remove ${profile.label}`}
                    onClick={() => removeProfile(profile.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Issued access</h3>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-border/70 p-4">
            <div className="text-sm font-medium">Active pairing links</div>
            <div className="mt-3 space-y-2">
              {pairingLinks.length === 0 ? (
                <div className="text-sm text-muted-foreground">No active pairing links.</div>
              ) : (
                pairingLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
                  >
                    <span>
                      <span className="font-mono text-foreground">{link.credential}</span> expires{" "}
                      {formatDate(link.expiresAt)}
                    </span>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => void revokePairingLink(link.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-lg border border-border/70 p-4">
            <div className="text-sm font-medium">Client sessions</div>
            <div className="mt-3 space-y-2">
              {clientSessions.length === 0 ? (
                <div className="text-sm text-muted-foreground">No paired client sessions.</div>
              ) : (
                clientSessions.map((client) => (
                  <div
                    key={client.sessionId}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
                  >
                    <span>
                      <span className="text-foreground">
                        {client.client.label ?? client.subject}
                      </span>{" "}
                      {client.connected ? "connected" : "disconnected"} · expires{" "}
                      {formatDate(client.expiresAt)}
                    </span>
                    {!client.current ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => void revokeClientSession(client.sessionId)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
