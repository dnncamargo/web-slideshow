import { describe, expect, it } from "vitest";

import {
  parseSvgPathData,
  serializeSvgPathData,
} from "../src/features/editor/svg-path-authoring";

describe("bounded SVG path authoring", () => {
  it("normalizes absolute move, line, and close commands", () => {
    expect(parseSvgPathData("M 0 0 L 10 0 L 10 10 Z")).toEqual([
      { type: "move", x: 0, y: 0 },
      { type: "line", x: 10, y: 0 },
      { type: "line", x: 10, y: 10 },
      { type: "close" },
    ]);
  });

  it("normalizes relative commands, repeated groups, and implicit lines", () => {
    expect(parseSvgPathData("m1 2 3 4 5 6 l 1 1 2 2")).toEqual([
      { type: "move", x: 1, y: 2 },
      { type: "line", x: 4, y: 6 },
      { type: "line", x: 9, y: 12 },
      { type: "line", x: 10, y: 13 },
      { type: "line", x: 12, y: 15 },
    ]);
  });

  it("normalizes horizontal and vertical lines", () => {
    expect(parseSvgPathData("M 1 2 H 10 V 20 h -2 v -3")).toEqual([
      { type: "move", x: 1, y: 2 },
      { type: "line", x: 10, y: 2 },
      { type: "line", x: 10, y: 20 },
      { type: "line", x: 8, y: 20 },
      { type: "line", x: 8, y: 17 },
    ]);
  });

  it("normalizes cubic and smooth cubic controls", () => {
    expect(parseSvgPathData("M 0 0 C 10 0 20 10 30 10 S 50 20 60 20")).toEqual([
      { type: "move", x: 0, y: 0 },
      { type: "cubic", control1X: 10, control1Y: 0, control2X: 20, control2Y: 10, x: 30, y: 10 },
      { type: "cubic", control1X: 40, control1Y: 10, control2X: 50, control2Y: 20, x: 60, y: 20 },
    ]);
  });

  it("normalizes quadratic and smooth quadratic controls", () => {
    expect(parseSvgPathData("M 0 0 Q 10 20 30 0 T 60 0")).toEqual([
      { type: "move", x: 0, y: 0 },
      { type: "quadratic", controlX: 10, controlY: 20, x: 30, y: 0 },
      { type: "quadratic", controlX: 50, controlY: -20, x: 60, y: 0 },
    ]);
  });

  it("normalizes arcs and converts zero-radius arcs to lines", () => {
    expect(parseSvgPathData("M 0 0 A 5 6 30 1 0 10 20 a 0 4 0 0 1 5 5")).toEqual([
      { type: "move", x: 0, y: 0 },
      { type: "arc", radiusX: 5, radiusY: 6, rotationDeg: 30, largeArc: true, sweep: false, x: 10, y: 20 },
      { type: "line", x: 15, y: 25 },
    ]);
  });

  it("accepts commas, whitespace, signs, decimals, exponents, and subpaths", () => {
    expect(parseSvgPathData("M.5,-1e1 L+2.5 3.0e+1 M 4 5 Z")).toEqual([
      { type: "move", x: 0.5, y: -10 },
      { type: "line", x: 2.5, y: 30 },
      { type: "move", x: 4, y: 5 },
      { type: "close" },
    ]);
  });

  it("rejects malformed data, invalid flags, missing initial move, and markup", () => {
    expect(() => parseSvgPathData("L 0 0")).toThrow(/begin with Move/);
    expect(() => parseSvgPathData("M 0 0 C 1 2")).toThrow(/requires 6/);
    expect(() => parseSvgPathData("M 0 0 A 1 1 0 2 0 4 4")).toThrow(/exactly 0 or 1/);
    expect(() => parseSvgPathData("<svg><path d=\"M 0 0\" /></svg>")).toThrow(/only the d value/);
  });

  it("serializes normalized commands deterministically", () => {
    const commands = parseSvgPathData("m 0 0 l 10 0 q 2 3 4 5 a 1 2 0 0 1 8 9 z");
    expect(serializeSvgPathData(commands)).toBe("M 0 0 L 10 0 Q 12 3 14 5 A 1 2 0 0 1 22 14 Z");
    expect(parseSvgPathData(serializeSvgPathData(commands))).toEqual(commands);
  });
});
