import {
  type AuthAccessStreamEvent,
  type AuthBearerBootstrapResult,
  type AuthBootstrapInput,
  type AuthBootstrapResult,
  type AuthClientSession,
  type AuthCreatePairingCredentialInput,
  AuthHttpRoutes,
  type AuthPairingCredentialResult,
  type AuthPairingLink,
  type AuthRevokeClientSessionInput,
  type AuthRevokePairingLinkInput,
  type AuthSessionState,
  type AuthWebSocketTokenResult,
  type ThreadId,
  type ThreadBrowserState,
  type GitActionProgressEvent,
  type OrchestrationEvent,
  type OrchestrationShellStreamItem,
  type OrchestrationThreadStreamItem,
  type ServerProviderStatusesUpdatedPayload,
  type ServerLifecycleStreamEvent,
  type ServerSettingsUpdatedPayload,
  type TerminalEvent,
  ORCHESTRATION_WS_CHANNELS,
  ORCHESTRATION_WS_METHODS,
  type ContextMenuItem,
  type NativeApi,
  ServerConfigUpdatedPayload,
  WS_CHANNELS,
  WS_METHODS,
  type WsWelcomePayload,
} from "@jcode/contracts";

import { showConfirmDialogFallback } from "./confirmDialogFallback";
import { getActiveSavedConnectionWebSocketUrl } from "./connection/savedConnectionManager";
import {
  readActiveSavedConnectionProfileId,
  readSavedConnectionProfile,
  readSavedConnectionSecretAsync,
} from "./connection/savedConnections";
import { showContextMenuFallback } from "./contextMenuFallback";
import { WsTransport } from "./wsTransport";

let instance: { api: NativeApi; transport: WsTransport } | null = null;
const welcomeListeners = new Set<(payload: WsWelcomePayload) => void>();
const serverConfigUpdatedListeners = new Set<(payload: ServerConfigUpdatedPayload) => void>();
const serverProviderStatusesUpdatedListeners = new Set<
  (payload: ServerProviderStatusesUpdatedPayload) => void
>();
const serverMaintenanceUpdatedListeners = new Set<(payload: ServerLifecycleStreamEvent) => void>();
const serverSettingsUpdatedListeners = new Set<(payload: ServerSettingsUpdatedPayload) => void>();
const authAccessListeners = new Set<(payload: AuthAccessStreamEvent) => void>();
const gitActionProgressListeners = new Set<(payload: GitActionProgressEvent) => void>();

function omitNullUserInputAnswers(
  command: Parameters<NativeApi["orchestration"]["dispatchCommand"]>[0],
) {
  if (command.type !== "thread.user-input.respond") {
    return command;
  }

  return {
    ...command,
    answers: Object.fromEntries(
      Object.entries(command.answers).filter(
        ([, answer]) => answer !== null && answer !== undefined,
      ),
    ),
  };
}
const terminalEventListeners = new Set<(payload: TerminalEvent) => void>();
const orchestrationDomainEventListeners = new Set<(payload: OrchestrationEvent) => void>();
const orchestrationShellEventListeners = new Set<(payload: OrchestrationShellStreamItem) => void>();
const orchestrationThreadEventListeners = new Set<
  (payload: OrchestrationThreadStreamItem) => void
>();
const fallbackBrowserStateListeners = new Set<(state: ThreadBrowserState) => void>();
const fallbackBrowserStates = new Map<ThreadId, ThreadBrowserState>();

function clearWsNativeApiListeners(): void {
  welcomeListeners.clear();
  serverConfigUpdatedListeners.clear();
  serverProviderStatusesUpdatedListeners.clear();
  serverMaintenanceUpdatedListeners.clear();
  serverSettingsUpdatedListeners.clear();
  authAccessListeners.clear();
  gitActionProgressListeners.clear();
  terminalEventListeners.clear();
  orchestrationDomainEventListeners.clear();
  orchestrationShellEventListeners.clear();
  orchestrationThreadEventListeners.clear();
  fallbackBrowserStateListeners.clear();
}

export function __resetWsNativeApiForTests(): void {
  instance?.transport.dispose();
  instance = null;
  clearWsNativeApiListeners();
  fallbackBrowserStates.clear();
}

function currentTransport(): WsTransport {
  if (!instance || instance.transport.getState() === "disposed") {
    createWsNativeApi();
  }

  if (!instance) {
    throw new Error("WebSocket transport unavailable");
  }

  return instance.transport;
}

function requestWs<T = unknown>(
  method: string,
  params?: unknown,
  options?: { readonly timeoutMs?: number | null },
): Promise<T> {
  if (arguments.length >= 3) {
    return currentTransport().request<T>(method, params, options);
  }
  if (arguments.length >= 2) {
    return currentTransport().request<T>(method, params);
  }
  return currentTransport().request<T>(method);
}

function resetTransportAfterBrowserSessionAuth(): void {
  instance?.transport.dispose();
  instance = null;
}

function defaultBrowserState(threadId: ThreadId): ThreadBrowserState {
  return {
    threadId,
    version: 0,
    open: false,
    activeTabId: null,
    tabs: [],
    lastError: null,
  };
}

function defaultBrowserTitle(url: string): string {
  if (url === "about:blank") {
    return "New tab";
  }
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

async function requestAuthJson<T>(
  path: string,
  options: {
    readonly method?: "GET" | "POST";
    readonly body?: unknown;
  } = {},
): Promise<T> {
  const hasBody = options.body !== undefined;
  const activeProfileId = readActiveSavedConnectionProfileId();
  const activeProfile = activeProfileId ? readSavedConnectionProfile(activeProfileId) : null;
  const bearerToken = activeProfileId
    ? await readSavedConnectionSecretAsync(activeProfileId)
    : null;
  const remoteUrl = activeProfile ? new URL(path, activeProfile.httpBaseUrl).toString() : path;
  const response = await fetch(remoteUrl, {
    method: options.method ?? "GET",
    ...(activeProfile ? {} : { credentials: "same-origin" as const }),
    ...(hasBody
      ? {
          headers: {
            "Content-Type": "application/json",
            ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
          },
          body: JSON.stringify(options.body),
        }
      : bearerToken
        ? { headers: { Authorization: `Bearer ${bearerToken}` } }
        : {}),
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Auth request failed with status ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

function createFallbackTab(url = "about:blank") {
  return {
    id: crypto.randomUUID(),
    url,
    title: defaultBrowserTitle(url),
    status: "live" as const,
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
    faviconUrl: null,
    lastCommittedUrl: url,
    lastError: null,
  };
}

function cloneBrowserState(state: ThreadBrowserState): ThreadBrowserState {
  return {
    ...state,
    tabs: state.tabs.map((tab) => ({ ...tab })),
  };
}

function getFallbackBrowserState(threadId: ThreadId): ThreadBrowserState {
  const existing = fallbackBrowserStates.get(threadId);
  if (existing) {
    return existing;
  }
  const initial = defaultBrowserState(threadId);
  fallbackBrowserStates.set(threadId, initial);
  return initial;
}

function emitFallbackBrowserState(threadId: ThreadId): ThreadBrowserState {
  const state = cloneBrowserState(getFallbackBrowserState(threadId));
  for (const listener of fallbackBrowserStateListeners) {
    listener(state);
  }
  return state;
}

function markFallbackBrowserStateChanged(state: ThreadBrowserState): void {
  state.version += 1;
}

function ensureFallbackBrowserWorkspace(threadId: ThreadId): ThreadBrowserState {
  const state = getFallbackBrowserState(threadId);
  if (state.tabs.length === 0) {
    const tab = createFallbackTab();
    state.tabs = [tab];
    state.activeTabId = tab.id;
  }
  state.open = true;
  return state;
}

function resolveFallbackBrowserTab(state: ThreadBrowserState, tabId?: string) {
  const existing =
    (tabId ? state.tabs.find((tab) => tab.id === tabId) : undefined) ??
    (state.activeTabId ? state.tabs.find((tab) => tab.id === state.activeTabId) : undefined) ??
    state.tabs[0];
  if (existing) {
    return existing;
  }
  const tab = createFallbackTab();
  state.tabs = [tab];
  state.activeTabId = tab.id;
  state.open = true;
  return tab;
}

/**
 * Subscribe to the server welcome message. If a welcome was already received
 * before this call, the listener fires synchronously with the cached payload.
 * This avoids the race between WebSocket connect and React effect registration.
 */
export function onServerWelcome(listener: (payload: WsWelcomePayload) => void): () => void {
  welcomeListeners.add(listener);

  const latestWelcome = instance?.transport.getLatestPush(WS_CHANNELS.serverWelcome)?.data ?? null;
  if (latestWelcome) {
    try {
      listener(latestWelcome);
    } catch {
      // Swallow listener errors
    }
  }

  return () => {
    welcomeListeners.delete(listener);
  };
}

/**
 * Subscribe to server config update events. Replays the latest update for
 * late subscribers to avoid missing config validation feedback.
 */
export function onServerConfigUpdated(
  listener: (payload: ServerConfigUpdatedPayload) => void,
): () => void {
  serverConfigUpdatedListeners.add(listener);

  const latestConfig =
    instance?.transport.getLatestPush(WS_CHANNELS.serverConfigUpdated)?.data ?? null;
  if (latestConfig) {
    try {
      listener(latestConfig);
    } catch {
      // Swallow listener errors
    }
  }

  return () => {
    serverConfigUpdatedListeners.delete(listener);
  };
}

/**
 * Subscribe to provider status updates without forcing a full config reload.
 */
export function onServerProviderStatusesUpdated(
  listener: (payload: ServerProviderStatusesUpdatedPayload) => void,
): () => void {
  serverProviderStatusesUpdatedListeners.add(listener);

  const latestProviderStatuses =
    instance?.transport.getLatestPush(WS_CHANNELS.serverProviderStatusesUpdated)?.data ?? null;
  if (latestProviderStatuses) {
    try {
      listener(latestProviderStatuses);
    } catch {
      // Swallow listener errors
    }
  }

  return () => {
    serverProviderStatusesUpdatedListeners.delete(listener);
  };
}

export function onServerMaintenanceUpdated(
  listener: (payload: ServerLifecycleStreamEvent) => void,
): () => void {
  serverMaintenanceUpdatedListeners.add(listener);

  const latestMaintenance =
    instance?.transport.getLatestPush(WS_CHANNELS.serverMaintenanceUpdated)?.data ?? null;
  if (latestMaintenance) {
    try {
      listener(latestMaintenance);
    } catch {
      // Swallow listener errors
    }
  }

  return () => {
    serverMaintenanceUpdatedListeners.delete(listener);
  };
}

export function onServerSettingsUpdated(
  listener: (payload: ServerSettingsUpdatedPayload) => void,
): () => void {
  serverSettingsUpdatedListeners.add(listener);

  const latestSettings =
    instance?.transport.getLatestPush(WS_CHANNELS.serverSettingsUpdated)?.data ?? null;
  if (latestSettings) {
    try {
      listener(latestSettings);
    } catch {
      // Swallow listener errors
    }
  }

  return () => {
    serverSettingsUpdatedListeners.delete(listener);
  };
}

export function onAuthAccess(listener: (payload: AuthAccessStreamEvent) => void): () => void {
  authAccessListeners.add(listener);

  const latest = instance?.transport.getLatestPush(WS_CHANNELS.authAccess)?.data ?? null;
  if (latest) {
    try {
      listener(latest);
    } catch {
      // Swallow listener errors
    }
  }

  return () => {
    authAccessListeners.delete(listener);
  };
}

export function createWsNativeApi(): NativeApi {
  if (instance) {
    if (instance.transport.getState() !== "disposed") {
      return instance.api;
    }
    instance = null;
  }

  const transport = new WsTransport(() => getActiveSavedConnectionWebSocketUrl());

  transport.subscribe(WS_CHANNELS.serverWelcome, (message) => {
    const payload = message.data;
    for (const listener of welcomeListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(WS_CHANNELS.serverConfigUpdated, (message) => {
    const payload = message.data;
    for (const listener of serverConfigUpdatedListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(WS_CHANNELS.serverProviderStatusesUpdated, (message) => {
    const payload = message.data;
    for (const listener of serverProviderStatusesUpdatedListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(WS_CHANNELS.serverMaintenanceUpdated, (message) => {
    const payload = message.data;
    for (const listener of serverMaintenanceUpdatedListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(WS_CHANNELS.serverSettingsUpdated, (message) => {
    const payload = message.data;
    for (const listener of serverSettingsUpdatedListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(WS_CHANNELS.authAccess, (message) => {
    const payload = message.data;
    for (const listener of authAccessListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(WS_CHANNELS.gitActionProgress, (message) => {
    const payload = message.data;
    for (const listener of gitActionProgressListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(WS_CHANNELS.terminalEvent, (message) => {
    const payload = message.data;
    for (const listener of terminalEventListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(ORCHESTRATION_WS_CHANNELS.domainEvent, (message) => {
    const payload = message.data;
    for (const listener of orchestrationDomainEventListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(ORCHESTRATION_WS_CHANNELS.shellEvent, (message) => {
    const payload = message.data;
    for (const listener of orchestrationShellEventListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(ORCHESTRATION_WS_CHANNELS.threadEvent, (message) => {
    const payload = message.data;
    for (const listener of orchestrationThreadEventListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  const api: NativeApi = {
    dialogs: {
      pickFolder: async () => {
        if (!window.desktopBridge) return null;
        return window.desktopBridge.pickFolder();
      },
      saveFile: async (input) => {
        if (window.desktopBridge?.saveFile) {
          return window.desktopBridge.saveFile(input);
        }
        const blob = new Blob([input.contents], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        try {
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = input.defaultFilename;
          anchor.click();
        } finally {
          URL.revokeObjectURL(url);
        }
        return null;
      },
      confirm: async (message) => {
        return showConfirmDialogFallback(message);
      },
    },
    terminal: {
      open: (input) => requestWs(WS_METHODS.terminalOpen, input),
      write: (input) => requestWs(WS_METHODS.terminalWrite, input),
      resize: (input) => requestWs(WS_METHODS.terminalResize, input),
      clear: (input) => requestWs(WS_METHODS.terminalClear, input),
      restart: (input) => requestWs(WS_METHODS.terminalRestart, input),
      close: (input) => requestWs(WS_METHODS.terminalClose, input),
      onEvent: (callback) => {
        terminalEventListeners.add(callback);
        return () => {
          terminalEventListeners.delete(callback);
        };
      },
    },
    projects: {
      listDirectories: (input) => requestWs(WS_METHODS.projectsListDirectories, input),
      searchEntries: (input) => requestWs(WS_METHODS.projectsSearchEntries, input),
      searchLocalEntries: (input) => requestWs(WS_METHODS.projectsSearchLocalEntries, input),
      writeFile: (input) => requestWs(WS_METHODS.projectsWriteFile, input),
    },
    filesystem: {
      browse: (input) => requestWs(WS_METHODS.filesystemBrowse, input),
    },
    shell: {
      openInEditor: (cwd, editor) => requestWs(WS_METHODS.shellOpenInEditor, { cwd, editor }),
      openExternal: async (url) => {
        if (window.desktopBridge) {
          const opened = await window.desktopBridge.openExternal(url);
          if (!opened) {
            throw new Error("Unable to open link.");
          }
          return;
        }

        // Some mobile browsers can return null here even when the tab opens.
        // Avoid false negatives and let the browser handle popup policy.
        window.open(url, "_blank", "noopener,noreferrer");
      },
      showInFolder: async (path) => {
        if (window.desktopBridge) {
          await window.desktopBridge.showInFolder(path);
        }
        // No-op in browser - this is a desktop-only feature
      },
    },
    git: {
      pull: (input) => requestWs(WS_METHODS.gitPull, input),
      status: (input) => requestWs(WS_METHODS.gitStatus, input),
      readWorkingTreeDiff: (input) => requestWs(WS_METHODS.gitReadWorkingTreeDiff, input),
      summarizeDiff: (input) =>
        requestWs(WS_METHODS.gitSummarizeDiff, input, {
          timeoutMs: null,
        }),
      runStackedAction: (input) =>
        requestWs(WS_METHODS.gitRunStackedAction, input, {
          timeoutMs: null,
        }),
      listBranches: (input) => requestWs(WS_METHODS.gitListBranches, input),
      createWorktree: (input) => requestWs(WS_METHODS.gitCreateWorktree, input),
      createDetachedWorktree: (input) => requestWs(WS_METHODS.gitCreateDetachedWorktree, input),
      removeWorktree: (input) => requestWs(WS_METHODS.gitRemoveWorktree, input),
      createBranch: (input) => requestWs(WS_METHODS.gitCreateBranch, input),
      checkout: (input) => requestWs(WS_METHODS.gitCheckout, input),
      stashAndCheckout: (input) => requestWs(WS_METHODS.gitStashAndCheckout, input),
      stashDrop: (input) => requestWs(WS_METHODS.gitStashDrop, input),
      stashInfo: (input) => requestWs(WS_METHODS.gitStashInfo, input),
      removeIndexLock: (input) => requestWs(WS_METHODS.gitRemoveIndexLock, input),
      init: (input) => requestWs(WS_METHODS.gitInit, input),
      handoffThread: (input) => requestWs(WS_METHODS.gitHandoffThread, input),
      resolvePullRequest: (input) => requestWs(WS_METHODS.gitResolvePullRequest, input),
      preparePullRequestThread: (input) => requestWs(WS_METHODS.gitPreparePullRequestThread, input),
      onActionProgress: (callback) => {
        gitActionProgressListeners.add(callback);
        return () => {
          gitActionProgressListeners.delete(callback);
        };
      },
    },
    contextMenu: {
      show: async <T extends string>(
        items: readonly ContextMenuItem<T>[],
        position?: { x: number; y: number },
      ): Promise<T | null> => {
        if (window.desktopBridge) {
          return window.desktopBridge.showContextMenu(items, position);
        }
        return showContextMenuFallback(items, position);
      },
    },
    server: {
      getConfig: () => requestWs(WS_METHODS.serverGetConfig),
      getEnvironment: () => requestWs(WS_METHODS.serverGetEnvironment),
      getSettings: () => requestWs(WS_METHODS.serverGetSettings),
      updateSettings: (input) => requestWs(WS_METHODS.serverUpdateSettings, input),
      updateOpenClawSecrets: (input) => requestWs(WS_METHODS.serverUpdateOpenClawSecrets, input),
      getAuthSession: () =>
        requestAuthJson<AuthSessionState>(AuthHttpRoutes.session.pathname, {
          method: AuthHttpRoutes.session.method,
        }),
      bootstrapAuth: async (input: AuthBootstrapInput) => {
        const result = await requestAuthJson<AuthBootstrapResult>(
          AuthHttpRoutes.bootstrap.pathname,
          {
            method: AuthHttpRoutes.bootstrap.method,
            body: input,
          },
        );
        if (result.sessionMethod === "browser-session-cookie") {
          resetTransportAfterBrowserSessionAuth();
        }
        return result;
      },
      bootstrapBearerAuth: (input: AuthBootstrapInput) =>
        requestAuthJson<AuthBearerBootstrapResult>(AuthHttpRoutes.bootstrapBearer.pathname, {
          method: AuthHttpRoutes.bootstrapBearer.method,
          body: input,
        }),
      issueAuthWebSocketToken: () =>
        requestAuthJson<AuthWebSocketTokenResult>(AuthHttpRoutes.webSocketToken.pathname, {
          method: AuthHttpRoutes.webSocketToken.method,
        }),
      createAuthPairingToken: (input?: AuthCreatePairingCredentialInput) =>
        requestAuthJson<AuthPairingCredentialResult>(AuthHttpRoutes.pairingToken.pathname, {
          method: AuthHttpRoutes.pairingToken.method,
          ...(input ? { body: input } : {}),
        }),
      listAuthPairingLinks: () =>
        requestAuthJson<ReadonlyArray<AuthPairingLink>>(AuthHttpRoutes.pairingLinks.pathname, {
          method: AuthHttpRoutes.pairingLinks.method,
        }),
      revokeAuthPairingLink: (input: AuthRevokePairingLinkInput) =>
        requestAuthJson<{ revoked: boolean }>(AuthHttpRoutes.revokePairingLink.pathname, {
          method: AuthHttpRoutes.revokePairingLink.method,
          body: input,
        }),
      listAuthClients: () =>
        requestAuthJson<ReadonlyArray<AuthClientSession>>(AuthHttpRoutes.clients.pathname, {
          method: AuthHttpRoutes.clients.method,
        }),
      revokeAuthClient: (input: AuthRevokeClientSessionInput) =>
        requestAuthJson<{ revoked: boolean }>(AuthHttpRoutes.revokeClient.pathname, {
          method: AuthHttpRoutes.revokeClient.method,
          body: input,
        }),
      revokeOtherAuthClients: () =>
        requestAuthJson<{ revokedCount: number }>(AuthHttpRoutes.revokeOtherClients.pathname, {
          method: AuthHttpRoutes.revokeOtherClients.method,
        }),
      onAuthAccess,
      refreshProviders: () => requestWs(WS_METHODS.serverRefreshProviders),
      updateProvider: (input) => requestWs(WS_METHODS.serverUpdateProvider, input),
      listWorktrees: () => requestWs(WS_METHODS.serverListWorktrees),
      getProviderUsageSnapshot: (input) =>
        requestWs(WS_METHODS.serverGetProviderUsageSnapshot, input),
      getDiagnostics: () => requestWs(WS_METHODS.serverGetDiagnostics),
      transcribeVoice: (input) => {
        if (window.desktopBridge?.server?.transcribeVoice) {
          return window.desktopBridge.server.transcribeVoice(input);
        }
        return requestWs(WS_METHODS.serverTranscribeVoice, input);
      },
      upsertKeybinding: (input) => requestWs(WS_METHODS.serverUpsertKeybinding, input),
      resetKeybinding: (input) => requestWs(WS_METHODS.serverResetKeybinding, input),
      resetAllKeybindings: () => requestWs(WS_METHODS.serverResetAllKeybindings, {}),
      getFirstRunWizardData: () => requestWs(WS_METHODS.serverGetFirstRunWizardData, {}),
      completeFirstRunWizard: (input) => requestWs(WS_METHODS.serverCompleteFirstRunWizard, input),
      skipFirstRun: () => requestWs(WS_METHODS.serverSkipFirstRun, {}),
      generateThreadRecap: (input) => requestWs(WS_METHODS.serverGenerateThreadRecap, input),
    },
    provider: {
      getComposerCapabilities: (input) =>
        requestWs(WS_METHODS.providerGetComposerCapabilities, input),
      getRuntimeHealth: (input) => requestWs(WS_METHODS.providerGetRuntimeHealth, input),
      getManagedSidecarHealth: () =>
        requestWs(WS_METHODS.providerGetManagedSidecarHealth, undefined),
      repairManagedSidecar: (input) => requestWs(WS_METHODS.providerRepairManagedSidecar, input),
      exportManagedSidecarDiagnostics: () =>
        requestWs(WS_METHODS.providerExportManagedSidecarDiagnostics, undefined),
      compactThread: (input) => requestWs(WS_METHODS.providerCompactThread, input),
      listCommands: (input) => requestWs(WS_METHODS.providerListCommands, input),
      listSkills: (input) => requestWs(WS_METHODS.providerListSkills, input),
      installSkill: (input) => requestWs(WS_METHODS.providerInstallSkill, input),
      uninstallSkill: (input) => requestWs(WS_METHODS.providerUninstallSkill, input),
      setSkillEnabled: (input) => requestWs(WS_METHODS.providerSetSkillEnabled, input),
      searchSkillsCatalog: (input) => requestWs(WS_METHODS.providerSearchSkillsCatalog, input),
      listPlugins: (input) => requestWs(WS_METHODS.providerListPlugins, input),
      readPlugin: (input) => requestWs(WS_METHODS.providerReadPlugin, input),
      listModels: (input) => requestWs(WS_METHODS.providerListModels, input),
      listAgents: (input) => requestWs(WS_METHODS.providerListAgents, input),
    },
    orchestration: {
      getSnapshot: () =>
        requestWs(ORCHESTRATION_WS_METHODS.getSnapshot, undefined, {
          timeoutMs: null,
        }),
      getShellSnapshot: () =>
        requestWs(ORCHESTRATION_WS_METHODS.getShellSnapshot, undefined, {
          timeoutMs: null,
        }),
      dispatchCommand: (command) => {
        return requestWs(ORCHESTRATION_WS_METHODS.dispatchCommand, {
          command: omitNullUserInputAnswers(command),
        });
      },
      importThread: (input) => requestWs(ORCHESTRATION_WS_METHODS.importThread, input),
      repairState: () => requestWs(ORCHESTRATION_WS_METHODS.repairState),
      getTurnDiff: (input) => requestWs(ORCHESTRATION_WS_METHODS.getTurnDiff, input),
      getFullThreadDiff: (input) =>
        requestWs(ORCHESTRATION_WS_METHODS.getFullThreadDiff, input, {
          timeoutMs: null,
        }),
      replayEvents: (fromSequenceExclusive) =>
        requestWs(ORCHESTRATION_WS_METHODS.replayEvents, {
          fromSequenceExclusive,
        }),
      subscribeShell: () => requestWs<void>(ORCHESTRATION_WS_METHODS.subscribeShell, {}),
      unsubscribeShell: () => requestWs<void>(ORCHESTRATION_WS_METHODS.unsubscribeShell, {}),
      subscribeThread: (input) => requestWs<void>(ORCHESTRATION_WS_METHODS.subscribeThread, input),
      unsubscribeThread: (input) =>
        requestWs<void>(ORCHESTRATION_WS_METHODS.unsubscribeThread, input),
      onDomainEvent: (callback) => {
        orchestrationDomainEventListeners.add(callback);
        return () => {
          orchestrationDomainEventListeners.delete(callback);
        };
      },
      onShellEvent: (callback) => {
        orchestrationShellEventListeners.add(callback);
        return () => {
          orchestrationShellEventListeners.delete(callback);
        };
      },
      onThreadEvent: (callback) => {
        orchestrationThreadEventListeners.add(callback);
        return () => {
          orchestrationThreadEventListeners.delete(callback);
        };
      },
    },
    browser: {
      open: async (input) => {
        if (window.desktopBridge) {
          return window.desktopBridge.browser.open(input);
        }
        const state = ensureFallbackBrowserWorkspace(input.threadId);
        if (input.initialUrl && state.tabs.length > 0) {
          const activeTab = resolveFallbackBrowserTab(state);
          activeTab.url = input.initialUrl;
          activeTab.title = defaultBrowserTitle(input.initialUrl);
          activeTab.lastCommittedUrl = input.initialUrl;
        }
        markFallbackBrowserStateChanged(state);
        return emitFallbackBrowserState(input.threadId);
      },
      close: async (input) => {
        if (window.desktopBridge) {
          return window.desktopBridge.browser.close(input);
        }
        const state = getFallbackBrowserState(input.threadId);
        state.open = false;
        state.activeTabId = null;
        state.tabs = [];
        state.lastError = null;
        markFallbackBrowserStateChanged(state);
        return emitFallbackBrowserState(input.threadId);
      },
      hide: async (input) => {
        if (window.desktopBridge) {
          await window.desktopBridge.browser.hide(input);
        }
      },
      getState: async (input) => {
        if (window.desktopBridge) {
          return window.desktopBridge.browser.getState(input);
        }
        return cloneBrowserState(getFallbackBrowserState(input.threadId));
      },
      setPanelBounds: async (input) => {
        if (window.desktopBridge) {
          await window.desktopBridge.browser.setPanelBounds(input);
          return;
        }
      },
      attachWebview: async (input) => {
        if (window.desktopBridge) {
          return window.desktopBridge.browser.attachWebview(input);
        }
        return cloneBrowserState(getFallbackBrowserState(input.threadId));
      },
      copyScreenshotToClipboard: async (input) => {
        if (window.desktopBridge) {
          await window.desktopBridge.browser.copyScreenshotToClipboard(input);
          return;
        }
        throw new Error("Browser screenshots require the desktop app.");
      },
      captureScreenshot: async (input) => {
        if (window.desktopBridge) {
          return window.desktopBridge.browser.captureScreenshot(input);
        }
        throw new Error("Browser screenshots require the desktop app.");
      },
      executeCdp: async (input) => {
        if (window.desktopBridge) {
          return window.desktopBridge.browser.executeCdp(input);
        }
        throw new Error("Browser automation requires the desktop app.");
      },
      navigate: async (input) => {
        if (window.desktopBridge) {
          return window.desktopBridge.browser.navigate(input);
        }
        const state = ensureFallbackBrowserWorkspace(input.threadId);
        const tab = resolveFallbackBrowserTab(state, input.tabId);
        tab.url = input.url;
        tab.title = defaultBrowserTitle(input.url);
        tab.lastCommittedUrl = input.url;
        tab.lastError = null;
        tab.status = "live";
        state.activeTabId = tab.id;
        markFallbackBrowserStateChanged(state);
        return emitFallbackBrowserState(input.threadId);
      },
      reload: async (input) => {
        if (window.desktopBridge) {
          return window.desktopBridge.browser.reload(input);
        }
        return cloneBrowserState(getFallbackBrowserState(input.threadId));
      },
      goBack: async (input) => {
        if (window.desktopBridge) {
          return window.desktopBridge.browser.goBack(input);
        }
        return cloneBrowserState(getFallbackBrowserState(input.threadId));
      },
      goForward: async (input) => {
        if (window.desktopBridge) {
          return window.desktopBridge.browser.goForward(input);
        }
        return cloneBrowserState(getFallbackBrowserState(input.threadId));
      },
      newTab: async (input) => {
        if (window.desktopBridge) {
          return window.desktopBridge.browser.newTab(input);
        }
        const state = ensureFallbackBrowserWorkspace(input.threadId);
        const tab = createFallbackTab(input.url);
        state.tabs = [...state.tabs, tab];
        if (input.activate !== false || !state.activeTabId) {
          state.activeTabId = tab.id;
        }
        markFallbackBrowserStateChanged(state);
        return emitFallbackBrowserState(input.threadId);
      },
      closeTab: async (input) => {
        if (window.desktopBridge) {
          return window.desktopBridge.browser.closeTab(input);
        }
        const state = getFallbackBrowserState(input.threadId);
        state.tabs = state.tabs.filter((tab) => tab.id !== input.tabId);
        if (state.tabs.length === 0) {
          state.open = false;
          state.activeTabId = null;
        } else if (!state.tabs.some((tab) => tab.id === state.activeTabId)) {
          state.activeTabId = state.tabs[0]?.id ?? null;
        }
        markFallbackBrowserStateChanged(state);
        return emitFallbackBrowserState(input.threadId);
      },
      selectTab: async (input) => {
        if (window.desktopBridge) {
          return window.desktopBridge.browser.selectTab(input);
        }
        const state = ensureFallbackBrowserWorkspace(input.threadId);
        const tab = resolveFallbackBrowserTab(state, input.tabId);
        state.activeTabId = tab.id;
        markFallbackBrowserStateChanged(state);
        return emitFallbackBrowserState(input.threadId);
      },
      openDevTools: async (input) => {
        if (window.desktopBridge) {
          await window.desktopBridge.browser.openDevTools(input);
        }
      },
      onState: (callback) => {
        if (window.desktopBridge) {
          return window.desktopBridge.browser.onState(callback);
        }
        fallbackBrowserStateListeners.add(callback);
        return () => {
          fallbackBrowserStateListeners.delete(callback);
        };
      },
    },
  };

  instance = { api, transport };
  return api;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    instance?.transport.dispose();
    instance = null;
    clearWsNativeApiListeners();
  });
}
