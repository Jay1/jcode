import type { ServerManagedWorktree } from "@jcode/contracts";
import type { Thread } from "./types";

export type ManagedWorktreeAssociation = "active" | "archived" | "orphaned";

export type ManagedWorktreeCleanupChoice = ServerManagedWorktree & {
  readonly linkedThreads: readonly Thread[];
  readonly association: ManagedWorktreeAssociation;
  readonly canRemove: boolean;
  readonly blockedReason: string | null;
};

function normalizeWorktreePath(path: string | null): string | null {
  const trimmed = path?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

export function getOrphanedWorktreePathForThread(
  threads: readonly Thread[],
  threadId: Thread["id"],
): string | null {
  const targetThread = threads.find((thread) => thread.id === threadId);
  if (!targetThread) {
    return null;
  }

  const targetWorktreePath = normalizeWorktreePath(targetThread.worktreePath);
  if (!targetWorktreePath) {
    return null;
  }

  const isShared = threads.some((thread) => {
    if (thread.id === threadId) {
      return false;
    }
    return normalizeWorktreePath(thread.worktreePath) === targetWorktreePath;
  });

  return isShared ? null : targetWorktreePath;
}

export function formatWorktreePathForDisplay(worktreePath: string): string {
  const trimmed = worktreePath.trim();
  if (!trimmed) {
    return worktreePath;
  }

  const normalized = trimmed.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/");
  const lastPart = parts[parts.length - 1]?.trim() ?? "";
  return lastPart.length > 0 ? lastPart : trimmed;
}

export function classifyManagedWorktreeCleanupChoices(input: {
  readonly worktrees: readonly ServerManagedWorktree[];
  readonly threads: readonly Thread[];
}): readonly ManagedWorktreeCleanupChoice[] {
  return input.worktrees.map((worktree) => {
    const linkedThreads = input.threads.filter((thread) => {
      const candidatePaths = [
        normalizeWorktreePath(thread.worktreePath),
        normalizeWorktreePath(thread.associatedWorktreePath ?? null),
      ];
      return candidatePaths.includes(worktree.path);
    });
    const hasActiveThread = linkedThreads.some((thread) => (thread.archivedAt ?? null) === null);
    const association: ManagedWorktreeAssociation = hasActiveThread
      ? "active"
      : linkedThreads.length > 0
        ? "archived"
        : "orphaned";
    const serverBlockedReason =
      worktree.cleanupStatus === "safe" ? null : worktree.cleanupExplanation;
    const linkedThreadBlockedReason = hasActiveThread
      ? "This worktree is linked to an active conversation. Archive or delete that conversation first."
      : null;
    const blockedReason = serverBlockedReason ?? linkedThreadBlockedReason;

    return {
      ...worktree,
      linkedThreads,
      association,
      canRemove: blockedReason === null,
      blockedReason,
    };
  });
}
