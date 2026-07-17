import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  popupContextMenu,
  type ContextMenuPopup,
  type ContextMenuPopupOptions,
  type ContextMenuWindowResolver,
} from "./contextMenuPopup";

type TestWindow = {
  readonly name: string;
  readonly webContents: {
    readonly getZoomFactor: ReturnType<typeof vi.fn<() => number>>;
  };
};

function makeWindow(name: string, zoomFactor: number): TestWindow {
  return {
    name,
    webContents: {
      getZoomFactor: vi.fn(() => zoomFactor),
    },
  };
}

describe("popupContextMenu", () => {
  const callback = vi.fn();
  const popup = vi.fn<(options: ContextMenuPopupOptions<TestWindow>) => void>();
  const menu: ContextMenuPopup<TestWindow> = { popup };

  beforeEach(() => {
    callback.mockReset();
    popup.mockReset();
  });

  it("uses sender-owner zoom and binds the popup to the sender owner", () => {
    // Given a sender owner whose zoom conflicts with the focused and main windows
    const senderOwner = makeWindow("sender", 2);
    const focusedWindow = makeWindow("focused", 1.25);
    const mainWindow = makeWindow("main", 0.8);
    const windows: ContextMenuWindowResolver<TestWindow> = {
      getSenderWindow: vi.fn(() => senderOwner),
      getFocusedWindow: vi.fn(() => focusedWindow),
      getMainWindow: vi.fn(() => mainWindow),
    };

    // When the popup is opened for fractional renderer coordinates
    const didPopup = popupContextMenu({ menu, position: { x: 10.8, y: 20.2 }, callback }, windows);

    // Then only the sender owner supplies the zoom and exact popup options
    expect(didPopup).toBe(true);
    expect(windows.getSenderWindow).toHaveBeenCalledOnce();
    expect(windows.getFocusedWindow).not.toHaveBeenCalled();
    expect(windows.getMainWindow).not.toHaveBeenCalled();
    expect(senderOwner.webContents.getZoomFactor).toHaveBeenCalledOnce();
    expect(focusedWindow.webContents.getZoomFactor).not.toHaveBeenCalled();
    expect(mainWindow.webContents.getZoomFactor).not.toHaveBeenCalled();
    expect(popup).toHaveBeenCalledWith({
      window: senderOwner,
      x: 21,
      y: 40,
      callback,
    });
  });

  it("falls back to the focused window before the main window", () => {
    // Given no sender owner and both focused and main windows
    const focusedWindow = makeWindow("focused", 1.5);
    const mainWindow = makeWindow("main", 2);
    const windows: ContextMenuWindowResolver<TestWindow> = {
      getSenderWindow: vi.fn(() => null),
      getFocusedWindow: vi.fn(() => focusedWindow),
      getMainWindow: vi.fn(() => mainWindow),
    };

    // When the popup is opened
    const didPopup = popupContextMenu({ menu, position: { x: 8, y: 10 }, callback }, windows);

    // Then the focused window owns the popup and main fallback is not consulted
    expect(didPopup).toBe(true);
    expect(windows.getFocusedWindow).toHaveBeenCalledOnce();
    expect(windows.getMainWindow).not.toHaveBeenCalled();
    expect(popup).toHaveBeenCalledWith({
      window: focusedWindow,
      x: 12,
      y: 15,
      callback,
    });
  });

  it("falls back to the main window when sender and focused owners are unavailable", () => {
    // Given only the main window is available
    const mainWindow = makeWindow("main", 1.25);
    const windows: ContextMenuWindowResolver<TestWindow> = {
      getSenderWindow: vi.fn(() => null),
      getFocusedWindow: vi.fn(() => null),
      getMainWindow: vi.fn(() => mainWindow),
    };

    // When the popup is opened
    const didPopup = popupContextMenu({ menu, position: { x: 8, y: 12 }, callback }, windows);

    // Then the main window owns the popup
    expect(didPopup).toBe(true);
    expect(windows.getMainWindow).toHaveBeenCalledOnce();
    expect(popup).toHaveBeenCalledWith({
      window: mainWindow,
      x: 10,
      y: 15,
      callback,
    });
  });

  it.each([
    { label: "missing position", position: undefined, zoomFactor: 1.5 },
    { label: "invalid coordinates", position: { x: -1, y: 10 }, zoomFactor: 1.5 },
    { label: "invalid zoom", position: { x: 10, y: 20 }, zoomFactor: Number.NaN },
  ])("omits x and y for $label without throwing", ({ position, zoomFactor }) => {
    // Given an owner and popup input that cannot be explicitly positioned
    const senderOwner = makeWindow("sender", zoomFactor);
    const windows: ContextMenuWindowResolver<TestWindow> = {
      getSenderWindow: vi.fn(() => senderOwner),
      getFocusedWindow: vi.fn(() => null),
      getMainWindow: vi.fn(() => null),
    };

    // When the native popup is opened
    const openPopup = () => popupContextMenu({ menu, position, callback }, windows);

    // Then it uses native cursor placement without throwing
    expect(openPopup).not.toThrow();
    expect(senderOwner.webContents.getZoomFactor).toHaveBeenCalledOnce();
    expect(popup).toHaveBeenCalledWith({ window: senderOwner, callback });
  });

  it("does not popup when no owner window is available", () => {
    // Given no sender, focused, or main owner
    const windows: ContextMenuWindowResolver<TestWindow> = {
      getSenderWindow: vi.fn(() => null),
      getFocusedWindow: vi.fn(() => null),
      getMainWindow: vi.fn(() => null),
    };

    // When the popup is requested
    const didPopup = popupContextMenu({ menu, position: { x: 10, y: 20 }, callback }, windows);

    // Then native popup is skipped cleanly
    expect(didPopup).toBe(false);
    expect(popup).not.toHaveBeenCalled();
  });
});
