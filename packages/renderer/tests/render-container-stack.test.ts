import { describe, expect, it } from "vitest";

import { renderElement } from "../src/render-element";

import {
  createContainerElement,
  createTextElement,
} from "./fixtures/render-fixtures";

describe("stack container rendering", () => {
  it("preserves flow container rendering", () => {
    const html = renderElement(
      createContainerElement({
        direction: "row",
        children: [createTextElement()],
      }),
    );

    expect(html).toContain("display:flex");
    expect(html).toContain("flex-direction:row");
    expect(html).not.toContain("powershow-container-stack");
  });

  it("renders stack containers as a grid with direct children in one area", () => {
    const html = renderElement(
      createContainerElement({
        layoutMode: "stack",
        horizontalAlign: "center",
        verticalAlign: "center",
        children: [
          createTextElement({ id: "background", content: "Background" }),
          createTextElement({ id: "overlay", content: "Overlay" }),
        ],
      }),
    );

    expect(html).toContain("powershow-container-stack");
    expect(html).toContain("display:grid");
    expect(html).toContain("justify-items:center");
    expect(html).toContain("align-items:center");
    expect(html).toContain('style="grid-area:1 / 1"');
    expect(html.indexOf("Background")).toBeLessThan(html.indexOf("Overlay"));
    expect(html).not.toContain("position:absolute");
    expect(html).not.toContain("z-index:");
  });

  it("renders nested stack containers without changing hierarchy", () => {
    const html = renderElement(
      createContainerElement({
        id: "outer-stack",
        layoutMode: "stack",
        children: [
          createContainerElement({
            id: "inner-stack",
            layoutMode: "stack",
            children: [createTextElement({ id: "overlay-text" })],
          }),
        ],
      }),
    );

    expect(html).toContain('data-powershow-id="outer-stack"');
    expect(html).toContain('data-powershow-id="inner-stack"');
    expect(html).toContain('data-powershow-id="overlay-text"');
    expect(html.match(/powershow-container-stack/g)).toHaveLength(2);
  });
});
