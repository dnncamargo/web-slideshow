import { describe, expect, it } from "vitest";

import type { ChartElement, EmbedElement, GalleryElement, ImageElement, InteractiveElement, ScriptedElement, TextElement } from "@powershow/document-schema";
import {
  updateCanonicalElementForCanvasDrag,
  updateCanonicalTextForCanvasDrag,
  updateCanonicalImageForCanvasDrag,
  updateCanonicalSurfaceForCanvasDrag,
  updateImageForCanvasResize,
  updateSurfaceForCanvasResize,
  type CanonicalTextCanvasGeometry,
} from "../src/features/editor/canonical-text-canvas-geometry";
import { resolveProportionalResize } from "../src/features/editor/canvas-resize-helpers";

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

function image(layout?: ImageElement["layout"]): ImageElement {
  return { type: "image", id: "image-1", hidden: false, src: "/image.png", alt: "", fit: "contain", layout };
}

function surface(type: GalleryElement["type"] | EmbedElement["type"] | ScriptedElement["type"], layout?: GalleryElement["layout"]): GalleryElement | EmbedElement | ScriptedElement {
  if (type === "gallery") return { type, id: "gallery-1", hidden: false, items: [], fit: "contain", layout };
  if (type === "embed") return { type, id: "embed-1", hidden: false, src: "https://example.com/", title: "Embed", layout };
  return { type, id: "scripted-1", hidden: false, title: "Scripted", html: "", css: "", script: "", ports: [], layout };
}

describe("canonical text canvas drag", () => {
  it.each([
    ["chart", { type: "chart", id: "chart", hidden: false, source: "" }],
    ["interactive", { type: "interactive", id: "interactive", hidden: false, widget: "function-plot", config: {} }],
  ] satisfies readonly [string, ChartElement | InteractiveElement][])("moves an absolute %s through canonical layout edges", (_type, element) => {
    const result = updateCanonicalElementForCanvasDrag(
      { ...element, layout: { position: "absolute", left: 10, top: "20%" } },
      15,
      20,
      {
        parentWidthPx: 400,
        parentHeightPx: 200,
        initialLeftPx: 10,
        initialTopPx: 40,
        initialRightPx: 0,
        initialBottomPx: 0,
        initialWidthPx: 100,
        initialHeightPx: 50,
      },
    );
    expect(result.layout).toEqual({ position: "absolute", left: 25, top: 60 });
    expect(result).not.toHaveProperty("style");
    expect(result).not.toHaveProperty("width");
  });
  it.each([
    ["Text", text()],
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

describe("canonical Image canvas geometry", () => {
  it("does not drag Flow Image and drags Absolute Image", () => {
    const flow = image({ width: 100, height: 80 });
    expect(updateCanonicalImageForCanvasDrag(flow, 20, 10, geometry)).toBe(flow);
    expect(updateCanonicalImageForCanvasDrag(image({ position: "absolute" }), 20, 10, geometry).layout).toMatchObject({ left: 100, top: 70 });
  });

  it("uses the direct edge matrix and canonical unit fallbacks", () => {
    expect(updateCanonicalImageForCanvasDrag(image({ position: "absolute", left: 20, right: 30 }), 10, 0, geometry).layout).toMatchObject({ left: 30, right: 20 });
    expect(updateCanonicalImageForCanvasDrag(image({ position: "absolute", right: "10%" }), 20, 0, geometry).layout?.right).toBe(20);
    expect(updateCanonicalImageForCanvasDrag(image({ position: "absolute", left: "2rem" }), 20, 0, geometry).layout?.left).toBe(100);
    const zero = image({ position: "absolute", left: 20 });
    expect(updateCanonicalImageForCanvasDrag(zero, 0, 0, geometry)).toBe(zero);
  });

  it("resizes Flow Image by size only and preserves absolute constraints", () => {
    const flow = updateImageForCanvasResize(image({ width: "50%", height: 80 }), "se", 40, 30, geometry);
    expect(flow.layout).toEqual({ width: "60%", height: 180 });

    const absolute = updateImageForCanvasResize(image({ position: "absolute", left: 20, top: 30, width: 100, height: 80 }), "nw", -10, -20, geometry);
    expect(absolute.layout).toMatchObject({ left: 10, top: 10, width: 210, height: 170 });
    expect(absolute.layout).not.toHaveProperty("placement");
  });

  it("applies both resolved dimensions for vertical-only proportional Flow movement", () => {
    const result = updateImageForCanvasResize(
      image({ width: 200, height: 150 }),
      "se",
      0,
      30,
      geometry,
      resolveProportionalResize("se", 0, 30, 200, 150),
    );

    expect(result.layout).toMatchObject({ width: 240, height: 180 });
    expect(result.layout).not.toHaveProperty("position");
    expect(result.layout).not.toHaveProperty("left");
    expect(result.layout).not.toHaveProperty("top");
  });

  it("applies both resolved dimensions for horizontal-only proportional Flow movement", () => {
    const result = updateImageForCanvasResize(
      image({ width: 200, height: 150 }),
      "se",
      40,
      0,
      geometry,
      resolveProportionalResize("se", 40, 0, 200, 150),
    );

    expect(result.layout).toMatchObject({ width: 240, height: 180 });
  });

  it("preserves percentage units independently for proportional Flow dimensions", () => {
    const result = updateImageForCanvasResize(
      image({ width: "50%", height: "50%" }),
      "se",
      0,
      30,
      geometry,
      { width: 240, height: 180 },
    );

    expect(result.layout).toMatchObject({ width: "60%", height: "60%" });
  });

  it("applies both resolved dimensions to absolute proportional resizing", () => {
    const result = updateImageForCanvasResize(
      image({ position: "absolute", left: 20, top: 30, width: 200, height: 150 }),
      "se",
      0,
      30,
      geometry,
      { width: 240, height: 180 },
    );

    expect(result.layout).toMatchObject({ left: 20, top: 30, width: 240, height: 180 });
    expect(result.layout).not.toHaveProperty("placement");
    expect(result.layout).not.toHaveProperty("anchor");
    expect(result.layout).not.toHaveProperty("offsetX");
    expect(result.layout).not.toHaveProperty("offsetY");
  });

  it("preserves opposite edges for proportional NW resizing", () => {
    const result = updateImageForCanvasResize(
      image({ position: "absolute", left: 20, top: 30, right: 40, bottom: 50, width: 200, height: 150 }),
      "nw",
      0,
      -30,
      geometry,
      { width: 240, height: 180 },
    );

    expect(result.layout).toMatchObject({ left: -20, top: 0, right: 40, bottom: 50, width: 240, height: 180 });
  });

  it("clamps Image resize to one logical px", () => {
    const result = updateImageForCanvasResize(image({ position: "absolute", width: 2, height: 2 }), "nw", 300, 300, geometry);
    expect(result.layout).toMatchObject({ width: 1, height: 1 });
  });
});

describe("canonical surface canvas geometry", () => {
  it.each(["gallery", "embed", "scripted"] as const)("routes %s through canonical drag and resize", (type) => {
    const absolute = surface(type, { position: "absolute", left: 20, top: 30, width: 200, height: 150 });
    const dragged = updateCanonicalSurfaceForCanvasDrag(absolute, 10, -5, geometry);
    expect(dragged.layout).toMatchObject({ left: 30, top: 25 });
    const resized = updateSurfaceForCanvasResize(dragged, "se", 20, 10, geometry);
    expect(resized.layout).toMatchObject({ left: 30, top: 25, width: 220, height: 160 });
    expect(resized).not.toHaveProperty("placement");
  });

  it("keeps flow surface resize size-only", () => {
    const element = surface("gallery");
    const resized = updateSurfaceForCanvasResize(element, "se", 20, 10, geometry);
    expect(resized.layout).toEqual({ width: 220, height: 160 });
  });
});
