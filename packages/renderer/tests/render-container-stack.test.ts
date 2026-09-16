import { describe, expect, it } from "vitest";

import { renderElement } from "../src/render-element";

import {
  createContainerElement,
  createImageElement,
  createTextElement,
} from "./fixtures/render-fixtures";

describe("stack container rendering", () => {
  it("preserves flow container rendering", () => {
    const html = renderElement(
      createContainerElement({
        layout: { children: { direction: "row" } },
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
        layout: { children: { mode: "stack", horizontalAlign: "center", verticalAlign: "center" } },
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
    expect(html).toContain('style="grid-area:1 / 1;z-index:0"');
    expect(html).toContain('style="grid-area:1 / 1;z-index:1"');
    expect(html.indexOf("Background")).toBeLessThan(html.indexOf("Overlay"));
    expect(html).not.toContain("position:absolute");
    expect(html).toContain("z-index:");
  });

  it("keeps a cropped Image below a later Text child", () => {
    const html = renderElement(
      createContainerElement({
        layout: { children: { mode: "stack" } },
        children: [
          createImageElement({
            id: "cropped-image",
            crop: { x: 10, y: 20, width: 60, height: 50 },
          }),
          createTextElement({ id: "front-text", content: "Front" }),
        ],
      }),
    );

    expect(html).toContain('data-powershow-id="cropped-image"');
    expect(html).toContain('data-powershow-id="front-text"');
    expect(html).toContain('style="grid-area:1 / 1;z-index:0;position:relative;overflow:hidden"');
    expect(html).toContain('style="grid-area:1 / 1;z-index:1"');
  });

  it("derives Stack layers from canonical order for reversed cropped children", () => {
    const html = renderElement(
      createContainerElement({
        layout: { children: { mode: "stack" } },
        children: [
          createTextElement({ id: "back-text", content: "Back" }),
          createImageElement({
            id: "front-image",
            crop: { x: 10, y: 20, width: 60, height: 50 },
          }),
        ],
      }),
    );

    expect(html).toContain('data-powershow-id="back-text"');
    expect(html).toContain('data-powershow-id="front-image"');
    expect(html).toContain('style="grid-area:1 / 1;z-index:0"');
    expect(html).toContain('style="grid-area:1 / 1;z-index:1;position:relative;overflow:hidden"');
  });

  it("gives nested Stack containers independent local layers", () => {
    const html = renderElement(
      createContainerElement({
        layout: { children: { mode: "stack" } },
        children: [
          createContainerElement({
            id: "inner-stack",
            layout: { children: { mode: "stack" } },
            children: [
              createTextElement({ id: "inner-back" }),
              createTextElement({ id: "inner-front" }),
            ],
          }),
          createTextElement({ id: "outer-front" }),
        ],
      }),
    );

    expect(html).toContain('data-powershow-id="inner-stack"');
    expect(html).toContain('data-powershow-id="outer-front"');
    expect(html).toContain('data-powershow-id="inner-back"');
    expect(html).toContain('data-powershow-id="inner-front"');
    expect(html).toContain('style="grid-area:1 / 1;z-index:0;display:grid"');
    expect(html).toContain('style="grid-area:1 / 1;z-index:1"');
  });

  it("keeps authored absolute children inside canonical Stack layers", () => {
    const html = renderElement(
      createContainerElement({
        layout: { children: { mode: "stack" } },
        children: [
          createImageElement({
            id: "absolute-image",
            layout: { position: "absolute", top: 0, left: 0, width: 100, height: 100 },
          }),
          createTextElement({ id: "front-text" }),
        ],
      }),
    );

    expect(html).toContain('position:absolute');
    expect(html).toContain('style="grid-area:1 / 1;z-index:0;width:100px;height:100px;position:absolute;top:0px;left:0px;object-fit:contain;object-position:50% 50%"');
    expect(html).toContain('style="grid-area:1 / 1;z-index:1"');
  });

  it("renders nested stack containers without changing hierarchy", () => {
    const html = renderElement(
      createContainerElement({
        id: "outer-stack",
        layout: { children: { mode: "stack" } },
        children: [
          createContainerElement({
            id: "inner-stack",
            layout: { children: { mode: "stack" } },
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
