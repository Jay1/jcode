export const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 64;

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

  return nextScrollTop < previousScrollTop - 0.5;
}

export function shouldDisableTailFollowOnWheel(input: TailFollowWheelInput): boolean {
  const { tailFollowEnabled, deltaY } = input;
  if (!tailFollowEnabled || !Number.isFinite(deltaY)) return false;

  return deltaY < -0.5;
}
