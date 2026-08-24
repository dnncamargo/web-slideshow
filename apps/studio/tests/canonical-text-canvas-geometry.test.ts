import { describe, expect, it } from "vitest";

import type { TextElement, TextboxElement } from "@powershow/document-schema";
import {
  updateCanonicalTextForCanvasDrag,
  updateTextboxForCanvasResize,
  type CanonicalTextCanvasGeometry,
} from "../src/features/editor/canonical-text-canvas-geometry";

const geometry: CanonicalTextCanvasGeometry = {
  parentWidthPx: 400,
  parentHeightPx: 300,
  initialLeftPx: 80,
  initialTopPx: 60,
  initialRightPx: 120,
  initialBottomPx: 90,
  initialWidthPx: 200,
  initialHeightPx: 150,
};

function text(layout?: TextElement["layout"]): TextElement {
  return { type: "text", id: "text-1", hidden: false, content: "Text", variant: "body", layout };
}

function textbox(layout?: TextboxElement["layout"], extra: Partial<TextboxElement> = {}): TextboxElement {
  return { type: "textbox", id: "textbox-1", hidden: false, content: "Textbox", layout, ...extra };
}

describe("canonical text canvas drag", () => {
  it.each([
    ["Text", text()],
    ["Textbox", textbox()],
  ])("flow $0 returns the same object", (_name, element) => {
    expect(updateCanonicalTextForCanvasDrag(element, 20, 10, geometry)).toBe(element);
  });

  it("drags absolute numeric left/top", () => {
    const element = text({ position: "absolute", left: 20, top: 30 });
    expect(updateCanonicalTextForCanvasDrag(element, 15, -10, geometry).layout).toMatchObject({ left: 35, top: 20 });
  });

  it("moves right/bottom inversely", () => {
    const element = text({ position: "absolute", right: 20, bottom: 10 });
    expect(updateCanonicalTextForCanvasDrag(element, 15, 5, geometry).layout).toMatchObject({ right: 5, bottom: 5 });
  });

  it("moves both horizontal constraints without changing width", () => {
    const element = text({ position: "absolute", left: 20, right: 30 });
    const result = updateCanonicalTextForCanvasDrag(element, 10, 0, geometry);
    expect(result.layout).toMatchObject({ left: 30, right: 20 });
    expect(result.layout).not.toHaveProperty("width");
  });

  it("moves both vertical constraints without changing height", () => {
    const element = text({ position: "absolute", top: 20, bottom: 30 });
    const result = updateCanonicalTextForCanvasDrag(element, 0, 10, geometry);
    expect(result.layout).toMatchObject({ top: 30, bottom: 20 });
    expect(result.layout).not.toHaveProperty("height");
  });

  it("materializes missing horizontal and vertical edges", () => {
    const element = text({ position: "absolute" });
    expect(updateCanonicalTextForCanvasDrag(element, 20, 10, geometry).layout).toMatchObject({ left: 100, top: 70 });
  });

  it("resolves percent and px-string edges to numeric px", () => {
    const element = text({ position: "absolute", left: "10%", top: "20px" });
    expect(updateCanonicalTextForCanvasDrag(element, 20, 10, geometry).layout).toMatchObject({ left: 60, top: 30 });
  });

  it.each(["2rem", "2em"])("uses rendered fallback for %s edges", (edge) => {
    const element = text({ position: "absolute", left: edge });
    expect(updateCanonicalTextForCanvasDrag(element, 20, 0, geometry).layout?.left).toBe(100);
  });

  it("returns the same object for zero drag", () => {
    const element = text({ position: "absolute" });
    expect(updateCanonicalTextForCanvasDrag(element, 0, 0, geometry)).toBe(element);
  });
});

describe("canonical flow textbox resize", () => {
  it("touches only the requested axes", () => {
    const element = textbox({ width: 100, height: 80 });
    expect(updateTextboxForCanvasResize(element, "e", 20, 30, geometry).layout).toEqual({ width: 220, height: 80 });
    expect(updateTextboxForCanvasResize(element, "s", 20, 30, geometry).layout).toEqual({ width: 100, height: 180 });
    expect(updateTextboxForCanvasResize(element, "se", 20, 30, geometry).layout).toEqual({ width: 220, height: 180 });
  });

  it("does nothing for zero movement and never creates position edges", () => {
    const element = textbox();
    expect(updateTextboxForCanvasResize(element, "se", 0, 0, geometry)).toBe(element);
    expect(updateTextboxForCanvasResize(element, "e", 20, 30, geometry).layout).toEqual({ width: 220 });
  });

  it("preserves percentage dimensions relative to their parent", () => {
    const element = textbox({ width: "50%", height: "50%" });
    expect(updateTextboxForCanvasResize(element, "e", 40, 0, geometry).layout?.width).toBe("60%");
    expect(updateTextboxForCanvasResize(element, "s", 0, 30, geometry).layout?.height).toBe("60%");
  });
});

describe("canonical absolute textbox resize", () => {
  it.each([
    ["n", 0, -20, ["top", "height"]],
    ["s", 0, 20, ["top", "height"]],
    ["e", 20, 0, ["left", "width"]],
    ["w", -20, 0, ["left", "width"]],
  ] as const)("isolates %s resize to its axis", (direction, deltaX, deltaY, allowed) => {
    const result = updateTextboxForCanvasResize(textbox({ position: "absolute" }), direction, deltaX, deltaY, geometry);
    expect(Object.keys(result.layout ?? {})).toEqual(expect.arrayContaining(["position", ...allowed]));
    const forbidden = direction === "n" || direction === "s" ? ["left", "right", "width"] : ["top", "bottom", "height"];
    for (const key of forbidden) expect(result.layout).not.toHaveProperty(key);
  });

  it("solves northeast independently", () => {
    const result = updateTextboxForCanvasResize(textbox({ position: "absolute" }), "ne", 20, -10, geometry);
    expect(result.layout).toMatchObject({ left: 80, top: 50, width: 220, height: 160 });
  });

  it("preserves stretch constraints without materializing dimensions", () => {
    const element = textbox({ position: "absolute", left: 20, right: 30, top: 40, bottom: 50 });
    expect(updateTextboxForCanvasResize(element, "w", -10, 0, geometry).layout).toMatchObject({ left: 10, right: 30 });
    expect(updateTextboxForCanvasResize(element, "e", 10, 0, geometry).layout).toMatchObject({ left: 20, right: 20 });
    expect(updateTextboxForCanvasResize(element, "n", 0, -10, geometry).layout).toMatchObject({ top: 30, bottom: 50 });
    expect(updateTextboxForCanvasResize(element, "s", 0, 10, geometry).layout).toMatchObject({ top: 40, bottom: 40 });
    expect(updateTextboxForCanvasResize(element, "e", 10, 0, geometry).layout).not.toHaveProperty("width");
    expect(updateTextboxForCanvasResize(element, "s", 0, 10, geometry).layout).not.toHaveProperty("height");
  });

  it("updates explicit dimensions and constraints deterministically", () => {
    expect(updateTextboxForCanvasResize(textbox({ position: "absolute", left: 20, width: 100 }), "e", 10, 0, geometry).layout).toMatchObject({ left: 20, width: 210 });
    expect(updateTextboxForCanvasResize(textbox({ position: "absolute", left: 20, width: 100 }), "w", 10, 0, geometry).layout).toMatchObject({ left: 30, width: 190 });
    expect(updateTextboxForCanvasResize(textbox({ position: "absolute", right: 20, width: 100 }), "w", -10, 0, geometry).layout).toMatchObject({ right: 20, width: 210 });
    expect(updateTextboxForCanvasResize(textbox({ position: "absolute", right: 20, width: 100 }), "e", 10, 0, geometry).layout).toMatchObject({ right: 10, width: 210 });
  });

  it("materializes left/top and dimensions without authored edges", () => {
    expect(updateTextboxForCanvasResize(textbox({ position: "absolute" }), "e", 20, 0, geometry).layout).toMatchObject({ left: 80, width: 220 });
    expect(updateTextboxForCanvasResize(textbox({ position: "absolute" }), "w", -20, 0, geometry).layout).toMatchObject({ left: 60, width: 220 });
    expect(updateTextboxForCanvasResize(textbox({ position: "absolute" }), "s", 0, 20, geometry).layout).toMatchObject({ top: 60, height: 170 });
    expect(updateTextboxForCanvasResize(textbox({ position: "absolute" }), "n", 0, -20, geometry).layout).toMatchObject({ top: 40, height: 170 });
  });

  it("clamps explicit dimensions to one logical px", () => {
    const result = updateTextboxForCanvasResize(textbox({ position: "absolute", width: 10, height: 10 }), "nw", 300, 300, geometry);
    expect(result.layout).toMatchObject({ width: 1, height: 1 });
  });

  it("preserves unrelated canonical responsibilities and introduces no legacy fields", () => {
    const element = textbox(
      { position: "absolute", width: 100, height: 80, left: 10, top: 20 },
      { style: { color: "#fff" }, typography: { fontSize: 20 }, effect: { opacity: 0.5 }, link: { kind: "url", href: "https://example.com" } },
    );
    const result = updateTextboxForCanvasResize(element, "e", 10, 10, geometry);
    expect(result).toMatchObject({ style: element.style, typography: element.typography, effect: element.effect, link: element.link });
    expect(result.style).not.toHaveProperty("width");
    expect(result.style).not.toHaveProperty("height");
    expect(result).not.toHaveProperty("placement");
  });
});
