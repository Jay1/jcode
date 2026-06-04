import {
  useCallback,
  useEffect,
  useRef,
  type DragEvent as ReactDragEvent,
  type ReactNode,
} from "react";
import { type ThreadId } from "@jcode/contracts";
import { type SplitDirection, type SplitDropSide } from "../../splitViewStore";
import { cn } from "../../lib/utils";
import {
  dropZoneToDirectionSide,
  getDropZoneFromPointer,
  isThreadDrag,
  isThreadDragPayloadAllowed,
  parseThreadDragPayload,
  type DropZone,
  type ThreadDragPayload,
} from "./ChatPaneDropOverlay.logic";

const DROP_ZONE_PREVIEW_CLASS: Record<DropZone, string> = {
  top: "left-0 right-0 top-0 h-1/2",
  bottom: "left-0 right-0 bottom-0 h-1/2",
  left: "top-0 bottom-0 left-0 w-1/2",
  right: "top-0 bottom-0 right-0 w-1/2",
};
const DROP_ZONE_PREVIEW_BASE_CLASS =
  "absolute m-1 rounded-md bg-info/18 ring-1 ring-inset ring-info/65";
const EMPTY_RECT = { left: 0, top: 0, width: 0, height: 0 };

interface ChatPaneDropOverlayProps {
  // Centralized tree-aware predicate. Split panes use this to enforce the 2x2 depth cap.
  canDropInDirection?: (direction: SplitDirection) => boolean;
  // ThreadIds whose drops should be ignored (e.g. threads already mounted in this split view).
  excludedThreadIds?: ReadonlySet<ThreadId>;
  onDrop(payload: ThreadDragPayload & { direction: SplitDirection; side: SplitDropSide }): void;
  // Outer wrapper className. Defaults to a layout-neutral filler that participates in flex containers.
  className?: string;
  children: ReactNode;
  // Identifier used to reset internal state when the wrapped surface changes (e.g. pane id).
  paneScopeId?: string;
}

export function ChatPaneDropOverlay(props: ChatPaneDropOverlayProps) {
  const { onDrop, canDropInDirection, excludedThreadIds, paneScopeId, className, children } = props;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const rectMeasuredAtRef = useRef(0);
  const activeZoneRef = useRef<DropZone | null>(null);

  const isZoneAllowed = useCallback(
    (zone: DropZone): boolean => {
      const { direction } = dropZoneToDirectionSide(zone);
      return canDropInDirection ? canDropInDirection(direction) : true;
    },
    [canDropInDirection],
  );

  const setPreviewZone = useCallback((zone: DropZone | null) => {
    const preview = previewRef.current;
    if (!preview) return;
    const nextClassName = zone
      ? cn(DROP_ZONE_PREVIEW_BASE_CLASS, DROP_ZONE_PREVIEW_CLASS[zone])
      : "";
    if (activeZoneRef.current === zone && preview.className === nextClassName) return;
    activeZoneRef.current = zone;
    if (zone === null) {
      preview.removeAttribute("data-chat-pane-drop-zone");
      preview.className = "";
      return;
    }
    preview.dataset.chatPaneDropZone = zone;
    preview.className = nextClassName;
  }, []);

  const resetOverlayState = useCallback(() => {
    rectRef.current = null;
    rectMeasuredAtRef.current = 0;
    setPreviewZone(null);
  }, [setPreviewZone]);

  const getCurrentRect = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return null;
    const now = performance.now();
    if (!rectRef.current || now - rectMeasuredAtRef.current >= 16) {
      rectRef.current = wrapper.getBoundingClientRect();
      rectMeasuredAtRef.current = now;
    }
    return rectRef.current;
  }, []);

  const getZoneForEvent = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) =>
      getDropZoneFromPointer(
        getCurrentRect() ?? EMPTY_RECT,
        event.clientX,
        event.clientY,
        isZoneAllowed,
      ),
    [getCurrentRect, isZoneAllowed],
  );

  const getAllowedZoneForEvent = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const zone = getZoneForEvent(event);
      if (!zone) return null;
      const payload = parseThreadDragPayload(event);
      if (
        payload &&
        !isThreadDragPayloadAllowed(payload, {
          excludedThreadIds,
        })
      ) {
        return null;
      }
      return zone;
    },
    [excludedThreadIds, getZoneForEvent],
  );

  const handleDragEnter = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!isThreadDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      rectRef.current = wrapperRef.current?.getBoundingClientRect() ?? null;
      rectMeasuredAtRef.current = performance.now();
      const zone = getAllowedZoneForEvent(event);
      event.dataTransfer.dropEffect = zone ? "move" : "none";
      setPreviewZone(zone);
    },
    [getAllowedZoneForEvent, setPreviewZone],
  );

  const handleDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!isThreadDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const zone = getAllowedZoneForEvent(event);
      event.dataTransfer.dropEffect = zone ? "move" : "none";
      setPreviewZone(zone);
    },
    [getAllowedZoneForEvent, setPreviewZone],
  );

  const handleDragLeave = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!isThreadDrag(event)) return;
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const related = event.relatedTarget as Node | null;
      if (related && wrapper.contains(related)) return;
      resetOverlayState();
    },
    [resetOverlayState],
  );

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!isThreadDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const zone = getZoneForEvent(event);
      const payload = parseThreadDragPayload(event);

      resetOverlayState();

      if (!zone || !payload) return;
      if (!isThreadDragPayloadAllowed(payload, { excludedThreadIds })) return;
      const { direction, side } = dropZoneToDirectionSide(zone);
      onDrop({ ...payload, direction, side });
    },
    [excludedThreadIds, getZoneForEvent, onDrop, resetOverlayState],
  );

  useEffect(() => {
    resetOverlayState();
    return resetOverlayState;
  }, [paneScopeId, resetOverlayState]);

  return (
    <div
      ref={wrapperRef}
      data-chat-pane-drop-overlay="true"
      className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col", className)}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      <div className="pointer-events-none absolute inset-0 z-50" data-chat-pane-drop-zones="true">
        <div ref={previewRef} data-chat-pane-drop-zone-active="true" />
      </div>
    </div>
  );
}
