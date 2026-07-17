export const DESKTOP_IS_FULLSCREEN_CHANNEL = "desktop:is-fullscreen";
export const DESKTOP_FULLSCREEN_CHANGE_CHANNEL = "desktop:fullscreen-change";

export type FullscreenEventName = "enter-full-screen" | "leave-full-screen";

export interface FullscreenReadableWindow {
  isFullScreen(): boolean;
}

export interface FullscreenEventWindow {
  readonly webContents: {
    send(channel: string, isFullscreen: boolean): void;
  };
  on(event: FullscreenEventName, listener: () => void): this;
  removeListener(event: FullscreenEventName, listener: () => void): this;
}

export function readSenderWindowFullscreen<TSender>(
  sender: TSender,
  fromWebContents: (sender: TSender) => FullscreenReadableWindow | null,
): boolean {
  return fromWebContents(sender)?.isFullScreen() ?? false;
}

export function registerFullscreenWindowEvents(window: FullscreenEventWindow): () => void {
  const enterFullscreen = (): void => {
    window.webContents.send(DESKTOP_FULLSCREEN_CHANGE_CHANNEL, true);
  };
  const leaveFullscreen = (): void => {
    window.webContents.send(DESKTOP_FULLSCREEN_CHANGE_CHANNEL, false);
  };

  window.on("enter-full-screen", enterFullscreen);
  window.on("leave-full-screen", leaveFullscreen);

  return () => {
    window.removeListener("enter-full-screen", enterFullscreen);
    window.removeListener("leave-full-screen", leaveFullscreen);
  };
}
