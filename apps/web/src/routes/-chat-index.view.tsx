import { ThreadId } from "@jcode/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { resolveRestorableThreadRoute } from "../chatRouteRestore";
import { SplashScreen } from "../components/SplashScreen";
import { readSidebarUiState } from "../components/Sidebar.uiState";
import { useHandleNewChat } from "../hooks/useHandleNewChat";
import { useSplitViewStore } from "../splitViewStore";
import { useStore } from "../store";

export function ChatIndexRouteView() {
  const { handleNewChat } = useHandleNewChat();
  const navigate = useNavigate();
  const threadsHydrated = useStore((store) => store.threadsHydrated);
  const threadIds = useStore((state) => state.threadIds ?? []);
  const splitViewsHydrated = useSplitViewStore((state) => state.hasHydrated);
  const splitViewsById = useSplitViewStore((state) => state.splitViewsById);
  const splitViewIds = useMemo(
    () => Object.keys(splitViewsById).filter((splitViewId) => splitViewsById[splitViewId]),
    [splitViewsById],
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const restoreOrCreateThread = useCallback(async (): Promise<string | null> => {
    setErrorMessage(null);

    const restorableRoute = resolveRestorableThreadRoute({
      lastThreadRoute: readSidebarUiState().lastThreadRoute,
      availableThreadIds: new Set(threadIds),
      availableSplitViewIds: new Set(splitViewIds),
    });
    if (restorableRoute) {
      await navigate({
        to: "/$threadId",
        params: { threadId: ThreadId.makeUnsafe(restorableRoute.threadId) },
        replace: true,
        search: () => ({
          splitViewId: restorableRoute.splitViewId,
        }),
      });
      return null;
    }

    const result = await handleNewChat({ fresh: true });
    return result.ok ? null : result.error;
  }, [handleNewChat, navigate, splitViewIds, threadIds]);

  useEffect(() => {
    if (!threadsHydrated || !splitViewsHydrated) {
      return;
    }

    let cancelled = false;

    void restoreOrCreateThread().then((error) => {
      if (!cancelled && error) {
        setErrorMessage(error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [restoreOrCreateThread, splitViewsHydrated, threadsHydrated]);

  const handleRetry = useCallback(() => {
    void restoreOrCreateThread().then((error) => {
      if (error) {
        setErrorMessage(error);
      }
    });
  }, [restoreOrCreateThread]);

  return (
    <SplashScreen
      errorMessage={errorMessage}
      onRetry={errorMessage ? handleRetry : null}
    />
  );
}
