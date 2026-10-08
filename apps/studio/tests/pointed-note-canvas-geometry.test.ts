import { describe, expect, it } from "vitest";

import {
  clampPointedNotePosition,
  POINTED_NOTE_MARKER_SIZE,
  toLogicalPointedNoteDelta,
} from "../src/features/editor/pointed-note-canvas-geometry";

describe("pointed-note canvas geometry", () => {
  it.each([
    ["16:9", 960, 540, { x: 16, y: 16 }, { x: 944, y: 524 }],
    ["4:3", 960, 720, { x: 16, y: 16 }, { x: 944, y: 704 }],
  ])("clamps %s marker centers to the logical slide", (_name, width, height, minimum, maximum) => {
    expect(POINTED_NOTE_MARKER_SIZE).toBe(32);
    expect(clampPointedNotePosition({ x: -100, y: -100 }, { logicalWidth: width, logicalHeight: height })).toEqual(minimum);
    expect(clampPointedNotePosition({ x: width + 100, y: height + 100 }, { logicalWidth: width, logicalHeight: height })).toEqual(maximum);
  });

  it.each([
    [1, 40],
    [0.5, 80],
    [1.5, 40 / 1.5],
  ])("converts client movement through scale %s", (scale, expected) => {
    expect(toLogicalPointedNoteDelta(40, scale)).toBeCloseTo(expected);
  });
});
