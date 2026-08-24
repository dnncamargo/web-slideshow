import { describe, expect, it } from "vitest";

import { renderElement } from "../src/render-element";

import {
  createCodeElement,
  createContainerElement,
  createTextElement,
} from "./fixtures/render-fixtures";

function absoluteCode(overrides: Record<string, unknown> = {}) {
  return createCodeElement({
    id: "absolute-text",
    style: { placement: { mode: "absolute", ...overrides } },
  });
}

describe("semantic placement rendering", () => {
  it("keeps missing and flow placement in normal layout", () => {
    const html = renderElement(
      createContainerElement({
        children: [createTextElement(), createTextElement({ id: "flow" })],
      }),
    );

    expect(html).toContain("display:flex");
    expect(html).not.toContain("position:relative");
    expect(html).not.toContain("position:absolute");
  });

  it("positions an absolute child from the center by default", () => {
    const html = renderElement(
      createContainerElement({ children: [absoluteCode()] }),
    );

    expect(html).toContain("position:relative");
    expect(html).toContain("position:absolute");
    expect(html).toContain("left:50%");
    expect(html).toContain("top:50%");
    expect(html).toContain("transform:translate(-50%,-50%)");
  });

  it("maps corner anchors and signed offsets", () => {
    const html = renderElement(
      createContainerElement({
        children: [
          absoluteCode({
            anchor: "bottom-right",
            offsetX: "-20px",
            offsetY: "10%",
          }),
        ],
      }),
    );

    expect(html).toContain("left:calc(100% + -20px)");
    expect(html).toContain("top:calc(100% + 10%)");
    expect(html).toContain("transform:translate(-100%,-100%)");
  });

  it("uses the nearest nested container and preserves sibling order in Stack", () => {
    const html = renderElement(
      createContainerElement({
        id: "outer",
        layout: { children: { mode: "stack" } },
        children: [
          createTextElement({ id: "background", content: "Background" }),
          createContainerElement({
            id: "inner",
          children: [absoluteCode({ anchor: "top-left" })],
          }),
        ],
      }),
    );

    expect(html).toContain('data-powershow-id="inner"');
    expect(html).toContain('data-powershow-id="absolute-text"');
    expect(html.match(/position:relative/g)).toHaveLength(1);
    expect(html.indexOf("Background")).toBeLessThan(html.indexOf("absolute-text"));
    expect(html).not.toContain("z-index:");
  });
});
