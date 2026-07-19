import "../index.css";

import {
  AuthHttpRoutes,
  DEFAULT_SERVER_SETTINGS,
  EventId,
  MessageId,
  ORCHESTRATION_WS_METHODS,
  ProjectId,
  ThreadId,
  TurnId,
  type AuthSessionState,
  type FirstRunWizardData,
  type OrchestrationEvent,
  type OrchestrationReadModel,
  type OrchestrationShellStreamEvent,
  type OrchestrationShellSnapshot,
  type OrchestrationShellStreamItem,
  type OrchestrationThread,
  type OrchestrationThreadStreamItem,
  type ServerConfig,
  type WsWelcomePayload,
  WS_CHANNELS,
  WS_METHODS,
} from "@jcode/contracts";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { HttpResponse, http } from "msw";
import { setupWorker } from "msw/browser";
import { commands, page } from "vitest/browser";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { useComposerDraftStore } from "../composerDraftStore";
import { getRouter } from "../router";
import { sidebarLayoutStore } from "../sidebarLayoutStore";
import { useStore } from "../store";
import { getThreadFromState } from "../threadDerivation";
import { useWorkspaceStore } from "../workspaceStore";
import { __resetWsNativeApiForTests } from "../wsNativeApi";

const THREAD_ID = ThreadId.makeUnsafe("thread-root-browser-test");
const OTHER_THREAD_ID = ThreadId.makeUnsafe("thread-other-browser-test");
const THIRD_THREAD_ID = ThreadId.makeUnsafe("thread-third-browser-test");
const PROJECT_ID = ProjectId.makeUnsafe("project-root-browser-test");
const CHAT_PROJECT_ID = ProjectId.makeUnsafe("project-chat-browser-test");
const NOW_ISO = "2026-03-04T12:00:00.000Z";

interface TestFixture {
  snapshot: OrchestrationReadModel;
  serverConfig: ServerConfig;
  firstRunWizardData: FirstRunWizardData;
  authSession: AuthSessionState;
  welcome: WsWelcomePayload;
}

let fixture: TestFixture;
let delayNextThreadSnapshot = false;
let autoShellSnapshot = true;
let autoWelcome = true;
let subscribeShellRequestCount = 0;
const subscribeThreadRequestCountById = new Map<ThreadId, number>();
let subscribeThreadRequests: ThreadId[] = [];
let replayEvents: OrchestrationEvent[] = [];
let replayRequestCursors: number[] = [];
let holdSidebarLayoutDispatchResponses = false;
let rejectNextSidebarLayoutDispatch = false;
let sidebarLayoutDispatchRequests: unknown[] = [];
let sidebarLayoutDispatchResolvers: Array<(result: { readonly sequence: number }) => void> = [];
let emitWelcomeStreamEvent: ((payload: WsWelcomePayload) => void) | null = null;
let emitShellStreamEvent: ((event: OrchestrationShellStreamItem) => void) | null = null;
let emitThreadStreamEvent: ((event: OrchestrationThreadStreamItem) => void) | null = null;
const activeMountCleanups = new Set<() => Promise<void>>();

function createBaseServerConfig(): ServerConfig {
  return {
    cwd: "/repo/project",
    worktreesDir: "/repo/.codex/worktrees",
    keybindingsConfigPath: "/repo/project/.t3code-keybindings.json",
    keybindings: [],
    issues: [],
    providers: [
      {
        provider: "codex",
        status: "ready",
        available: true,
        authStatus: "authenticated",
        checkedAt: NOW_ISO,
      },
    ],
    availableEditors: [],
  };
}

function createFirstRunWizardData(
  overrides?: Partial<Pick<FirstRunWizardData, "currentStep" | "state">>,
): FirstRunWizardData {
  return {
    state: { completed: false, skipped: false, ...overrides?.state },
    currentStep: overrides?.currentStep ?? "select-provider",
    scanResults: {
      scannedAt: NOW_ISO,
      providers: [
        {
          provider: "opencode",
          status: "not-installed",
          hasCredentials: false,
          hasBinary: false,
          credentials: [],
        },
      ],
    },
  };
}

function createAuthenticatedSession(): AuthSessionState {
  return {
    authenticated: true,
    auth: {
      policy: "loopback-browser",
      bootstrapMethods: ["one-time-token"],
      sessionMethods: ["browser-session-cookie"],
      sessionCookieName: "browser-session-cookie",
    },
    role: "owner",
    sessionMethod: "browser-session-cookie",
  };
}

function createSnapshot(overrides?: Partial<OrchestrationReadModel["threads"][number]>) {
  return {
    snapshotSequence: 1,
    sidebarLayout: null,
    projects: [
      {
        id: PROJECT_ID,
        kind: "project",
        title: "Project",
        workspaceRoot: "/repo/project",
        defaultModelSelection: {
          provider: "codex",
          model: "gpt-5",
        },
        scripts: [],
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
        deletedAt: null,
      },
    ],
    threads: [
      {
        id: THREAD_ID,
        projectId: PROJECT_ID,
        title: "Root test thread",
        modelSelection: {
          provider: "codex",
          model: "gpt-5",
        },
        interactionMode: "default",
        runtimeMode: "full-access",
        envMode: "local",
        branch: "main",
        worktreePath: null,
        latestTurn: null,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
        deletedAt: null,
        handoff: null,
        messages: [
          {
            id: MessageId.makeUnsafe("msg-user-1"),
            role: "user",
            text: "hello",
            turnId: null,
            streaming: false,
            source: "native",
            createdAt: NOW_ISO,
            updatedAt: NOW_ISO,
          },
        ],
        activities: [],
        proposedPlans: [],
        checkpoints: [],
        session: {
          threadId: THREAD_ID,
          status: "ready",
          providerName: "codex",
          runtimeMode: "full-access",
          activeTurnId: null,
          lastError: null,
          updatedAt: NOW_ISO,
        },
        ...overrides,
      },
    ],
    updatedAt: NOW_ISO,
  } satisfies OrchestrationReadModel;
}

function buildFixture(): TestFixture {
  return {
    snapshot: createSnapshot(),
    serverConfig: createBaseServerConfig(),
    firstRunWizardData: createFirstRunWizardData({
      currentStep: "complete",
      state: { completed: true, skipped: false, completedAt: NOW_ISO },
    }),
    authSession: createAuthenticatedSession(),
    welcome: {
      cwd: "/repo/project",
      projectName: "Project",
      bootstrapProjectId: PROJECT_ID,
      bootstrapThreadId: THREAD_ID,
    },
  };
}

function createShellSnapshotFromFixtureSnapshot(
  snapshot: OrchestrationReadModel,
): OrchestrationShellSnapshot {
  return {
    snapshotSequence: snapshot.snapshotSequence,
    sidebarLayout: snapshot.sidebarLayout,
    projects: snapshot.projects
      .filter((project) => project.deletedAt === null)
      .map((project) => ({
        id: project.id,
        kind: project.kind,
        title: project.title,
        workspaceRoot: project.workspaceRoot,
        defaultModelSelection: project.defaultModelSelection,
        scripts: project.scripts,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })),
    threads: snapshot.threads
      .filter((thread) => thread.deletedAt === null)
      .map((thread) => ({
        id: thread.id,
        projectId: thread.projectId,
        title: thread.title,
        modelSelection: thread.modelSelection,
        interactionMode: thread.interactionMode,
        runtimeMode: thread.runtimeMode,
        envMode: thread.envMode,
        branch: thread.branch,
        worktreePath: thread.worktreePath,
        associatedWorktreePath: thread.associatedWorktreePath ?? null,
        associatedWorktreeBranch: thread.associatedWorktreeBranch ?? null,
        associatedWorktreeRef: thread.associatedWorktreeRef ?? null,
        parentThreadId: thread.parentThreadId ?? null,
        subagentAgentId: thread.subagentAgentId ?? null,
        subagentNickname: thread.subagentNickname ?? null,
        subagentRole: thread.subagentRole ?? null,
        forkSourceThreadId: thread.forkSourceThreadId ?? null,
        sidechatSourceThreadId: thread.sidechatSourceThreadId ?? null,
        latestTurn: thread.latestTurn,
        latestUserMessageAt: thread.latestUserMessageAt ?? null,
        hasPendingApprovals: thread.hasPendingApprovals ?? false,
        hasPendingUserInput: thread.hasPendingUserInput ?? false,
        hasActionableProposedPlan: thread.hasActionableProposedPlan ?? false,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        archivedAt: thread.archivedAt ?? null,
        handoff: thread.handoff ?? null,
        session: thread.session,
      })),
    updatedAt: snapshot.updatedAt,
  };
}

function getThreadDetailFromFixtureSnapshot(threadId: ThreadId): OrchestrationThread {
  const thread = fixture.snapshot.threads.find((entry) => entry.id === threadId);
  if (!thread) {
    throw new Error(`Missing thread fixture for ${threadId}`);
  }
  return thread;
}

function resolveWsRpc(tag: string, body?: unknown): unknown {
  if (tag === ORCHESTRATION_WS_METHODS.getSnapshot) {
    return fixture.snapshot;
  }
  if (tag === ORCHESTRATION_WS_METHODS.getShellSnapshot) {
    return createShellSnapshotFromFixtureSnapshot(fixture.snapshot);
  }
  if (tag === ORCHESTRATION_WS_METHODS.dispatchCommand) {
    sidebarLayoutDispatchRequests.push(body);
    if (rejectNextSidebarLayoutDispatch) {
      rejectNextSidebarLayoutDispatch = false;
      return Promise.reject(new Error("sidebar_layout_rejected"));
    }
    if (holdSidebarLayoutDispatchResponses) {
      return new Promise<{ readonly sequence: number }>((resolve) => {
        sidebarLayoutDispatchResolvers.push(resolve);
      });
    }
    return { sequence: fixture.snapshot.snapshotSequence + 1 };
  }
  if (tag === ORCHESTRATION_WS_METHODS.replayEvents) {
    const request = body as { readonly fromSequenceExclusive?: unknown } | null;
    const fromSequenceExclusive =
      typeof request?.fromSequenceExclusive === "number" ? request.fromSequenceExclusive : 0;
    replayRequestCursors.push(fromSequenceExclusive);
    return replayEvents.filter((event) => event.sequence > fromSequenceExclusive);
  }
  if (tag === WS_METHODS.serverGetConfig) {
    return fixture.serverConfig;
  }
  if (tag === WS_METHODS.serverGetSettings) {
    return DEFAULT_SERVER_SETTINGS;
  }
  if (tag === WS_METHODS.serverUpdateSettings) {
    return { ...DEFAULT_SERVER_SETTINGS, ...(recordValue(body) ?? {}) };
  }
  if (tag === WS_METHODS.serverGetFirstRunWizardData) {
    return fixture.firstRunWizardData;
  }
  if (tag === WS_METHODS.serverGetEnvironment) {
    return {
      environmentId: "test-browser",
      label: "Browser test",
      platform: { os: "linux", arch: "x64" },
      serverVersion: "0.0.0-test",
      capabilities: { repositoryIdentity: false },
    };
  }
  if (tag === WS_METHODS.serverGetProviderUsageSnapshot) {
    return null;
  }
  if (tag === WS_METHODS.serverListWorktrees) {
    return { worktrees: [] };
  }
  if (tag === WS_METHODS.gitListBranches) {
    return {
      isRepo: true,
      hasOriginRemote: true,
      branches: [{ name: "main", current: true, isDefault: true, worktreePath: null }],
    };
  }
  if (tag === WS_METHODS.gitStatus) {
    return {
      branch: "main",
      hasWorkingTreeChanges: false,
      workingTree: { files: [], insertions: 0, deletions: 0 },
      hasUpstream: true,
      aheadCount: 0,
      behindCount: 0,
      pr: null,
    };
  }
  if (tag === WS_METHODS.projectsSearchEntries) {
    return { entries: [], truncated: false };
  }
  if (tag === WS_METHODS.providerGetComposerCapabilities) {
    return {
      provider: "codex",
      supportsSkillMentions: false,
      supportsSkillDiscovery: false,
      supportsNativeSlashCommandDiscovery: false,
      supportsPluginMentions: false,
      supportsPluginDiscovery: false,
      supportsRuntimeModelList: false,
      supportsThreadCompaction: false,
      supportsThreadImport: false,
    };
  }
  if (tag === WS_METHODS.providerListModels) {
    return { models: [], cached: true };
  }
  if (tag === WS_METHODS.providerListAgents) {
    return { agents: [], cached: true };
  }
  if (tag === WS_METHODS.providerListSkills) {
    return { skills: [], cached: true };
  }
  if (tag === WS_METHODS.providerListCommands) {
    return { commands: [], cached: true };
  }
  if (tag === WS_METHODS.providerListPlugins) {
    return { plugins: [], cached: true };
  }
  return {};
}

const worker = setupWorker(
  http.get("*/attachments/:attachmentId", () => new HttpResponse(null, { status: 204 })),
  http.get("*/api/project-favicon", () => new HttpResponse(null, { status: 204 })),
  http.get(`*${AuthHttpRoutes.session.pathname}`, () => HttpResponse.json(fixture.authSession)),
);

function installTransportDriver(): void {
  window.__T3_WS_TRANSPORT_TEST_DRIVER__ = {
    request: (method, params) => resolveWsRpc(method, params),
    subscribeChannel: (channel, emit) => {
      if (channel === WS_CHANNELS.serverWelcome) {
        emitWelcomeStreamEvent = (payload) => emit(payload);
        if (autoWelcome) {
          queueMicrotask(() => emit(fixture.welcome));
        }
      }
      return undefined;
    },
    subscribeShell: (emit) => {
      subscribeShellRequestCount += 1;
      emitShellStreamEvent = emit;
      if (autoShellSnapshot) {
        queueMicrotask(() =>
          emit({
            kind: "snapshot",
            snapshot: createShellSnapshotFromFixtureSnapshot(fixture.snapshot),
          }),
        );
      }
      return () => {
        if (emitShellStreamEvent === emit) {
          emitShellStreamEvent = null;
        }
      };
    },
    subscribeThread: (input, emit) => {
      const threadId = (input as { threadId: ThreadId }).threadId;
      subscribeThreadRequestCountById.set(
        threadId,
        (subscribeThreadRequestCountById.get(threadId) ?? 0) + 1,
      );
      subscribeThreadRequests.push(threadId);
      emitThreadStreamEvent = emit;
      if (delayNextThreadSnapshot) {
        delayNextThreadSnapshot = false;
        return undefined;
      }
      const thread = getThreadDetailFromFixtureSnapshot(threadId);
      const snapshotSequence = fixture.snapshot.snapshotSequence;
      queueMicrotask(() =>
        emit({
          kind: "snapshot",
          snapshot: {
            snapshotSequence,
            thread,
          },
        }),
      );
      return () => {
        if (emitThreadStreamEvent === emit) {
          emitThreadStreamEvent = null;
        }
      };
    },
  };
}

async function mountApp(options?: {
  initialPath?: string;
  routeThreadId?: ThreadId;
  waitForThreadId?: ThreadId | null;
  waitForHydration?: boolean;
}): Promise<{ cleanup: () => Promise<void> }> {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.width = "100vw";
  host.style.height = "100vh";
  host.style.display = "grid";
  host.style.overflow = "hidden";
  document.body.append(host);

  const routeThreadId = options?.routeThreadId ?? THREAD_ID;
  const initialPath = options?.initialPath ?? `/${routeThreadId}`;
  const router = getRouter(createMemoryHistory({ initialEntries: [initialPath] }));
  const screen = await render(<RouterProvider router={router} />, { container: host });

  if (options?.waitForHydration !== false) {
    await vi.waitFor(
      () => {
        if (options?.waitForThreadId === null) {
          expect(useStore.getState().threadsHydrated).toBe(true);
          return;
        }
        const expectedThreadId = options?.waitForThreadId ?? THREAD_ID;
        expect(useStore.getState().threads.some((thread) => thread.id === expectedThreadId)).toBe(
          true,
        );
      },
      { timeout: 8_000, interval: 16 },
    );
  }

  let cleanedUp = false;
  const cleanup = async (): Promise<void> => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    activeMountCleanups.delete(cleanup);
    try {
      await screen.unmount();
    } finally {
      host.remove();
    }
  };
  activeMountCleanups.add(cleanup);

  return {
    cleanup,
  };
}

function sendThreadEventPush(event: OrchestrationEvent) {
  if (!emitThreadStreamEvent) throw new Error("Thread stream not connected");
  emitThreadStreamEvent({ kind: "event", event });
}

function sendThreadSnapshotPush(threadId: ThreadId, snapshotSequence: number) {
  if (!emitThreadStreamEvent) throw new Error("Thread stream not connected");
  emitThreadStreamEvent({
    kind: "snapshot",
    snapshot: {
      snapshotSequence,
      thread: getThreadDetailFromFixtureSnapshot(threadId),
    },
  });
}

function sendShellEventPush(event: OrchestrationShellStreamEvent) {
  if (!emitShellStreamEvent) throw new Error("Shell stream not connected");
  emitShellStreamEvent(event);
}

function sendShellSnapshotPush(snapshot: OrchestrationShellSnapshot) {
  if (!emitShellStreamEvent) throw new Error("Shell stream not connected");
  emitShellStreamEvent({ kind: "snapshot", snapshot });
}

function sendWelcomePush(payload: WsWelcomePayload) {
  if (!emitWelcomeStreamEvent) throw new Error("Welcome stream not connected");
  emitWelcomeStreamEvent(payload);
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;
}

function dispatchedCommand(request: unknown): Record<string, unknown> | null {
  const body = recordValue(request);
  return recordValue(body?.["command"]);
}

function sidebarProjectIds(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-sidebar-project-id]")).map(
    (element) => element.dataset["sidebarProjectId"] ?? "",
  );
}

function pinnedThreadIds(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-pinned-thread-id]")).map(
    (element) => element.dataset["pinnedThreadId"] ?? "",
  );
}

function sidebarProjectButton(projectId: ProjectId): HTMLButtonElement {
  const button = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button[data-sidebar-project-id]"),
  ).find((candidate) => candidate.dataset["sidebarProjectId"] === projectId);
  if (button === undefined) {
    throw new Error(`Missing sidebar project button: ${projectId}`);
  }
  return button;
}

async function dragSidebarProject(movedProjectId: ProjectId, overProjectId: ProjectId) {
  sidebarProjectButton(movedProjectId);
  sidebarProjectButton(overProjectId);
  await commands.dragSidebarProject(movedProjectId, overProjectId);
}

function clickVisibleSidebarTrigger(): void {
  const trigger = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-sidebar="trigger"]'),
  ).find((candidate) => {
    const bounds = candidate.getBoundingClientRect();
    const style = getComputedStyle(candidate);
    return (
      bounds.width > 0 &&
      bounds.height > 0 &&
      bounds.right > 0 &&
      bounds.left < window.innerWidth &&
      style.visibility !== "hidden"
    );
  });
  if (trigger === undefined) {
    throw new Error("Missing visible sidebar trigger");
  }
  trigger.click();
}

async function selectProjectSortOption(name: string): Promise<void> {
  await commands.selectProjectSortOption(name);
}

async function waitForMobileSidebarOpen(): Promise<void> {
  await vi.waitFor(() => {
    const sidebar = document.querySelector<HTMLElement>(
      '[data-mobile="true"][data-sidebar="sidebar"]',
    );
    if (sidebar === null) {
      throw new Error("Missing open mobile sidebar");
    }
    const bounds = sidebar.getBoundingClientRect();
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(window.innerWidth);
    expect(
      sidebar
        .getAnimations({ subtree: true })
        .every((animation) => animation.playState !== "running"),
    ).toBe(true);
  });
}

describe("EventRouter scoped orchestration sync", () => {
  beforeAll(async () => {
    fixture = buildFixture();
    await worker.start({
      onUnhandledRequest: "bypass",
      quiet: true,
      serviceWorker: { url: "/mockServiceWorker.js" },
    });
  });

  afterAll(() => {
    worker.stop();
  });

  beforeEach(() => {
    fixture = buildFixture();
    __resetWsNativeApiForTests();
    installTransportDriver();
    document.body.replaceChildren();
    delayNextThreadSnapshot = false;
    autoShellSnapshot = true;
    autoWelcome = true;
    holdSidebarLayoutDispatchResponses = false;
    rejectNextSidebarLayoutDispatch = false;
    sidebarLayoutDispatchRequests = [];
    sidebarLayoutDispatchResolvers = [];
    emitWelcomeStreamEvent = null;
    localStorage.clear();
    useComposerDraftStore.setState({
      draftsByThreadId: {},
      draftThreadsByThreadId: {},
      projectDraftThreadIdByProjectId: {},
    });
    useStore.setState({
      projects: [],
      threads: [],
      threadIds: [],
      threadShellById: {},
      threadSessionById: {},
      threadTurnStateById: {},
      messageIdsByThreadId: {},
      messageByThreadId: {},
      activityIdsByThreadId: {},
      activityByThreadId: {},
      proposedPlanIdsByThreadId: {},
      proposedPlanByThreadId: {},
      turnDiffIdsByThreadId: {},
      turnDiffSummaryByThreadId: {},
      sidebarThreadSummaryById: {},
      threadsHydrated: false,
    });
    sidebarLayoutStore.setState({
      confirmedLayout: null,
      pendingIntents: [],
      lifecycle: { projects: [], threads: [] },
      inFlightCommandId: null,
    });
    useWorkspaceStore.setState({
      homeDir: null,
      workspacePages: [
        {
          id: "workspace-test",
          title: "Workspace 1",
          layoutPresetId: "single",
          createdAt: NOW_ISO,
          updatedAt: NOW_ISO,
        },
      ],
    });
    subscribeShellRequestCount = 0;
    subscribeThreadRequestCountById.clear();
    subscribeThreadRequests = [];
    replayEvents = [];
    replayRequestCursors = [];
  });

  afterEach(async () => {
    const acceptedSequence =
      fixture.snapshot.sidebarLayout?.revision ?? fixture.snapshot.snapshotSequence + 1;
    for (const resolve of sidebarLayoutDispatchResolvers.splice(0)) {
      resolve({ sequence: acceptedSequence });
    }
    await Promise.resolve();
    try {
      await Promise.all([...activeMountCleanups].map((cleanup) => cleanup()));
    } finally {
      __resetWsNativeApiForTests();
      delete window.__T3_WS_TRANSPORT_TEST_DRIVER__;
      document.body.replaceChildren();
    }
  });

  it("shows the first-run wizard instead of the routed workspace when authenticated setup is incomplete", async () => {
    fixture.firstRunWizardData = createFirstRunWizardData();
    const mounted = await mountApp();

    try {
      await expect.element(page.getByText("Welcome to JCode")).toBeVisible();
      await expect.element(page.getByText("Choose a provider")).toBeVisible();
      expect(document.body.textContent).not.toContain("hello");
    } finally {
      await mounted.cleanup();
    }
  });

  it("renders routed children normally when authenticated setup is complete", async () => {
    fixture.firstRunWizardData = createFirstRunWizardData({
      currentStep: "complete",
      state: { completed: true, skipped: false, completedAt: NOW_ISO },
    });
    const mounted = await mountApp();

    try {
      await expect.element(page.getByText("hello")).toBeVisible();
      expect(document.body.textContent).not.toContain("Welcome to JCode");
      expect(document.body.textContent).not.toContain("Choose a provider");
    } finally {
      await mounted.cleanup();
    }
  });

  it("applies a buffered shell event after the initial shell snapshot", async () => {
    // Given: the shell stream is connected but its initial snapshot is delayed.
    autoShellSnapshot = false;
    autoWelcome = false;
    const mounted = await mountApp({ waitForHydration: false });

    try {
      await vi.waitFor(() => expect(emitShellStreamEvent).not.toBeNull());
      const bufferedProjectId = ProjectId.makeUnsafe("project-buffered-before-snapshot");

      // When: a live project event arrives before the older snapshot.
      sendShellEventPush({
        kind: "project-upserted",
        sequence: 2,
        project: {
          ...createShellSnapshotFromFixtureSnapshot(fixture.snapshot).projects[0]!,
          id: bufferedProjectId,
          title: "Buffered project",
          workspaceRoot: "/repo/buffered-project",
        },
      });
      expect(useStore.getState().projects).toEqual([]);
      sendShellSnapshotPush(createShellSnapshotFromFixtureSnapshot(fixture.snapshot));

      // Then: snapshot hydration occurs first and the buffered event is replayed after it.
      await vi.waitFor(() => {
        expect(useStore.getState().projects.map((project) => project.id)).toEqual([
          PROJECT_ID,
          bufferedProjectId,
        ]);
      });
    } finally {
      await mounted.cleanup();
    }
  });

  it("preserves the first server layout when two initialization attempts race and a response is lost", async () => {
    // Given: hydrated legacy candidates and a delayed null shell snapshot.
    autoShellSnapshot = false;
    autoWelcome = false;
    holdSidebarLayoutDispatchResponses = true;
    const otherProjectId = ProjectId.makeUnsafe("project-other-initializer");
    const baseProject = fixture.snapshot.projects[0];
    if (baseProject === undefined) {
      throw new Error("Missing base project fixture");
    }
    fixture.snapshot = {
      ...fixture.snapshot,
      projects: [
        ...fixture.snapshot.projects,
        {
          ...baseProject,
          id: otherProjectId,
          title: "Other project",
          workspaceRoot: "/repo/other-project",
        },
      ],
    };
    await page.viewport(1280, 800);
    const mounted = await mountApp({ waitForHydration: false });

    try {
      await vi.waitFor(() => expect(emitShellStreamEvent).not.toBeNull());

      // When: the null snapshot arrives after candidates are ready.
      sendShellSnapshotPush(createShellSnapshotFromFixtureSnapshot(fixture.snapshot));

      // Then: one logical initializer is dispatched and the routed DOM is hydrated.
      await vi.waitFor(() => expect(sidebarLayoutDispatchRequests).toHaveLength(1));
      await expect.element(page.getByText("hello")).toBeVisible();
      const firstCommand = dispatchedCommand(sidebarLayoutDispatchRequests[0]);
      expect(firstCommand?.["type"]).toBe("sidebar-layout.initialize");
      expect(firstCommand?.["projectOrder"]).toEqual([]);
      expect(firstCommand?.["pinnedThreadOrder"]).toEqual([]);
      const firstCommandId = firstCommand?.["commandId"];
      expect(typeof firstCommandId).toBe("string");

      // Given: another client wins while this client's first response is lost.
      const winningLayout = {
        projectOrder: [otherProjectId, PROJECT_ID],
        pinnedThreadOrder: [],
        revision: 9,
        updatedAt: "2026-07-18T00:00:09.000Z",
      } as const;
      fixture.snapshot = {
        ...fixture.snapshot,
        snapshotSequence: 9,
        sidebarLayout: winningLayout,
      };

      // When: reconnect retries receipt recovery and fetches the canonical snapshot.
      await vi.waitFor(() => expect(emitWelcomeStreamEvent).not.toBeNull());
      sendWelcomePush(fixture.welcome);

      // Then: the retry reuses the command ID and the canonical server order is rendered.
      await vi.waitFor(() => {
        expect(sidebarLayoutDispatchRequests).toHaveLength(2);
        expect(sidebarProjectIds()).toEqual([otherProjectId, PROJECT_ID]);
      });
      const retryCommand = dispatchedCommand(sidebarLayoutDispatchRequests[1]);
      expect(retryCommand?.["commandId"]).toBe(firstCommandId);

      // Given: the reconnect stream establishes the winning snapshot fence.
      sendShellSnapshotPush(createShellSnapshotFromFixtureSnapshot(fixture.snapshot));

      // When: a newer live layout is applied.
      const newerLayout = {
        ...winningLayout,
        projectOrder: [PROJECT_ID, otherProjectId],
        revision: 10,
        updatedAt: "2026-07-18T00:00:10.000Z",
      } as const;
      sendShellEventPush({
        kind: "sidebar-layout-updated",
        sequence: 10,
        sidebarLayout: newerLayout,
      });
      await vi.waitFor(() => {
        expect(sidebarProjectIds()).toEqual([PROJECT_ID, otherProjectId]);
      });

      // When: a later shell snapshot is observable but carries the older layout revision.
      const staleSnapshot = createShellSnapshotFromFixtureSnapshot(fixture.snapshot);
      sendShellSnapshotPush({
        ...staleSnapshot,
        snapshotSequence: 100,
        sidebarLayout: winningLayout,
        projects: staleSnapshot.projects.map((project) =>
          project.id === otherProjectId
            ? { ...project, title: "Other project from stale snapshot" }
            : project,
        ),
      });

      // Then: rendered order remains at the newer revision and no second logical init is created.
      await vi.waitFor(() => {
        expect(document.body.textContent).toContain("Other project from stale snapshot");
        expect(sidebarProjectIds()).toEqual([PROJECT_ID, otherProjectId]);
        expect(sidebarLayoutDispatchRequests).toHaveLength(2);
        expect(
          sidebarLayoutDispatchRequests.map((request) => dispatchedCommand(request)?.["commandId"]),
        ).toEqual([firstCommandId, firstCommandId]);
      });
    } finally {
      for (const resolve of sidebarLayoutDispatchResolvers) {
        resolve({ sequence: 9 });
      }
      await mounted.cleanup();
      await page.viewport(414, 896);
    }
  });

  it("migrates legacy sidebar authority once and a marked reload never initializes again", async () => {
    // Given: an old profile has project order, pin membership, expansion, and a local alias.
    autoShellSnapshot = false;
    autoWelcome = false;
    const otherProjectId = ProjectId.makeUnsafe("project-legacy-other");
    const baseProject = fixture.snapshot.projects[0];
    if (baseProject === undefined) {
      throw new Error("Missing base project fixture");
    }
    fixture.snapshot = {
      ...fixture.snapshot,
      projects: [
        ...fixture.snapshot.projects,
        {
          ...baseProject,
          id: otherProjectId,
          title: "Legacy other project",
          workspaceRoot: "/repo/legacy-other",
        },
      ],
    };
    localStorage.setItem(
      "jcode:renderer-state:v8",
      JSON.stringify({
        expandedProjectCwds: ["/repo/project"],
        projectOrderCwds: ["/repo/legacy-other", "/repo/project"],
        projectNamesByCwd: { "/repo/project": "Local project" },
      }),
    );
    localStorage.setItem(
      "dpcode:pinned-threads:v1",
      JSON.stringify({ state: { pinnedThreadIds: [THREAD_ID] }, version: 0 }),
    );
    await page.viewport(1280, 800);
    const mounted = await mountApp({ waitForHydration: false });

    try {
      await vi.waitFor(() => expect(emitShellStreamEvent).not.toBeNull());

      // When: the uninitialized snapshot is hydrated and another client wins initialization.
      sendShellSnapshotPush(createShellSnapshotFromFixtureSnapshot(fixture.snapshot));
      await vi.waitFor(() => expect(sidebarLayoutDispatchRequests).toHaveLength(1));
      expect(dispatchedCommand(sidebarLayoutDispatchRequests[0])).toMatchObject({
        type: "sidebar-layout.initialize",
        projectOrder: [otherProjectId, PROJECT_ID],
        pinnedThreadOrder: [THREAD_ID],
      });
      const winningLayout = {
        projectOrder: [PROJECT_ID, otherProjectId],
        pinnedThreadOrder: [],
        revision: 8,
        updatedAt: "2026-07-18T00:00:08.000Z",
      } as const;
      sendShellSnapshotPush({
        ...createShellSnapshotFromFixtureSnapshot(fixture.snapshot),
        snapshotSequence: 8,
        sidebarLayout: winningLayout,
      });

      // Then: canonical state wins visibly and only authority fields are retired.
      await vi.waitFor(() => {
        expect(sidebarProjectIds()).toEqual([PROJECT_ID, otherProjectId]);
        expect(pinnedThreadIds()).toEqual([]);
        expect(localStorage.getItem("jcode:sidebar-layout-migrated:v1")).toBe("1");
      });
      expect(localStorage.getItem("dpcode:pinned-threads:v1")).toBeNull();
      const cleanedRendererState: unknown = JSON.parse(
        localStorage.getItem("jcode:renderer-state:v8") ?? "null",
      );
      expect(cleanedRendererState).not.toHaveProperty("projectOrderCwds");
    } finally {
      await mounted.cleanup();
    }

    // Given: stale legacy values reappear after the durable marker on an old-profile reload.
    localStorage.setItem(
      "jcode:renderer-state:v8",
      JSON.stringify({ projectOrderCwds: ["/repo/legacy-other"] }),
    );
    localStorage.setItem("t3code:pinned-threads:v1", JSON.stringify([THREAD_ID]));
    fixture.snapshot = { ...fixture.snapshot, sidebarLayout: null, snapshotSequence: 1 };
    sidebarLayoutDispatchRequests = [];
    sidebarLayoutStore.setState({
      confirmedLayout: null,
      pendingIntents: [],
      lifecycle: { projects: [], threads: [] },
      inFlightCommandId: null,
    });
    const reloaded = await mountApp({ waitForHydration: false });

    try {
      await vi.waitFor(() => expect(emitShellStreamEvent).not.toBeNull());

      // When: the reloaded client receives the old null snapshot.
      sendShellSnapshotPush(createShellSnapshotFromFixtureSnapshot(fixture.snapshot));
      await expect.element(page.getByText("hello")).toBeVisible();

      // Then: the marker blocks replay and no second initialize command is submitted.
      expect(sidebarLayoutDispatchRequests).toEqual([]);
    } finally {
      await reloaded.cleanup();
      await page.viewport(414, 896);
    }
  });

  it("waits through a transient empty shell snapshot before collecting legacy candidates", async () => {
    // Given: legacy authority refers to subjects omitted by a transient desktop startup snapshot.
    autoShellSnapshot = false;
    autoWelcome = false;
    localStorage.setItem(
      "jcode:renderer-state:v8",
      JSON.stringify({ projectOrderCwds: ["/repo/project"] }),
    );
    localStorage.setItem("jcode:pinned-threads:v1", JSON.stringify([THREAD_ID]));
    const hydratedSnapshot = createShellSnapshotFromFixtureSnapshot(fixture.snapshot);
    const mounted = await mountApp({ waitForHydration: false });

    try {
      await vi.waitFor(() => expect(emitShellStreamEvent).not.toBeNull());

      // When: the first pushed snapshot is empty but still marks shell hydration complete.
      sendShellSnapshotPush({ ...hydratedSnapshot, projects: [], threads: [] });
      await vi.waitFor(() => expect(useStore.getState().threadsHydrated).toBe(true));

      // Then: provisional emptiness cannot consume the one-time initializer.
      expect(sidebarLayoutDispatchRequests).toEqual([]);

      // When: the later pushed snapshot contains the hydrated subjects.
      sendShellSnapshotPush({ ...hydratedSnapshot, snapshotSequence: 2 });

      // Then: the first initializer includes the mapped legacy project and pin candidates.
      await vi.waitFor(() => expect(sidebarLayoutDispatchRequests).toHaveLength(1));
      expect(dispatchedCommand(sidebarLayoutDispatchRequests[0])).toMatchObject({
        type: "sidebar-layout.initialize",
        projectOrder: [PROJECT_ID],
        pinnedThreadOrder: [THREAD_ID],
      });
    } finally {
      await mounted.cleanup();
    }
  });

  it("moves manual projects by final next-sibling intent and preserves canonical order across automatic sorting", async () => {
    const projectB = ProjectId.makeUnsafe("project-browser-b");
    const projectC = ProjectId.makeUnsafe("project-browser-c");
    const chatProject = ProjectId.makeUnsafe("chat-browser-home");
    const projectARecord = fixture.snapshot.projects[0];
    if (projectARecord === undefined) {
      throw new Error("Missing base project fixture");
    }
    fixture.snapshot = {
      ...fixture.snapshot,
      sidebarLayout: {
        projectOrder: [projectB, chatProject, PROJECT_ID, projectC],
        pinnedThreadOrder: [],
        revision: 1,
        updatedAt: NOW_ISO,
      },
      projects: [
        { ...projectARecord, title: "Project A", updatedAt: "2026-03-04T10:00:00.000Z" },
        {
          ...projectARecord,
          id: projectB,
          title: "Project B",
          workspaceRoot: "/repo/project-b",
          createdAt: "2026-03-04T09:00:00.000Z",
          updatedAt: "2026-03-04T11:00:00.000Z",
        },
        {
          ...projectARecord,
          id: chatProject,
          kind: "chat",
          title: "Chat home",
          workspaceRoot: "/repo/chat-home",
          createdAt: "2026-03-04T08:00:00.000Z",
          updatedAt: "2026-03-04T08:00:00.000Z",
        },
        {
          ...projectARecord,
          id: projectC,
          title: "Project C",
          workspaceRoot: "/repo/project-c",
          createdAt: "2026-03-04T07:00:00.000Z",
          updatedAt: "2026-03-04T12:00:00.000Z",
        },
      ],
    };
    holdSidebarLayoutDispatchResponses = true;
    await page.viewport(1280, 800);
    const mounted = await mountApp();

    try {
      await vi.waitFor(() => {
        expect(sidebarProjectIds()).toEqual([projectB, PROJECT_ID, projectC]);
      });
      await page.screenshot({
        path: "../../../../.omo/evidence/task-11-project-order-1280-resting.png",
      });

      rejectNextSidebarLayoutDispatch = true;
      await dragSidebarProject(PROJECT_ID, projectC);

      await expect.element(page.getByText("Unable to reorder projects")).toBeVisible();
      await vi.waitFor(() => {
        expect(sidebarLayoutDispatchRequests).toHaveLength(1);
        expect(sidebarProjectIds()).toEqual([projectB, PROJECT_ID, projectC]);
      });
      expect(dispatchedCommand(sidebarLayoutDispatchRequests[0])).toMatchObject({
        type: "sidebar-layout.project.move",
        projectId: PROJECT_ID,
        beforeProjectId: null,
      });

      await dragSidebarProject(PROJECT_ID, projectC);

      await vi.waitFor(() => {
        expect(sidebarLayoutDispatchRequests).toHaveLength(2);
        expect(sidebarProjectIds()).toEqual([projectB, projectC, PROJECT_ID]);
      });
      expect(dispatchedCommand(sidebarLayoutDispatchRequests[1])).toMatchObject({
        type: "sidebar-layout.project.move",
        projectId: PROJECT_ID,
        beforeProjectId: null,
      });

      sendShellEventPush({
        kind: "sidebar-layout-updated",
        sequence: 2,
        sidebarLayout: {
          projectOrder: [projectB, chatProject, projectC, PROJECT_ID],
          pinnedThreadOrder: [],
          revision: 2,
          updatedAt: "2026-03-04T12:00:01.000Z",
        },
      });
      sidebarLayoutDispatchResolvers.shift()?.({ sequence: 2 });

      await selectProjectSortOption("Last user message");
      await vi.waitFor(() => {
        expect(sidebarProjectIds()).toEqual([PROJECT_ID, projectC, projectB]);
      });
      await dragSidebarProject(PROJECT_ID, projectC);
      expect(sidebarLayoutDispatchRequests).toHaveLength(2);

      await selectProjectSortOption("Manual");
      await vi.waitFor(() => {
        expect(sidebarProjectIds()).toEqual([projectB, projectC, PROJECT_ID]);
      });

      await dragSidebarProject(PROJECT_ID, projectB);
      await vi.waitFor(() => {
        expect(sidebarLayoutDispatchRequests).toHaveLength(3);
        expect(sidebarProjectIds()).toEqual([PROJECT_ID, projectB, projectC]);
      });
      expect(document.activeElement).toBe(sidebarProjectButton(PROJECT_ID));
      expect(dispatchedCommand(sidebarLayoutDispatchRequests[2])).toMatchObject({
        type: "sidebar-layout.project.move",
        projectId: PROJECT_ID,
        beforeProjectId: projectB,
      });
      sendShellEventPush({
        kind: "sidebar-layout-updated",
        sequence: 3,
        sidebarLayout: {
          projectOrder: [PROJECT_ID, projectB, chatProject, projectC],
          pinnedThreadOrder: [],
          revision: 3,
          updatedAt: "2026-03-04T12:00:02.000Z",
        },
      });
      sidebarLayoutDispatchResolvers.shift()?.({ sequence: 3 });
      await page.screenshot({
        path: "../../../../.omo/evidence/task-11-project-order-1280-post-drag.png",
      });

      await page.viewport(768, 800);
      await vi.waitFor(() => expect(sidebarProjectIds()).toEqual([PROJECT_ID, projectB, projectC]));
      clickVisibleSidebarTrigger();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      clickVisibleSidebarTrigger();
      await vi.waitFor(() => expect(sidebarProjectIds()).toEqual([PROJECT_ID, projectB, projectC]));
      await page.screenshot({
        path: "../../../../.omo/evidence/task-11-project-order-768-post-drag.png",
      });
      sendShellEventPush({
        kind: "sidebar-layout-updated",
        sequence: 4,
        sidebarLayout: {
          projectOrder: [projectB, chatProject, projectC, PROJECT_ID],
          pinnedThreadOrder: [],
          revision: 4,
          updatedAt: "2026-03-04T12:00:03.000Z",
        },
      });
      await vi.waitFor(() => expect(sidebarProjectIds()).toEqual([projectB, projectC, PROJECT_ID]));
      await page.screenshot({
        path: "../../../../.omo/evidence/task-11-project-order-768-resting.png",
      });

      await page.viewport(375, 800);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      clickVisibleSidebarTrigger();
      await waitForMobileSidebarOpen();
      await vi.waitFor(() => expect(sidebarProjectIds()).toEqual([projectB, projectC, PROJECT_ID]));
      await page.screenshot({
        path: "../../../../.omo/evidence/task-11-project-order-375-resting.png",
      });
      sendShellEventPush({
        kind: "sidebar-layout-updated",
        sequence: 5,
        sidebarLayout: {
          projectOrder: [PROJECT_ID, projectB, chatProject, projectC],
          pinnedThreadOrder: [],
          revision: 5,
          updatedAt: "2026-03-04T12:00:04.000Z",
        },
      });
      await vi.waitFor(() => expect(sidebarProjectIds()).toEqual([PROJECT_ID, projectB, projectC]));
      await page.screenshot({
        path: "../../../../.omo/evidence/task-11-project-order-375-post-drag.png",
      });
    } finally {
      for (const resolve of sidebarLayoutDispatchResolvers) {
        resolve({ sequence: 3 });
      }
      await mounted.cleanup();
      await page.viewport(414, 896);
    }
  });

  it("converges remote project and pin order after entity lifecycle changes", async () => {
    const projectB = ProjectId.makeUnsafe("project-remote-browser-b");
    const projectC = ProjectId.makeUnsafe("project-remote-browser-c");
    const threadB = ThreadId.makeUnsafe("thread-remote-browser-b");
    const threadC = ThreadId.makeUnsafe("thread-remote-browser-c");
    const projectARecord = fixture.snapshot.projects[0];
    const rootThread = fixture.snapshot.threads[0];
    if (projectARecord === undefined || rootThread === undefined || rootThread.session === null) {
      throw new Error("Missing remote convergence fixture records");
    }
    const projectBRecord = {
      ...projectARecord,
      id: projectB,
      title: "Remote project B",
      workspaceRoot: "/repo/remote-project-b",
      createdAt: "2026-03-04T11:00:00.000Z",
      updatedAt: "2026-03-04T11:00:00.000Z",
    };
    const threadBRecord = {
      ...rootThread,
      id: threadB,
      projectId: projectB,
      title: "Remote pinned B",
      messages: [],
      session: { ...rootThread.session, threadId: threadB },
    };
    fixture.snapshot = {
      ...fixture.snapshot,
      sidebarLayout: {
        projectOrder: [PROJECT_ID, projectB],
        pinnedThreadOrder: [THREAD_ID, threadB],
        revision: 1,
        updatedAt: NOW_ISO,
      },
      projects: [projectARecord, projectBRecord],
      threads: [rootThread, threadBRecord],
    };
    await page.viewport(1280, 800);
    const mounted = await mountApp();

    try {
      await vi.waitFor(
        () => {
          expect(sidebarProjectIds()).toEqual([PROJECT_ID, projectB]);
          expect(pinnedThreadIds()).toEqual([THREAD_ID, threadB]);
        },
        { timeout: 5_000, interval: 16 },
      );

      // When: another client publishes a new canonical order.
      sendShellEventPush({
        kind: "sidebar-layout-updated",
        sequence: 2,
        sidebarLayout: {
          projectOrder: [projectB, PROJECT_ID],
          pinnedThreadOrder: [threadB, THREAD_ID],
          revision: 2,
          updatedAt: "2026-07-18T00:00:02.000Z",
        },
      });

      // Then: both project and pin order converge in the rendered sidebar.
      await vi.waitFor(() => {
        expect(sidebarProjectIds()).toEqual([projectB, PROJECT_ID]);
        expect(pinnedThreadIds()).toEqual([threadB, THREAD_ID]);
      });

      const projectCRecord = {
        ...projectARecord,
        id: projectC,
        title: "Remote project C",
        workspaceRoot: "/repo/remote-project-c",
        createdAt: "2026-03-04T12:00:00.000Z",
        updatedAt: "2026-03-04T12:00:00.000Z",
      };
      const threadCRecord = {
        ...rootThread,
        id: threadC,
        projectId: projectC,
        title: "Remote pinned C",
        messages: [],
        session: { ...rootThread.session, threadId: threadC },
      };
      fixture.snapshot = {
        ...fixture.snapshot,
        projects: [...fixture.snapshot.projects, projectCRecord],
        threads: [...fixture.snapshot.threads, threadCRecord],
      };

      // When: lifecycle upserts arrive before a canonical layout that places the new entities first.
      const shellSnapshotWithNewEntities = createShellSnapshotFromFixtureSnapshot(fixture.snapshot);
      const projectCShell = shellSnapshotWithNewEntities.projects.find(
        (project) => project.id === projectC,
      );
      const projectBShell = shellSnapshotWithNewEntities.projects.find(
        (project) => project.id === projectB,
      );
      const threadCShell = shellSnapshotWithNewEntities.threads.find(
        (thread) => thread.id === threadC,
      );
      const threadBShell = shellSnapshotWithNewEntities.threads.find(
        (thread) => thread.id === threadB,
      );
      if (
        projectBShell === undefined ||
        projectCShell === undefined ||
        threadBShell === undefined ||
        threadCShell === undefined
      ) {
        throw new Error("Missing remote convergence shell records");
      }
      sendShellEventPush({
        kind: "project-upserted",
        sequence: 3,
        project: projectCShell,
      });
      sendShellEventPush({
        kind: "thread-upserted",
        sequence: 4,
        thread: threadCShell,
      });
      sendShellEventPush({
        kind: "sidebar-layout-updated",
        sequence: 5,
        sidebarLayout: {
          projectOrder: [projectC, projectB, PROJECT_ID],
          pinnedThreadOrder: [threadC, threadB, THREAD_ID],
          revision: 5,
          updatedAt: "2026-07-18T00:00:05.000Z",
        },
      });

      // Then: normalization includes the new live entities in the remote canonical positions.
      await vi.waitFor(() => {
        expect(sidebarProjectIds()).toEqual([projectC, projectB, PROJECT_ID]);
        expect(pinnedThreadIds()).toEqual([threadC, threadB, THREAD_ID]);
      });

      // When: lower/equal lifecycle removals arrive after the newer canonical event.
      sendShellEventPush({ kind: "project-removed", sequence: 4, projectId: projectB });
      sendShellEventPush({ kind: "thread-removed", sequence: 5, threadId: threadB });
      sendShellEventPush({
        kind: "sidebar-layout-updated",
        sequence: 6,
        sidebarLayout: {
          projectOrder: [projectB, projectC, PROJECT_ID],
          pinnedThreadOrder: [threadB, threadC, THREAD_ID],
          revision: 6,
          updatedAt: "2026-07-18T00:00:06.000Z",
        },
      });

      // Then: stale entity events cannot alter lifecycle normalization or rendered order.
      await vi.waitFor(() => {
        expect(sidebarProjectIds()).toEqual([projectB, projectC, PROJECT_ID]);
        expect(pinnedThreadIds()).toEqual([threadB, threadC, THREAD_ID]);
      });

      // When: the shell removes a project and a pinned thread still named by canonical state.
      sendShellEventPush({ kind: "project-removed", sequence: 7, projectId: projectB });
      sendShellEventPush({ kind: "thread-removed", sequence: 8, threadId: threadB });

      // Then: removed entities disappear without waiting for a replacement layout snapshot.
      await vi.waitFor(() => {
        expect(sidebarProjectIds()).toEqual([projectC, PROJECT_ID]);
        expect(pinnedThreadIds()).toEqual([threadC, THREAD_ID]);
      });

      const dispatchCountAfterValidRemovals = sidebarLayoutDispatchRequests.length;

      // When: saved lower/equal upserts arrive after their entities were validly removed.
      sendShellEventPush({ kind: "project-upserted", sequence: 7, project: projectBShell });
      sendShellEventPush({ kind: "thread-upserted", sequence: 8, thread: threadBShell });
      sendShellEventPush({
        kind: "sidebar-layout-updated",
        sequence: 9,
        sidebarLayout: {
          projectOrder: [PROJECT_ID, projectC, projectB],
          pinnedThreadOrder: [THREAD_ID, threadC, threadB],
          revision: 9,
          updatedAt: "2026-07-18T00:00:09.000Z",
        },
      });

      // Then: stale upserts cannot resurrect removed rows or dispatch a layout command.
      await vi.waitFor(() => {
        expect(sidebarProjectIds()).toEqual([PROJECT_ID, projectC]);
        expect(pinnedThreadIds()).toEqual([THREAD_ID, threadC]);
        expect(sidebarLayoutDispatchRequests).toHaveLength(dispatchCountAfterValidRemovals);
      });
      await page.screenshot({
        path: "../../../../.omo/evidence/sidebar-layout/browser-harness.png",
      });
    } finally {
      await mounted.cleanup();
      await page.viewport(414, 896);
    }
  });

  it("keeps the original unpin race at one unpin and zero compensating pins while reordering accessibly", async () => {
    const rootThread = fixture.snapshot.threads[0];
    const rootProject = fixture.snapshot.projects[0];
    if (rootThread === undefined || rootThread.session === null || rootProject === undefined) {
      throw new Error("Missing root pin fixture");
    }
    const rootSession = rootThread.session;
    const makeSibling = (
      id: ThreadId,
      title: string,
      projectId: ProjectId = rootThread.projectId,
    ): OrchestrationThread => ({
      ...rootThread,
      id,
      projectId,
      title,
      isPinned: true,
      messages: [],
      session: { ...rootSession, threadId: id },
    });
    fixture.snapshot = {
      ...fixture.snapshot,
      sidebarLayout: {
        projectOrder: [PROJECT_ID, CHAT_PROJECT_ID],
        pinnedThreadOrder: [OTHER_THREAD_ID, THIRD_THREAD_ID],
        revision: 1,
        updatedAt: NOW_ISO,
      },
      projects: [
        rootProject,
        {
          ...rootProject,
          id: CHAT_PROJECT_ID,
          kind: "chat",
          title: "Home",
          workspaceRoot: "/home/tester",
        },
      ],
      threads: [
        { ...rootThread, isPinned: true },
        makeSibling(OTHER_THREAD_ID, "T3Code Integration Ideas", CHAT_PROJECT_ID),
        makeSibling(THIRD_THREAD_ID, "Third pinned test thread"),
      ],
    };
    fixture.serverConfig = { ...fixture.serverConfig, homeDir: "/home/tester" };
    fixture.welcome = { ...fixture.welcome, homeDir: "/home/tester" };
    localStorage.setItem(
      "jcode:sidebar-ui:v1",
      JSON.stringify({
        chatSectionExpanded: true,
        expandedProjectThreadListCwds: ["/repo/project"],
      }),
    );
    await page.viewport(1280, 800);
    const mounted = await mountApp();

    try {
      await vi.waitFor(() => {
        expect(pinnedThreadIds()).toEqual([OTHER_THREAD_ID, THIRD_THREAD_ID]);
      });
      expect(document.querySelectorAll(`[data-sidebar-thread-id="${THREAD_ID}"]`)).toHaveLength(1);
      expect(document.querySelector(`[data-pinned-thread-id="${THREAD_ID}"]`)).toBeNull();
      expect(
        document.querySelectorAll(`[data-testid="thread-title-${OTHER_THREAD_ID}"]`),
      ).toHaveLength(1);
      expect(
        document.querySelectorAll(`[data-sidebar-thread-id="${OTHER_THREAD_ID}"]`),
      ).toHaveLength(1);
      await expect.element(page.getByText("No chats yet")).toBeVisible();

      await commands.clickProjectThreadPin(THREAD_ID);
      await vi.waitFor(() => {
        expect(pinnedThreadIds()).toEqual([OTHER_THREAD_ID, THIRD_THREAD_ID, THREAD_ID]);
      });
      expect(dispatchedCommand(sidebarLayoutDispatchRequests.at(-1))).toMatchObject({
        type: "sidebar-layout.thread.pin",
        threadId: THREAD_ID,
        beforeThreadId: null,
      });
      expect(document.querySelectorAll(`[data-testid="thread-title-${THREAD_ID}"]`)).toHaveLength(
        1,
      );
      expect(document.querySelector(`[data-pinned-thread-id="${THREAD_ID}"]`)).not.toBeNull();
      sendShellEventPush({
        kind: "sidebar-layout-updated",
        sequence: 2,
        sidebarLayout: {
          projectOrder: [PROJECT_ID, CHAT_PROJECT_ID],
          pinnedThreadOrder: [OTHER_THREAD_ID, THIRD_THREAD_ID, THREAD_ID],
          revision: 2,
          updatedAt: "2026-07-18T00:00:02.000Z",
        },
      });
      fixture.snapshot = {
        ...fixture.snapshot,
        snapshotSequence: 2,
        sidebarLayout: {
          projectOrder: [PROJECT_ID, CHAT_PROJECT_ID],
          pinnedThreadOrder: [OTHER_THREAD_ID, THIRD_THREAD_ID, THREAD_ID],
          revision: 2,
          updatedAt: "2026-07-18T00:00:02.000Z",
        },
      };

      const rootHandle = document.querySelector<HTMLButtonElement>(
        `button[data-pinned-thread-drag-handle="${THREAD_ID}"]`,
      );
      expect(rootHandle?.getAttribute("aria-label")).toBe("Reorder pinned thread Root test thread");
      expect(rootHandle?.getAttribute("aria-pressed")).toBe("false");
      expect(rootHandle?.tabIndex).toBe(0);
      rootHandle?.focus();
      expect(document.activeElement).toBe(rootHandle);
      await page.screenshot({
        path: "../../../../.omo/evidence/task-12-pinned-1280-handle-focus.png",
      });

      const commandCountBeforeOutOfBoundsDrag = sidebarLayoutDispatchRequests.length;
      expect(await commands.dragPinnedThreadOutOfBounds(THREAD_ID)).toBe(true);
      expect(sidebarLayoutDispatchRequests).toHaveLength(commandCountBeforeOutOfBoundsDrag);
      expect(pinnedThreadIds()).toEqual([OTHER_THREAD_ID, THIRD_THREAD_ID, THREAD_ID]);

      await commands.keyboardMovePinnedThread(THREAD_ID, "ArrowUp");
      await vi.waitFor(() => {
        expect(pinnedThreadIds()).toEqual([OTHER_THREAD_ID, THREAD_ID, THIRD_THREAD_ID]);
      });
      expect(dispatchedCommand(sidebarLayoutDispatchRequests.at(-1))).toMatchObject({
        type: "sidebar-layout.pinned-thread.move",
        threadId: THREAD_ID,
        beforeThreadId: THIRD_THREAD_ID,
      });
      const rootHandleAfterKeyboard = document.querySelector<HTMLButtonElement>(
        `button[data-pinned-thread-drag-handle="${THREAD_ID}"]`,
      );
      expect(document.activeElement).toBe(rootHandleAfterKeyboard);
      sendShellEventPush({
        kind: "sidebar-layout-updated",
        sequence: 4,
        sidebarLayout: {
          projectOrder: [PROJECT_ID, CHAT_PROJECT_ID],
          pinnedThreadOrder: [OTHER_THREAD_ID, THREAD_ID, THIRD_THREAD_ID],
          revision: 4,
          updatedAt: "2026-07-18T00:00:04.000Z",
        },
      });
      fixture.snapshot = {
        ...fixture.snapshot,
        snapshotSequence: 4,
        sidebarLayout: {
          projectOrder: [PROJECT_ID, CHAT_PROJECT_ID],
          pinnedThreadOrder: [OTHER_THREAD_ID, THREAD_ID, THIRD_THREAD_ID],
          revision: 4,
          updatedAt: "2026-07-18T00:00:04.000Z",
        },
      };
      await vi.waitFor(() => {
        const list = document.querySelector<HTMLElement>("[data-pinned-thread-list]");
        expect(list).not.toBeNull();
        expect(
          list
            ?.getAnimations({ subtree: true })
            .every((animation) => animation.playState !== "running"),
        ).toBe(true);
      });

      rejectNextSidebarLayoutDispatch = true;
      await commands.dragPinnedThread(THREAD_ID, THIRD_THREAD_ID);
      await expect.element(page.getByText("Unable to reorder pinned threads")).toBeVisible();
      await vi.waitFor(() => {
        expect(pinnedThreadIds()).toEqual([OTHER_THREAD_ID, THREAD_ID, THIRD_THREAD_ID]);
      });

      await commands.dragPinnedThread(THREAD_ID, THIRD_THREAD_ID);
      await vi.waitFor(() => {
        expect(pinnedThreadIds()).toEqual([OTHER_THREAD_ID, THIRD_THREAD_ID, THREAD_ID]);
      });
      expect(dispatchedCommand(sidebarLayoutDispatchRequests.at(-1))).toMatchObject({
        type: "sidebar-layout.pinned-thread.move",
        threadId: THREAD_ID,
        beforeThreadId: null,
      });
      sendShellEventPush({
        kind: "sidebar-layout-updated",
        sequence: 5,
        sidebarLayout: {
          projectOrder: [PROJECT_ID, CHAT_PROJECT_ID],
          pinnedThreadOrder: [OTHER_THREAD_ID, THIRD_THREAD_ID, THREAD_ID],
          revision: 5,
          updatedAt: "2026-07-18T00:00:05.000Z",
        },
      });

      sendShellEventPush({
        kind: "sidebar-layout-updated",
        sequence: 10,
        sidebarLayout: {
          projectOrder: [PROJECT_ID, CHAT_PROJECT_ID],
          pinnedThreadOrder: [OTHER_THREAD_ID, THIRD_THREAD_ID, THREAD_ID],
          revision: 10,
          updatedAt: "2026-07-18T00:00:10.000Z",
        },
      });
      holdSidebarLayoutDispatchResponses = true;
      await commands.clickPinnedThreadUnpin(OTHER_THREAD_ID);
      await vi.waitFor(() => {
        expect(dispatchedCommand(sidebarLayoutDispatchRequests.at(-1))).toMatchObject({
          type: "sidebar-layout.thread.unpin",
          threadId: OTHER_THREAD_ID,
        });
        expect(pinnedThreadIds()).toEqual([THIRD_THREAD_ID, THREAD_ID]);
      });
      sendShellEventPush({
        kind: "sidebar-layout-updated",
        sequence: 11,
        sidebarLayout: {
          projectOrder: [PROJECT_ID, CHAT_PROJECT_ID],
          pinnedThreadOrder: [THREAD_ID, OTHER_THREAD_ID, THIRD_THREAD_ID],
          revision: 11,
          updatedAt: "2026-07-18T00:00:11.000Z",
        },
      });
      await vi.waitFor(() => {
        expect(pinnedThreadIds()).toEqual([THREAD_ID, THIRD_THREAD_ID]);
      });
      const commandsForRaceThread = sidebarLayoutDispatchRequests
        .map(dispatchedCommand)
        .filter((command) => command?.["threadId"] === OTHER_THREAD_ID);
      expect(
        commandsForRaceThread.filter(
          (command) => command?.["type"] === "sidebar-layout.thread.unpin",
        ),
      ).toHaveLength(1);
      expect(
        commandsForRaceThread.filter(
          (command) => command?.["type"] === "sidebar-layout.thread.pin",
        ),
      ).toHaveLength(0);
      expect(
        document.querySelectorAll(`[data-sidebar-thread-id="${OTHER_THREAD_ID}"]`),
      ).toHaveLength(1);
      await page.screenshot({
        path: "../../../../.omo/evidence/task-12-pinned-1280-post-reorder-unpin.png",
      });
    } finally {
      for (const resolve of sidebarLayoutDispatchResolvers) {
        resolve({ sequence: 12 });
      }
      await mounted.cleanup();
      await page.viewport(414, 896);
    }
  });

  it("does not block the pair route with the first-run wizard", async () => {
    fixture.firstRunWizardData = createFirstRunWizardData();
    const mounted = await mountApp({ initialPath: "/pair", waitForThreadId: null });

    try {
      await expect.element(page.getByRole("button", { name: "Pair client" })).toBeVisible();
      expect(document.body.textContent).not.toContain("Welcome to JCode");
      expect(document.body.textContent).not.toContain("Choose a provider");
    } finally {
      await mounted.cleanup();
    }
  });

  it("drops duplicate thread events after the thread snapshot sequence advances", async () => {
    const mounted = await mountApp();

    try {
      const firstAssistantChunk = {
        sequence: 2,
        eventId: EventId.makeUnsafe("event-message-2"),
        aggregateKind: "thread",
        aggregateId: THREAD_ID,
        occurredAt: "2026-03-04T12:00:05.000Z",
        commandId: null,
        causationEventId: null,
        correlationId: null,
        metadata: {},
        type: "thread.message-sent",
        payload: {
          threadId: THREAD_ID,
          messageId: MessageId.makeUnsafe("msg-assistant-1"),
          role: "assistant",
          text: "hello",
          turnId: TurnId.makeUnsafe("turn-1"),
          source: "native",
          streaming: true,
          createdAt: "2026-03-04T12:00:05.000Z",
          updatedAt: "2026-03-04T12:00:05.000Z",
        },
      } satisfies Extract<OrchestrationEvent, { type: "thread.message-sent" }>;

      sendThreadEventPush(firstAssistantChunk);

      await vi.waitFor(
        () => {
          const thread = getThreadFromState(useStore.getState(), THREAD_ID);
          const message = thread?.messages.find(
            (entry) => entry.id === MessageId.makeUnsafe("msg-assistant-1"),
          );
          expect(message?.text).toBe("hello");
        },
        { timeout: 4_000, interval: 16 },
      );

      sendThreadEventPush(firstAssistantChunk);

      await new Promise((resolve) => window.setTimeout(resolve, 120));

      const threadAfterDuplicate = useStore.getState();
      expect(
        getThreadFromState(threadAfterDuplicate, THREAD_ID)?.messages.filter(
          (entry) => entry.id === MessageId.makeUnsafe("msg-assistant-1"),
        ),
      ).toHaveLength(1);

      const secondAssistantChunk = {
        ...firstAssistantChunk,
        sequence: 3,
        eventId: EventId.makeUnsafe("event-message-3"),
        occurredAt: "2026-03-04T12:00:06.000Z",
        payload: {
          ...firstAssistantChunk.payload,
          text: "hello world",
          streaming: false,
          updatedAt: "2026-03-04T12:00:06.000Z",
        },
      } satisfies Extract<OrchestrationEvent, { type: "thread.message-sent" }>;

      sendThreadEventPush(secondAssistantChunk);

      await vi.waitFor(
        () => {
          const thread = getThreadFromState(useStore.getState(), THREAD_ID);
          const message = thread?.messages.find(
            (entry) => entry.id === MessageId.makeUnsafe("msg-assistant-1"),
          );
          expect(message?.text).toBe("hello world");
          expect(message?.streaming).toBe(false);
        },
        { timeout: 4_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("replays missed thread detail events when a subscribed shell row advances", async () => {
    const mounted = await mountApp();

    try {
      const assistantMessage = {
        sequence: 2,
        eventId: EventId.makeUnsafe("event-replay-assistant"),
        aggregateKind: "thread",
        aggregateId: THREAD_ID,
        occurredAt: "2026-03-04T12:00:05.000Z",
        commandId: null,
        causationEventId: null,
        correlationId: null,
        metadata: {},
        type: "thread.message-sent",
        payload: {
          threadId: THREAD_ID,
          messageId: MessageId.makeUnsafe("msg-replayed-assistant"),
          role: "assistant",
          text: "Recovered from replay",
          turnId: TurnId.makeUnsafe("turn-replayed"),
          source: "native",
          streaming: false,
          createdAt: "2026-03-04T12:00:05.000Z",
          updatedAt: "2026-03-04T12:00:05.000Z",
        },
      } satisfies Extract<OrchestrationEvent, { type: "thread.message-sent" }>;
      const sessionReady = {
        sequence: 3,
        eventId: EventId.makeUnsafe("event-replay-session-ready"),
        aggregateKind: "thread",
        aggregateId: THREAD_ID,
        occurredAt: "2026-03-04T12:00:06.000Z",
        commandId: null,
        causationEventId: null,
        correlationId: null,
        metadata: {},
        type: "thread.session-set",
        payload: {
          threadId: THREAD_ID,
          session: {
            threadId: THREAD_ID,
            status: "ready",
            providerName: "codex",
            runtimeMode: "full-access",
            activeTurnId: null,
            lastError: null,
            updatedAt: "2026-03-04T12:00:06.000Z",
          },
        },
      } satisfies Extract<OrchestrationEvent, { type: "thread.session-set" }>;
      const otherThreadMessage = {
        sequence: 4,
        eventId: EventId.makeUnsafe("event-replay-other-thread"),
        aggregateKind: "thread",
        aggregateId: OTHER_THREAD_ID,
        occurredAt: "2026-03-04T12:00:07.000Z",
        commandId: null,
        causationEventId: null,
        correlationId: null,
        metadata: {},
        type: "thread.message-sent",
        payload: {
          threadId: OTHER_THREAD_ID,
          messageId: MessageId.makeUnsafe("msg-replayed-other-thread"),
          role: "assistant",
          text: "Wrong thread",
          turnId: TurnId.makeUnsafe("turn-replayed-other-thread"),
          source: "native",
          streaming: false,
          createdAt: "2026-03-04T12:00:07.000Z",
          updatedAt: "2026-03-04T12:00:07.000Z",
        },
      } satisfies Extract<OrchestrationEvent, { type: "thread.message-sent" }>;
      const futureSameThreadMessage = {
        ...assistantMessage,
        sequence: 5,
        eventId: EventId.makeUnsafe("event-replay-future-assistant"),
        occurredAt: "2026-03-04T12:00:08.000Z",
        payload: {
          ...assistantMessage.payload,
          messageId: MessageId.makeUnsafe("msg-replayed-future-assistant"),
          text: "Future event",
          createdAt: "2026-03-04T12:00:08.000Z",
          updatedAt: "2026-03-04T12:00:08.000Z",
        },
      } satisfies Extract<OrchestrationEvent, { type: "thread.message-sent" }>;
      replayEvents = [assistantMessage, sessionReady, otherThreadMessage, futureSameThreadMessage];

      sendShellEventPush({
        kind: "thread-upserted",
        sequence: 3,
        thread: {
          ...createShellSnapshotFromFixtureSnapshot(fixture.snapshot).threads[0]!,
          updatedAt: "2026-03-04T12:00:06.000Z",
          session: sessionReady.payload.session,
        },
      });

      await vi.waitFor(
        () => {
          const thread = getThreadFromState(useStore.getState(), THREAD_ID);
          expect(
            thread?.messages.some(
              (message) =>
                message.id === MessageId.makeUnsafe("msg-replayed-assistant") &&
                message.text === "Recovered from replay" &&
                message.streaming === false,
            ),
          ).toBe(true);
          expect(thread?.session?.orchestrationStatus).toBe("ready");
          expect(
            thread?.messages.some(
              (message) => message.id === MessageId.makeUnsafe("msg-replayed-future-assistant"),
            ),
          ).toBe(false);
          expect(thread?.messages.some((message) => message.text === "Wrong thread")).toBe(false);
        },
        { timeout: 4_000, interval: 16 },
      );
      expect(replayRequestCursors).toContain(1);
    } finally {
      await mounted.cleanup();
    }
  });

  it("polls a subscribed running thread to recover missed detail events", async () => {
    const runningTurnId = TurnId.makeUnsafe("turn-catchup-running");
    fixture = {
      ...fixture,
      snapshot: createSnapshot({
        latestTurn: {
          turnId: runningTurnId,
          state: "running",
          requestedAt: "2026-03-04T12:00:04.000Z",
          startedAt: "2026-03-04T12:00:04.500Z",
          completedAt: null,
          assistantMessageId: null,
        },
        session: {
          threadId: THREAD_ID,
          status: "running",
          providerName: "opencode",
          runtimeMode: "full-access",
          activeTurnId: runningTurnId,
          lastError: null,
          updatedAt: "2026-03-04T12:00:04.500Z",
        },
        updatedAt: "2026-03-04T12:00:04.500Z",
      }),
    };

    const assistantMessage = {
      sequence: 2,
      eventId: EventId.makeUnsafe("event-catchup-assistant"),
      aggregateKind: "thread",
      aggregateId: THREAD_ID,
      occurredAt: "2026-03-04T12:00:05.000Z",
      commandId: null,
      causationEventId: null,
      correlationId: null,
      metadata: {},
      type: "thread.message-sent",
      payload: {
        threadId: THREAD_ID,
        messageId: MessageId.makeUnsafe("msg-catchup-assistant"),
        role: "assistant",
        text: "Recovered by periodic catch-up",
        turnId: runningTurnId,
        source: "native",
        streaming: false,
        createdAt: "2026-03-04T12:00:05.000Z",
        updatedAt: "2026-03-04T12:00:05.000Z",
      },
    } satisfies Extract<OrchestrationEvent, { type: "thread.message-sent" }>;
    const sessionReady = {
      sequence: 3,
      eventId: EventId.makeUnsafe("event-catchup-session-ready"),
      aggregateKind: "thread",
      aggregateId: THREAD_ID,
      occurredAt: "2026-03-04T12:00:06.000Z",
      commandId: null,
      causationEventId: null,
      correlationId: null,
      metadata: {},
      type: "thread.session-set",
      payload: {
        threadId: THREAD_ID,
        session: {
          threadId: THREAD_ID,
          status: "ready",
          providerName: "opencode",
          runtimeMode: "full-access",
          activeTurnId: null,
          lastError: null,
          updatedAt: "2026-03-04T12:00:06.000Z",
        },
      },
    } satisfies Extract<OrchestrationEvent, { type: "thread.session-set" }>;
    replayEvents = [assistantMessage, sessionReady];

    const mounted = await mountApp();

    try {
      await vi.waitFor(
        () => {
          const thread = getThreadFromState(useStore.getState(), THREAD_ID);
          expect(
            thread?.messages.some(
              (message) =>
                message.id === MessageId.makeUnsafe("msg-catchup-assistant") &&
                message.text === "Recovered by periodic catch-up" &&
                message.streaming === false,
            ),
          ).toBe(true);
          expect(thread?.session?.orchestrationStatus).toBe("ready");
        },
        { timeout: 5_000, interval: 16 },
      );
      expect(replayRequestCursors).toContain(1);
    } finally {
      fixture = buildFixture();
      await mounted.cleanup();
    }
  });

  it("flushes only the first assistant chunk immediately for a message", async () => {
    const mounted = await mountApp();

    try {
      const firstAssistantChunk = {
        sequence: 2,
        eventId: EventId.makeUnsafe("event-message-immediate-1"),
        aggregateKind: "thread",
        aggregateId: THREAD_ID,
        occurredAt: "2026-03-04T12:00:05.000Z",
        commandId: null,
        causationEventId: null,
        correlationId: null,
        metadata: {},
        type: "thread.message-sent",
        payload: {
          threadId: THREAD_ID,
          messageId: MessageId.makeUnsafe("msg-assistant-immediate"),
          role: "assistant",
          text: "I’ll start",
          turnId: TurnId.makeUnsafe("turn-immediate"),
          source: "native",
          streaming: true,
          createdAt: "2026-03-04T12:00:05.000Z",
          updatedAt: "2026-03-04T12:00:05.000Z",
        },
      } satisfies Extract<OrchestrationEvent, { type: "thread.message-sent" }>;

      sendThreadEventPush(firstAssistantChunk);

      await vi.waitFor(
        () => {
          const thread = getThreadFromState(useStore.getState(), THREAD_ID);
          const message = thread?.messages.find(
            (entry) => entry.id === MessageId.makeUnsafe("msg-assistant-immediate"),
          );
          expect(message?.text).toBe("I’ll start");
          expect(message?.streaming).toBe(true);
        },
        { timeout: 4_000, interval: 16 },
      );

      const secondAssistantChunk = {
        ...firstAssistantChunk,
        sequence: 3,
        eventId: EventId.makeUnsafe("event-message-immediate-2"),
        occurredAt: "2026-03-04T12:00:05.050Z",
        payload: {
          ...firstAssistantChunk.payload,
          text: " by scanning the repository.",
          updatedAt: "2026-03-04T12:00:05.050Z",
        },
      } satisfies Extract<OrchestrationEvent, { type: "thread.message-sent" }>;

      sendThreadEventPush(secondAssistantChunk);

      await new Promise((resolve) => window.setTimeout(resolve, 20));

      const threadBeforeThrottleFlush = getThreadFromState(useStore.getState(), THREAD_ID);
      const messageBeforeThrottleFlush = threadBeforeThrottleFlush?.messages.find(
        (entry) => entry.id === MessageId.makeUnsafe("msg-assistant-immediate"),
      );
      expect(messageBeforeThrottleFlush?.text).toBe("I’ll start");

      await vi.waitFor(
        () => {
          const thread = getThreadFromState(useStore.getState(), THREAD_ID);
          const message = thread?.messages.find(
            (entry) => entry.id === MessageId.makeUnsafe("msg-assistant-immediate"),
          );
          expect(message?.text).toBe("I’ll start by scanning the repository.");
        },
        { timeout: 4_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("recovers buffered thread events by re-requesting the missing thread snapshot", async () => {
    delayNextThreadSnapshot = true;
    const mounted = await mountApp();

    try {
      const bufferedEvent = {
        sequence: 2,
        eventId: EventId.makeUnsafe("event-buffered-message"),
        aggregateKind: "thread",
        aggregateId: THREAD_ID,
        occurredAt: "2026-03-04T12:00:07.000Z",
        commandId: null,
        causationEventId: null,
        correlationId: null,
        metadata: {},
        type: "thread.message-sent",
        payload: {
          threadId: THREAD_ID,
          messageId: MessageId.makeUnsafe("msg-buffered-assistant"),
          role: "assistant",
          text: "buffered reply",
          turnId: TurnId.makeUnsafe("turn-2"),
          source: "native",
          streaming: false,
          createdAt: "2026-03-04T12:00:07.000Z",
          updatedAt: "2026-03-04T12:00:07.000Z",
        },
      } satisfies Extract<OrchestrationEvent, { type: "thread.message-sent" }>;

      sendThreadEventPush(bufferedEvent);

      let thread;
      await vi.waitFor(
        () => {
          thread = getThreadFromState(useStore.getState(), THREAD_ID);
          const message = thread?.messages.find(
            (entry) => entry.id === MessageId.makeUnsafe("msg-buffered-assistant"),
          );
          expect(message?.text).toBe("buffered reply");
        },
        { timeout: 4_000, interval: 16 },
      );

      sendThreadEventPush(bufferedEvent);

      await new Promise((resolve) => window.setTimeout(resolve, 120));

      thread = getThreadFromState(useStore.getState(), THREAD_ID);
      expect(
        thread?.messages.filter(
          (entry) => entry.id === MessageId.makeUnsafe("msg-buffered-assistant"),
        ),
      ).toHaveLength(1);
    } finally {
      await mounted.cleanup();
    }
  });

  it("requests a thread snapshot again when a subscribed draft thread becomes real", async () => {
    const draftThreadId = ThreadId.makeUnsafe("thread-draft-promoted");
    delayNextThreadSnapshot = true;
    useComposerDraftStore.setState({
      draftsByThreadId: {},
      draftThreadsByThreadId: {
        [draftThreadId]: {
          projectId: PROJECT_ID,
          createdAt: NOW_ISO,
          runtimeMode: "full-access",
          interactionMode: "default",
          entryPoint: "chat",
          branch: null,
          worktreePath: null,
          envMode: "local",
          isTemporary: false,
        },
      },
      projectDraftThreadIdByProjectId: {
        [PROJECT_ID]: draftThreadId,
      },
    });

    const mounted = await mountApp({
      routeThreadId: draftThreadId,
      waitForThreadId: null,
    });

    try {
      await vi.waitFor(
        () => {
          expect(
            subscribeThreadRequests.filter((threadId) => threadId === draftThreadId).length,
          ).toBeGreaterThanOrEqual(1);
        },
        { timeout: 4_000, interval: 16 },
      );

      const baseThread = fixture.snapshot.threads[0]!;
      fixture.snapshot = {
        ...fixture.snapshot,
        snapshotSequence: 2,
        threads: [
          ...fixture.snapshot.threads,
          {
            ...baseThread,
            id: draftThreadId,
            title: "Promoted thread",
            messages: [],
            activities: [],
            proposedPlans: [],
            checkpoints: [],
            latestTurn: null,
            updatedAt: "2026-03-04T12:00:08.000Z",
          } satisfies OrchestrationReadModel["threads"][number],
        ],
      };

      sendThreadEventPush({
        sequence: 3,
        eventId: EventId.makeUnsafe("event-draft-promoted-assistant"),
        aggregateKind: "thread",
        aggregateId: draftThreadId,
        occurredAt: "2026-03-04T12:00:09.000Z",
        commandId: null,
        causationEventId: null,
        correlationId: null,
        metadata: {},
        type: "thread.message-sent",
        payload: {
          threadId: draftThreadId,
          messageId: MessageId.makeUnsafe("msg-draft-promoted-assistant"),
          role: "assistant",
          text: "draft promotion rendered",
          turnId: TurnId.makeUnsafe("turn-draft-promoted"),
          source: "native",
          streaming: false,
          createdAt: "2026-03-04T12:00:09.000Z",
          updatedAt: "2026-03-04T12:00:09.000Z",
        },
      } satisfies Extract<OrchestrationEvent, { type: "thread.message-sent" }>);

      sendShellEventPush({
        kind: "thread-upserted",
        sequence: 2,
        thread: createShellSnapshotFromFixtureSnapshot(fixture.snapshot).threads.find(
          (thread) => thread.id === draftThreadId,
        )!,
      });

      await vi.waitFor(
        () => {
          expect(useStore.getState().threads.some((thread) => thread.id === draftThreadId)).toBe(
            true,
          );
          expect(subscribeThreadRequestCountById.get(draftThreadId)).toBeGreaterThanOrEqual(2);
          expect(
            subscribeThreadRequests.filter((threadId) => threadId === draftThreadId).length,
          ).toBeGreaterThanOrEqual(2);
          const thread = getThreadFromState(useStore.getState(), draftThreadId);
          expect(thread?.messages.at(-1)?.text).toBe("draft promotion rendered");
        },
        { timeout: 4_000, interval: 16 },
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it("keeps a live assistant intro when a lagging thread snapshot arrives right after it", async () => {
    const mounted = await mountApp();

    try {
      const introEvent = {
        sequence: 2,
        eventId: EventId.makeUnsafe("event-assistant-intro"),
        aggregateKind: "thread",
        aggregateId: THREAD_ID,
        occurredAt: "2026-03-04T12:00:07.000Z",
        commandId: null,
        causationEventId: null,
        correlationId: null,
        metadata: {},
        type: "thread.message-sent",
        payload: {
          threadId: THREAD_ID,
          messageId: MessageId.makeUnsafe("msg-assistant-intro"),
          role: "assistant",
          text: "I'll start by scanning the repository.",
          turnId: TurnId.makeUnsafe("turn-intro"),
          source: "native",
          streaming: true,
          createdAt: "2026-03-04T12:00:07.000Z",
          updatedAt: "2026-03-04T12:00:07.000Z",
        },
      } satisfies Extract<OrchestrationEvent, { type: "thread.message-sent" }>;

      sendThreadEventPush(introEvent);

      await vi.waitFor(
        () => {
          const thread = getThreadFromState(useStore.getState(), THREAD_ID);
          const message = thread?.messages.find(
            (entry) => entry.id === MessageId.makeUnsafe("msg-assistant-intro"),
          );
          expect(message?.text).toBe("I'll start by scanning the repository.");
        },
        { timeout: 4_000, interval: 16 },
      );

      const previousFixture = fixture;
      fixture = {
        ...fixture,
        snapshot: createSnapshot({
          latestTurn: {
            turnId: TurnId.makeUnsafe("turn-intro"),
            state: "running",
            requestedAt: "2026-03-04T12:00:07.000Z",
            startedAt: "2026-03-04T12:00:07.000Z",
            completedAt: null,
            assistantMessageId: null,
          },
          updatedAt: "2026-03-04T12:00:07.500Z",
        }),
      };

      sendThreadSnapshotPush(THREAD_ID, 3);

      await vi.waitFor(
        () => {
          const thread = getThreadFromState(useStore.getState(), THREAD_ID);
          const message = thread?.messages.find(
            (entry) => entry.id === MessageId.makeUnsafe("msg-assistant-intro"),
          );
          expect(message?.text).toBe("I'll start by scanning the repository.");
          expect(thread?.latestTurn?.assistantMessageId).toBe(
            MessageId.makeUnsafe("msg-assistant-intro"),
          );
        },
        { timeout: 4_000, interval: 16 },
      );

      fixture = previousFixture;
    } finally {
      fixture = buildFixture();
      await mounted.cleanup();
    }
  });

  it("does not resubscribe shell sync when workspace pages change", async () => {
    const mounted = await mountApp();

    try {
      let initialSubscribeShellCount = 0;
      await vi.waitFor(
        () => {
          expect(subscribeShellRequestCount).toBeGreaterThan(0);
          initialSubscribeShellCount = subscribeShellRequestCount;
        },
        { timeout: 4_000, interval: 16 },
      );

      useWorkspaceStore.getState().createWorkspace();

      await new Promise((resolve) => window.setTimeout(resolve, 120));

      expect(subscribeShellRequestCount).toBe(initialSubscribeShellCount);
    } finally {
      await mounted.cleanup();
    }
  });
});
