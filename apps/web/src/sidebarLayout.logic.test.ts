import { describe, expect, it } from "vitest";
import { CommandId, ProjectId, ThreadId, type SidebarLayout } from "@jcode/contracts";
import * as sidebarLayout from "./sidebarLayout.logic";

const acceptConfirmed = sidebarLayout.acceptConfirmedSidebarLayout;
const deriveDisplayed = sidebarLayout.deriveDisplayedSidebarLayout;
const selectPins = sidebarLayout.selectDisplayedPinnedThreadOrder;
const selectProjects = sidebarLayout.selectDisplayedProjectOrder;

const projectA = ProjectId.makeUnsafe("project-a");
const projectB = ProjectId.makeUnsafe("project-b");
const projectC = ProjectId.makeUnsafe("project-c");
const projectD = ProjectId.makeUnsafe("project-d");
const threadA = ThreadId.makeUnsafe("thread-a");
const threadB = ThreadId.makeUnsafe("thread-b");
const threadC = ThreadId.makeUnsafe("thread-c");
const commandA = CommandId.makeUnsafe("command-a");
const commandB = CommandId.makeUnsafe("command-b");

const layout = (
  revision: number,
  projectOrder: readonly ProjectId[] = [projectA, projectB, projectC],
  pinnedThreadOrder: readonly ThreadId[] = [threadA, threadB, threadC],
): SidebarLayout => ({
  projectOrder,
  pinnedThreadOrder,
  revision,
  updatedAt: `2026-07-18T00:00:${String(revision).padStart(2, "0")}.000Z`,
});

const lifecycle: sidebarLayout.SidebarLayoutLifecycle = {
  projects: [
    { id: projectA, kind: "project", createdAt: "2026-01-01T00:00:00Z", deletedAt: null },
    { id: projectB, kind: "project", createdAt: "2026-01-02T00:00:00Z", deletedAt: null },
    { id: projectC, kind: "project", createdAt: "2026-01-03T00:00:00Z", deletedAt: null },
  ],
  threads: [
    { id: threadA, deletedAt: null },
    { id: threadB, deletedAt: null },
    { id: threadC, deletedAt: null },
  ],
};

describe("confirmed sidebar layout", () => {
  it.each([
    ["older", layout(4, [projectC, projectB, projectA])],
    ["equal conflicting", layout(5, [projectC, projectB, projectA])],
  ])("rejects an %s revision", (_caseName, incoming) => {
    // Given
    const confirmed = layout(5);
    // When
    const accepted = acceptConfirmed(confirmed, incoming);
    // Then
    expect(accepted).toBe(confirmed);
  });

  it("accepts a newer revision", () => {
    // Given
    const confirmed = layout(5);
    const incoming = layout(6, [projectB, projectA, projectC]);
    // When
    const accepted = acceptConfirmed(confirmed, incoming);
    // Then
    expect(accepted).toBe(incoming);
  });

  it("treats an identical equal revision as idempotent", () => {
    // Given
    const confirmed = layout(5);
    const duplicate = { ...confirmed };
    // When
    const accepted = acceptConfirmed(confirmed, duplicate);
    // Then
    expect(accepted).toBe(confirmed);
  });
});

describe("pending intent reconciliation", () => {
  const pending: readonly sidebarLayout.PendingSidebarLayoutIntent[] = [
    {
      commandId: commandA,
      intent: { type: "sidebar-layout.project.move", projectId: projectA, beforeProjectId: null },
    },
  ];

  it("keeps an intent when its layout event arrives before its RPC receipt", () => {
    // Given
    const confirmedRevision = 8;
    // When
    const reconciled = sidebarLayout.reconcilePendingSidebarLayoutIntents(
      pending,
      confirmedRevision,
    );
    // Then
    expect(reconciled).toEqual(pending);
  });

  it("clears event-before-RPC intent after the receipt sequence is recorded", () => {
    // Given
    const accepted = sidebarLayout.recordPendingSidebarLayoutAcceptance(pending, commandA, 8);
    // When
    const reconciled = sidebarLayout.reconcilePendingSidebarLayoutIntents(accepted, 8);
    // Then
    expect(reconciled).toEqual([]);
  });

  it.each(["RPC-before-event", "an unrelated newer snapshotSequence"])(
    "keeps an intent for %s below its accepted layout revision",
    () => {
      // Given: snapshotSequence is deliberately absent from this API.
      const accepted = sidebarLayout.recordPendingSidebarLayoutAcceptance(pending, commandA, 8);
      // When
      const reconciled = sidebarLayout.reconcilePendingSidebarLayoutIntents(accepted, 7);
      // Then
      expect(reconciled).toEqual(accepted);
    },
  );

  it("records an idempotent retry receipt on the existing command", () => {
    // Given
    const firstReceipt = sidebarLayout.recordPendingSidebarLayoutAcceptance(pending, commandA, 8);
    // When
    const retriedReceipt = sidebarLayout.recordPendingSidebarLayoutAcceptance(
      firstReceipt,
      commandA,
      8,
    );
    // Then
    expect(retriedReceipt).toEqual(firstReceipt);
  });

  it("removes only a rejected intent so the displayed state rolls back", () => {
    // Given
    const twoPending: readonly sidebarLayout.PendingSidebarLayoutIntent[] = [
      ...pending,
      {
        commandId: commandB,
        intent: { type: "sidebar-layout.thread.unpin", threadId: threadA },
      },
    ];
    // When
    const remaining = sidebarLayout.rejectPendingSidebarLayoutIntent(twoPending, commandA);
    // Then
    expect(remaining.map((item) => item.commandId)).toEqual([commandB]);
  });
});

describe("optimistic replay and lifecycle normalization", () => {
  it("rebases two local intents over a newer remote layout", () => {
    // Given
    const pending: readonly sidebarLayout.PendingSidebarLayoutIntent[] = [
      {
        commandId: commandA,
        intent: {
          type: "sidebar-layout.project.move",
          projectId: projectB,
          beforeProjectId: projectA,
        },
      },
      {
        commandId: commandB,
        intent: {
          type: "sidebar-layout.project.move",
          projectId: projectC,
          beforeProjectId: null,
        },
      },
    ];
    // When
    const displayed = deriveDisplayed(
      layout(9, [projectC, projectA, projectB]),
      pending,
      lifecycle,
    );
    // Then
    expect(selectProjects(displayed)).toEqual([projectB, projectA, projectC]);
  });

  it("replays pin, pinned move, and unpin without mutating confirmed state", () => {
    // Given
    const confirmed = layout(3, [projectA, projectB, projectC], [threadA]);
    const pending: readonly sidebarLayout.PendingSidebarLayoutIntent[] = [
      {
        commandId: commandA,
        intent: {
          type: "sidebar-layout.thread.pin",
          threadId: threadB,
          beforeThreadId: threadA,
        },
      },
      {
        commandId: commandB,
        intent: {
          type: "sidebar-layout.pinned-thread.move",
          threadId: threadA,
          beforeThreadId: threadB,
        },
      },
      {
        commandId: CommandId.makeUnsafe("command-c"),
        intent: { type: "sidebar-layout.thread.unpin", threadId: threadB },
      },
    ];
    // When
    const displayed = deriveDisplayed(confirmed, pending, lifecycle);
    // Then
    expect(selectPins(displayed)).toEqual([threadA]);
    expect(confirmed.pinnedThreadOrder).toEqual([threadA]);
  });

  it("uses initialization while canonical layout is absent", () => {
    // Given
    const pending: readonly sidebarLayout.PendingSidebarLayoutIntent[] = [
      {
        commandId: commandA,
        intent: {
          type: "sidebar-layout.initialize",
          projectOrder: [projectC, projectA],
          pinnedThreadOrder: [threadB],
        },
      },
    ];
    // When
    const displayed = deriveDisplayed(null, pending, lifecycle);
    // Then
    expect(selectProjects(displayed)).toEqual([projectC, projectA, projectB]);
  });

  it("does not replay initialization over a reconnect snapshot", () => {
    // Given
    const pending: readonly sidebarLayout.PendingSidebarLayoutIntent[] = [
      {
        commandId: commandA,
        intent: {
          type: "sidebar-layout.initialize",
          projectOrder: [projectC, projectA],
          pinnedThreadOrder: [threadB],
        },
      },
    ];
    // When
    const displayed = deriveDisplayed(layout(10), pending, lifecycle);
    // Then
    expect(selectProjects(displayed)).toEqual([projectA, projectB, projectC]);
  });

  it("appends every unseen active project kind by createdAt then id and omits deleted IDs", () => {
    // Given
    const lifecycleWithChanges: sidebarLayout.SidebarLayoutLifecycle = {
      projects: [
        { id: projectA, kind: "project", createdAt: "2026-01-01", deletedAt: "2026-06-01" },
        { id: projectB, kind: "chat", createdAt: "2026-01-03", deletedAt: null },
        { id: projectC, kind: "project", createdAt: "2026-01-02", deletedAt: null },
        { id: projectD, kind: "chat", createdAt: "2026-01-02", deletedAt: null },
      ],
      threads: [
        { id: threadA, deletedAt: "2026-06-01" },
        { id: threadB, deletedAt: null },
      ],
    };
    // When
    const displayed = deriveDisplayed(
      layout(2, [projectA, projectB, projectB], [threadA, threadB, threadB]),
      [],
      lifecycleWithChanges,
    );
    // Then
    expect(selectProjects(displayed)).toEqual([projectB, projectC, projectD]);
    expect(selectPins(displayed)).toEqual([threadB]);
  });

  it("ignores unknown subjects and appends on a missing anchor", () => {
    // Given
    const pending: readonly sidebarLayout.PendingSidebarLayoutIntent[] = [
      {
        commandId: commandA,
        intent: {
          type: "sidebar-layout.project.move",
          projectId: ProjectId.makeUnsafe("unknown-project"),
          beforeProjectId: projectA,
        },
      },
      {
        commandId: commandB,
        intent: {
          type: "sidebar-layout.project.move",
          projectId: projectA,
          beforeProjectId: ProjectId.makeUnsafe("missing-anchor"),
        },
      },
    ];
    // When
    const displayed = deriveDisplayed(layout(4), pending, lifecycle);
    // Then
    expect(selectProjects(displayed)).toEqual([projectB, projectC, projectA]);
  });
});

describe("DnD next-sibling anchors", () => {
  it.each([
    ["first to middle", projectA, projectC, [projectB, projectC, projectA, projectD], projectD],
    ["last to first", projectD, projectA, [projectD, projectA, projectB, projectC], projectA],
    ["upward", projectC, projectA, [projectC, projectA, projectB, projectD], projectA],
    ["downward", projectB, projectD, [projectA, projectC, projectD, projectB], null],
    ["self", projectB, projectB, [projectA, projectB, projectC, projectD], projectC],
  ])("derives the %s anchor from the final project list", (_name, moved, over, final, anchor) => {
    // Given
    const order = [projectA, projectB, projectC, projectD];
    // When
    const result = sidebarLayout.getDndNextSiblingAnchor(order, moved, over);
    // Then
    expect(result).toEqual({ finalOrder: final, beforeId: anchor });
  });

  it.each([
    ["upward", threadC, threadA, [threadC, threadA, threadB], threadA],
    ["downward to end", threadA, threadC, [threadB, threadC, threadA], null],
  ])("derives the %s pinned-thread anchor", (_name, moved, over, final, anchor) => {
    // Given
    const order = [threadA, threadB, threadC];
    // When
    const result = sidebarLayout.getDndNextSiblingAnchor(order, moved, over);
    // Then
    expect(result).toEqual({ finalOrder: final, beforeId: anchor });
  });
});
