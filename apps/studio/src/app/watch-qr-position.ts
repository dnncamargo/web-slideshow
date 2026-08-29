export interface WatchQrBounds {
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  inset: number;
}

export interface WatchQrPosition {
  x: number;
  y: number;
}

export function clampWatchQrPosition(
  position: WatchQrPosition,
  { width, height, viewportWidth, viewportHeight, inset }: WatchQrBounds,
): WatchQrPosition {
  const maxX = Math.max(inset, viewportWidth - width - inset);
  const maxY = Math.max(inset, viewportHeight - height - inset);

  return {
    x: Math.min(Math.max(position.x, inset), maxX),
    y: Math.min(Math.max(position.y, inset), maxY),
  };
}
