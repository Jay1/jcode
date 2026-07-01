export const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 64;
const SCROLL_INTENT_TOLERANCE_PX = 0.5;

interface ScrollPosition {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}

interface TailFollowScrollInput {
  tailFollowEnabled: boolean;
  previousScrollTop: number | null;
  nextScrollTop: number;
  nextClientHeight: number;
  nextScrollHeight: number;
  nowMs: number;
  programmaticScrollUntilMs: number;
}

interface TailFollowWheelInput {
  tailFollowEnabled: boolean;
  deltaY: number;
}

interface TimelineLiveEdgeState {
  isAtEnd?: boolean;
  isNearEnd?: boolean;
}

export function getScrollContainerDistanceFromBottom(position: ScrollPosition): number {
  const { scrollTop, clientHeight, scrollHeight } = position;
  if (![scrollTop, clientHeight, scrollHeight].every(Number.isFinite)) {
    return 0;
  }

  return Math.max(0, scrollHeight - clientHeight - scrollTop);
}

export function isScrollContainerNearBottom(
  position: ScrollPosition,
  thresholdPx = AUTO_SCROLL_BOTTOM_THRESHOLD_PX,
): boolean {
  const threshold = Number.isFinite(thresholdPx)
    ? Math.max(0, thresholdPx)
    : AUTO_SCROLL_BOTTOM_THRESHOLD_PX;

  return getScrollContainerDistanceFromBottom(position) <= threshold;
}

export function resolveTimelineLiveEdge(
  state: TimelineLiveEdgeState | undefined,
): boolean | undefined {
  return state?.isNearEnd ?? state?.isAtEnd;
}

/**
 * Returns true when scroll input should disable sticky tail-follow.
 *
 * A first scroll observation has no direction baseline, so it detaches only
 * when the viewport is already away from the bottom. Later observations detach
 * on upward user movement outside the programmatic scroll guard window.
 */
export function shouldDisableTailFollowOnScroll(input: TailFollowScrollInput): boolean {
  const {
    tailFollowEnabled,
    previousScrollTop,
    nextScrollTop,
    nextClientHeight,
    nextScrollHeight,
    nowMs,
    programmaticScrollUntilMs,
  } = input;
  if (!tailFollowEnabled) {
    return false;
  }
  if (nowMs < programmaticScrollUntilMs) {
    return false;
  }
  if (!Number.isFinite(nextScrollTop)) {
    return false;
  }
  if (previousScrollTop === null) {
    return !isScrollContainerNearBottom({
      scrollTop: nextScrollTop,
      clientHeight: nextClientHeight,
      scrollHeight: nextScrollHeight,
    });
  }
  if (!Number.isFinite(previousScrollTop)) return false;

  return nextScrollTop < previousScrollTop - SCROLL_INTENT_TOLERANCE_PX;
}

/** Returns true when upward wheel input should disable sticky tail-follow. */
export function shouldDisableTailFollowOnWheel(input: TailFollowWheelInput): boolean {
  const { tailFollowEnabled, deltaY } = input;
  if (!tailFollowEnabled || !Number.isFinite(deltaY)) return false;

  return deltaY < -SCROLL_INTENT_TOLERANCE_PX;
}
