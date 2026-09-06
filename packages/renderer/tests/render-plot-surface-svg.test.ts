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

function pathPoints(svg: string): Array<[number, number]> {
  const path = svg.match(/ d="([^"]+)"/)?.[1] ?? "";
  return [...path.matchAll(/[ML] ([^ ]+) ([^ ]+)/g)].map((match) => [Number(match[1]), Number(match[2])]);
}

function hasNonCollinearPoints(points: Array<[number, number]>): boolean {
  const origin = points[0];
  if (origin === undefined) return false;
  for (let first = 1; first < points.length; first += 1) {
    const a = points[first];
    if (a === undefined) continue;
    for (let second = first + 1; second < points.length; second += 1) {
      const b = points[second];
      if (b === undefined) continue;
      const cross = (a[0] - origin[0]) * (b[1] - origin[1]) -
        (a[1] - origin[1]) * (b[0] - origin[0]);
      if (Math.abs(cross) > 1e-9) return true;
    }
  }
  return false;
}

function plane(rows: (x: number, y: number) => number): MathSurfaceGeometryResult["rows"] {
  return [-1, 0, 1].map((y) => [-1, 0, 1].map((x) => ({ x, y, z: rows(x, y) })));
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
    expect(segments[0]?.[2]! - segments[0]?.[0]!).toBeCloseTo(Math.SQRT1_2);
    expect(segments[0]?.[3]! - segments[0]?.[1]!).toBeCloseTo(Math.SQRT1_2 * 0.5);
    expect(segments[1]?.[2]! - segments[1]?.[0]!).toBeCloseTo(Math.SQRT1_2);
    expect(segments[1]?.[3]! - segments[1]?.[1]!).toBeCloseTo(-(Math.sqrt(3) / 2 + Math.SQRT1_2 * 0.5));
    expect(segments[2]?.[2]! - segments[2]?.[0]!).toBeCloseTo(-Math.SQRT1_2);
    expect(segments[2]?.[3]! - segments[2]?.[1]!).toBeCloseTo(Math.SQRT1_2 * 0.5);
    expect(segments[3]?.[2]! - segments[3]?.[0]!).toBeCloseTo(-Math.SQRT1_2);
    expect(segments[3]?.[3]! - segments[3]?.[1]!).toBeCloseTo(-(Math.sqrt(3) / 2 + Math.SQRT1_2 * 0.5));
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

  it("renders deterministic projected x/y/z axes and labels by default", () => {
    const value = geometry(plane((x, y) => x + y));
    const svg = renderMathSurfaceGeometrySvg(value);

    expect(svg).toContain('class="powershow-plot-axis powershow-plot-axis-x"');
    expect(svg).toContain('class="powershow-plot-axis powershow-plot-axis-y"');
    expect(svg).toContain('class="powershow-plot-axis powershow-plot-axis-z"');
    expect(svg).toContain('class="powershow-plot-axis-label powershow-plot-axis-label-x"');
    expect(svg).toContain('class="powershow-plot-axis-label powershow-plot-axis-label-y"');
    expect(svg).toContain('class="powershow-plot-axis-label powershow-plot-axis-label-z"');
    expect(svg).toContain("powershow-plot-surface-wireframe");
    expect(svg).not.toMatch(/NaN|Infinity/);
    expect(svg).toBe(renderMathSurfaceGeometrySvg(value));
  });

  it("maps the mathematical origin to one shared SVG coordinate frame", () => {
    const svg = renderMathSurfaceGeometrySvg(geometry([
      [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }],
      [{ x: 0, y: 1, z: 1 }, { x: 1, y: 1, z: 2 }],
    ]));
    const origin = svg.match(/<path[^>]* d="M ([^ ]+) ([^ ]+)/)?.slice(1);
    if (origin?.[0] === undefined || origin[1] === undefined) throw new Error("Missing surface origin");

    for (const axis of ["x", "y", "z"] as const) {
      const point = svg.match(new RegExp(`powershow-plot-axis-${axis}\\" x1=\\"([^\\"]+)\\" y1=\\"([^\\"]+)\\"`))?.slice(1);
      expect(point).toEqual(origin);
    }
  });

  it("hides axes while preserving the surface wireframe", () => {
    const svg = renderMathSurfaceGeometrySvg(geometry(plane((x, y) => x + y)), { showAxes: false });

    expect(svg).toContain("powershow-plot-surface-wireframe");
    expect(svg).not.toContain("powershow-plot-axis");
    expect(svg).not.toContain("powershow-plot-axis-label");
  });

  it("uses finite non-degenerate padded bounds for a flat surface", () => {
    const svg = renderMathSurfaceGeometrySvg(geometry([
      [{ x: 0, y: 0, z: 2 }, { x: 1, y: 0, z: 2 }],
      [{ x: 0, y: 1, z: 2 }, { x: 1, y: 1, z: 2 }],
    ]), { showAxes: false });
    const [width, height] = viewBox(svg);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(Number.isFinite(width)).toBe(true);
    expect(Number.isFinite(height)).toBe(true);
  });

  it("keeps an inclined z=x+y plane materially different from a flat plane", () => {
    const inclined = renderMathSurfaceGeometrySvg(geometry(plane((x, y) => x + y)));
    const flat = renderMathSurfaceGeometrySvg(geometry(plane(() => 2)));
    const [inclinedWidth, inclinedHeight] = viewBox(inclined);
    const [flatWidth, flatHeight] = viewBox(flat);

    expect(inclinedHeight / inclinedWidth).not.toBeCloseTo(flatHeight / flatWidth, 2);
    expect(inclined).not.toBe(flat);
  });

  it.each([
    ["z=x", (x: number) => x],
    ["z=y", (_x: number, y: number) => y],
  ] as const)("keeps %s from collapsing edge-on", (_name, surface) => {
    const svg = renderMathSurfaceGeometrySvg(geometry(plane(surface)));
    const [width, height] = viewBox(svg);

    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(hasNonCollinearPoints(pathPoints(svg))).toBe(true);
  });

  it("defensively skips malformed points and emits required wireframe markup", () => {
    const svg = renderMathSurfaceGeometrySvg(geometry([
      [{ x: 0, y: 0, z: 0 }, { x: Number.NaN, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }],
      [{ x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: Number.POSITIVE_INFINITY }],
    ]), { showAxes: false });

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
