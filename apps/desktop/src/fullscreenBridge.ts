import type { DesktopBridge } from "@jcode/contracts";

import {
  DESKTOP_FULLSCREEN_CHANGE_CHANNEL,
  DESKTOP_IS_FULLSCREEN_CHANNEL,
} from "./fullscreenWindow";

export type FullscreenRendererListener = (event: unknown, isFullscreen: unknown) => void;

export interface FullscreenIpcRenderer {
  sendSync(channel: string): unknown;
  on(channel: string, listener: FullscreenRendererListener): this;
  removeListener(channel: string, listener: FullscreenRendererListener): this;
}

type FullscreenBridge = Required<Pick<DesktopBridge, "getIsFullscreen" | "onFullscreenChange">>;

export function createFullscreenBridge(ipcRenderer: FullscreenIpcRenderer): FullscreenBridge {
  return {
    getIsFullscreen: () => ipcRenderer.sendSync(DESKTOP_IS_FULLSCREEN_CHANNEL) === true,
    onFullscreenChange: (listener) => {
      const wrappedListener: FullscreenRendererListener = (_event, isFullscreen) => {
        if (typeof isFullscreen !== "boolean") return;
        listener(isFullscreen);
      };

      ipcRenderer.on(DESKTOP_FULLSCREEN_CHANGE_CHANNEL, wrappedListener);
      return () => {
        ipcRenderer.removeListener(DESKTOP_FULLSCREEN_CHANGE_CHANNEL, wrappedListener);
      };
    },
  };
}
