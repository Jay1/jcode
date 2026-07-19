import type {
  OrchestrationProject,
  OrchestrationThread,
  ProjectId,
  ThreadId,
} from "@jcode/contracts";

type SidebarLayoutProject = Pick<OrchestrationProject, "id" | "createdAt" | "deletedAt">;

type SidebarLayoutThread = Pick<OrchestrationThread, "id" | "createdAt" | "deletedAt" | "isPinned">;

export type SidebarLayoutOrder = {
  readonly projectOrder: readonly ProjectId[];
  readonly pinnedThreadOrder: readonly ThreadId[];
};

export type SidebarLayoutSubjectNotFound =
  | {
      readonly kind: "subject-not-found";
      readonly subject: "project";
      readonly subjectId: ProjectId;
    }
  | {
      readonly kind: "subject-not-found";
      readonly subject: "thread";
      readonly subjectId: ThreadId;
    };

export type ProjectMoveResult =
  | { readonly kind: "applied"; readonly projectOrder: readonly ProjectId[] }
  | Extract<SidebarLayoutSubjectNotFound, { readonly subject: "project" }>;

export type PinnedThreadMoveResult =
  | { readonly kind: "applied"; readonly pinnedThreadOrder: readonly ThreadId[] }
  | Extract<SidebarLayoutSubjectNotFound, { readonly subject: "thread" }>
  | { readonly kind: "subject-not-pinned"; readonly threadId: ThreadId };

export type PinnedThreadIntentResult =
  | { readonly kind: "applied"; readonly pinnedThreadOrder: readonly ThreadId[] }
  | Extract<SidebarLayoutSubjectNotFound, { readonly subject: "thread" }>;

export function normalizeSidebarLayout(input: {
  readonly projectOrder: readonly ProjectId[];
  readonly pinnedThreadOrder: readonly ThreadId[];
  readonly projects: readonly SidebarLayoutProject[];
  readonly threads: readonly SidebarLayoutThread[];
}): SidebarLayoutOrder {
  const activeProjects = input.projects.filter((project) => project.deletedAt === null);
  const activeProjectById = new Map(activeProjects.map((project) => [project.id, project]));
  const seenProjectIds = new Set<ProjectId>();
  const projectOrder = input.projectOrder.filter((projectId) => {
    if (seenProjectIds.has(projectId) || !activeProjectById.has(projectId)) {
      return false;
    }
    seenProjectIds.add(projectId);
    return true;
  });
  const missingProjectIds = activeProjects
    .toSorted(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    )
    .filter((project) => {
      if (seenProjectIds.has(project.id)) {
        return false;
      }
      seenProjectIds.add(project.id);
      return true;
    })
    .map((project) => project.id);
  const liveThreadIds = new Set(
    input.threads.filter((thread) => thread.deletedAt === null).map((thread) => thread.id),
  );
  const seenThreadIds = new Set<ThreadId>();
  const pinnedThreadOrder = input.pinnedThreadOrder.filter((threadId) => {
    if (seenThreadIds.has(threadId) || !liveThreadIds.has(threadId)) {
      return false;
    }
    seenThreadIds.add(threadId);
    return true;
  });

  return {
    projectOrder: [...projectOrder, ...missingProjectIds],
    pinnedThreadOrder,
  };
}

export function initializeSidebarLayout(input: {
  readonly projectOrderCandidates: readonly ProjectId[];
  readonly pinnedThreadOrderCandidates: readonly ThreadId[];
  readonly projects: readonly SidebarLayoutProject[];
  readonly threads: readonly SidebarLayoutThread[];
}): SidebarLayoutOrder {
  const serverPinnedThreadIds = input.threads
    .filter((thread) => thread.deletedAt === null && thread.isPinned)
    .toSorted(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    )
    .map((thread) => thread.id);

  return normalizeSidebarLayout({
    projectOrder: input.projectOrderCandidates,
    pinnedThreadOrder: [...input.pinnedThreadOrderCandidates, ...serverPinnedThreadIds],
    projects: input.projects,
    threads: input.threads,
  });
}

function moveBeforeOrAppend<Id>(
  order: readonly Id[],
  subjectId: Id,
  beforeId: Id | null,
): readonly Id[] {
  if (beforeId === subjectId && order.includes(subjectId)) {
    return [...order];
  }
  const withoutSubject = order.filter((id) => id !== subjectId);
  const anchorIndex = beforeId === null ? -1 : withoutSubject.indexOf(beforeId);
  if (anchorIndex < 0) {
    return [...withoutSubject, subjectId];
  }
  return [...withoutSubject.slice(0, anchorIndex), subjectId, ...withoutSubject.slice(anchorIndex)];
}

export function moveProjectBefore(input: {
  readonly projectOrder: readonly ProjectId[];
  readonly projectId: ProjectId;
  readonly beforeProjectId: ProjectId | null;
  readonly projects: readonly SidebarLayoutProject[];
}): ProjectMoveResult {
  const activeProjectIds = new Set(
    input.projects.filter((project) => project.deletedAt === null).map((project) => project.id),
  );
  if (!activeProjectIds.has(input.projectId)) {
    return {
      kind: "subject-not-found",
      subject: "project",
      subjectId: input.projectId,
    };
  }
  const normalized = normalizeSidebarLayout({
    projectOrder: input.projectOrder,
    pinnedThreadOrder: [],
    projects: input.projects,
    threads: [],
  });
  return {
    kind: "applied" as const,
    projectOrder: moveBeforeOrAppend(
      normalized.projectOrder,
      input.projectId,
      input.beforeProjectId,
    ),
  };
}

export function movePinnedThreadBefore(input: {
  readonly pinnedThreadOrder: readonly ThreadId[];
  readonly threadId: ThreadId;
  readonly beforeThreadId: ThreadId | null;
  readonly threads: readonly SidebarLayoutThread[];
}): PinnedThreadMoveResult {
  const liveThreadIds = new Set(
    input.threads.filter((thread) => thread.deletedAt === null).map((thread) => thread.id),
  );
  if (!liveThreadIds.has(input.threadId)) {
    return {
      kind: "subject-not-found",
      subject: "thread",
      subjectId: input.threadId,
    };
  }
  const normalized = normalizeSidebarLayout({
    projectOrder: [],
    pinnedThreadOrder: input.pinnedThreadOrder,
    projects: [],
    threads: input.threads,
  });
  if (!normalized.pinnedThreadOrder.includes(input.threadId)) {
    return { kind: "subject-not-pinned", threadId: input.threadId };
  }
  return {
    kind: "applied" as const,
    pinnedThreadOrder: moveBeforeOrAppend(
      normalized.pinnedThreadOrder,
      input.threadId,
      input.beforeThreadId,
    ),
  };
}

export function pinThreadBefore(input: {
  readonly pinnedThreadOrder: readonly ThreadId[];
  readonly threadId: ThreadId;
  readonly beforeThreadId: ThreadId | null;
  readonly threads: readonly SidebarLayoutThread[];
}): PinnedThreadIntentResult {
  const liveThreadIds = new Set(
    input.threads.filter((thread) => thread.deletedAt === null).map((thread) => thread.id),
  );
  if (!liveThreadIds.has(input.threadId)) {
    return { kind: "subject-not-found", subject: "thread", subjectId: input.threadId };
  }
  const normalized = normalizeSidebarLayout({
    projectOrder: [],
    pinnedThreadOrder: input.pinnedThreadOrder,
    projects: [],
    threads: input.threads,
  });
  return {
    kind: "applied",
    pinnedThreadOrder: moveBeforeOrAppend(
      normalized.pinnedThreadOrder,
      input.threadId,
      input.beforeThreadId,
    ),
  };
}

export function unpinThread(input: {
  readonly pinnedThreadOrder: readonly ThreadId[];
  readonly threadId: ThreadId;
  readonly threads: readonly SidebarLayoutThread[];
}): PinnedThreadIntentResult {
  const liveThreadIds = new Set(
    input.threads.filter((thread) => thread.deletedAt === null).map((thread) => thread.id),
  );
  if (!liveThreadIds.has(input.threadId)) {
    return { kind: "subject-not-found", subject: "thread", subjectId: input.threadId };
  }
  const normalized = normalizeSidebarLayout({
    projectOrder: [],
    pinnedThreadOrder: input.pinnedThreadOrder,
    projects: [],
    threads: input.threads,
  });
  return {
    kind: "applied",
    pinnedThreadOrder: normalized.pinnedThreadOrder.filter(
      (threadId) => threadId !== input.threadId,
    ),
  };
}

export function pinnedMembershipEquals(
  left: readonly ThreadId[],
  right: readonly ThreadId[],
): boolean {
  const leftIds = new Set(left);
  const rightIds = new Set(right);
  return leftIds.size === rightIds.size && [...leftIds].every((threadId) => rightIds.has(threadId));
}
