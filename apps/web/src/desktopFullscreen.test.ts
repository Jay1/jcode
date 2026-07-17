import { describe, expect, it, vi } from "vitest";

import { createDesktopFullscreenStore, type DesktopFullscreenBridge } from "./desktopFullscreen";

type FullscreenListener = (isFullscreen: boolean) => void;

function createControllableBridge(initialState = false) {
  let state = initialState;
  let listener: FullscreenListener | null = null;
  let lastListener: FullscreenListener | null = null;
  let duringSubscribe: (() => void) | null = null;
  const getIsFullscreen = vi.fn(() => state);
  const unsubscribe = vi.fn(() => {
    listener = null;
  });
  const onFullscreenChange = vi.fn((nextListener: FullscreenListener) => {
    listener = nextListener;
    lastListener = nextListener;
    duringSubscribe?.();
    return unsubscribe;
  });
  const bridge: DesktopFullscreenBridge = { getIsFullscreen, onFullscreenChange };

  return {
    bridge,
    getIsFullscreen,
    onFullscreenChange,
    unsubscribe,
    setState(nextState: boolean) {
      state = nextState;
    },
    emit(nextState: boolean) {
      state = nextState;
      listener?.(nextState);
    },
    emitStale(nextState: boolean) {
      state = nextState;
      lastListener?.(nextState);
    },
    setDuringSubscribe(effect: (() => void) | null) {
      duringSubscribe = effect;
    },
  };
}

describe("desktop fullscreen external store", () => {
  it("initializes synchronously and defaults to false without the optional bridge", () => {
    const present = createControllableBridge(true);

    expect(createDesktopFullscreenStore(() => present.bridge).getSnapshot()).toBe(true);
    expect(createDesktopFullscreenStore(() => undefined).getSnapshot()).toBe(false);
  });

  it("rereads immediately after subscribing to close the event-before-subscribe race", () => {
    const controlled = createControllableBridge(false);
    const store = createDesktopFullscreenStore(() => controlled.bridge);
    const listener = vi.fn();

    controlled.setState(true);
    const unsubscribe = store.subscribe(listener);

    expect(store.getSnapshot()).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("handles an event delivered during native subscription without duplicating notification", () => {
    const controlled = createControllableBridge(false);
    const store = createDesktopFullscreenStore(() => controlled.bridge);
    const listener = vi.fn();
    controlled.setDuringSubscribe(() => controlled.emit(true));

    const unsubscribe = store.subscribe(listener);

    expect(store.getSnapshot()).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    expect(controlled.getIsFullscreen).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("deduplicates repeated state while sharing one native subscription", () => {
    const controlled = createControllableBridge(false);
    const store = createDesktopFullscreenStore(() => controlled.bridge);
    const first = vi.fn();
    const second = vi.fn();

    const unsubscribeFirst = store.subscribe(first);
    const unsubscribeSecond = store.subscribe(second);
    controlled.emit(true);
    controlled.emit(true);

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(controlled.onFullscreenChange).toHaveBeenCalledOnce();

    unsubscribeFirst();
    expect(controlled.unsubscribe).not.toHaveBeenCalled();
    unsubscribeSecond();
    expect(controlled.unsubscribe).toHaveBeenCalledOnce();
  });

  it("stops updates after the last unsubscribe and reattaches cleanly on remount", () => {
    const controlled = createControllableBridge(false);
    const store = createDesktopFullscreenStore(() => controlled.bridge);
    const first = vi.fn();
    const unsubscribeFirst = store.subscribe(first);

    unsubscribeFirst();
    controlled.emitStale(true);
    expect(store.getSnapshot()).toBe(false);
    expect(first).not.toHaveBeenCalled();

    const second = vi.fn();
    const unsubscribeSecond = store.subscribe(second);
    expect(store.getSnapshot()).toBe(true);
    expect(second).toHaveBeenCalledOnce();
    expect(controlled.onFullscreenChange).toHaveBeenCalledTimes(2);
    unsubscribeSecond();
  });
});
