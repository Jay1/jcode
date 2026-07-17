export type MenuPopupPosition = {
  readonly x: number;
  readonly y: number;
};

export function resolveMenuPopupPosition(
  position: MenuPopupPosition,
  zoomFactor: number,
): MenuPopupPosition | undefined {
  if (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    position.x < 0 ||
    position.y < 0 ||
    !Number.isFinite(zoomFactor) ||
    zoomFactor <= 0
  ) {
    return undefined;
  }

  return {
    x: Math.floor(position.x * zoomFactor),
    y: Math.floor(position.y * zoomFactor),
  };
}
