import { describe, expect, it } from "vitest";
import type { MathGeometryResult, MathViewport2D } from "@powershow/math-source";
import { renderMathGeometrySvg } from "../src/render-plot-svg";

const squareViewport: MathViewport2D = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };

function geometry(segments: MathGeometryResult["segments"]): MathGeometryResult {
  return { segments, diagnostics: [] };
}

describe("renderMathGeometrySvg", () => {
  it("projects mathematical coordinates with an upward-positive y axis", () => {
    const svg = renderMathGeometrySvg(geometry([
      [{ x: -10, y: -10 }, { x: 0, y: 0 }, { x: 10, y: 10 }],
    ]), squareViewport);

    expect(svg).toContain('d="M 0 20 L 10 10 L 20 0"');
  });

  it("uses the viewport dimensions as the exact viewBox", () => {
    const svg = renderMathGeometrySvg(geometry([
      [{ x: -2, y: -3 }, { x: 6, y: 7 }],
    ]), { xMin: -2, xMax: 6, yMin: -3, yMax: 7 });

    expect(svg).toContain('viewBox="0 0 8 10"');
  });

  it("preserves mathematical aspect ratio", () => {
    expect(renderMathGeometrySvg(geometry([
      [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    ]), { xMin: 0, xMax: 1, yMin: 0, yMax: 1 })).toContain(
      'preserveAspectRatio="xMidYMid meet"',
    );
  });

  it("serializes all segments into one path with independent subpaths", () => {
    const svg = renderMathGeometrySvg(geometry([
      [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }],
      [{ x: 3, y: 3 }, { x: 4, y: 4 }],
    ]), { xMin: 0, xMax: 4, yMin: 0, yMax: 4 });

    expect(svg.match(/<path/g)).toHaveLength(1);
    expect(svg.match(/M /g)).toHaveLength(2);
    expect(svg).toContain('d="M 0 4 L 1 3 L 2 4 M 3 1 L 4 0"');
    expect(svg).not.toContain("Z");
  });

  it("keeps two-point pieces as separate subpaths", () => {
    const svg = renderMathGeometrySvg(geometry([
      [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      [{ x: 2, y: 2 }, { x: 3, y: 3 }],
    ]), { xMin: 0, xMax: 3, yMin: 0, yMax: 3 });

    expect(svg).toContain('d="M 0 3 L 1 2 M 2 1 L 3 0"');
  });

  it("uses the renderer-owned minimal appearance", () => {
    const svg = renderMathGeometrySvg(geometry([
      [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    ]), { xMin: 0, xMax: 1, yMin: 0, yMax: 1 });

    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('stroke-width="2"');
    expect(svg).toContain('vector-effect="non-scaling-stroke"');
  });

  it("renders subordinate Cartesian axes before the curve", () => {
    const svg = renderMathGeometrySvg(geometry([
      [{ x: -1, y: -1 }, { x: 1, y: 1 }],
    ]), squareViewport, { x: "x", y: "f(x)" });

    expect(svg.match(/<line /g)).toHaveLength(2);
    expect(svg).toContain('class="powershow-plot-axis powershow-plot-axis-x"');
    expect(svg).toContain('class="powershow-plot-axis powershow-plot-axis-y"');
    expect(svg).toContain('stroke-width="1"');
    expect(svg.indexOf("<line")).toBeLessThan(svg.indexOf("<path"));
    expect(svg).toContain('class="powershow-plot-axis-label powershow-plot-axis-label-x"');
    expect(svg).toContain('class="powershow-plot-axis-label powershow-plot-axis-label-y"');
    expect(svg).toContain(">x</text>");
    expect(svg).toContain(">f(x)</text>");
    expect(svg.match(/<path /g)).toHaveLength(1);
  });

  it("uses x/y labels for non-explicit-y plots", () => {
    const svg = renderMathGeometrySvg(geometry([
      [{ x: -1, y: -1 }, { x: 1, y: 1 }],
    ]), squareViewport, { x: "x", y: "y" });

    expect(svg).toContain(">x</text>");
    expect(svg).toContain(">y</text>");
    expect(svg).not.toContain("f(x)");
  });

  it("omits axes outside the viewport", () => {
    const svg = renderMathGeometrySvg(geometry([
      [{ x: 1, y: 1 }, { x: 2, y: 2 }],
    ]), { xMin: 1, xMax: 2, yMin: 1, yMax: 2 }, { x: "x", y: "y" });

    expect(svg).not.toContain("powershow-plot-axis");
    expect(svg).not.toContain("<text");
  });

  it("returns empty SVG for empty geometry", () => {
    expect(renderMathGeometrySvg(geometry([]), squareViewport)).toBe("");
  });

  it.each([
    { xMin: Number.NaN, xMax: 1, yMin: 0, yMax: 1 },
    { xMin: 0, xMax: 0, yMin: 0, yMax: 1 },
    { xMin: 1, xMax: 0, yMin: 0, yMax: 1 },
  ])("returns empty SVG for invalid viewport %#", (viewport) => {
    expect(renderMathGeometrySvg(geometry([
      [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    ]), viewport)).toBe("");
  });

  it("skips non-finite segments without serializing unsafe coordinates", () => {
    const svg = renderMathGeometrySvg(geometry([
      [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      [{ x: 2, y: Number.POSITIVE_INFINITY }, { x: 3, y: 3 }],
      [{ x: Number.NaN, y: 0 }, { x: 4, y: 4 }],
    ]), { xMin: 0, xMax: 4, yMin: 0, yMax: 4 });

    expect(svg).toContain('d="M 0 4 L 1 3"');
    expect(svg).not.toMatch(/NaN|Infinity/);
  });

  it("returns empty SVG when all segments are invalid or too short", () => {
    expect(renderMathGeometrySvg(geometry([
      [{ x: 0, y: 0 }],
      [{ x: Number.NaN, y: 0 }, { x: 1, y: 1 }],
    ]), squareViewport)).toBe("");
  });
});
