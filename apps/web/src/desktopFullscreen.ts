import { useSyncExternalStore } from "react";

export interface DesktopFullscreenBridge {
  getIsFullscreen?: () => boolean;
  onFullscreenChange?: (listener: (isFullscreen: boolean) => void) => () => void;
}

export interface DesktopFullscreenStore {
  readonly getSnapshot: () => boolean;
  readonly subscribe: (listener: () => void) => () => void;
}

function readFullscreen(bridge: DesktopFullscreenBridge | undefined): boolean {
  return bridge?.getIsFullscreen?.() === true;
}

export function createDesktopFullscreenStore(
  getBridge: () => DesktopFullscreenBridge | undefined,
): DesktopFullscreenStore {
  let isFullscreen = readFullscreen(getBridge());
  let unsubscribeFromBridge: (() => void) | null = null;
  let subscriptionGeneration = 0;
  const listeners = new Set<() => void>();

  const update = (nextIsFullscreen: boolean): void => {
    if (isFullscreen === nextIsFullscreen) return;
    isFullscreen = nextIsFullscreen;
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getSnapshot: () => isFullscreen,
    subscribe: (listener) => {
      listeners.add(listener);

      if (listeners.size === 1) {
        const bridge = getBridge();
        const currentGeneration = ++subscriptionGeneration;
        unsubscribeFromBridge =
          bridge?.onFullscreenChange?.((nextIsFullscreen) => {
            if (subscriptionGeneration !== currentGeneration) return;
            update(nextIsFullscreen);
          }) ?? null;
        update(readFullscreen(bridge));
      }

      let isSubscribed = true;
      return () => {
        if (!isSubscribed) return;
        isSubscribed = false;
        listeners.delete(listener);
        if (listeners.size !== 0) return;

        subscriptionGeneration += 1;
        unsubscribeFromBridge?.();
        unsubscribeFromBridge = null;
      };
    },
  };
}

const desktopFullscreenStore = createDesktopFullscreenStore(() =>
  typeof window === "undefined" ? undefined : window.desktopBridge,
);

export function useDesktopFullscreen(): boolean {
  return useSyncExternalStore(
    desktopFullscreenStore.subscribe,
    desktopFullscreenStore.getSnapshot,
    () => false,
  );
}
