// FILE: sidebarLayoutLegacyMigration.ts
// Purpose: Reads and retires one-time browser authority for sidebar order and pins.
// Layer: Web migration utility
// Exports: candidate reader, confirmed-state cleanup, durable marker key

import type { ProjectId, SidebarLayout, ThreadId } from "@jcode/contracts";
import { normalizeWorkspaceRootForComparison } from "@jcode/shared/threadWorkspace";

export const SIDEBAR_LAYOUT_MIGRATION_MARKER_KEY = "jcode:sidebar-layout-migrated:v1";

const RENDERER_STATE_KEYS = [
  "jcode:renderer-state:v8",
  "dpcode:renderer-state:v8",
  "t3code:renderer-state:v8",
  "t3code:renderer-state:v7",
  "t3code:renderer-state:v6",
  "t3code:renderer-state:v5",
  "t3code:renderer-state:v4",
  "t3code:renderer-state:v3",
] as const;

const PINNED_THREAD_KEYS = [
  "jcode:pinned-threads:v1",
  "dpcode:pinned-threads:v1",
  "t3code:pinned-threads:v1",
] as const;

export type HydratedSidebarLayoutSubjects = {
  readonly projects: readonly {
    readonly id: ProjectId;
    readonly workspaceRoot: string;
  }[];
  readonly threadIds: readonly ThreadId[];
};

export type SidebarLayoutLegacyCandidates = Pick<
  SidebarLayout,
  "projectOrder" | "pinnedThreadOrder"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(raw: string): unknown | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
}

function stringItems(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((candidate): candidate is string => typeof candidate === "string");
}

function rendererProjectOrder(raw: string): readonly string[] {
  const parsed = parseJson(raw);
  if (!isRecord(parsed)) {
    return [];
  }
  if (isRecord(parsed["state"])) {
    return stringItems(parsed["state"]["projectOrderCwds"]);
  }
  return stringItems(parsed["projectOrderCwds"]);
}

function parsePinnedThreadOrder(raw: string): readonly string[] {
  const parsed = parseJson(raw);
  if (Array.isArray(parsed)) {
    return stringItems(parsed);
  }
  if (!isRecord(parsed)) {
    return [];
  }
  if (isRecord(parsed["state"])) {
    return stringItems(parsed["state"]["pinnedThreadIds"]);
  }
  return stringItems(parsed["pinnedThreadIds"]);
}

function collectStoredValues(storage: Storage, keys: readonly string[]): readonly string[] {
  const values: string[] = [];
  for (const key of keys) {
    const value = storage.getItem(key);
    if (value !== null) {
      values.push(value);
    }
  }
  return values;
}

export function readSidebarLayoutLegacyCandidates(
  storage: Storage,
  serverLayout: SidebarLayout | null,
  subjects: HydratedSidebarLayoutSubjects,
): SidebarLayoutLegacyCandidates | null {
  if (serverLayout !== null) {
    return null;
  }

  try {
    if (storage.getItem(SIDEBAR_LAYOUT_MIGRATION_MARKER_KEY) !== null) {
      return null;
    }

    const projectByRoot = new Map(
      subjects.projects.map((project) => [
        normalizeWorkspaceRootForComparison(project.workspaceRoot),
        project.id,
      ]),
    );
    const projectOrder: ProjectId[] = [];
    for (const raw of collectStoredValues(storage, RENDERER_STATE_KEYS)) {
      for (const root of rendererProjectOrder(raw)) {
        const projectId = projectByRoot.get(normalizeWorkspaceRootForComparison(root));
        if (projectId !== undefined && !projectOrder.includes(projectId)) {
          projectOrder.push(projectId);
        }
      }
    }

    const hydratedThreadIds = new Map<string, ThreadId>(
      subjects.threadIds.map((threadId) => [threadId, threadId]),
    );
    const pinnedThreadOrder: ThreadId[] = [];
    for (const raw of collectStoredValues(storage, PINNED_THREAD_KEYS)) {
      for (const candidate of parsePinnedThreadOrder(raw)) {
        const threadId = hydratedThreadIds.get(candidate);
        if (threadId !== undefined && !pinnedThreadOrder.includes(threadId)) {
          pinnedThreadOrder.push(threadId);
        }
      }
    }

    return { projectOrder, pinnedThreadOrder };
  } catch (error) {
    if (error instanceof Error) {
      return null;
    }
    throw error;
  }
}

export function removeSidebarLayoutLegacyProjectOrder(raw: string): string | null {
  const parsed = parseJson(raw);
  if (!isRecord(parsed)) {
    return null;
  }
  if (isRecord(parsed["state"])) {
    const { projectOrderCwds: _projectOrder, ...presentationState } = parsed["state"];
    const { state: _state, ...envelope } = parsed;
    return JSON.stringify({ ...envelope, state: presentationState });
  }
  const { projectOrderCwds: _projectOrder, ...presentationState } = parsed;
  return JSON.stringify(presentationState);
}

export function confirmSidebarLayoutLegacyMigration(
  storage: Storage,
  serverLayout: SidebarLayout | null,
): boolean {
  if (serverLayout === null) {
    return false;
  }

  try {
    storage.setItem(SIDEBAR_LAYOUT_MIGRATION_MARKER_KEY, "1");
    for (const key of RENDERER_STATE_KEYS) {
      const raw = storage.getItem(key);
      if (raw === null) {
        continue;
      }
      const cleaned = removeSidebarLayoutLegacyProjectOrder(raw);
      if (cleaned !== null) {
        storage.setItem(key, cleaned);
      }
    }
    for (const key of PINNED_THREAD_KEYS) {
      storage.removeItem(key);
    }
    return true;
  } catch (error) {
    if (error instanceof Error) {
      return false;
    }
    throw error;
  }
}
