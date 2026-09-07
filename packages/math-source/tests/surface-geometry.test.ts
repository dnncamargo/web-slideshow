import { describe, expect, it } from "vitest";
import {
  analyzeMathSource,
  generateExplicit3DSurfaceGeometry,
  type MathSemanticEquation,
} from "../src";

function equation(source: string): MathSemanticEquation {
  const result = analyzeMathSource(source);
  expect(result.diagnostics).toEqual([]);
  expect(result.equations).toHaveLength(1);
  return result.equations[0]!;
}

describe("generateExplicit3DSurfaceGeometry", () => {
  it("accepts explicit-z and emits ordered endpoint-inclusive rows", () => {
    const result = generateExplicit3DSurfaceGeometry(
      equation("z = x + y"),
      { xMin: -1, xMax: 1, yMin: 2, yMax: 4 },
      { xSampleCount: 3, ySampleCount: 2 },
    );

    expect(result).toEqual({
      rows: [
        [
          { x: -1, y: 2, z: 1 },
          { x: 0, y: 2, z: 2 },
          { x: 1, y: 2, z: 3 },
        ],
        [
          { x: -1, y: 4, z: 3 },
          { x: 0, y: 4, z: 4 },
          { x: 1, y: 4, z: 5 },
        ],
      ],
      diagnostics: [],
    });
  });

  it("rejects non-explicit-z forms", () => {
    for (const source of ["z + 1 = x", "y = x", "x = y", "x + y = 1"]) {
      expect(generateExplicit3DSurfaceGeometry(
        equation(source),
        { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
      ).diagnostics[0]?.code).toBe("unsupported-equation-form");
    }
  });

  it.each([
    { xMin: Number.NaN, xMax: 1, yMin: 0, yMax: 1 },
    { xMin: 1, xMax: 0, yMin: 0, yMax: 1 },
  ])("rejects invalid domains %j", (domain) => {
    expect(generateExplicit3DSurfaceGeometry(equation("z = x + y"), domain).diagnostics[0]?.code).toBe("invalid-viewport");
  });

  it.each([
    { xSampleCount: 1 },
    { ySampleCount: 65 },
    { xSampleCount: 2.5 },
  ])("rejects invalid sample counts %j", (options) => {
    expect(generateExplicit3DSurfaceGeometry(
      equation("z = x + y"),
      { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
      options,
    ).diagnostics[0]?.code).toBe("invalid-grid");
  });

  it("rejects grids above the total evaluation budget", () => {
    expect(generateExplicit3DSurfaceGeometry(
      equation("z = x + y"),
      { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
      { xSampleCount: 46, ySampleCount: 46 },
    ).diagnostics[0]?.code).toBe("geometry-budget-exceeded");
  });

  it("generates a finite constant surface", () => {
    const result = generateExplicit3DSurfaceGeometry(
      equation("z = 2"),
      { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
      { xSampleCount: 2, ySampleCount: 2 },
    );

    expect(result.rows.flat()).toEqual([
      { x: 0, y: 0, z: 2 }, { x: 1, y: 0, z: 2 },
      { x: 0, y: 1, z: 2 }, { x: 1, y: 1, z: 2 },
    ]);
  });

  it("resolves finite parameters and overrides caller x/y bindings", () => {
    const result = generateExplicit3DSurfaceGeometry(
      equation("z = a*x + b*y"),
      { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
      { bindings: { a: 2, b: 3, x: 999, y: 999 }, xSampleCount: 2, ySampleCount: 2 },
    );

    expect(result.rows[1]?.[1]).toEqual({ x: 1, y: 1, z: 5 });
  });

  it("fails the whole surface for a missing parameter", () => {
    expect(generateExplicit3DSurfaceGeometry(
      equation("z = a*x"),
      { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
      { xSampleCount: 2, ySampleCount: 2 },
    )).toMatchObject({ rows: [], diagnostics: [{ code: "evaluation-failed", cause: { code: "missing-binding" } }] });
  });

  it("retains finite samples around local domain gaps", () => {
    const result = generateExplicit3DSurfaceGeometry(
      equation("z = sqrt(x)"),
      { xMin: -1, xMax: 1, yMin: 0, yMax: 1 },
      { xSampleCount: 3, ySampleCount: 2 },
    );

    expect(result.rows).toEqual([
      [null, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }],
      [null, { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 1 }],
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it("reports no visible geometry when every sample is invalid", () => {
    expect(generateExplicit3DSurfaceGeometry(
      equation("z = sqrt(x)"),
      { xMin: -2, xMax: -1, yMin: 0, yMax: 1 },
      { xSampleCount: 2, ySampleCount: 2 },
    )).toEqual({ rows: [], diagnostics: [{ code: "no-visible-geometry", message: "No visible geometry." }] });
  });

  it("is deterministic", () => {
    const domain = { xMin: -1, xMax: 1, yMin: -2, yMax: 2 };
    const options = { xSampleCount: 4, ySampleCount: 3 };
    const first = generateExplicit3DSurfaceGeometry(equation("z = sin(x) * cos(y)"), domain, options);
    const second = generateExplicit3DSurfaceGeometry(equation("z = sin(x) * cos(y)"), domain, options);
    expect(second).toEqual(first);
  });
});
