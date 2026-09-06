import { describe, expect, it } from "vitest";
import type { MathSurfaceGeometryResult } from "@powershow/math-source";
import { renderMathSurfaceGeometrySvg } from "../src/render-plot-surface-svg";

function geometry(rows: MathSurfaceGeometryResult["rows"]): MathSurfaceGeometryResult {
  return { rows, diagnostics: [] };
}

function viewBox(svg: string): [number, number] {
  const match = svg.match(/viewBox="0 0 ([^ ]+) ([^"]+)"/);
  if (match?.[1] === undefined || match[2] === undefined) throw new Error("Missing viewBox");
  return [Number(match[1]), Number(match[2])];
}

describe("renderMathSurfaceGeometrySvg", () => {
  it("projects the frozen isometric view deterministically", () => {
    const svg = renderMathSurfaceGeometrySvg(geometry([
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      [
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 1 },
      ],
    ]));

    const path = svg.match(/ d="([^"]+)"/)?.[1];
    const segments = [...(path ?? "").matchAll(/M ([^ ]+) ([^ ]+) L ([^ ]+) ([^ ]+)/g)]
      .map((match) => match.slice(1).map(Number));

    expect(segments).toHaveLength(4);
    expect(segments[0]?.[2]! - segments[0]?.[0]!).toBeCloseTo(Math.sqrt(3) / 2);
    expect(segments[0]?.[3]! - segments[0]?.[1]!).toBeCloseTo(0.5);
    expect(segments[1]?.[2]! - segments[1]?.[0]!).toBeCloseTo(Math.sqrt(3) / 2);
    expect(segments[1]?.[3]! - segments[1]?.[1]!).toBeCloseTo(-1.5);
    expect(segments[2]?.[2]! - segments[2]?.[0]!).toBeCloseTo(-Math.sqrt(3) / 2);
    expect(segments[2]?.[3]! - segments[2]?.[1]!).toBeCloseTo(0.5);
    expect(segments[3]?.[2]! - segments[3]?.[0]!).toBeCloseTo(-Math.sqrt(3) / 2);
    expect(segments[3]?.[3]! - segments[3]?.[1]!).toBeCloseTo(-1.5);
  });

  it("connects finite points across rows and columns", () => {
    const svg = renderMathSurfaceGeometrySvg(geometry([
      [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
      [{ x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }],
    ]));

    const path = svg.match(/ d="([^"]+)"/)?.[1];
    expect(path?.match(/M /g)).toHaveLength(4);
    expect(path?.match(/L /g)).toHaveLength(4);
  });

  it("breaks row and column runs at null gaps", () => {
    const svg = renderMathSurfaceGeometrySvg(geometry([
      [
        { x: 0, y: 0, z: 0 },
        null,
        { x: 2, y: 0, z: 0 },
        { x: 3, y: 0, z: 0 },
      ],
      [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 1, z: 0 },
        null,
        { x: 3, y: 1, z: 0 },
      ],
    ]));

    const path = svg.match(/ d="([^"]+)"/)?.[1];
    expect(path?.match(/M /g)).toHaveLength(4);
    expect(path).not.toContain("NaN");
  });

  it("keeps output byte-for-byte deterministic", () => {
    const value = geometry([
      [{ x: -1, y: -1, z: 0 }, { x: 1, y: -1, z: 1 }],
      [{ x: -1, y: 1, z: 1 }, { x: 1, y: 1, z: 0 }],
    ]);
    expect(renderMathSurfaceGeometrySvg(value)).toBe(renderMathSurfaceGeometrySvg(value));
  });

  it("uses finite non-degenerate padded bounds for a flat surface", () => {
    const svg = renderMathSurfaceGeometrySvg(geometry([
      [{ x: 0, y: 0, z: 2 }, { x: 1, y: 0, z: 2 }],
      [{ x: 0, y: 1, z: 2 }, { x: 1, y: 1, z: 2 }],
    ]));
    const [width, height] = viewBox(svg);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(Number.isFinite(width)).toBe(true);
    expect(Number.isFinite(height)).toBe(true);
  });

  it("defensively skips malformed points and emits required wireframe markup", () => {
    const svg = renderMathSurfaceGeometrySvg(geometry([
      [{ x: 0, y: 0, z: 0 }, { x: Number.NaN, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }],
      [{ x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: Number.POSITIVE_INFINITY }],
    ]));

    expect(svg).toContain("powershow-plot-svg");
    expect(svg).toContain("powershow-plot-surface-svg");
    expect(svg).toContain("powershow-plot-surface-wireframe");
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('vector-effect="non-scaling-stroke"');
    expect(svg).not.toContain("NaN");
    expect(svg).not.toContain("Infinity");
    expect(svg).not.toContain("<polygon");
    expect(svg).not.toContain("<canvas");
    expect(svg).not.toContain("powershow-plot-axis");
  });

  it("returns empty output when no wireframe segment survives", () => {
    expect(renderMathSurfaceGeometrySvg(geometry([
      [null, { x: 0, y: 0, z: 0 }],
      [{ x: 1, y: 1, z: 1 }, null],
    ]))).toBe("");
    expect(renderMathSurfaceGeometrySvg({ rows: [], diagnostics: [{ code: "no-visible-geometry", message: "No visible geometry." }] })).toBe("");
  });
});
