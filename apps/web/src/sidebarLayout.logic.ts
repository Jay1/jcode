import type {
  CommandId,
  DispatchableClientOrchestrationCommand,
  OrchestrationProject,
  OrchestrationThread,
  ProjectId,
  SidebarLayout,
  ThreadId,
} from "@jcode/contracts";

type LayoutCommand = Extract<
  DispatchableClientOrchestrationCommand,
  {
    readonly type:
      | "sidebar-layout.initialize"
      | "sidebar-layout.project.move"
      | "sidebar-layout.thread.pin"
      | "sidebar-layout.thread.unpin"
      | "sidebar-layout.pinned-thread.move";
  }
>;

type IntentOf<Command extends LayoutCommand> = Omit<Command, "commandId">;

export type SidebarLayoutIntent = LayoutCommand extends infer Command
  ? Command extends LayoutCommand
    ? IntentOf<Command>
    : never
  : never;

export type PendingSidebarLayoutIntent = {
  readonly commandId: CommandId;
  readonly intent: SidebarLayoutIntent;
  readonly acceptedSequence?: number;
};

type ProjectLifecycle = Pick<OrchestrationProject, "id" | "kind" | "createdAt" | "deletedAt">;
type ThreadLifecycle = Pick<OrchestrationThread, "id" | "deletedAt">;

export type SidebarLayoutLifecycle = {
  readonly projects: readonly ProjectLifecycle[];
  readonly threads: readonly ThreadLifecycle[];
};

export type DisplayedSidebarLayout = Pick<SidebarLayout, "projectOrder" | "pinnedThreadOrder">;

export type DndNextSiblingAnchor<Id extends ProjectId | ThreadId> = {
  readonly finalOrder: readonly Id[];
  readonly beforeId: Id | null;
};

class UnexpectedSidebarLayoutIntentError extends Error {
  constructor() {
    super("Unexpected sidebar layout intent");
    this.name = "UnexpectedSidebarLayoutIntentError";
  }
}

function assertNever(_value: never): never {
  throw new UnexpectedSidebarLayoutIntentError();
}

export function acceptConfirmedSidebarLayout(
  current: SidebarLayout | null,
  incoming: SidebarLayout,
): SidebarLayout {
  if (current === null || incoming.revision > current.revision) {
    return incoming;
  }
  return current;
}

export function recordPendingSidebarLayoutAcceptance(
  pending: readonly PendingSidebarLayoutIntent[],
  commandId: CommandId,
  acceptedSequence: number,
): readonly PendingSidebarLayoutIntent[] {
  return pending.map((item) =>
    item.commandId === commandId ? { ...item, acceptedSequence } : item,
  );
}

export function reconcilePendingSidebarLayoutIntents(
  pending: readonly PendingSidebarLayoutIntent[],
  confirmedRevision: number | null,
): readonly PendingSidebarLayoutIntent[] {
  if (confirmedRevision === null) {
    return pending;
  }
  return pending.filter(
    (item) => item.acceptedSequence === undefined || item.acceptedSequence > confirmedRevision,
  );
}

export function rejectPendingSidebarLayoutIntent(
  pending: readonly PendingSidebarLayoutIntent[],
  commandId: CommandId,
): readonly PendingSidebarLayoutIntent[] {
  return pending.filter((item) => item.commandId !== commandId);
}

function uniqueLiveIds<Id>(ids: readonly Id[], activeIds: ReadonlySet<Id>): readonly Id[] {
  const seen = new Set<Id>();
  return ids.filter((id) => {
    if (!activeIds.has(id) || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

function normalizeLayout(
  layout: DisplayedSidebarLayout,
  lifecycle: SidebarLayoutLifecycle,
): DisplayedSidebarLayout {
  const activeProjects = lifecycle.projects
    .filter((project) => project.deletedAt === null)
    .toSorted(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    );
  const activeProjectIds = new Set(activeProjects.map((project) => project.id));
  const projectOrder = [...uniqueLiveIds(layout.projectOrder, activeProjectIds)];
  const seenProjectIds = new Set(projectOrder);
  for (const project of activeProjects) {
    if (!seenProjectIds.has(project.id)) {
      projectOrder.push(project.id);
      seenProjectIds.add(project.id);
    }
  }

  const activeThreadIds = new Set(
    lifecycle.threads.filter((thread) => thread.deletedAt === null).map((thread) => thread.id),
  );
  return {
    projectOrder,
    pinnedThreadOrder: uniqueLiveIds(layout.pinnedThreadOrder, activeThreadIds),
  };
}

function moveBefore<Id>(items: readonly Id[], subject: Id, anchor: Id | null): readonly Id[] {
  if (!items.includes(subject) || anchor === subject) {
    return items;
  }
  const remaining = items.filter((item) => item !== subject);
  if (anchor === null) {
    return [...remaining, subject];
  }
  const anchorIndex = remaining.indexOf(anchor);
  if (anchorIndex < 0) {
    return [...remaining, subject];
  }
  return [...remaining.slice(0, anchorIndex), subject, ...remaining.slice(anchorIndex)];
}

function applyIntent(
  layout: DisplayedSidebarLayout,
  intent: SidebarLayoutIntent,
  context: {
    readonly activeThreadIds: ReadonlySet<ThreadId>;
    readonly canonicalExists: boolean;
  },
): DisplayedSidebarLayout {
  switch (intent.type) {
    case "sidebar-layout.initialize":
      return context.canonicalExists
        ? layout
        : {
            projectOrder: intent.projectOrder,
            pinnedThreadOrder: intent.pinnedThreadOrder,
          };
    case "sidebar-layout.project.move":
      return {
        ...layout,
        projectOrder: moveBefore(
          layout.projectOrder,
          intent.projectId,
          intent.beforeProjectId ?? null,
        ),
      };
    case "sidebar-layout.thread.pin":
      return context.activeThreadIds.has(intent.threadId)
        ? {
            ...layout,
            pinnedThreadOrder: moveBefore(
              layout.pinnedThreadOrder.includes(intent.threadId)
                ? layout.pinnedThreadOrder
                : [...layout.pinnedThreadOrder, intent.threadId],
              intent.threadId,
              intent.beforeThreadId ?? null,
            ),
          }
        : layout;
    case "sidebar-layout.thread.unpin":
      return {
        ...layout,
        pinnedThreadOrder: layout.pinnedThreadOrder.filter(
          (threadId) => threadId !== intent.threadId,
        ),
      };
    case "sidebar-layout.pinned-thread.move":
      return {
        ...layout,
        pinnedThreadOrder: moveBefore(
          layout.pinnedThreadOrder,
          intent.threadId,
          intent.beforeThreadId ?? null,
        ),
      };
    default:
      return assertNever(intent);
  }
}

export function deriveDisplayedSidebarLayout(
  confirmed: SidebarLayout | null,
  pending: readonly PendingSidebarLayoutIntent[],
  lifecycle: SidebarLayoutLifecycle,
): DisplayedSidebarLayout {
  const emptyLayout: DisplayedSidebarLayout = {
    projectOrder: [],
    pinnedThreadOrder: [],
  };
  const normalized = normalizeLayout(confirmed ?? emptyLayout, lifecycle);
  const context = {
    activeThreadIds: new Set(
      lifecycle.threads.filter((thread) => thread.deletedAt === null).map((thread) => thread.id),
    ),
    canonicalExists: confirmed !== null,
  };
  const replayed = pending.reduce(
    (current, item) => applyIntent(current, item.intent, context),
    normalized,
  );
  return normalizeLayout(replayed, lifecycle);
}

export function selectDisplayedProjectOrder(layout: DisplayedSidebarLayout): readonly ProjectId[] {
  return layout.projectOrder;
}

export function selectDisplayedPinnedThreadOrder(
  layout: DisplayedSidebarLayout,
): readonly ThreadId[] {
  return layout.pinnedThreadOrder;
}

export function getDndNextSiblingAnchor<Id extends ProjectId | ThreadId>(
  order: readonly Id[],
  movedId: Id,
  overId: Id,
): DndNextSiblingAnchor<Id> {
  const normalized = [...new Set(order)];
  const movedIndex = normalized.indexOf(movedId);
  const overIndex = normalized.indexOf(overId);
  const remaining = normalized.filter((id) => id !== movedId);
  const finalOrder =
    movedIndex < 0 || overIndex < 0 || movedId === overId
      ? normalized
      : [...remaining.slice(0, overIndex), movedId, ...remaining.slice(overIndex)];
  const finalMovedIndex = finalOrder.indexOf(movedId);
  return {
    finalOrder,
    beforeId: finalMovedIndex < 0 ? null : (finalOrder.at(finalMovedIndex + 1) ?? null),
  };
}
