import "../index.css";

import {
  DEFAULT_SERVER_SETTINGS,
  type FirstRunWizardData,
  ORCHESTRATION_WS_METHODS,
  type MessageId,
  type OrchestrationReadModel,
  type OrchestrationShellSnapshot,
  type OrchestrationThread,
  type ProjectId,
  type ServerConfig,
  type ServerConfigUpdatedPayload,
  type ThreadId,
  type WsWelcomePayload,
  WS_CHANNELS,
  WS_METHODS,
} from "@jcode/contracts";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { http, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { useComposerDraftStore } from "../composerDraftStore";
import { getRouter } from "../router";
import { useStore } from "../store";
import { __resetWsNativeApiForTests } from "../wsNativeApi";

const THREAD_ID = "thread-kb-toast-test" as ThreadId;
const PROJECT_ID = "project-1" as ProjectId;
const NOW_ISO = "2026-03-04T12:00:00.000Z";

interface TestFixture {
  snapshot: OrchestrationReadModel;
  serverConfig: ServerConfig;
  firstRunWizardData: FirstRunWizardData;
  welcome: WsWelcomePayload;
}

let fixture: TestFixture;
let emitServerConfigUpdated: ((payload: ServerConfigUpdatedPayload) => void) | null = null;

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

function createCompletedFirstRunWizardData(): FirstRunWizardData {
  return {
    state: {
      completed: true,
      completedAt: NOW_ISO,
      selectedProvider: "codex",
      skipped: false,
    },
    currentStep: "complete",
    scanResults: {
      scannedAt: NOW_ISO,
      providers: [
        {
          provider: "codex",
          status: "ready",
          hasCredentials: true,
          hasBinary: true,
          credentials: [],
        },
      ],
    },
  };
}

function createMinimalSnapshot(): OrchestrationReadModel {
  return {
    snapshotSequence: 1,
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
        title: "Test thread",
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
            id: "msg-1" as MessageId,
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
      },
    ],
    updatedAt: NOW_ISO,
  };
}

function buildFixture(): TestFixture {
  return {
    snapshot: createMinimalSnapshot(),
    serverConfig: createBaseServerConfig(),
    firstRunWizardData: createCompletedFirstRunWizardData(),
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
    projects: snapshot.projects.map((project) => ({
      id: project.id,
      kind: project.kind,
      title: project.title,
      workspaceRoot: project.workspaceRoot,
      defaultModelSelection: project.defaultModelSelection,
      scripts: project.scripts,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    })),
    threads: snapshot.threads.map((thread) => ({
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

function resolveWsRpc(tag: string): unknown {
  if (tag === ORCHESTRATION_WS_METHODS.getSnapshot) {
    return fixture.snapshot;
  }
  if (tag === ORCHESTRATION_WS_METHODS.getShellSnapshot) {
    return createShellSnapshotFromFixtureSnapshot(fixture.snapshot);
  }
  if (tag === WS_METHODS.serverGetConfig) {
    return fixture.serverConfig;
  }
  if (tag === WS_METHODS.serverGetSettings) {
    return DEFAULT_SERVER_SETTINGS;
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
  return {};
}

const worker = setupWorker(
  http.get("*/attachments/:attachmentId", () => new HttpResponse(null, { status: 204 })),
  http.get("*/api/project-favicon", () => new HttpResponse(null, { status: 204 })),
);

function installTransportDriver(): void {
  window.__T3_WS_TRANSPORT_TEST_DRIVER__ = {
    request: (method) => resolveWsRpc(method),
    subscribeChannel: (channel, emit) => {
      if (channel === WS_CHANNELS.serverWelcome) {
        queueMicrotask(() => emit(fixture.welcome));
      }
      if (channel === WS_CHANNELS.serverConfigUpdated) {
        emitServerConfigUpdated = emit as (payload: ServerConfigUpdatedPayload) => void;
        return () => {
          if (emitServerConfigUpdated === emit) {
            emitServerConfigUpdated = null;
          }
        };
      }
      return undefined;
    },
    subscribeShell: (emit) => {
      queueMicrotask(() =>
        emit({
          kind: "snapshot",
          snapshot: createShellSnapshotFromFixtureSnapshot(fixture.snapshot),
        }),
      );
    },
    subscribeThread: (input, emit) => {
      const threadId = (input as { threadId: ThreadId }).threadId;
      queueMicrotask(() =>
        emit({
          kind: "snapshot",
          snapshot: {
            snapshotSequence: fixture.snapshot.snapshotSequence,
            thread: getThreadDetailFromFixtureSnapshot(threadId),
          },
        }),
      );
    },
  };
}

function sendServerConfigUpdatedPush(issues: ServerConfigUpdatedPayload["issues"]) {
  if (!emitServerConfigUpdated) throw new Error("Server config stream not connected");
  emitServerConfigUpdated({
    issues,
    providers: fixture.serverConfig.providers,
  });
}

function queryToastTitles(): string[] {
  return Array.from(document.querySelectorAll('[data-slot="toast-title"]')).map(
    (el) => el.textContent ?? "",
  );
}

async function waitForElement<T extends Element>(
  query: () => T | null,
  errorMessage: string,
): Promise<T> {
  let element: T | null = null;
  await vi.waitFor(
    () => {
      element = query();
      expect(element, errorMessage).toBeTruthy();
    },
    { timeout: 8_000, interval: 16 },
  );
  return element!;
}

async function waitForComposerEditor(): Promise<HTMLElement> {
  return waitForElement(
    () => document.querySelector<HTMLElement>('[data-testid="composer-editor"]'),
    "App should render composer editor",
  );
}

async function waitForToast(title: string, count = 1): Promise<void> {
  await vi.waitFor(
    () => {
      const matches = queryToastTitles().filter((t) => t === title);
      expect(matches.length, `Expected ${count} "${title}" toast(s)`).toBeGreaterThanOrEqual(count);
    },
    { timeout: 4_000, interval: 16 },
  );
}

async function waitForNoToast(title: string): Promise<void> {
  await vi.waitFor(
    () => {
      expect(queryToastTitles().filter((t) => t === title)).toHaveLength(0);
    },
    { timeout: 10_000, interval: 50 },
  );
}

async function mountApp(): Promise<{ cleanup: () => Promise<void> }> {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.width = "100vw";
  host.style.height = "100vh";
  host.style.display = "grid";
  host.style.overflow = "hidden";
  document.body.append(host);

  const router = getRouter(createMemoryHistory({ initialEntries: [`/${THREAD_ID}`] }));

  const screen = await render(<RouterProvider router={router} />, { container: host });
  await waitForComposerEditor();

  return {
    cleanup: async () => {
      await screen.unmount();
      host.remove();
    },
  };
}

describe("Keybindings update toast", () => {
  beforeAll(async () => {
    fixture = buildFixture();
    await worker.start({
      onUnhandledRequest: "bypass",
      quiet: true,
      serviceWorker: { url: "/mockServiceWorker.js" },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  beforeEach(() => {
    fixture = buildFixture();
    __resetWsNativeApiForTests();
    installTransportDriver();
    localStorage.clear();
    document.body.innerHTML = "";
    useComposerDraftStore.setState({
      draftsByThreadId: {},
      draftThreadsByThreadId: {},
      projectDraftThreadIdByProjectId: {},
    });
    useStore.setState({
      projects: [],
      threads: [],
      sidebarThreadSummaryById: {},
      threadsHydrated: false,
    });
  });

  afterEach(() => {
    __resetWsNativeApiForTests();
    delete window.__T3_WS_TRANSPORT_TEST_DRIVER__;
    document.body.innerHTML = "";
  });

  it("does not show success toasts for passive keybinding reloads", async () => {
    const mounted = await mountApp();

    try {
      sendServerConfigUpdatedPush([]);
      await waitForNoToast("Keybindings updated");

      sendServerConfigUpdatedPush([]);
      await waitForNoToast("Keybindings updated");
    } finally {
      await mounted.cleanup();
    }
  });

  it("shows a warning toast when keybinding config has issues", async () => {
    const mounted = await mountApp();

    try {
      sendServerConfigUpdatedPush([
        { kind: "keybindings.malformed-config", message: "Expected JSON array" },
      ]);
      await waitForToast("Invalid keybindings configuration");
    } finally {
      await mounted.cleanup();
    }
  });

  it("does not show a toast from the replayed cached value on subscribe", async () => {
    const mounted = await mountApp();

    try {
      sendServerConfigUpdatedPush([]);
      await waitForNoToast("Keybindings updated");

      // Remount the app — onServerConfigUpdated replays the cached value
      // synchronously on subscribe. This should NOT produce a toast.
      await mounted.cleanup();
      const remounted = await mountApp();

      // Give it a moment to process the replayed value
      await new Promise((resolve) => setTimeout(resolve, 500));

      const titles = queryToastTitles();
      expect(
        titles.filter((t) => t === "Keybindings updated").length,
        "Replayed cached value should not produce a toast",
      ).toBe(0);

      await remounted.cleanup();
    } catch (error) {
      await mounted.cleanup().catch(() => {});
      throw error;
    }
  });
});
