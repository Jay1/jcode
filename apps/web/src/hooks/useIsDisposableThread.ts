import { type ThreadId } from "@jcode/contracts";
import { useEffect, useState } from "react";
import { useComposerDraftStore } from "../composerDraftStore";
import { useTemporaryThreadStore } from "../temporaryThreadStore";

export function useIsDisposableThread(threadId: ThreadId | null | undefined): boolean {
  const hasTemporaryThreadMarker = useTemporaryThreadStore((store) =>
    threadId ? store.temporaryThreadIds[threadId] === true : false,
  );
  const hasTemporaryDraftMetadata = useComposerDraftStore((store) =>
    threadId ? store.draftThreadsByThreadId[threadId]?.isTemporary === true : false,
  );
  const [seenDisposableThreadIds, setSeenDisposableThreadIds] = useState<ReadonlySet<ThreadId>>(
    () => new Set(),
  );

  useEffect(() => {
    if (!threadId) {
      return;
    }
    // Latch positives to avoid transient UI flicker during draft/server promotion.
    if (hasTemporaryThreadMarker || hasTemporaryDraftMetadata) {
      setSeenDisposableThreadIds((current) => {
        if (current.has(threadId)) return current;
        return new Set(current).add(threadId);
      });
    }
  }, [threadId, hasTemporaryDraftMetadata, hasTemporaryThreadMarker]);

  if (!threadId) {
    return false;
  }
  return (
    hasTemporaryThreadMarker || hasTemporaryDraftMetadata || seenDisposableThreadIds.has(threadId)
  );
}
