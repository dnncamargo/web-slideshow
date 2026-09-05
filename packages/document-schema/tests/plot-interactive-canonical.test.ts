import { describe, expect, it } from "vitest";
import { PlotElementSchema, InteractiveElementSchema } from "../src";

const plot = { id: "plot-1", type: "chart" as const, hidden: false, source: "" };
const interactive = { id: "interactive-1", type: "interactive" as const, widget: "function-plot" as const, config: {} };

describe("Plot canonical contract", () => {
  it("keeps the legacy minimum valid without materializing fitToAxes", () => {
    const parsed = PlotElementSchema.parse(plot);

    expect(parsed).not.toHaveProperty("fitToAxes");
  });

  it.each([true, false])("accepts fitToAxes: %j", (fitToAxes) => {
    expect(PlotElementSchema.safeParse({ ...plot, fitToAxes }).success).toBe(true);
  });

  it.each([
    plot,
    { ...plot, source: "y = x^2" },
    { ...plot, layout: { width: 640, height: 360 } },
  ])("accepts %j", (input) => {
    expect(PlotElementSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    { id: "plot-1", type: "chart", hidden: false },
    { ...plot, type: "plot" },
    { ...plot, source: "x".repeat(4097) },
    { ...plot, chartType: "line", series: [] },
    { ...plot, unknown: true },
    { ...plot, fitToAxes: "true" },
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
    { style: {} },
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
});
