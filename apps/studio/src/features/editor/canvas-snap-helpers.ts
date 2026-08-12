export const CANVAS_SNAP_THRESHOLD_CLIENT_PX = 6;

export type SnapAxis = "x" | "y";

export interface CanvasSnapCandidate {
  axis: SnapAxis;
  value: number;
}

export interface CanvasSnapGuide {
  axis: SnapAxis;
  value: number;
}

export interface CanvasSnapResult {
  correction: number;
  guide: CanvasSnapGuide | null;
}

export interface CanvasBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function buildCanvasSnapCandidates(
  parent: CanvasBounds,
  siblings: readonly CanvasBounds[],
): CanvasSnapCandidate[] {
  const candidates: CanvasSnapCandidate[] = [];
  const addBounds = (bounds: CanvasBounds) => {
    candidates.push(
      { axis: "x", value: bounds.left },
      { axis: "x", value: bounds.left + bounds.width / 2 },
      { axis: "x", value: bounds.left + bounds.width },
      { axis: "y", value: bounds.top },
      { axis: "y", value: bounds.top + bounds.height / 2 },
      { axis: "y", value: bounds.top + bounds.height },
    );
  };

  addBounds(parent);
  siblings.forEach(addBounds);

  return candidates;
}

export function resolveCanvasAxisSnap(
  axis: SnapAxis,
  points: readonly number[],
  candidates: readonly CanvasSnapCandidate[],
  bypass: boolean,
): CanvasSnapResult {
  if (bypass) {
    return { correction: 0, guide: null };
  }

  let best: { distance: number; correction: number; value: number } | null = null;

  for (const point of points) {
    for (const candidate of candidates) {
      if (candidate.axis !== axis) {
        continue;
      }

      const correction = candidate.value - point;
      const distance = Math.abs(correction);

      if (
        distance <= CANVAS_SNAP_THRESHOLD_CLIENT_PX &&
        (best === null || distance < best.distance)
      ) {
        best = { distance, correction, value: candidate.value };
      }
    }
  }

  return best
    ? { correction: best.correction, guide: { axis, value: best.value } }
    : { correction: 0, guide: null };
}
