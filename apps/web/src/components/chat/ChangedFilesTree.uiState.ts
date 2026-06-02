// FILE: ChangedFilesTree.uiState.ts
// Purpose: Persist per-turn directory expansion state for changed-files trees.
// Layer: Browser storage helper
// Exports: read/write helpers for changed-files tree expansion state.

const CHANGED_FILES_UI_STATE_KEY = "jcode:changed-files-ui:v1";

export type ChangedFilesUiState = {
  expandedDirectoryPathsByTurnId: Record<string, string[]>;
};

const DEFAULT_CHANGED_FILES_UI_STATE: ChangedFilesUiState = {
  expandedDirectoryPathsByTurnId: {},
};

export function readChangedFilesUiState(): ChangedFilesUiState {
  if (typeof window === "undefined") {
    return DEFAULT_CHANGED_FILES_UI_STATE;
  }

  try {
    const raw = window.localStorage.getItem(CHANGED_FILES_UI_STATE_KEY);
    if (!raw) {
      return DEFAULT_CHANGED_FILES_UI_STATE;
    }

    const parsed = JSON.parse(raw) as {
      expandedDirectoryPathsByTurnId?: Record<string, string[]>;
    };

    return {
      expandedDirectoryPathsByTurnId: Object.fromEntries(
        Object.entries(parsed.expandedDirectoryPathsByTurnId ?? {}).filter(
          ([turnId, paths]) =>
            typeof turnId === "string" &&
            turnId.length > 0 &&
            Array.isArray(paths) &&
            paths.every((p): p is string => typeof p === "string" && p.length > 0),
        ),
      ),
    };
  } catch {
    return DEFAULT_CHANGED_FILES_UI_STATE;
  }
}

export function persistChangedFilesUiState(state: ChangedFilesUiState): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      CHANGED_FILES_UI_STATE_KEY,
      JSON.stringify({
        expandedDirectoryPathsByTurnId: Object.fromEntries(
          Object.entries(state.expandedDirectoryPathsByTurnId).filter(
            ([turnId, paths]) =>
              typeof turnId === "string" &&
              turnId.length > 0 &&
              Array.isArray(paths) &&
              paths.length > 0 &&
              paths.every((p) => typeof p === "string" && p.length > 0),
          ),
        ),
      }),
    );
  } catch {
    // Ignore storage errors so rendering keeps working when persistence is unavailable.
  }
}

export function getExpandedDirectoryPathsForTurn(
  state: ChangedFilesUiState,
  turnId: string,
): string[] {
  return state.expandedDirectoryPathsByTurnId[turnId] ?? [];
}

export function setExpandedDirectoryPathsForTurn(
  state: ChangedFilesUiState,
  turnId: string,
  paths: string[],
): ChangedFilesUiState {
  const nextPaths = paths.filter((p) => p.length > 0);
  if (nextPaths.length === 0) {
    const nextByTurnId = { ...state.expandedDirectoryPathsByTurnId };
    delete nextByTurnId[turnId];
    return { expandedDirectoryPathsByTurnId: nextByTurnId };
  }
  return {
    expandedDirectoryPathsByTurnId: {
      ...state.expandedDirectoryPathsByTurnId,
      [turnId]: nextPaths,
    },
  };
}
