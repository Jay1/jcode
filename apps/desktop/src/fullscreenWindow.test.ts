import { describe, expect, it, vi } from "vitest";

import {
  DESKTOP_FULLSCREEN_CHANGE_CHANNEL,
  readSenderWindowFullscreen,
  registerFullscreenWindowEvents,
  type FullscreenEventName,
  type FullscreenEventWindow,
} from "./fullscreenWindow";

class FakeFullscreenWindow implements FullscreenEventWindow {
  readonly sent = vi.fn();
  readonly webContents = { send: this.sent };
  private readonly listeners = new Map<FullscreenEventName, Set<() => void>>();

  on(event: FullscreenEventName, listener: () => void): this {
    const listeners = this.listeners.get(event) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  removeListener(event: FullscreenEventName, listener: () => void): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  emit(event: FullscreenEventName): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener();
    }
  }

  listenerCount(event: FullscreenEventName): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

describe("desktop fullscreen main-process bridge", () => {
  it("reads fullscreen from the BrowserWindow selected for the exact IPC sender", () => {
    const sender = { id: 7 };
    const senderWindow = { isFullScreen: vi.fn(() => true) };
    const fromWebContents = vi.fn((candidate: typeof sender) =>
      candidate === sender ? senderWindow : null,
    );

    expect(readSenderWindowFullscreen(sender, fromWebContents)).toBe(true);
    expect(fromWebContents).toHaveBeenCalledExactlyOnceWith(sender);
    expect(senderWindow.isFullScreen).toHaveBeenCalledOnce();
  });

  it("falls back to false when the IPC sender no longer belongs to a window", () => {
    const sender = { id: 8 };

    expect(readSenderWindowFullscreen(sender, () => null)).toBe(false);
  });

  it("broadcasts every native enter and leave event, including repeated events", () => {
    const window = new FakeFullscreenWindow();
    const cleanup = registerFullscreenWindowEvents(window);

    window.emit("enter-full-screen");
    window.emit("enter-full-screen");
    window.emit("leave-full-screen");

    expect(window.sent.mock.calls).toEqual([
      [DESKTOP_FULLSCREEN_CHANGE_CHANNEL, true],
      [DESKTOP_FULLSCREEN_CHANGE_CHANNEL, true],
      [DESKTOP_FULLSCREEN_CHANGE_CHANNEL, false],
    ]);
    cleanup();
  });

  it("removes both event listeners during window teardown", () => {
    const window = new FakeFullscreenWindow();
    const cleanup = registerFullscreenWindowEvents(window);

    expect(window.listenerCount("enter-full-screen")).toBe(1);
    expect(window.listenerCount("leave-full-screen")).toBe(1);

    cleanup();
    window.emit("enter-full-screen");
    window.emit("leave-full-screen");

    expect(window.listenerCount("enter-full-screen")).toBe(0);
    expect(window.listenerCount("leave-full-screen")).toBe(0);
    expect(window.sent).not.toHaveBeenCalled();
  });
});
