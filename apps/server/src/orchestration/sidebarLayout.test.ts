import { ProjectId, ThreadId } from "@jcode/contracts";
import { describe, expect, it } from "vitest";

import {
  initializeSidebarLayout,
  movePinnedThreadBefore,
  moveProjectBefore,
  normalizeSidebarLayout,
  pinThreadBefore,
  pinnedMembershipEquals,
  unpinThread,
} from "./sidebarLayout.ts";

const projectId = ProjectId.makeUnsafe;
const threadId = ThreadId.makeUnsafe;
const createdAt = (day: number) => `2026-01-${day.toString().padStart(2, "0")}`;

function project(id: string, day: number, deletedAt: string | null = null) {
  return { id: projectId(id), createdAt: createdAt(day), deletedAt };
}

function thread(id: string, day: number, isPinned = false, deletedAt: string | null = null) {
  return { id: threadId(id), createdAt: createdAt(day), deletedAt, isPinned };
}

const projectsABC = () => [
  project("project-a", 1),
  project("project-b", 2),
  project("project-c", 3),
];

type ProjectRows = Parameters<typeof normalizeSidebarLayout>[0]["projects"];

function normalizedProjectOrder(projects: ProjectRows, projectOrder: readonly ProjectId[] = []) {
  return normalizeSidebarLayout({ projectOrder, pinnedThreadOrder: [], projects, threads: [] })
    .projectOrder;
}

const liveThreadsAB = [thread("thread-a", 1), thread("thread-b", 2)];
const pinB = (pinnedThreadOrder: readonly ThreadId[], beforeThreadId: ThreadId) =>
  pinThreadBefore({
    pinnedThreadOrder,
    threadId: threadId("thread-b"),
    beforeThreadId,
    threads: liveThreadsAB,
  });

describe("sidebar layout", () => {
  it("normalizes project order when candidates are duplicated, stale, or partial", () => {
    // Given
    const projectOrder = [
      projectId("project-chat"),
      projectId("project-chat"),
      projectId("project-unknown"),
      projectId("project-deleted"),
    ];
    const projects = [
      project("project-z", 3),
      { ...project("project-chat", 2), kind: "chat" as const },
      project("project-a", 3),
      project("project-deleted", 1, "2026-02-01"),
    ];

    // When
    const result = normalizedProjectOrder(projects, projectOrder);

    // Then
    expect(result).toEqual([
      projectId("project-chat"),
      projectId("project-a"),
      projectId("project-z"),
    ]);
  });

  it("appends a duplicated live project row only once", () => {
    // Given
    const projects = [
      project("project-duplicate", 1),
      project("project-other", 2),
      project("project-duplicate", 3),
    ];

    // When
    const result = normalizedProjectOrder(projects);

    // Then
    expect(result).toEqual([projectId("project-duplicate"), projectId("project-other")]);
  });

  it("normalizes pinned order when ids are duplicated, unknown, or deleted", () => {
    // Given
    const pinnedThreadOrder = [
      threadId("thread-live"),
      threadId("thread-live"),
      threadId("thread-unknown"),
      threadId("thread-deleted"),
    ];
    const threads = [thread("thread-live", 1), thread("thread-deleted", 2, true, "2026-02-01")];

    // When
    const result = normalizeSidebarLayout({
      projectOrder: [],
      pinnedThreadOrder,
      projects: [],
      threads,
    });

    // Then
    expect(result.pinnedThreadOrder).toEqual([threadId("thread-live")]);
  });

  it("initializes empty project and partial pin candidates while preserving server pins", () => {
    // Given
    const projects = [project("project-later", 2), project("project-first", 1)];
    const threads = [
      thread("thread-client", 4),
      thread("thread-z", 3, true),
      thread("thread-a", 3, true),
      thread("thread-unpinned", 1),
      thread("thread-deleted-pin", 2, true, "2026-02-01"),
    ];

    // When
    const result = initializeSidebarLayout({
      projectOrderCandidates: [],
      pinnedThreadOrderCandidates: [
        threadId("thread-client"),
        threadId("thread-client"),
        threadId("thread-unknown"),
        threadId("thread-deleted-pin"),
      ],
      projects,
      threads,
    });

    // Then
    expect(result).toEqual({
      projectOrder: [projectId("project-first"), projectId("project-later")],
      pinnedThreadOrder: [threadId("thread-client"), threadId("thread-a"), threadId("thread-z")],
    });
  });

  it.each([
    ["missing", projectId("project-missing")],
    ["deleted", projectId("project-deleted")],
  ])("returns an explicit failure for a %s project subject", (_case, subjectId) => {
    // Given
    const projects = [project("project-a", 1), project("project-deleted", 2, "2026-02-01")];

    // When
    const result = moveProjectBefore({
      projectOrder: projects.map((project) => project.id),
      projectId: subjectId,
      beforeProjectId: projectId("project-a"),
      projects,
    });

    // Then
    expect(result).toEqual({
      kind: "subject-not-found",
      subject: "project",
      subjectId,
    });
  });

  it.each([
    ["upward", "project-c", "project-a", ["project-c", "project-a", "project-b"]],
    ["downward", "project-a", "project-c", ["project-b", "project-a", "project-c"]],
    ["to the end", "project-b", null, ["project-a", "project-c", "project-b"]],
    [
      "past a missing anchor",
      "project-b",
      "project-missing",
      ["project-a", "project-c", "project-b"],
    ],
    ["before itself", "project-b", "project-b", ["project-a", "project-b", "project-c"]],
    [
      "past a deleted anchor",
      "project-b",
      "project-deleted",
      ["project-a", "project-c", "project-b"],
    ],
  ])("moves a project %s", (_case, subject, before, expected) => {
    // Given
    const projects = [...projectsABC(), project("project-deleted", 4, "2026-02-01")];

    // When
    const result = moveProjectBefore({
      projectOrder: projects.map((project) => project.id),
      projectId: projectId(subject),
      beforeProjectId: before === null ? null : projectId(before),
      projects,
    });

    // Then
    expect(result).toEqual({
      kind: "applied",
      projectOrder: expected.map((id) => projectId(id)),
    });
  });

  it.each([
    ["upward", "thread-c", "thread-a", ["thread-c", "thread-a", "thread-b"]],
    ["downward", "thread-a", "thread-c", ["thread-b", "thread-a", "thread-c"]],
    ["to the end", "thread-b", null, ["thread-a", "thread-c", "thread-b"]],
    ["past a missing anchor", "thread-b", "thread-missing", ["thread-a", "thread-c", "thread-b"]],
    ["before itself", "thread-b", "thread-b", ["thread-a", "thread-b", "thread-c"]],
    ["past a deleted anchor", "thread-b", "thread-deleted", ["thread-a", "thread-c", "thread-b"]],
  ])("moves a pinned thread %s", (_case, subject, before, expected) => {
    // Given
    const threads = [
      thread("thread-a", 1),
      thread("thread-b", 2),
      thread("thread-c", 3),
      thread("thread-deleted", 4, true, "2026-02-01"),
    ];

    // When
    const result = movePinnedThreadBefore({
      pinnedThreadOrder: threads.map((item) => item.id),
      threadId: threadId(subject),
      beforeThreadId: before === null ? null : threadId(before),
      threads,
    });

    // Then
    expect(result).toEqual({
      kind: "applied",
      pinnedThreadOrder: expected.map((id) => threadId(id)),
    });
  });

  it.each([
    ["missing", threadId("thread-missing")],
    ["deleted", threadId("thread-deleted")],
  ])("returns an explicit failure for a %s pinned-thread subject", (_case, subjectId) => {
    // Given
    const threads = [thread("thread-live", 1), thread("thread-deleted", 2, true, "2026-02-01")];

    // When
    const result = movePinnedThreadBefore({
      pinnedThreadOrder: threads.map((item) => item.id),
      threadId: subjectId,
      beforeThreadId: threadId("thread-live"),
      threads,
    });

    // Then
    expect(result).toEqual({ kind: "subject-not-found", subject: "thread", subjectId });
  });

  it("returns an explicit failure when a live thread is not pinned", () => {
    // Given
    const threads = [thread("thread-live", 1)];

    // When
    const result = movePinnedThreadBefore({
      pinnedThreadOrder: [],
      threadId: threadId("thread-live"),
      beforeThreadId: null,
      threads,
    });

    // Then
    expect(result).toEqual({ kind: "subject-not-pinned", threadId: threadId("thread-live") });
  });

  it("pins idempotently and repositions an already-pinned thread", () => {
    // Given
    const initialOrder = [threadId("thread-a")];

    // When
    const once = pinB(initialOrder, threadId("thread-a"));
    const twice =
      once.kind === "applied" ? pinB(once.pinnedThreadOrder, threadId("thread-a")) : once;

    // Then
    expect(once).toEqual({
      kind: "applied",
      pinnedThreadOrder: [threadId("thread-b"), threadId("thread-a")],
    });
    expect(twice).toEqual(once);
  });

  it("appends an absent live thread when its pin anchor is itself", () => {
    // Given
    const initialOrder = [threadId("thread-a")];

    // When
    const result = pinB(initialOrder, threadId("thread-b"));

    // Then
    expect(result).toEqual({
      kind: "applied",
      pinnedThreadOrder: [threadId("thread-a"), threadId("thread-b")],
    });
  });

  it("unpins idempotently", () => {
    // Given
    const threads = [thread("thread-a", 1)];

    // When
    const unpin = (pinnedThreadOrder: readonly ThreadId[]) =>
      unpinThread({ pinnedThreadOrder, threadId: threadId("thread-a"), threads });
    const once = unpin([threadId("thread-a")]);
    const twice = once.kind === "applied" ? unpin(once.pinnedThreadOrder) : once;

    // Then
    expect(once).toEqual({ kind: "applied", pinnedThreadOrder: [] });
    expect(twice).toEqual(once);
  });

  it("compares exact pinned membership independently of order", () => {
    // Given
    const canonical = [threadId("thread-a"), threadId("thread-b")];

    // When
    const reordered = pinnedMembershipEquals(canonical, [
      threadId("thread-b"),
      threadId("thread-a"),
    ]);
    const missing = pinnedMembershipEquals(canonical, [threadId("thread-a")]);

    // Then
    expect(reordered).toBe(true);
    expect(missing).toBe(false);
  });

  it("does not mutate input arrays or records", () => {
    // Given
    const projectOrder = [projectId("project-b")];
    const projects = projectsABC();
    const before = structuredClone({ projectOrder, projects });

    // When
    normalizeSidebarLayout({ projectOrder, pinnedThreadOrder: [], projects, threads: [] });

    // Then
    expect({ projectOrder, projects }).toEqual(before);
  });
});
