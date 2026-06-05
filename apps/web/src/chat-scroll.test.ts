import { describe, expect, it } from "vitest";

import {
  AUTO_SCROLL_BOTTOM_THRESHOLD_PX,
  getScrollContainerDistanceFromBottom,
  isScrollContainerNearBottom,
  shouldDisableTailFollowOnScroll,
  shouldDisableTailFollowOnWheel,
} from "./chat-scroll";

describe("getScrollContainerDistanceFromBottom", () => {
  it("returns the remaining distance when the viewport is above the bottom", () => {
    expect(
      getScrollContainerDistanceFromBottom({
        scrollTop: 520,
        clientHeight: 400,
        scrollHeight: 1_000,
      }),
    ).toBe(80);
  });

  it("clamps negative distances and non-finite values", () => {
    expect(
      getScrollContainerDistanceFromBottom({
        scrollTop: 620,
        clientHeight: 400,
        scrollHeight: 1_000,
      }),
    ).toBe(0);
    expect(
      getScrollContainerDistanceFromBottom({
        scrollTop: Number.NaN,
        clientHeight: 400,
        scrollHeight: 1_000,
      }),
    ).toBe(0);
  });
});

describe("shouldDisableTailFollowOnScroll", () => {
  it("disables tail follow for upward user scrolling outside the programmatic guard", () => {
    expect(
      shouldDisableTailFollowOnScroll({
        tailFollowEnabled: true,
        previousScrollTop: 500,
        nextScrollTop: 420,
        nextClientHeight: 400,
        nextScrollHeight: 1_000,
        nowMs: 1_000,
        programmaticScrollUntilMs: 900,
      }),
    ).toBe(true);
  });

  it("keeps tail follow for downward scrolls and programmatic guard windows", () => {
    expect(
      shouldDisableTailFollowOnScroll({
        tailFollowEnabled: true,
        previousScrollTop: 420,
        nextScrollTop: 500,
        nextClientHeight: 400,
        nextScrollHeight: 1_000,
        nowMs: 1_000,
        programmaticScrollUntilMs: 900,
      }),
    ).toBe(false);
    expect(
      shouldDisableTailFollowOnScroll({
        tailFollowEnabled: true,
        previousScrollTop: 500,
        nextScrollTop: 420,
        nextClientHeight: 400,
        nextScrollHeight: 1_000,
        nowMs: 1_000,
        programmaticScrollUntilMs: 1_100,
      }),
    ).toBe(false);
  });

  it("disables tail follow when the first observed scroll is already away from bottom", () => {
    expect(
      shouldDisableTailFollowOnScroll({
        tailFollowEnabled: true,
        previousScrollTop: null,
        nextScrollTop: 0,
        nextClientHeight: 400,
        nextScrollHeight: 1_000,
        nowMs: 1_000,
        programmaticScrollUntilMs: 900,
      }),
    ).toBe(true);
  });

  it("keeps tail follow when observed scroll positions are non-finite", () => {
    expect(
      shouldDisableTailFollowOnScroll({
        tailFollowEnabled: true,
        previousScrollTop: 500,
        nextScrollTop: Number.NaN,
        nextClientHeight: 400,
        nextScrollHeight: 1_000,
        nowMs: 1_000,
        programmaticScrollUntilMs: 900,
      }),
    ).toBe(false);
    expect(
      shouldDisableTailFollowOnScroll({
        tailFollowEnabled: true,
        previousScrollTop: Number.NaN,
        nextScrollTop: 420,
        nextClientHeight: 400,
        nextScrollHeight: 1_000,
        nowMs: 1_000,
        programmaticScrollUntilMs: 900,
      }),
    ).toBe(false);
    expect(
      shouldDisableTailFollowOnScroll({
        tailFollowEnabled: true,
        previousScrollTop: Number.POSITIVE_INFINITY,
        nextScrollTop: 420,
        nextClientHeight: 400,
        nextScrollHeight: 1_000,
        nowMs: 1_000,
        programmaticScrollUntilMs: 900,
      }),
    ).toBe(false);
  });
});

describe("shouldDisableTailFollowOnWheel", () => {
  it("disables tail follow immediately for upward wheel intent", () => {
    expect(shouldDisableTailFollowOnWheel({ tailFollowEnabled: true, deltaY: -240 })).toBe(true);
  });

  it("keeps tail follow for downward or inactive wheel input", () => {
    expect(shouldDisableTailFollowOnWheel({ tailFollowEnabled: true, deltaY: 240 })).toBe(false);
    expect(shouldDisableTailFollowOnWheel({ tailFollowEnabled: false, deltaY: -240 })).toBe(false);
    expect(shouldDisableTailFollowOnWheel({ tailFollowEnabled: true, deltaY: Number.NaN })).toBe(
      false,
    );
  });
});

describe("isScrollContainerNearBottom", () => {
  it("returns true when already at bottom", () => {
    expect(
      isScrollContainerNearBottom({
        scrollTop: 600,
        clientHeight: 400,
        scrollHeight: 1_000,
      }),
    ).toBe(true);
  });

  it("returns true when within the auto-scroll threshold", () => {
    expect(
      isScrollContainerNearBottom({
        scrollTop: 540,
        clientHeight: 400,
        scrollHeight: 1_000,
      }),
    ).toBe(true);
  });

  it("returns false when the user is meaningfully above the bottom", () => {
    expect(
      isScrollContainerNearBottom({
        scrollTop: 520,
        clientHeight: 400,
        scrollHeight: 1_000,
      }),
    ).toBe(false);
  });

  it("clamps negative thresholds to zero", () => {
    expect(
      isScrollContainerNearBottom(
        {
          scrollTop: 539,
          clientHeight: 400,
          scrollHeight: 1_000,
        },
        -1,
      ),
    ).toBe(false);
  });

  it("falls back to the default threshold for non-finite values", () => {
    expect(
      isScrollContainerNearBottom(
        {
          scrollTop: 540,
          clientHeight: 400,
          scrollHeight: 1_000,
        },
        Number.NaN,
      ),
    ).toBe(true);
    expect(AUTO_SCROLL_BOTTOM_THRESHOLD_PX).toBe(64);
  });
});
