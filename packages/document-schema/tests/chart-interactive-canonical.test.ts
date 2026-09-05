import { describe, expect, it } from "vitest";
import { ChartElementSchema, InteractiveElementSchema } from "../src";

const chart = { id: "chart-1", type: "chart" as const, hidden: false, source: "" };
const interactive = { id: "interactive-1", type: "interactive" as const, widget: "function-plot" as const, config: {} };

describe("Chart canonical contract", () => {
  it.each([
    chart,
    { ...chart, source: "y = x^2" },
    { ...chart, layout: { width: 640, height: 360 } },
  ])("accepts %j", (input) => {
    expect(ChartElementSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    { id: "chart-1", type: "chart", hidden: false },
    { ...chart, source: "x".repeat(4097) },
    { ...chart, chartType: "line", series: [] },
    { ...chart, unknown: true },
  ])("rejects non-canonical input %j", (input) => {
    expect(ChartElementSchema.safeParse(input).success).toBe(false);
  });
});

describe.each([
  ["Chart", ChartElementSchema, chart],
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
