import { describe, expect, it } from "vitest";

import { PlotElementSchema } from "@powershow/document-schema";

import type { ElementCreateType } from "../src/features/editor/element-operations";
import { createElement } from "../src/features/editor/element-operations";

describe("Plot element authoring", () => {
  it("exposes the canonical plot discriminator as an ElementCreateType", () => {
    const createType: ElementCreateType = "plot";
    expect(createType).toBe("plot");
  });

  it("creates a canonical Plot with deterministic defaults", () => {
    const created = createElement("plot", []);

    expect(created).toMatchObject({
      id: "plot-element",
      type: "plot",
      hidden: false,
      source: "y = x^2",
      fitToAxes: true,
      layout: { width: "60%", height: "55%" },
    });
    expect(() => PlotElementSchema.parse(created)).not.toThrow();
  });

  it("uses plot-element-2 on id collision", () => {
    const created = createElement("plot", [{
      id: "slide-1",
      title: "",
      summary: "",
      speakerNotes: "",
      elements: [{ id: "plot-element", type: "plot", hidden: false, source: "" }],
    }]);

    expect(created.id).toBe("plot-element-2");
  });
});
