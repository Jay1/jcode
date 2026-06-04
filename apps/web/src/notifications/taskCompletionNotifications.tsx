// FILE: taskCompletionNotifications.tsx
// Purpose: Bridges thread completion and attention-needed events to in-app toasts and OS notifications.
// Layer: Notification runtime
// Exports: TaskCompletionNotifications

import { ThreadId } from "@jcode/contracts";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toastManager } from "../components/ui/toast";
import { resolveVisibleToastThreadIds } from "../components/ui/toastRouteVisibility";
import { useAppSettings } from "../appSettings";
import { parseDiffRouteSearch } from "../diffRouteSearch";
import { selectSplitView, useSplitViewStore } from "../splitViewStore";
import { useStore } from "../store";
import { createAllThreadsSelector } from "../storeSelectors";
import { useTerminalStateStore } from "../terminalStateStore";
import type { Thread } from "../types";
import {
  buildTerminalAttentionCopy,
  buildTerminalCompletionCopy,
  buildInputNeededCopy,
  buildTaskCompletionCopy,
  collectCompletedThreadCandidates,
  collectCompletedTerminalCandidates,
  collectInputNeededThreadCandidates,
  collectTerminalAttentionCandidates,
  isNotificationRuntimeFreshTimestamp,
  shouldShowThreadNotificationToast,
} from "./taskCompletion.logic";
import { readBrowserNotificationPermissionState } from "./taskCompletion.permissions";

const selectAllThreads = createAllThreadsSelector();

function isWindowForeground(): boolean {
  if (typeof document === "undefined") {
    return true;
  }
  return document.visibilityState === "visible" && document.hasFocus();
}

interface ThreadNotificationCopy {
  title: string;
  body: string;
}

// Notification opens are generic thread activations, so they clear splitViewId
// instead of resurrecting a hidden split pairing.
function focusThread(threadId: Thread["id"], navigate: ReturnType<typeof useNavigate>): void {
  void navigate({
    to: "/$threadId",
    params: { threadId },
    search: (previous) => ({ ...previous, splitViewId: undefined }),
  });
}

async function showSystemThreadNotification(
  copy: ThreadNotificationCopy,
  threadId: Thread["id"],
  navigate: ReturnType<typeof useNavigate>,
): Promise<boolean> {
  const { body, title } = copy;

  if (window.desktopBridge) {
    const supported = await window.desktopBridge.notifications.isSupported();
    if (!supported) {
      return false;
    }
    return window.desktopBridge.notifications.show({ title, body, silent: false, threadId });
  }

  if (readBrowserNotificationPermissionState() !== "granted") {
    return false;
  }

  const notification = new Notification(title, {
    body,
    tag: `thread-notification:${threadId}`,
  });
  notification.addEventListener("click", () => {
    window.focus();
    focusThread(threadId, navigate);
  });
  return true;
}

function showThreadToast(
  copy: ThreadNotificationCopy,
  threadId: Thread["id"],
  tone: "success" | "warning",
  navigate: ReturnType<typeof useNavigate>,
): void {
  const { body, title } = copy;
  toastManager.add({
    type: tone,
    title,
    description: body,
    data: {
      allowCrossThreadVisibility: true,
      threadId,
      dismissAfterVisibleMs: 8000,
    },
    actionProps: {
      children: "Open",
      onClick: () => focusThread(threadId, navigate),
    },
  });
}

export function TaskCompletionNotifications() {
  const { settings } = useAppSettings();
  const navigate = useNavigate();
  const activeThreadId = useParams({
    strict: false,
    select: (params) =>
      typeof params.threadId === "string" ? ThreadId.makeUnsafe(params.threadId) : null,
  });
  const routeSearch = useSearch({
    strict: false,
    select: (search) => parseDiffRouteSearch(search),
  });
  const splitView = useSplitViewStore(selectSplitView(routeSearch.splitViewId ?? null));
  const threads = useStore(selectAllThreads);
  const threadsHydrated = useStore((store) => store.threadsHydrated);
  const terminalStateByThreadId = useTerminalStateStore((store) => store.terminalStateByThreadId);
  const previousThreadsRef = useRef<readonly Thread[]>([]);
  const previousTerminalStateRef = useRef(terminalStateByThreadId);
  const [runtimeStartedAtMs] = useState(() => Date.now());
  const readyRef = useRef(false);

  useEffect(() => {
    const onMenuAction = window.desktopBridge?.onMenuAction;
    if (typeof onMenuAction !== "function") {
      return;
    }

    const unsubscribe = onMenuAction((action) => {
      const prefix = "notification-open-thread:";
      if (!action.startsWith(prefix)) {
        return;
      }
      const threadId = action.slice(prefix.length).trim();
      if (threadId.length === 0) {
        return;
      }
      focusThread(threadId as Thread["id"], navigate);
    });

    return () => {
      unsubscribe?.();
    };
  }, [navigate]);

  useEffect(() => {
    if (!threadsHydrated) {
      return;
    }

    const visibleThreadIds = resolveVisibleToastThreadIds({ activeThreadId, splitView });

    if (!readyRef.current) {
      previousThreadsRef.current = threads;
      previousTerminalStateRef.current = terminalStateByThreadId;
      readyRef.current = true;
      return;
    }

    const completions = collectCompletedThreadCandidates(
      previousThreadsRef.current,
      threads,
    ).filter((candidate) =>
      isNotificationRuntimeFreshTimestamp(candidate.completedAt, runtimeStartedAtMs),
    );
    const terminalCompletions = collectCompletedTerminalCandidates(
      previousTerminalStateRef.current,
      terminalStateByThreadId,
    );
    const inputNeededCandidates = collectInputNeededThreadCandidates(
      previousThreadsRef.current,
      threads,
    ).filter((candidate) =>
      isNotificationRuntimeFreshTimestamp(candidate.createdAt, runtimeStartedAtMs),
    );
    const terminalAttentionCandidates = collectTerminalAttentionCandidates(
      previousTerminalStateRef.current,
      terminalStateByThreadId,
    );
    previousThreadsRef.current = threads;
    previousTerminalStateRef.current = terminalStateByThreadId;

    if (
      completions.length === 0 &&
      inputNeededCandidates.length === 0 &&
      terminalCompletions.length === 0 &&
      terminalAttentionCandidates.length === 0
    ) {
      return;
    }

    const shouldAttemptSystemNotification =
      settings.enableSystemTaskCompletionNotifications &&
      (window.desktopBridge ? true : !isWindowForeground());

    for (const completion of completions) {
      const copy = buildTaskCompletionCopy(completion);
      if (
        settings.enableTaskCompletionToasts &&
        shouldShowThreadNotificationToast({
          threadId: completion.threadId,
          visibleThreadIds,
        })
      ) {
        showThreadToast(copy, completion.threadId, "success", navigate);
      }

      if (shouldAttemptSystemNotification) {
        void showSystemThreadNotification(copy, completion.threadId, navigate);
      }
    }

    for (const candidate of inputNeededCandidates) {
      const copy = buildInputNeededCopy(candidate);
      if (
        settings.enableTaskCompletionToasts &&
        shouldShowThreadNotificationToast({
          threadId: candidate.threadId,
          visibleThreadIds,
        })
      ) {
        showThreadToast(copy, candidate.threadId, "warning", navigate);
      }

      if (shouldAttemptSystemNotification) {
        void showSystemThreadNotification(copy, candidate.threadId, navigate);
      }
    }

    for (const completion of terminalCompletions) {
      const copy = buildTerminalCompletionCopy(completion);
      if (
        settings.enableTaskCompletionToasts &&
        shouldShowThreadNotificationToast({
          threadId: completion.threadId,
          visibleThreadIds,
        })
      ) {
        showThreadToast(copy, completion.threadId, "success", navigate);
      }

      if (shouldAttemptSystemNotification) {
        void showSystemThreadNotification(copy, completion.threadId, navigate);
      }
    }

    for (const candidate of terminalAttentionCandidates) {
      const copy = buildTerminalAttentionCopy(candidate);
      if (
        settings.enableTaskCompletionToasts &&
        shouldShowThreadNotificationToast({
          threadId: candidate.threadId,
          visibleThreadIds,
        })
      ) {
        showThreadToast(copy, candidate.threadId, "warning", navigate);
      }

      if (shouldAttemptSystemNotification) {
        void showSystemThreadNotification(copy, candidate.threadId, navigate);
      }
    }
  }, [
    navigate,
    activeThreadId,
    runtimeStartedAtMs,
    settings.enableSystemTaskCompletionNotifications,
    settings.enableTaskCompletionToasts,
    splitView,
    terminalStateByThreadId,
    threads,
    threadsHydrated,
  ]);

  return null;
}
