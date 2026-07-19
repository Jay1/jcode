import {
  CommandId,
  ProjectId,
  ThreadId,
  type DispatchResult,
  type OrchestrationShellStreamEvent,
  type SidebarLayout,
} from "@jcode/contracts";
import { describe, expect, it } from "vitest";
import { createSidebarLayoutRouter } from "./sidebarLayoutRouter";
import { sidebarLayoutLegacySubjectsReady } from "./sidebarLayoutRouter";
import {
  createSidebarLayoutStore,
  type SidebarLayoutCommand,
  type SidebarLayoutDispatch,
} from "./sidebarLayoutStore";

type PendingDispatch = {
  readonly command: SidebarLayoutCommand;
  readonly resolve: (result: DispatchResult) => void;
  readonly reject: (error: unknown) => void;
};

class ControllableTransport {
  readonly commands: SidebarLayoutCommand[] = [];
  readonly pending: PendingDispatch[] = [];

  readonly dispatchCommand: SidebarLayoutDispatch = (command) => {
    this.commands.push(command);
    return new Promise((resolve, reject) => this.pending.push({ command, resolve, reject }));
  };
}

const projectA = ProjectId.makeUnsafe("project-a");
const projectB = ProjectId.makeUnsafe("project-b");
const threadA = ThreadId.makeUnsafe("thread-a");
const commandA = CommandId.makeUnsafe("command-a");
const commandB = CommandId.makeUnsafe("command-b");

const lifecycle = {
  projects: [
    { id: projectA, kind: "project", createdAt: "2026-01-01T00:00:00Z", deletedAt: null },
    { id: projectB, kind: "project", createdAt: "2026-01-02T00:00:00Z", deletedAt: null },
  ],
  threads: [{ id: threadA, deletedAt: null }],
} as const;

function layout(revision: number, projectOrder = [projectA, projectB]): SidebarLayout {
  return {
    projectOrder,
    pinnedThreadOrder: [threadA],
    revision,
    updatedAt: `2026-07-18T00:00:${String(revision).padStart(2, "0")}.000Z`,
  };
}

function layoutEvent(revision: number, projectOrder = [projectA, projectB]) {
  return {
    kind: "sidebar-layout-updated",
    sequence: revision,
    sidebarLayout: layout(revision, projectOrder),
  } satisfies OrchestrationShellStreamEvent;
}

async function flushDispatch(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("sidebar layout router", () => {
  it("defers transient empty streams but treats an authoritative empty query as ready", () => {
    // Given: both observations contain a genuinely empty lifecycle.
    const emptyLifecycle = { projects: [], threads: [] } as const;

    // When/Then: stream emptiness is provisional, while the bootstrap query is authoritative.
    expect(sidebarLayoutLegacySubjectsReady("stream", emptyLifecycle)).toBe(false);
    expect(sidebarLayoutLegacySubjectsReady("query", emptyLifecycle)).toBe(true);
    expect(sidebarLayoutLegacySubjectsReady("stream", lifecycle)).toBe(true);
    expect(
      sidebarLayoutLegacySubjectsReady("stream", { projects: lifecycle.projects, threads: [] }),
    ).toBe(true);
    expect(
      sidebarLayoutLegacySubjectsReady("stream", { projects: [], threads: lifecycle.threads }),
    ).toBe(true);
  });

  it("initializes only after a null snapshot and legacy candidates are ready", async () => {
    // Given: a hydrated null snapshot whose candidate read has not completed.
    const transport = new ControllableTransport();
    const store = createSidebarLayoutStore({
      dispatchCommand: transport.dispatchCommand,
      createCommandId: () => commandA,
    });
    const router = createSidebarLayoutRouter({ store });
    router.acceptSnapshot({ sidebarLayout: null, lifecycle });
    await flushDispatch();
    expect(transport.commands).toEqual([]);

    // When: the same hydrated snapshot is delivered with ready candidates.
    router.acceptSnapshot({
      sidebarLayout: null,
      lifecycle,
      legacyCandidates: { projectOrder: [projectB], pinnedThreadOrder: [threadA] },
    });
    await flushDispatch();

    // Then: exactly one initialize command uses those candidates.
    expect(transport.commands).toEqual([
      {
        type: "sidebar-layout.initialize",
        commandId: commandA,
        projectOrder: [projectB],
        pinnedThreadOrder: [threadA],
      },
    ]);
    router.acceptSnapshot({
      sidebarLayout: null,
      lifecycle,
      legacyCandidates: { projectOrder: [], pinnedThreadOrder: [] },
    });
    await flushDispatch();
    expect(transport.commands).toHaveLength(1);
  });

  it("adopts the newest layout for event-before-snapshot and snapshot-before-event", () => {
    // Given: an event arrives before its older snapshot.
    const store = createSidebarLayoutStore({ dispatchCommand: async () => ({ sequence: 1 }) });
    const router = createSidebarLayoutRouter({ store });
    router.acceptShellEvent(layoutEvent(5, [projectB, projectA]));

    // When: an older initialized snapshot and then a newer event arrive.
    router.acceptSnapshot({
      sidebarLayout: layout(4),
      lifecycle,
      legacyCandidates: null,
    });
    router.acceptShellEvent(layoutEvent(6));

    // Then: confirmation is monotonic by layout revision only.
    expect(store.getState().confirmedLayout).toEqual(layout(6));
    expect(store.getState().pendingIntents).toEqual([]);
  });

  it("normalizes displayed layout when shell lifecycle events remove entities", () => {
    // Given: canonical layout references two live projects and one pinned thread.
    const store = createSidebarLayoutStore({ dispatchCommand: async () => ({ sequence: 1 }) });
    const router = createSidebarLayoutRouter({ store });
    router.acceptSnapshot({ sidebarLayout: layout(1), lifecycle, legacyCandidates: null });

    // When: the shell removes one project and the pinned thread.
    router.acceptShellEvent({ kind: "project-removed", sequence: 2, projectId: projectB });
    router.acceptShellEvent({ kind: "thread-removed", sequence: 3, threadId: threadA });

    // Then: lifecycle state immediately excludes both removed entities.
    expect(store.getState().lifecycle).toEqual({
      projects: [lifecycle.projects[0]],
      threads: [],
    });
  });

  it("does not initialize from a stale null snapshot after a live layout event", async () => {
    // Given: another client initializes before this client's first snapshot.
    const transport = new ControllableTransport();
    const store = createSidebarLayoutStore({
      dispatchCommand: transport.dispatchCommand,
      createCommandId: () => commandA,
    });
    const router = createSidebarLayoutRouter({ store });
    router.acceptShellEvent(layoutEvent(7, [projectB, projectA]));

    // When: a stale null snapshot is delivered with cached-marker/no-candidate state.
    router.acceptSnapshot({
      sidebarLayout: null,
      lifecycle,
      legacyCandidates: { projectOrder: [], pinnedThreadOrder: [] },
    });
    await flushDispatch();

    // Then: canonical state wins and no initializer is sent.
    expect(store.getState().confirmedLayout).toEqual(layout(7, [projectB, projectA]));
    expect(transport.commands).toEqual([]);
  });

  it("retries a lost initializer response with the same ID then adopts reconnect state", async () => {
    // Given: initialize was sent but its response was lost.
    const transport = new ControllableTransport();
    const store = createSidebarLayoutStore({
      dispatchCommand: transport.dispatchCommand,
      createCommandId: () => commandA,
    });
    const router = createSidebarLayoutRouter({ store });
    router.acceptSnapshot({
      sidebarLayout: null,
      lifecycle,
      legacyCandidates: { projectOrder: [], pinnedThreadOrder: [] },
    });
    await flushDispatch();

    // When: reconnect retries and the server snapshot reports a winning canonical layout.
    expect(router.reconnect()).toBe(true);
    await flushDispatch();
    router.acceptSnapshot({
      sidebarLayout: layout(9, [projectB, projectA]),
      lifecycle,
      legacyCandidates: null,
    });

    // Then: the same command ID was reused and no initialization remains pending.
    expect(transport.commands.map((command) => command.commandId)).toEqual([commandA, commandA]);
    expect(store.getState().confirmedLayout).toEqual(layout(9, [projectB, projectA]));
    expect(store.getState().pendingIntents).toEqual([]);
    expect(store.getState().inFlightCommandId).toBeNull();
  });

  it("does not initialize when a durable marker suppresses legacy candidates on reload", async () => {
    // Given: candidate collection reports that this profile already completed migration.
    const transport = new ControllableTransport();
    const store = createSidebarLayoutStore({
      dispatchCommand: transport.dispatchCommand,
      createCommandId: () => commandA,
    });
    const router = createSidebarLayoutRouter({ store });

    // When: an old null snapshot reaches the reloaded client.
    router.acceptSnapshot({ sidebarLayout: null, lifecycle, legacyCandidates: null });
    await flushDispatch();

    // Then: stale browser values cannot cause another initialization attempt.
    expect(transport.commands).toEqual([]);
    expect(store.getState().pendingIntents).toEqual([]);
  });

  it("confirms legacy cleanup after another client initializes and retries interrupted cleanup", () => {
    // Given: another client wins while this profile still contains legacy candidates.
    const store = createSidebarLayoutStore({ dispatchCommand: async () => ({ sequence: 1 }) });
    const cleanupAttempts: SidebarLayout[] = [];
    const router = createSidebarLayoutRouter({
      store,
      confirmLegacyMigration: (confirmed) => {
        cleanupAttempts.push(confirmed);
        return cleanupAttempts.length > 1;
      },
    });

    // When: the winning event is followed by a reconnect snapshot after cleanup was interrupted.
    router.acceptShellEvent(layoutEvent(7, [projectB, projectA]));
    router.acceptSnapshot({
      sidebarLayout: layout(7, [projectB, projectA]),
      lifecycle,
      legacyCandidates: { projectOrder: [projectA], pinnedThreadOrder: [threadA] },
    });

    // Then: canonical server state is adopted, cleanup retries, and no initializer is submitted.
    expect(store.getState().confirmedLayout).toEqual(layout(7, [projectB, projectA]));
    expect(cleanupAttempts).toEqual([
      layout(7, [projectB, projectA]),
      layout(7, [projectB, projectA]),
    ]);
    expect(store.getState().pendingIntents).toEqual([]);
  });

  it("stops legacy cleanup after it succeeds", () => {
    // Given: a cleanup callback that succeeds on its first initialized observation.
    const store = createSidebarLayoutStore({ dispatchCommand: async () => ({ sequence: 1 }) });
    const cleanupAttempts: SidebarLayout[] = [];
    const router = createSidebarLayoutRouter({
      store,
      confirmLegacyMigration: (confirmed) => {
        cleanupAttempts.push(confirmed);
        return true;
      },
    });

    // When: later initialized snapshots and events arrive.
    router.acceptSnapshot({ sidebarLayout: layout(4), lifecycle, legacyCandidates: null });
    router.acceptShellEvent(layoutEvent(5, [projectB, projectA]));

    // Then: the durable migration cleanup is not repeated in this client session.
    expect(cleanupAttempts).toEqual([layout(4)]);
  });

  it("retries interrupted cleanup from a later canonical-only snapshot without regressing layout", () => {
    // Given: the first canonical event is adopted but legacy cleanup is interrupted.
    const store = createSidebarLayoutStore({ dispatchCommand: async () => ({ sequence: 1 }) });
    const cleanupAttempts: SidebarLayout[] = [];
    const router = createSidebarLayoutRouter({
      store,
      confirmLegacyMigration: (confirmed) => {
        cleanupAttempts.push(confirmed);
        return cleanupAttempts.length > 1;
      },
    });
    router.acceptShellEvent(layoutEvent(7, [projectB, projectA]));

    // When: a fallback/bootstrap query later observes an older canonical layout that must not
    // reapply lifecycle or candidates.
    router.acceptConfirmedLayout(layout(6));

    // Then: cleanup retries against the newest accepted layout and canonical revision is monotonic.
    expect(store.getState().confirmedLayout).toEqual(layout(7, [projectB, projectA]));
    expect(cleanupAttempts).toEqual([
      layout(7, [projectB, projectA]),
      layout(7, [projectB, projectA]),
    ]);
    expect(store.getState().lifecycle).toEqual({ projects: [], threads: [] });
    expect(store.getState().pendingIntents).toEqual([]);
  });

  it("offers a typed retry after initialize rejection and adopts a winning canonical layout", async () => {
    // Given: the first initialization attempt is rejected.
    const transport = new ControllableTransport();
    const commandIds = [commandA, commandB];
    let commandIndex = 0;
    let retryInitialization: (() => boolean) | null = null;
    const rejectedErrors: unknown[] = [];
    const store = createSidebarLayoutStore({
      dispatchCommand: transport.dispatchCommand,
      createCommandId: () => commandIds[commandIndex++] ?? commandB,
    });
    const router = createSidebarLayoutRouter({
      store,
      onInitializationRejected: (failure) => {
        rejectedErrors.push(failure.error);
        retryInitialization = failure.retry;
      },
    });
    router.acceptSnapshot({
      sidebarLayout: null,
      lifecycle,
      legacyCandidates: { projectOrder: [projectB], pinnedThreadOrder: [threadA] },
    });
    await flushDispatch();
    const rejection = new Error("initialization rejected");
    transport.pending[0]?.reject(rejection);
    await flushDispatch();

    // When: the targeted recovery action retries and another client wins before its response.
    expect(retryInitialization).not.toBeNull();
    expect((retryInitialization as (() => boolean) | null)?.()).toBe(true);
    await flushDispatch();
    router.acceptShellEvent(layoutEvent(9, [projectA, projectB]));

    // Then: recovery is observable, uses a fresh command, and canonical state clears the retry.
    expect(rejectedErrors).toEqual([rejection]);
    expect(transport.commands.map((command) => command.commandId)).toEqual([commandA, commandB]);
    expect(store.getState().confirmedLayout).toEqual(layout(9, [projectA, projectB]));
    expect(store.getState().pendingIntents).toEqual([]);
    expect(store.getState().inFlightCommandId).toBeNull();
    expect((retryInitialization as (() => boolean) | null)?.()).toBe(false);
  });
});
