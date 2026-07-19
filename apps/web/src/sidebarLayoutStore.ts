import type {
  CommandId,
  DispatchableClientOrchestrationCommand,
  DispatchResult,
  SidebarLayout,
} from "@jcode/contracts";
import { createStore } from "zustand/vanilla";
import { newCommandId } from "./lib/utils";
import { ensureNativeApi } from "./nativeApi";
import type {
  DisplayedSidebarLayout,
  PendingSidebarLayoutIntent,
  SidebarLayoutLifecycle,
  SidebarLayoutIntent,
} from "./sidebarLayout.logic";
import {
  acceptConfirmedSidebarLayout,
  deriveDisplayedSidebarLayout,
  reconcilePendingSidebarLayoutIntents,
} from "./sidebarLayout.logic";

export type SidebarLayoutCommand = Extract<
  DispatchableClientOrchestrationCommand,
  { readonly type: SidebarLayoutIntent["type"] }
>;

export type SidebarLayoutDispatch = (command: SidebarLayoutCommand) => Promise<DispatchResult>;

export type SidebarLayoutStoreDependencies = {
  readonly dispatchCommand: SidebarLayoutDispatch;
  readonly createCommandId?: () => PendingSidebarLayoutIntent["commandId"];
};

export type SidebarLayoutEnqueueOptions = {
  readonly onRejected?: (error: unknown) => void;
};

export type SidebarLayoutStoreState = {
  readonly confirmedLayout: SidebarLayout | null;
  readonly pendingIntents: readonly PendingSidebarLayoutIntent[];
  readonly lifecycle: SidebarLayoutLifecycle;
  readonly inFlightCommandId: CommandId | null;
  readonly enqueue: (
    intent: SidebarLayoutIntent,
    options?: SidebarLayoutEnqueueOptions,
  ) => CommandId;
  readonly acceptConfirmedLayout: (layout: SidebarLayout | null) => void;
  readonly setLifecycle: (lifecycle: SidebarLayoutLifecycle) => void;
  readonly retryInFlight: () => boolean;
};

const displayedLayoutByState = new WeakMap<SidebarLayoutStoreState, DisplayedSidebarLayout>();

function sidebarLayoutLifecycleEqual(
  left: SidebarLayoutLifecycle,
  right: SidebarLayoutLifecycle,
): boolean {
  return (
    left.projects.length === right.projects.length &&
    left.projects.every((project, index) => {
      const candidate = right.projects[index];
      return (
        candidate !== undefined &&
        project.id === candidate.id &&
        project.kind === candidate.kind &&
        project.createdAt === candidate.createdAt &&
        project.deletedAt === candidate.deletedAt
      );
    }) &&
    left.threads.length === right.threads.length &&
    left.threads.every((thread, index) => {
      const candidate = right.threads[index];
      return (
        candidate !== undefined &&
        thread.id === candidate.id &&
        thread.deletedAt === candidate.deletedAt
      );
    })
  );
}

export function selectDisplayedSidebarLayout(
  state: SidebarLayoutStoreState,
): DisplayedSidebarLayout {
  const cached = displayedLayoutByState.get(state);
  if (cached !== undefined) {
    return cached;
  }
  const displayed = deriveDisplayedSidebarLayout(
    state.confirmedLayout,
    state.pendingIntents,
    state.lifecycle,
  );
  displayedLayoutByState.set(state, displayed);
  return displayed;
}

export function selectDisplayedProjectOrder(
  state: SidebarLayoutStoreState,
): DisplayedSidebarLayout["projectOrder"] {
  return selectDisplayedSidebarLayout(state).projectOrder;
}

export function selectDisplayedPinnedThreadOrder(
  state: SidebarLayoutStoreState,
): DisplayedSidebarLayout["pinnedThreadOrder"] {
  return selectDisplayedSidebarLayout(state).pinnedThreadOrder;
}

export function createSidebarLayoutStore(dependencies: SidebarLayoutStoreDependencies) {
  return createStore<SidebarLayoutStoreState>()((set, get) => {
    let activeAttempt = 0;
    const rejectionHandlers = new Map<CommandId, (error: unknown) => void>();

    const dispatchAttempt = (pendingIntent: PendingSidebarLayoutIntent): void => {
      const attempt = ++activeAttempt;
      const command: SidebarLayoutCommand = {
        ...pendingIntent.intent,
        commandId: pendingIntent.commandId,
      };
      void Promise.resolve()
        .then(() => dependencies.dispatchCommand(command))
        .then(
          (result) => {
            if (attempt !== activeAttempt || get().inFlightCommandId !== pendingIntent.commandId) {
              return;
            }
            set((state) => {
              const accepted = state.pendingIntents.map((pending) =>
                pending.commandId === pendingIntent.commandId
                  ? { ...pending, acceptedSequence: result.sequence }
                  : pending,
              );
              return {
                inFlightCommandId: null,
                pendingIntents: reconcilePendingSidebarLayoutIntents(
                  accepted,
                  state.confirmedLayout?.revision ?? null,
                ),
              };
            });
            rejectionHandlers.delete(pendingIntent.commandId);
            dispatchNext();
          },
          (error: unknown) => {
            if (attempt !== activeAttempt || get().inFlightCommandId !== pendingIntent.commandId) {
              return;
            }
            set((state) => ({
              inFlightCommandId: null,
              pendingIntents: state.pendingIntents.filter(
                (pending) => pending.commandId !== pendingIntent.commandId,
              ),
            }));
            const onRejected = rejectionHandlers.get(pendingIntent.commandId);
            rejectionHandlers.delete(pendingIntent.commandId);
            try {
              onRejected?.(error);
            } catch {
              return;
            } finally {
              dispatchNext();
            }
          },
        );
    };

    const dispatchNext = (): void => {
      if (get().inFlightCommandId !== null) {
        return;
      }
      const next = get().pendingIntents.find((pending) => pending.acceptedSequence === undefined);
      if (next === undefined) {
        return;
      }
      set({ inFlightCommandId: next.commandId });
      dispatchAttempt(next);
    };

    return {
      confirmedLayout: null,
      pendingIntents: [],
      lifecycle: { projects: [], threads: [] },
      inFlightCommandId: null,
      enqueue: (intent, options) => {
        const commandId = (dependencies.createCommandId ?? newCommandId)();
        if (options?.onRejected !== undefined) {
          rejectionHandlers.set(commandId, options.onRejected);
        }
        set((state) => ({
          pendingIntents: [...state.pendingIntents, { commandId, intent }],
        }));
        dispatchNext();
        return commandId;
      },
      acceptConfirmedLayout: (incoming) => {
        if (incoming === null) {
          return;
        }
        const current = get();
        const lostInitializer = current.pendingIntents.find(
          (pending) =>
            pending.commandId === current.inFlightCommandId &&
            pending.intent.type === "sidebar-layout.initialize" &&
            pending.acceptedSequence === undefined,
        );
        if (lostInitializer !== undefined) {
          activeAttempt += 1;
          rejectionHandlers.delete(lostInitializer.commandId);
        }
        set((state) => {
          const confirmedLayout = acceptConfirmedSidebarLayout(state.confirmedLayout, incoming);
          const pendingIntents =
            lostInitializer === undefined
              ? state.pendingIntents
              : state.pendingIntents.filter(
                  (pending) => pending.commandId !== lostInitializer.commandId,
                );
          const reconciledPendingIntents = reconcilePendingSidebarLayoutIntents(
            pendingIntents,
            confirmedLayout.revision,
          );
          if (
            confirmedLayout === state.confirmedLayout &&
            reconciledPendingIntents.length === state.pendingIntents.length &&
            reconciledPendingIntents.every(
              (pending, index) => pending === state.pendingIntents[index],
            ) &&
            lostInitializer === undefined
          ) {
            return state;
          }
          return {
            confirmedLayout,
            pendingIntents: reconciledPendingIntents,
            ...(lostInitializer === undefined ? {} : { inFlightCommandId: null }),
          };
        });
        if (lostInitializer !== undefined) {
          dispatchNext();
        }
      },
      setLifecycle: (lifecycle) =>
        set((state) =>
          sidebarLayoutLifecycleEqual(state.lifecycle, lifecycle) ? state : { lifecycle },
        ),
      retryInFlight: () => {
        const commandId = get().inFlightCommandId;
        if (commandId === null) {
          return false;
        }
        const pending = get().pendingIntents.find((item) => item.commandId === commandId);
        if (pending === undefined) {
          return false;
        }
        dispatchAttempt(pending);
        return true;
      },
    };
  });
}

export const sidebarLayoutStore = createSidebarLayoutStore({
  dispatchCommand: (command) => ensureNativeApi().orchestration.dispatchCommand(command),
});
