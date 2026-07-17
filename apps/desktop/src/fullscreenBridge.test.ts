import { describe, expect, it, vi } from "vitest";

import {
  DESKTOP_FULLSCREEN_CHANGE_CHANNEL,
  DESKTOP_IS_FULLSCREEN_CHANNEL,
} from "./fullscreenWindow";
import {
  createFullscreenBridge,
  type FullscreenIpcRenderer,
  type FullscreenRendererListener,
} from "./fullscreenBridge";

class FakeIpcRenderer implements FullscreenIpcRenderer {
  readonly sendSync = vi.fn((_channel: string): unknown => false);
  readonly onCalls = vi.fn();
  readonly removeCalls = vi.fn();
  private listener: FullscreenRendererListener | null = null;

  on(channel: string, listener: FullscreenRendererListener): this {
    this.onCalls(channel, listener);
    this.listener = listener;
    return this;
  }

  removeListener(channel: string, listener: FullscreenRendererListener): this {
    this.removeCalls(channel, listener);
    if (this.listener === listener) {
      this.listener = null;
    }
    return this;
  }

  emit(payload: unknown): void {
    this.listener?.({}, payload);
  }
}

describe("desktop fullscreen preload bridge", () => {
  it("performs a synchronous read and accepts only literal true", () => {
    const renderer = new FakeIpcRenderer();
    const bridge = createFullscreenBridge(renderer);

    renderer.sendSync.mockReturnValueOnce(true).mockReturnValueOnce(1).mockReturnValueOnce("true");

    expect(bridge.getIsFullscreen()).toBe(true);
    expect(bridge.getIsFullscreen()).toBe(false);
    expect(bridge.getIsFullscreen()).toBe(false);
    expect(renderer.sendSync).toHaveBeenCalledTimes(3);
    expect(renderer.sendSync).toHaveBeenNthCalledWith(1, DESKTOP_IS_FULLSCREEN_CHANNEL);
  });

  it("forwards boolean events and rejects malformed payloads", () => {
    const renderer = new FakeIpcRenderer();
    const bridge = createFullscreenBridge(renderer);
    const listener = vi.fn();

    const unsubscribe = bridge.onFullscreenChange(listener);
    renderer.emit(true);
    renderer.emit(false);
    renderer.emit(1);
    renderer.emit("false");
    renderer.emit(null);

    expect(listener.mock.calls).toEqual([[true], [false]]);
    expect(renderer.onCalls).toHaveBeenCalledExactlyOnceWith(
      DESKTOP_FULLSCREEN_CHANGE_CHANNEL,
      expect.any(Function),
    );

    unsubscribe();
    renderer.emit(true);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(renderer.removeCalls).toHaveBeenCalledExactlyOnceWith(
      DESKTOP_FULLSCREEN_CHANGE_CHANNEL,
      expect.any(Function),
    );
  });
});
