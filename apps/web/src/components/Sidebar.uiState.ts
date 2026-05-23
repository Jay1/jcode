// FILE: Sidebar.uiState.ts
// Purpose: Persists sidebar-only UI preferences plus the last chat route for restore flows.
// Layer: Browser storage helper
// Exports: sidebar UI state read/write helpers.

import { normalizeWorkspaceRootForComparison } from "@jcode/shared/threadWorkspace";
import type { LastThreadRoute } from "../chatRouteRestore";

const SIDEBAR_UI_STATE_STORAGE_KEY = "jcode:sidebar-ui:v1";

export type SidebarUiState = {
  chatSectionExpanded: boolean;
  chatThreadListExpanded: boolean;
  expandedProjectThreadListCwds: string[];
  dismissedThreadStatusKeyByThreadId: Record<string, string>;
  lastThreadRoute: LastThreadRoute | null;
};

const DEFAULT_SIDEBAR_UI_STATE: SidebarUiState = {
  chatSectionExpanded: false,
  chatThreadListExpanded: false,
  expandedProjectThreadListCwds: [],
  dismissedThreadStatusKeyByThreadId: {},
  lastThreadRoute: null,
};

function normalizeExpandedProjectThreadListCwds(values: readonly unknown[]): string[] {
  const normalizedCwds: string[] = [];
  const seenCwds = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const cwd = normalizeSidebarProjectThreadListCwd(value);
    if (cwd.length === 0 || seenCwds.has(cwd)) continue;
    seenCwds.add(cwd);
    normalizedCwds.push(cwd);
  }
  return normalizedCwds;
}

export function normalizeSidebarProjectThreadListCwd(cwd: string): string {
  return normalizeWorkspaceRootForComparison(cwd);
}

export function readSidebarUiState(): SidebarUiState {
  if (typeof window === "undefined") {
    return DEFAULT_SIDEBAR_UI_STATE;
  }

  try {
    const raw = window.localStorage.getItem(SIDEBAR_UI_STATE_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SIDEBAR_UI_STATE;
    }

    const parsed = JSON.parse(raw) as {
      chatSectionExpanded?: boolean;
      chatThreadListExpanded?: boolean;
      expandedProjectThreadListCwds?: string[];
      dismissedThreadStatusKeyByThreadId?: Record<string, string>;
      lastThreadRoute?: {
        threadId?: unknown;
        splitViewId?: unknown;
      } | null;
    };

    const lastThreadRoute =
      parsed.lastThreadRoute &&
      typeof parsed.lastThreadRoute.threadId === "string" &&
      parsed.lastThreadRoute.threadId.length > 0
        ? {
            threadId: parsed.lastThreadRoute.threadId,
            ...(typeof parsed.lastThreadRoute.splitViewId === "string" &&
            parsed.lastThreadRoute.splitViewId.length > 0
              ? { splitViewId: parsed.lastThreadRoute.splitViewId }
              : {}),
          }
        : null;

    return {
      chatSectionExpanded: parsed.chatSectionExpanded === true,
      chatThreadListExpanded: parsed.chatThreadListExpanded === true,
      expandedProjectThreadListCwds: normalizeExpandedProjectThreadListCwds(
        parsed.expandedProjectThreadListCwds ?? [],
      ),
      dismissedThreadStatusKeyByThreadId: Object.fromEntries(
        Object.entries(parsed.dismissedThreadStatusKeyByThreadId ?? {}).filter(
          ([threadId, statusKey]) =>
            typeof threadId === "string" &&
            threadId.length > 0 &&
            typeof statusKey === "string" &&
            statusKey.length > 0,
        ),
      ),
      lastThreadRoute,
    };
  } catch {
    return DEFAULT_SIDEBAR_UI_STATE;
  }
}

export function persistSidebarUiState(input: SidebarUiState): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      SIDEBAR_UI_STATE_STORAGE_KEY,
      JSON.stringify({
        chatSectionExpanded: input.chatSectionExpanded,
        chatThreadListExpanded: input.chatThreadListExpanded,
        expandedProjectThreadListCwds: normalizeExpandedProjectThreadListCwds(
          input.expandedProjectThreadListCwds,
        ),
        dismissedThreadStatusKeyByThreadId: Object.fromEntries(
          Object.entries(input.dismissedThreadStatusKeyByThreadId).filter(
            ([threadId, statusKey]) => threadId.length > 0 && statusKey.length > 0,
          ),
        ),
        lastThreadRoute: input.lastThreadRoute
          ? {
              threadId: input.lastThreadRoute.threadId,
              ...(input.lastThreadRoute.splitViewId
                ? { splitViewId: input.lastThreadRoute.splitViewId }
                : {}),
            }
          : null,
      }),
    );
  } catch {
    // Ignore storage errors so sidebar rendering keeps working when persistence is unavailable.
  }
}
