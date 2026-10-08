export const POINTED_NOTE_MARKER_SIZE = 32;

export interface PointedNotePosition {
  x: number;
  y: number;
}

export interface PointedNoteCanvasBounds {
  logicalWidth: number;
  logicalHeight: number;
  markerSize?: number;
}

export function clampPointedNotePosition(
  position: PointedNotePosition,
  bounds: PointedNoteCanvasBounds,
): PointedNotePosition {
  const markerHalfSize = (bounds.markerSize ?? POINTED_NOTE_MARKER_SIZE) / 2;

  return {
    x: Math.min(
      Math.max(markerHalfSize, position.x),
      Math.max(markerHalfSize, bounds.logicalWidth - markerHalfSize),
    ),
    y: Math.min(
      Math.max(markerHalfSize, position.y),
      Math.max(markerHalfSize, bounds.logicalHeight - markerHalfSize),
    ),
  };
}

export function toLogicalPointedNoteDelta(
  clientDelta: number,
  scale: number,
): number {
  return clientDelta / (scale || 1);
}
