// FILE: desktopProjectRecovery.ts
// Purpose: Detects desktop startup snapshots that can hide projects while thread rows still exist.
// Exports: snapshot shape guard used by the desktop bootstrap repair path.

import type { OrchestrationReadModel, OrchestrationShellSnapshot } from "@jcode/contracts";

type ProjectRecoverySnapshot = OrchestrationReadModel | OrchestrationShellSnapshot;

export function hasLiveThreadsWithMissingProjects(snapshot: ProjectRecoverySnapshot): boolean {
  const liveProjectIds = new Set<string>();
  for (const project of snapshot.projects) {
    if (!("deletedAt" in project) || project.deletedAt === null) {
      liveProjectIds.add(project.id);
    }
  }

  return snapshot.threads.some((thread) => {
    const isLiveThread = !("deletedAt" in thread) || thread.deletedAt === null;
    return isLiveThread && !liveProjectIds.has(thread.projectId);
  });
}
