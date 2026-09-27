import { describe, expect, it } from "vitest";

import { PresentationElementSchema } from "@web-slideshow/document-schema";

import { createElement, type ElementCreateType } from "../src/features/editor/element-operations";

describe("Shape element operations", () => {
  it("creates a valid immediately visible default Shape", () => {
    const usedIds = new Set<string>();
    const element = createElement("shape", usedIds);

    expect(PresentationElementSchema.parse(element)).toEqual(element);
    expect(element).toMatchObject({
      id: "shape-element",
      type: "shape",
      hidden: false,
      layout: { width: 240, height: 160 },
      style: { fill: { type: "color" } },
    });
    expect(usedIds.has("shape-element")).toBe(true);
  });

  it("keeps Shape creation in the normal canonical create-type union", () => {
    const type: ElementCreateType = "shape";
    expect(createElement(type, new Set()).type).toBe("shape");
  });
});
