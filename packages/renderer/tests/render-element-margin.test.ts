import { describe, expect, it } from "vitest";

import type {
  BlocksElement,
  EmbedElement,
  GalleryElement,
  PlotElement,
  ScriptedElement,
} from "@powershow/document-schema";

import { renderElement } from "../src/render-element";
import {
  createCodeElement,
  createImageElement,
  createTableElement,
  createTerminalElement,
  createTextElement,
} from "./fixtures/render-fixtures";

const margin = {
  margin: 8,
  marginTop: 1,
  marginRight: 2,
  marginBottom: 3,
  marginLeft: 4,
} as const;

function expectCanonicalMargins(html: string): void {
  expect(html).toContain("margin:8px");
  expect(html).toContain("margin-top:1px");
  expect(html).toContain("margin-right:2px");
  expect(html).toContain("margin-bottom:3px");
  expect(html).toContain("margin-left:4px");
}

describe("canonical element margin rendering", () => {
  it.each([
    ["text", createTextElement({ layout: { ...margin } })],
    ["image", createImageElement({ layout: { ...margin } })],
    ["code", createCodeElement({ layout: { ...margin } })],
    ["terminal", createTerminalElement({ layout: { ...margin } })],
    ["table", createTableElement({ layout: { ...margin } })],
    ["blocks", { id: "blocks", type: "blocks", hidden: false, layout: { ...margin }, source: "move [10] steps" } satisfies BlocksElement],
    ["gallery", { id: "gallery", type: "gallery", hidden: false, layout: { ...margin }, items: [], fit: "contain" } satisfies GalleryElement],
    ["embed", { id: "embed", type: "embed", hidden: false, layout: { ...margin }, src: "https://example.com/", title: "Embedded content" } satisfies EmbedElement],
    ["scripted", { id: "scripted", type: "scripted", hidden: false, layout: { ...margin }, title: "Scripted content", html: "", css: "", script: "", ports: [] } satisfies ScriptedElement],
    ["plot", { id: "plot", type: "plot", hidden: false, layout: { ...margin }, source: "" } satisfies PlotElement],
  ] as const)("renders canonical margins for %s", (_name, element) => {
    expectCanonicalMargins(renderElement(element));
  });

  it("preserves non-margin layout when rendering margins", () => {
    const html = renderElement(createImageElement({
      layout: { width: "60%", height: 240, position: "absolute", top: 10, left: 20, ...margin },
    }));

    expect(html).toContain("width:60%");
    expect(html).toContain("height:240px");
    expect(html).toContain("position:absolute");
    expect(html).toContain("top:10px");
    expect(html).toContain("left:20px");
    expectCanonicalMargins(html);
  });

  it("omits margin declarations when margins are absent", () => {
    const html = renderElement(createTextElement());

    expect(html).not.toContain("margin:");
  });
});