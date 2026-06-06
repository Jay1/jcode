import { type ThreadId } from "@jcode/contracts";
import { type SplitDirection, type SplitDropSide } from "../../splitViewStore";

// Custom MIME so external file drops on the composer (which listen for `Files`) cannot trigger us.
export const THREAD_DRAG_MIME = "application/x-t3-thread";

export interface ThreadDragPayload {
  threadId: ThreadId;
}

export type DropZone = "top" | "bottom" | "left" | "right";

export interface ThreadDropRules {
  excludedThreadIds?: ReadonlySet<ThreadId> | undefined;
}

const EDGE_REGION_FRACTION = 1 / 3;

interface ThreadDragEventLike {
  dataTransfer: {
    getData(type: string): string;
    types: ArrayLike<string>;
  };
}

function chooseAllowedZone(
  primary: DropZone,
  fallback: DropZone,
  isZoneAllowed: (zone: DropZone) => boolean,
): DropZone {
  return isZoneAllowed(primary) ? primary : fallback;
}

export function getDropZoneFromPointer(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
  isZoneAllowed: (zone: DropZone) => boolean = () => true,
): DropZone | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const relX = (clientX - rect.left) / rect.width;
  const relY = (clientY - rect.top) / rect.height;
  if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return null;

  const horizontalAllowed = isZoneAllowed("left") || isZoneAllowed("right");
  const verticalAllowed = isZoneAllowed("top") || isZoneAllowed("bottom");
  if (!horizontalAllowed && !verticalAllowed) return null;

  if (!horizontalAllowed) {
    return relY < 0.5
      ? chooseAllowedZone("top", "bottom", isZoneAllowed)
      : chooseAllowedZone("bottom", "top", isZoneAllowed);
  }
  if (!verticalAllowed) {
    return relX < 0.5
      ? chooseAllowedZone("left", "right", isZoneAllowed)
      : chooseAllowedZone("right", "left", isZoneAllowed);
  }

  // VS Code-style regions: favor left/right on wide panes, top/bottom on tall panes.
  const preferHorizontal = rect.width >= rect.height;
  const chooseHorizontal = () =>
    relX < 0.5
      ? chooseAllowedZone("left", "right", isZoneAllowed)
      : chooseAllowedZone("right", "left", isZoneAllowed);
  const chooseVertical = () =>
    relY < 0.5
      ? chooseAllowedZone("top", "bottom", isZoneAllowed)
      : chooseAllowedZone("bottom", "top", isZoneAllowed);

  if (preferHorizontal) {
    if (relX < EDGE_REGION_FRACTION && isZoneAllowed("left")) return "left";
    if (relX > 1 - EDGE_REGION_FRACTION && isZoneAllowed("right")) return "right";
    return chooseVertical();
  }

  if (relY < EDGE_REGION_FRACTION && isZoneAllowed("top")) return "top";
  if (relY > 1 - EDGE_REGION_FRACTION && isZoneAllowed("bottom")) return "bottom";
  return chooseHorizontal();
}

export function dropZoneToDirectionSide(zone: DropZone): {
  direction: SplitDirection;
  side: SplitDropSide;
} {
  if (zone === "top") return { direction: "vertical", side: "first" };
  if (zone === "bottom") return { direction: "vertical", side: "second" };
  if (zone === "left") return { direction: "horizontal", side: "first" };
  return { direction: "horizontal", side: "second" };
}

export function isThreadDrag(event: ThreadDragEventLike): boolean {
  const { types } = event.dataTransfer;
  for (let index = 0; index < types.length; index += 1) {
    if (types[index] === THREAD_DRAG_MIME) return true;
  }
  return false;
}

export function parseThreadDragPayload(event: ThreadDragEventLike): ThreadDragPayload | null {
  try {
    const raw = event.dataTransfer.getData(THREAD_DRAG_MIME);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ThreadDragPayload>;
    if (typeof parsed.threadId === "string") {
      return {
        threadId: parsed.threadId as ThreadId,
      };
    }
  } catch {
    return null;
  }
  return null;
}

// Applies the same thread constraints for hover feedback and the final drop.
export function isThreadDragPayloadAllowed(
  payload: ThreadDragPayload,
  rules: ThreadDropRules,
): boolean {
  if (rules.excludedThreadIds?.has(payload.threadId)) return false;
  return true;
}
