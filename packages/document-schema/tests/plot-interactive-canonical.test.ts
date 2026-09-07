import { describe, expect, it } from "vitest";
import { PlotElementSchema, InteractiveElementSchema } from "../src";

const plot = { id: "plot-1", type: "plot" as const, hidden: false, source: "" };
const interactive = { id: "interactive-1", type: "interactive" as const, widget: "function-plot" as const, config: {} };

describe("Plot canonical contract", () => {
  it("keeps the legacy minimum valid without materializing fitToAxes", () => {
    const parsed = PlotElementSchema.parse(plot);

    expect(parsed).not.toHaveProperty("fitToAxes");
  });

  it.each([true, false])("accepts fitToAxes: %j", (fitToAxes) => {
    expect(PlotElementSchema.safeParse({ ...plot, fitToAxes }).success).toBe(true);
  });

  it.each([true, false])("accepts showAxes: %j", (showAxes) => {
    expect(PlotElementSchema.safeParse({ ...plot, showAxes }).success).toBe(true);
  });

  it("accepts canonical Plot animation intent", () => {
    const parsed = PlotElementSchema.parse({
      ...plot,
      animation: {
        parameter: "t",
        from: 0,
        to: Math.PI * 2,
        durationMs: 4000,
        loop: true,
        autoplay: false,
      },
    });

    expect(parsed.animation).toEqual({
      parameter: "t",
      from: 0,
      to: Math.PI * 2,
      durationMs: 4000,
      loop: true,
      autoplay: false,
    });
  });

  it.each(["t", "phase", "phase2", "time_value", "sin", "cos"])(
    "accepts animation parameter %s",
    (parameter) => {
      expect(PlotElementSchema.safeParse({
        ...plot,
        animation: { parameter, from: 0, to: 1, durationMs: 1000 },
      }).success).toBe(true);
    },
  );

  it.each(["x", "y", "z", "pi", "e"])("rejects reserved animation parameter %s", (parameter) => {
    expect(PlotElementSchema.safeParse({
      ...plot,
      animation: { parameter, from: 0, to: 1, durationMs: 1000 },
    }).success).toBe(false);
  });

  it.each(["", "_t", "2t", "t-value", "t value"])("rejects invalid animation parameter %j", (parameter) => {
    expect(PlotElementSchema.safeParse({
      ...plot,
      animation: { parameter, from: 0, to: 1, durationMs: 1000 },
    }).success).toBe(false);
  });

  it.each([[2, 1], [2, 2]] as const)("preserves animation range %j and omitted optional fields", (from, to) => {
    const parsed = PlotElementSchema.parse({
      ...plot,
      animation: { parameter: "t", from, to, durationMs: 1000 },
    });

    expect(parsed.animation).toEqual({ parameter: "t", from, to, durationMs: 1000 });
    expect(parsed.animation).not.toHaveProperty("loop");
    expect(parsed.animation).not.toHaveProperty("autoplay");
  });

  it.each([
    { color: "#ff0000" },
    { color: { kind: "palette", colorId: "accent" } },
    { background: { color: "#ffffff" } },
    { color: "#ff0000", background: { color: "#ffffff" } },
    { zGradient: { minColor: "#7c3aed", maxColor: "#06b6d4" } },
    {
      zGradient: {
        minColor: { kind: "palette", colorId: "low" },
        maxColor: { kind: "palette", colorId: "high" },
      },
    },
    {
      color: "#ffffff",
      background: { color: "#000000" },
      zGradient: { minColor: "#7c3aed", maxColor: "#06b6d4" },
    },
    { axes: { color: "#ff00aa", strokeWidth: 3 } },
    { axes: { color: { kind: "palette", colorId: "axis" }, strokeWidth: 0.5 } },
  ])("accepts minimal visual style %j", (style) => {
    expect(PlotElementSchema.safeParse({ ...plot, style }).success).toBe(true);
  });

  it.each([
    plot,
    { ...plot, source: "y = x^2" },
    { ...plot, layout: { width: 640, height: 360 } },
  ])("accepts %j", (input) => {
    expect(PlotElementSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    { ...plot, source: "x".repeat(4097) },
    { ...plot, unknown: true },
    { ...plot, fitToAxes: "true" },
    { ...plot, showAxes: "true" },
    { ...plot, animation: { parameter: "t", from: 0, to: 1, durationMs: 0 } },
    { ...plot, animation: { parameter: "t", from: 0, to: 1, durationMs: -1 } },
    { ...plot, animation: { parameter: "t", from: 0, to: 1, durationMs: 1.5 } },
    { ...plot, animation: { parameter: "x", from: 0, to: 1, durationMs: 1000 } },
    { ...plot, animation: { parameter: "pi", from: 0, to: 1, durationMs: 1000 } },
    { ...plot, animation: { parameter: "bad-name", from: 0, to: 1, durationMs: 1000 } },
    { ...plot, animation: { parameter: "t", from: Number.NaN, to: 1, durationMs: 1000 } },
    { ...plot, animation: { parameter: "t", from: 0, to: Number.POSITIVE_INFINITY, durationMs: 1000 } },
    { ...plot, animation: { parameter: "t", from: 0, to: 1, durationMs: Number.NaN } },
    { ...plot, animation: { parameter: "t", from: 0, to: 1, durationMs: Number.POSITIVE_INFINITY } },
    { ...plot, animation: { parameter: "t", from: 0, to: 1, durationMs: 1000, current: 0 } },
    { ...plot, style: { gradient: {} } },
    { ...plot, style: { border: {} } },
    { ...plot, style: { lineWidth: 2 } },
    { ...plot, style: { unknown: true } },
    { ...plot, style: { background: { border: {} } } },
    { ...plot, style: { zGradient: {} } },
    { ...plot, style: { zGradient: { minColor: "#7c3aed" } } },
    { ...plot, style: { zGradient: { maxColor: "#06b6d4" } } },
    { ...plot, style: { zGradient: { minColor: "#7c3aed", maxColor: "#06b6d4", type: "linear" } } },
    { ...plot, style: { zGradient: { minColor: "#7c3aed", maxColor: "#06b6d4", angle: 90 } } },
    { ...plot, style: { zGradient: { minColor: "#7c3aed", maxColor: "#06b6d4", shape: "circle" } } },
    { ...plot, style: { zGradient: { minColor: "#7c3aed", maxColor: "#06b6d4", stops: [] } } },
    { ...plot, style: { axes: { strokeWidth: 0 } } },
    { ...plot, style: { axes: { strokeWidth: -1 } } },
    { ...plot, style: { axes: { strokeWidth: Number.NaN } } },
    { ...plot, style: { axes: { strokeWidth: Number.POSITIVE_INFINITY } } },
    { ...plot, style: { axes: { color: "#ff00aa", unknown: true } } },
  ])("rejects non-canonical input %j", (input) => {
    expect(PlotElementSchema.safeParse(input).success).toBe(false);
  });
});

describe("Interactive canonical layout", () => {
  it.each([
    { width: 100 },
    { height: 100 },
  ])("rejects resizable-only layout %j", (layout) => {
    expect(
      InteractiveElementSchema.safeParse({
        ...interactive,
        layout,
      }).success,
    ).toBe(false);
  });
});

describe.each([
  ["Plot", PlotElementSchema, plot],
  ["Interactive", InteractiveElementSchema, interactive],
] as const)("%s canonical contract", (_name, schema, minimum) => {
  it("accepts the minimum semantic object and canonical absolute edges", () => {
    expect(schema.safeParse(minimum).success).toBe(true);
    expect(schema.safeParse({ ...minimum, hidden: true }).success).toBe(true);
    expect(schema.safeParse({ ...minimum, layout: { position: "absolute", top: "10%", right: 2, bottom: "3px", left: 4 } }).success).toBe(true);
  });

  it("keeps authored flow objects free of layout", () => {
    const parsed = schema.parse(minimum);
    expect(parsed).not.toHaveProperty("layout");
  });

  it.each([
    { layout: { top: 1 } },
    { layout: { minWidth: 1 } },
    { layout: { maxHeight: 1 } },
    { layout: { padding: 1 } },
    { layout: { margin: 1 } },
    { layout: { overflow: "hidden" } },
    { typography: {} },
    { effect: {} },
    { link: {} },
    { placement: {} },
    { anchor: "center" },
    { offsetX: 1 },
    { unknown: true },
  ])("rejects non-canonical field %j", (extra) => {
    expect(schema.safeParse({ ...minimum, ...extra }).success).toBe(false);
  });

  it("rejects an empty style object for Interactive", () => {
    expect(InteractiveElementSchema.safeParse({ ...interactive, style: {} }).success).toBe(false);
  });
});
