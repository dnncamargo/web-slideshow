import { describe, expect, it } from "vitest";

import { ChartElementSchema } from "@powershow/document-schema";

import type { ElementCreateType } from "../src/features/editor/element-operations";
import { createElement } from "../src/features/editor/element-operations";

describe("Chart element authoring", () => {
  it("exposes chart as an ElementCreateType", () => {
    const createType: ElementCreateType = "chart";
    expect(createType).toBe("chart");
  });

  it("creates a canonical Chart with deterministic defaults", () => {
    const created = createElement("chart", []);

    expect(created).toMatchObject({
      id: "chart-element",
      type: "chart",
      hidden: false,
      source: "y = x^2",
      fitToAxes: true,
      layout: { width: "60%", height: "55%" },
    });
    expect(() => ChartElementSchema.parse(created)).not.toThrow();
  });

  it("uses chart-element-2 on id collision", () => {
    const created = createElement("chart", [{
      id: "slide-1",
      title: "",
      summary: "",
      speakerNotes: "",
      elements: [{ id: "chart-element", type: "chart", hidden: false, source: "" }],
    }]);

    expect(created.id).toBe("chart-element-2");
  });
});
