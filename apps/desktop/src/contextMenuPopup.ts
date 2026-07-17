import { resolveMenuPopupPosition, type MenuPopupPosition } from "./menuCoordinates";

type ZoomedMenuWindow = {
  readonly webContents: {
    readonly getZoomFactor: () => number;
  };
};

export type ContextMenuPopupOptions<TWindow extends ZoomedMenuWindow> = {
  readonly window: TWindow;
  readonly x?: number;
  readonly y?: number;
  readonly callback: () => void;
};

export type ContextMenuPopup<TWindow extends ZoomedMenuWindow> = {
  readonly popup: (options: ContextMenuPopupOptions<TWindow>) => void;
};

export type ContextMenuWindowResolver<TWindow extends ZoomedMenuWindow> = {
  readonly getSenderWindow: () => TWindow | null;
  readonly getFocusedWindow: () => TWindow | null;
  readonly getMainWindow: () => TWindow | null;
};

type ContextMenuPopupRequest<TWindow extends ZoomedMenuWindow> = {
  readonly menu: ContextMenuPopup<TWindow>;
  readonly position: MenuPopupPosition | undefined;
  readonly callback: () => void;
};

export function popupContextMenu<TWindow extends ZoomedMenuWindow>(
  request: ContextMenuPopupRequest<TWindow>,
  windows: ContextMenuWindowResolver<TWindow>,
): boolean {
  const owner = windows.getSenderWindow() ?? windows.getFocusedWindow() ?? windows.getMainWindow();
  if (!owner) {
    return false;
  }

  const zoomFactor = owner.webContents.getZoomFactor();
  const popupPosition = request.position
    ? resolveMenuPopupPosition(request.position, zoomFactor)
    : undefined;
  request.menu.popup({
    window: owner,
    ...popupPosition,
    callback: request.callback,
  });
  return true;
}
