import { describe, expect, it } from "vitest";

import {
  buildCanvasSnapCandidates,
  CANVAS_SNAP_THRESHOLD_CLIENT_PX,
  resolveCanvasAxisSnap,
} from "../src/features/editor/canvas-snap-helpers";

describe("canvas snapping", () => {
  const parent = { left: 0, top: 0, width: 400, height: 200 };
  const sibling = { left: 100, top: 40, width: 80, height: 60 };
  const candidates = buildCanvasSnapCandidates(parent, [sibling]);

  it("builds parent and direct sibling edges and centers", () => {
    expect(candidates).toContainEqual({ axis: "x", value: 0 });
    expect(candidates).toContainEqual({ axis: "x", value: 200 });
    expect(candidates).toContainEqual({ axis: "x", value: 400 });
    expect(candidates).toContainEqual({ axis: "y", value: 0 });
    expect(candidates).toContainEqual({ axis: "y", value: 100 });
    expect(candidates).toContainEqual({ axis: "y", value: 200 });
    expect(candidates).toContainEqual({ axis: "x", value: 140 });
  });

  it("snaps to the nearest eligible candidate with deterministic ordering", () => {
    expect(resolveCanvasAxisSnap("x", [196], candidates, false)).toEqual({
      correction: 4,
      guide: { axis: "x", value: 200 },
    });
    expect(resolveCanvasAxisSnap("x", [200 + CANVAS_SNAP_THRESHOLD_CLIENT_PX + 1], candidates, false)).toEqual({ correction: 0, guide: null });
  });

  it("resolves axes independently and supports Alt bypass", () => {
    expect(resolveCanvasAxisSnap("x", [98], candidates, false).guide).toEqual({ axis: "x", value: 100 });
    expect(resolveCanvasAxisSnap("y", [38], candidates, false).guide).toEqual({ axis: "y", value: 40 });
    expect(resolveCanvasAxisSnap("x", [98], candidates, true)).toEqual({ correction: 0, guide: null });
  });
});
