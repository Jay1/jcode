import type { OrchestrationShellStreamEvent, SidebarLayout } from "@jcode/contracts";
import type { StoreApi } from "zustand/vanilla";
import type { SidebarLayoutLifecycle } from "./sidebarLayout.logic";
import type { SidebarLayoutLegacyCandidates } from "./sidebarLayoutLegacyMigration";
import type { SidebarLayoutStoreState } from "./sidebarLayoutStore";

export type SidebarLayoutRouterSnapshot = {
  readonly sidebarLayout: SidebarLayout | null;
  readonly lifecycle: SidebarLayoutLifecycle;
  readonly legacyCandidates?: SidebarLayoutLegacyCandidates | null;
};

export type SidebarLayoutRouterDependencies = {
  readonly store: Pick<StoreApi<SidebarLayoutStoreState>, "getState">;
  readonly confirmLegacyMigration?: (layout: SidebarLayout) => boolean;
  readonly onInitializationRejected?: (failure: SidebarLayoutInitializationFailure) => void;
};

export type SidebarLayoutInitializationFailure = {
  readonly error: unknown;
  readonly retry: () => boolean;
};

export type SidebarLayoutSnapshotSource = "stream" | "query";

export function sidebarLayoutLegacySubjectsReady(
  source: SidebarLayoutSnapshotSource,
  lifecycle: SidebarLayoutLifecycle,
): boolean {
  return source === "query" || lifecycle.projects.length > 0 || lifecycle.threads.length > 0;
}

function applyLifecycleShellEvent(
  lifecycle: SidebarLayoutLifecycle,
  event: Exclude<OrchestrationShellStreamEvent, { readonly kind: "sidebar-layout-updated" }>,
): SidebarLayoutLifecycle {
  switch (event.kind) {
    case "project-upserted":
      return {
        ...lifecycle,
        projects: [
          ...lifecycle.projects.filter((project) => project.id !== event.project.id),
          {
            id: event.project.id,
            kind: event.project.kind,
            createdAt: event.project.createdAt,
            deletedAt: null,
          },
        ],
      };
    case "project-removed":
      return {
        ...lifecycle,
        projects: lifecycle.projects.filter((project) => project.id !== event.projectId),
      };
    case "thread-upserted":
      return {
        ...lifecycle,
        threads: [
          ...lifecycle.threads.filter((thread) => thread.id !== event.thread.id),
          { id: event.thread.id, deletedAt: null },
        ],
      };
    case "thread-removed":
      return {
        ...lifecycle,
        threads: lifecycle.threads.filter((thread) => thread.id !== event.threadId),
      };
  }
}

export function createSidebarLayoutRouter(dependencies: SidebarLayoutRouterDependencies) {
  let initializationAttempted = false;
  let initializationCandidates: SidebarLayoutLegacyCandidates | null = null;
  let legacyCleanupComplete = false;

  const confirmLegacyMigration = (): void => {
    if (legacyCleanupComplete || dependencies.confirmLegacyMigration === undefined) {
      return;
    }
    const confirmedLayout = dependencies.store.getState().confirmedLayout;
    if (confirmedLayout !== null) {
      legacyCleanupComplete = dependencies.confirmLegacyMigration(confirmedLayout);
    }
  };

  const acceptConfirmedLayout = (layout: SidebarLayout | null): void => {
    dependencies.store.getState().acceptConfirmedLayout(layout);
    confirmLegacyMigration();
  };

  const retryInitialization = (): boolean => {
    if (
      initializationAttempted ||
      initializationCandidates === null ||
      dependencies.store.getState().confirmedLayout !== null
    ) {
      return false;
    }
    enqueueInitialization(initializationCandidates);
    return true;
  };

  function enqueueInitialization(candidates: SidebarLayoutLegacyCandidates): void {
    initializationAttempted = true;
    initializationCandidates = candidates;
    dependencies.store.getState().enqueue(
      {
        type: "sidebar-layout.initialize",
        projectOrder: candidates.projectOrder,
        pinnedThreadOrder: candidates.pinnedThreadOrder,
      },
      {
        onRejected: (error) => {
          initializationAttempted = false;
          dependencies.onInitializationRejected?.({ error, retry: retryInitialization });
        },
      },
    );
  }

  return {
    acceptConfirmedLayout,
    acceptSnapshot: (snapshot: SidebarLayoutRouterSnapshot): void => {
      const state = dependencies.store.getState();
      state.setLifecycle(snapshot.lifecycle);
      acceptConfirmedLayout(snapshot.sidebarLayout);

      if (
        snapshot.sidebarLayout !== null ||
        dependencies.store.getState().confirmedLayout !== null
      ) {
        initializationAttempted = true;
        return;
      }
      if (
        snapshot.legacyCandidates === undefined ||
        snapshot.legacyCandidates === null ||
        initializationAttempted
      ) {
        return;
      }

      enqueueInitialization(snapshot.legacyCandidates);
    },
    acceptShellEvent: (event: OrchestrationShellStreamEvent): void => {
      switch (event.kind) {
        case "sidebar-layout-updated":
          acceptConfirmedLayout(event.sidebarLayout);
          return;
        case "project-upserted":
        case "project-removed":
        case "thread-upserted":
        case "thread-removed":
          dependencies.store
            .getState()
            .setLifecycle(applyLifecycleShellEvent(dependencies.store.getState().lifecycle, event));
          return;
      }
    },
    reconnect: (): boolean => dependencies.store.getState().retryInFlight(),
  };
}
