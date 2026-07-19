import {
  CommandId,
  ProjectId,
  ThreadId,
  type DispatchResult,
  type SidebarLayout,
} from "@jcode/contracts";
import { describe, expect, it } from "vitest";
import {
  createSidebarLayoutStore,
  selectDisplayedPinnedThreadOrder,
  selectDisplayedProjectOrder,
  type SidebarLayoutCommand,
  type SidebarLayoutDispatch,
} from "./sidebarLayoutStore";

type PendingDispatch = {
  readonly command: SidebarLayoutCommand;
  readonly resolve: (result: DispatchResult) => void;
  readonly reject: (error: Error) => void;
};

class ControllableTransport {
  readonly commands: SidebarLayoutCommand[] = [];
  readonly pending: PendingDispatch[] = [];

  readonly dispatchCommand: SidebarLayoutDispatch = (command) => {
    this.commands.push(command);
    return new Promise((resolve, reject) => {
      this.pending.push({ command, resolve, reject });
    });
  };

  resolveAttempt(index: number, sequence: number): void {
    this.pending[index]?.resolve({ sequence });
  }

  rejectAttempt(index: number, message: string): void {
    this.pending[index]?.reject(new Error(message));
  }
}

const projectA = ProjectId.makeUnsafe("project-a");
const projectB = ProjectId.makeUnsafe("project-b");
const projectC = ProjectId.makeUnsafe("project-c");
const threadA = ThreadId.makeUnsafe("thread-a");
const threadB = ThreadId.makeUnsafe("thread-b");
const commandA = CommandId.makeUnsafe("command-a");
const commandB = CommandId.makeUnsafe("command-b");

const layout = (
  revision: number,
  projectOrder: readonly ProjectId[] = [projectA, projectB],
  pinnedThreadOrder: readonly ThreadId[] = [threadA],
): SidebarLayout => ({
  projectOrder,
  pinnedThreadOrder,
  revision,
  updatedAt: `2026-07-18T00:00:${String(revision).padStart(2, "0")}.000Z`,
});

const lifecycle = {
  projects: [
    { id: projectA, kind: "project", createdAt: "2026-01-01T00:00:00Z", deletedAt: null },
    { id: projectB, kind: "project", createdAt: "2026-01-02T00:00:00Z", deletedAt: null },
    { id: projectC, kind: "project", createdAt: "2026-01-03T00:00:00Z", deletedAt: null },
  ],
  threads: [
    { id: threadA, deletedAt: null },
    { id: threadB, deletedAt: null },
  ],
} as const;

async function flushDispatch(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("sidebar layout store", () => {
  it("returns a stable displayed selector value while state is unchanged", () => {
    // Given: one immutable store state object.
    const state = createSidebarLayoutStore({
      dispatchCommand: async () => ({ sequence: 1 }),
    }).getState();
    // When: displayed state is selected twice.
    const first = selectDisplayedProjectOrder(state);
    // Then: React external-store consumers receive the same snapshot reference.
    expect(selectDisplayedProjectOrder(state)).toBe(first);
  });

  it("queues a session-only optimistic intent", () => {
    // Given: a new store with a dispatch transport.
    const store = createSidebarLayoutStore({
      dispatchCommand: async () => ({ sequence: 1 }),
    });

    // When: a layout intent is enqueued.
    store.getState().enqueue({
      type: "sidebar-layout.initialize",
      projectOrder: [],
      pinnedThreadOrder: [],
    });

    // Then: the intent is visible in session state.
    expect(store.getState().pendingIntents).toHaveLength(1);
  });

  it("dispatches rapid intents sequentially with their exact generated command IDs", async () => {
    // Given: a transport whose first response is controllable and deterministic command IDs.
    const transport = new ControllableTransport();
    const commandIds = [commandA, commandB];
    const store = createSidebarLayoutStore({
      dispatchCommand: transport.dispatchCommand,
      createCommandId: () => commandIds.shift() ?? CommandId.makeUnsafe("unexpected-command"),
    });

    // When: two actions are enqueued before the first RPC completes.
    store.getState().enqueue({
      type: "sidebar-layout.project.move",
      projectId: projectA,
      beforeProjectId: null,
    });
    store.getState().enqueue({
      type: "sidebar-layout.thread.unpin",
      threadId: threadA,
    });
    await flushDispatch();

    // Then: only the first exact command is dispatched.
    expect(transport.commands).toEqual([
      {
        type: "sidebar-layout.project.move",
        commandId: commandA,
        projectId: projectA,
        beforeProjectId: null,
      },
    ]);

    transport.resolveAttempt(0, 7);
    await flushDispatch();
    expect(transport.commands[1]).toEqual({
      type: "sidebar-layout.thread.unpin",
      commandId: commandB,
      threadId: threadA,
    });
  });

  it("clears an event-before-RPC intent only after its accepted sequence is known", async () => {
    // Given: a dispatched optimistic move whose canonical event arrives first.
    const transport = new ControllableTransport();
    const store = createSidebarLayoutStore({
      dispatchCommand: transport.dispatchCommand,
      createCommandId: () => commandA,
    });
    store.getState().setLifecycle(lifecycle);
    store.getState().enqueue({
      type: "sidebar-layout.project.move",
      projectId: projectA,
      beforeProjectId: null,
    });
    await flushDispatch();

    // When: revision 7 is confirmed before the RPC receipt.
    store.getState().acceptConfirmedLayout(layout(7, [projectB, projectA, projectC]));

    // Then: the unacknowledged intent remains optimistic.
    expect(store.getState().pendingIntents).toHaveLength(1);

    transport.resolveAttempt(0, 7);
    await flushDispatch();
    expect(store.getState().pendingIntents).toEqual([]);
  });

  it("keeps an RPC-before-event intent until the confirmed layout reaches its sequence", async () => {
    // Given: an optimistic pin accepted at sequence 9.
    const transport = new ControllableTransport();
    const store = createSidebarLayoutStore({
      dispatchCommand: transport.dispatchCommand,
      createCommandId: () => commandA,
    });
    store.getState().setLifecycle(lifecycle);
    store.getState().enqueue({
      type: "sidebar-layout.thread.pin",
      threadId: threadA,
      beforeThreadId: null,
    });
    await flushDispatch();
    transport.resolveAttempt(0, 9);
    await flushDispatch();

    // When: a high snapshot fence carries an older layout revision, followed by revision 9.
    const olderReconnectSnapshotLayout = { ...layout(8, [], []), snapshotSequence: 900 };
    store.getState().acceptConfirmedLayout(olderReconnectSnapshotLayout);
    expect(store.getState().pendingIntents[0]?.acceptedSequence).toBe(9);
    store.getState().acceptConfirmedLayout(layout(9, [], [threadA]));

    // Then: the accepted intent is finally cleared.
    expect(store.getState().pendingIntents).toEqual([]);
  });

  it("rebases displayed selectors over a newer remote layout", async () => {
    // Given: a confirmed layout plus an optimistic local move-to-end.
    const transport = new ControllableTransport();
    const store = createSidebarLayoutStore({
      dispatchCommand: transport.dispatchCommand,
      createCommandId: () => commandA,
    });
    store.getState().setLifecycle(lifecycle);
    store.getState().acceptConfirmedLayout(layout(1, [projectA, projectB, projectC]));
    store.getState().enqueue({
      type: "sidebar-layout.project.move",
      projectId: projectA,
      beforeProjectId: null,
    });

    // When: a remote command changes canonical order at revision 2.
    store.getState().acceptConfirmedLayout(layout(2, [projectC, projectA, projectB], [threadA]));

    // Then: selectors replay the pending local intent over the remote canonical order.
    expect(selectDisplayedProjectOrder(store.getState())).toEqual([projectC, projectB, projectA]);
    expect(selectDisplayedPinnedThreadOrder(store.getState())).toEqual([threadA]);
  });

  it("does not regress confirmed state on stale or equal conflicting revisions", () => {
    // Given: revision 5 is confirmed.
    const store = createSidebarLayoutStore({ dispatchCommand: async () => ({ sequence: 1 }) });
    const confirmed = layout(5, [projectA, projectB]);
    store.getState().acceptConfirmedLayout(confirmed);

    // When: stale, equal-conflicting, and null reconnect values arrive.
    store.getState().acceptConfirmedLayout(layout(4, [projectB, projectA]));
    store.getState().acceptConfirmedLayout(layout(5, [projectB, projectA]));
    store.getState().acceptConfirmedLayout(null);

    // Then: the original canonical object remains authoritative.
    expect(store.getState().confirmedLayout).toBe(confirmed);
  });

  it("starts each store session without persisted layout authority", () => {
    // Given: one session with confirmed and pending layout state.
    const dependencies = { dispatchCommand: async () => ({ sequence: 1 }) };
    const firstSession = createSidebarLayoutStore(dependencies);
    firstSession.getState().acceptConfirmedLayout(layout(1));
    firstSession.getState().enqueue({
      type: "sidebar-layout.thread.unpin",
      threadId: threadA,
    });

    // When: a new session store is constructed.
    const nextSession = createSidebarLayoutStore(dependencies);

    // Then: neither confirmed nor optimistic authority is restored.
    expect(nextSession.getState().confirmedLayout).toBeNull();
    expect(nextSession.getState().pendingIntents).toEqual([]);
    expect("snapshotSequence" in nextSession.getState()).toBe(false);
  });

  it("retries a lost response with the same command ID and ignores the late attempt", async () => {
    // Given: the first command response is lost while a second intent waits.
    const transport = new ControllableTransport();
    const ids = [commandA, commandB];
    const store = createSidebarLayoutStore({
      dispatchCommand: transport.dispatchCommand,
      createCommandId: () => ids.shift() ?? CommandId.makeUnsafe("unexpected-command"),
    });
    store.getState().enqueue({
      type: "sidebar-layout.project.move",
      projectId: projectA,
      beforeProjectId: null,
    });
    store.getState().enqueue({
      type: "sidebar-layout.project.move",
      projectId: projectB,
      beforeProjectId: projectA,
    });
    await flushDispatch();

    // When: the unresolved dispatch is retried and its receipt arrives.
    expect(store.getState().retryInFlight()).toBe(true);
    await flushDispatch();
    expect(transport.commands.map((command) => command.commandId)).toEqual([commandA, commandA]);
    transport.resolveAttempt(1, 10);
    await flushDispatch();

    // Then: the queue continues and a late response cannot replace the recovered receipt.
    expect(transport.commands[2]?.commandId).toBe(commandB);
    transport.resolveAttempt(0, 99);
    await flushDispatch();
    expect(store.getState().pendingIntents[0]?.acceptedSequence).toBe(10);
  });

  it("adopts an initialized canonical layout when the initialize receipt was lost", async () => {
    // Given: an initialize request remains in flight without a receipt.
    const transport = new ControllableTransport();
    const store = createSidebarLayoutStore({
      dispatchCommand: transport.dispatchCommand,
      createCommandId: () => commandA,
    });
    store.getState().enqueue({
      type: "sidebar-layout.initialize",
      projectOrder: [projectB, projectA],
      pinnedThreadOrder: [threadA],
    });
    await flushDispatch();

    // When: a reconnect snapshot proves the server has initialized canonically.
    store.getState().acceptConfirmedLayout(layout(11, [projectA, projectB]));

    // Then: the canonical layout is adopted without leaving a hung initializer.
    expect(store.getState().pendingIntents).toEqual([]);
    expect(store.getState().inFlightCommandId).toBeNull();
  });

  it("clears the rejection observer when adopting a lost initializer", async () => {
    // Given: an initializer with a rejection observer remains in flight without a receipt.
    const transport = new ControllableTransport();
    const rejectedInitializers: unknown[] = [];
    const store = createSidebarLayoutStore({
      dispatchCommand: transport.dispatchCommand,
      createCommandId: () => commandA,
    });
    store.getState().enqueue(
      {
        type: "sidebar-layout.initialize",
        projectOrder: [projectB, projectA],
        pinnedThreadOrder: [threadA],
      },
      { onRejected: (error) => rejectedInitializers.push(error) },
    );
    await flushDispatch();
    store.getState().acceptConfirmedLayout(layout(11, [projectA, projectB]));

    // When: the same command ID is reused for a later command without an observer and rejected.
    store.getState().enqueue({ type: "sidebar-layout.thread.unpin", threadId: threadA });
    await flushDispatch();
    transport.rejectAttempt(1, "later_rejection");
    await flushDispatch();

    // Then: the removed initializer's observer cannot leak into the later command lifecycle.
    expect(rejectedInitializers).toEqual([]);
  });

  it("rolls back a rejected intent and continues the sequential queue", async () => {
    // Given: two optimistic moves over a confirmed canonical layout.
    const transport = new ControllableTransport();
    const ids = [commandA, commandB];
    const store = createSidebarLayoutStore({
      dispatchCommand: transport.dispatchCommand,
      createCommandId: () => ids.shift() ?? CommandId.makeUnsafe("unexpected-command"),
    });
    store.getState().setLifecycle(lifecycle);
    store.getState().acceptConfirmedLayout(layout(1, [projectA, projectB, projectC]));
    store.getState().enqueue({
      type: "sidebar-layout.project.move",
      projectId: projectA,
      beforeProjectId: null,
    });
    store.getState().enqueue({
      type: "sidebar-layout.project.move",
      projectId: projectB,
      beforeProjectId: null,
    });
    await flushDispatch();

    // When: the first RPC is explicitly rejected.
    transport.rejectAttempt(0, "stale_state");
    await flushDispatch();

    // Then: its optimistic effect is gone and the second exact command is dispatched.
    expect(store.getState().pendingIntents.map((pending) => pending.commandId)).toEqual([commandB]);
    expect(selectDisplayedProjectOrder(store.getState())).toEqual([projectA, projectC, projectB]);
    expect(transport.commands[1]?.commandId).toBe(commandB);
  });

  it("notifies a rejected project move after canonical rollback and continues without compensation", async () => {
    // Given: one project move with a rejection observer and a second queued move.
    const transport = new ControllableTransport();
    const ids = [commandA, commandB];
    const rejectedDisplayedOrders: Array<readonly ProjectId[]> = [];
    const rejectedConfirmedOrders: Array<readonly ProjectId[]> = [];
    const store = createSidebarLayoutStore({
      dispatchCommand: transport.dispatchCommand,
      createCommandId: () => ids.shift() ?? CommandId.makeUnsafe("unexpected-command"),
    });
    store.getState().setLifecycle(lifecycle);
    store.getState().acceptConfirmedLayout(layout(1, [projectA, projectB, projectC]));
    store.getState().enqueue(
      {
        type: "sidebar-layout.project.move",
        projectId: projectA,
        beforeProjectId: null,
      },
      {
        onRejected: () => {
          rejectedDisplayedOrders.push(selectDisplayedProjectOrder(store.getState()));
          rejectedConfirmedOrders.push(store.getState().confirmedLayout?.projectOrder ?? []);
        },
      },
    );
    store.getState().enqueue({
      type: "sidebar-layout.project.move",
      projectId: projectB,
      beforeProjectId: null,
    });
    await flushDispatch();

    // When: the first project move is rejected.
    transport.rejectAttempt(0, "stale_state");
    await flushDispatch();

    // Then: its observer sees canonical state with only the queued move replayed, which proceeds once.
    expect(rejectedConfirmedOrders).toEqual([[projectA, projectB, projectC]]);
    expect(rejectedDisplayedOrders).toEqual([[projectA, projectC, projectB]]);
    expect(store.getState().pendingIntents.map((pending) => pending.commandId)).toEqual([commandB]);
    expect(transport.commands.map((command) => command.commandId)).toEqual([commandA, commandB]);
    expect(
      transport.commands.every((command) => command.type === "sidebar-layout.project.move"),
    ).toBe(true);
    expect(selectDisplayedProjectOrder(store.getState())).toEqual([projectA, projectC, projectB]);
  });

  it("isolates a throwing rejection observer and continues the sequential queue", async () => {
    // Given: a rejected first command whose caller observer throws and a second queued command.
    const transport = new ControllableTransport();
    const ids = [commandA, commandB];
    const store = createSidebarLayoutStore({
      dispatchCommand: transport.dispatchCommand,
      createCommandId: () => ids.shift() ?? CommandId.makeUnsafe("unexpected-command"),
    });
    store.getState().enqueue(
      { type: "sidebar-layout.thread.pin", threadId: threadA, beforeThreadId: null },
      {
        onRejected: () => {
          throw new Error("observer_exploded");
        },
      },
    );
    store.getState().enqueue({ type: "sidebar-layout.thread.unpin", threadId: threadA });
    await flushDispatch();

    // When: the first RPC rejects and invokes the throwing observer.
    transport.rejectAttempt(0, "stale_state");
    await flushDispatch();

    // Then: the observer is contained, no rejected promise escapes, and dispatch continues.
    expect(transport.commands[1]?.commandId).toBe(commandB);
  });

  it("dispatches exactly one unpin while a stale shell layout arrives in flight", async () => {
    // Given: canonical membership contains the thread and the unpin response is held.
    const transport = new ControllableTransport();
    const store = createSidebarLayoutStore({
      dispatchCommand: transport.dispatchCommand,
      createCommandId: () => commandA,
    });
    store.getState().setLifecycle(lifecycle);
    store.getState().acceptConfirmedLayout(layout(1, [projectA, projectB], [threadA]));

    // When: unpin is optimistic and an unrelated shell update still carries the old pin.
    store.getState().enqueue({ type: "sidebar-layout.thread.unpin", threadId: threadA });
    await flushDispatch();
    store.getState().acceptConfirmedLayout(layout(2, [projectB, projectA], [threadA, threadB]));
    await flushDispatch();

    // Then: replay keeps the thread unpinned and no mirror command is generated.
    expect(selectDisplayedPinnedThreadOrder(store.getState())).toEqual([threadB]);
    expect(transport.commands).toHaveLength(1);
    expect(transport.commands[0]?.type).toBe("sidebar-layout.thread.unpin");
    expect(
      transport.commands.filter((command) => command.type === "sidebar-layout.thread.pin"),
    ).toEqual([]);
  });

  it("rolls back a rejected pin intent before notifying its caller", async () => {
    // Given: a canonical unpinned thread and a caller-owned rejection observer.
    const transport = new ControllableTransport();
    const rejectedDisplayedOrders: Array<readonly ThreadId[]> = [];
    const store = createSidebarLayoutStore({
      dispatchCommand: transport.dispatchCommand,
      createCommandId: () => commandA,
    });
    store.getState().setLifecycle(lifecycle);
    store.getState().acceptConfirmedLayout(layout(1, [projectA, projectB], []));

    // When: the optimistic pin is rejected.
    store.getState().enqueue(
      { type: "sidebar-layout.thread.pin", threadId: threadA, beforeThreadId: null },
      {
        onRejected: () => {
          rejectedDisplayedOrders.push(selectDisplayedPinnedThreadOrder(store.getState()));
        },
      },
    );
    await flushDispatch();
    transport.rejectAttempt(0, "thread_not_found");
    await flushDispatch();

    // Then: the callback sees canonical rollback and no compensation is dispatched.
    expect(rejectedDisplayedOrders).toEqual([[]]);
    expect(transport.commands.map((command) => command.type)).toEqual([
      "sidebar-layout.thread.pin",
    ]);
  });
});
