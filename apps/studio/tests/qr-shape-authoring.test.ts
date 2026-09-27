import { describe, expect, it } from "vitest";

import type { Slide, TextElement } from "@web-slideshow/document-schema";
import { PresentationSchema } from "@web-slideshow/document-schema";

import { insertElementAfterId } from "../src/features/editor/element-operations";
import { createQrShapeElement } from "../src/features/editor/qr-shape-authoring";
import { collectPresentationAuthoringIds } from "../src/features/editor/presentation-authoring-trees";

function slide(elements: Slide["elements"] = []): Slide {
  return { id: "slide-1", title: "", summary: "", speakerNotes: "", elements };
}

function text(id: string, link?: TextElement["link"]): TextElement {
  return { id, type: "text", hidden: false, variant: "body", content: "Source", ...(link ? { link } : {}) };
}

describe("QR Shape authoring", () => {
  it("creates an editable canonical Shape with safe defaults", () => {
    const href = "https://example.com/lesson?q=qr";
    const shape = createQrShapeElement(href, new Set());

    expect(shape).toMatchObject({
      type: "shape",
      geometry: {
        mode: "generated",
        generator: "qr-code",
        config: { value: href, errorCorrection: "M", quietZone: 4 },
      },
      layout: { width: 240, height: 240 },
      style: { fill: { type: "color", color: "#000000" } },
    });
    expect(shape?.type).not.toBe("image");
    expect(JSON.stringify(shape)).not.toContain("data:image");
  });

  it("rejects empty and invalid URLs for Create QR from link", () => {
    expect(createQrShapeElement("", new Set())).toBeNull();
    expect(createQrShapeElement("javascript:alert(1)", new Set())).toBeNull();
  });

  it("inserts the Shape beside the linked source", () => {
    const source = text("source", { kind: "url", href: "https://example.com" });
    const parent = { id: "parent", type: "container" as const, hidden: false, children: [source] };
    const qr = createQrShapeElement("https://example.com", new Set());
    const elements = insertElementAfterId([parent], source.id, qr!);

    const nextParent = elements[0];
    expect(nextParent?.type).toBe("container");
    if (nextParent?.type !== "container") return;
    expect(nextParent.children.map((element) => element.type)).toEqual(["text", "shape"]);
    expect(source.link?.href).toBe("https://example.com");
  });

  it("keeps a Container source and its QR as siblings", () => {
    const source = {
      id: "source-container",
      type: "container" as const,
      hidden: false,
      link: { kind: "url" as const, href: "https://example.com/container" },
      children: [],
    };
    const qr = createQrShapeElement(source.link.href, new Set());
    const elements = insertElementAfterId([source], source.id, qr!);

    expect(elements.map((element) => element.type)).toEqual(["container", "shape"]);
    expect(elements[0]?.type === "container" ? elements[0].children : []).toHaveLength(0);
  });

  it("avoids IDs reserved by Root/local content", () => {
    const presentation = PresentationSchema.parse({
      schemaVersion: 1,
      id: "qr-presentation",
      title: "QR",
      rootDefinitions: [{
        id: "root-definition",
        name: "Root Definition",
        localChildTargetIds: ["root-container"],
        root: {
          id: "root-container",
          type: "container",
          hidden: false,
          children: [{ id: "shape-element", type: "shape", hidden: false, geometry: {
            mode: "path",
            viewBox: { x: 0, y: 0, width: 100, height: 100 },
            commands: [{ type: "move", x: 0, y: 0 }, { type: "close" }],
          } }],
        },
      }],
      slides: [slide([])],
    });
    const usedIds = collectPresentationAuthoringIds(presentation);
    const qr = createQrShapeElement("https://example.com/lesson", usedIds);

    expect(qr).toMatchObject({ type: "shape", geometry: { generator: "qr-code" } });
    expect(qr?.id).not.toBe("shape-element");
    expect(PresentationSchema.safeParse(presentation).success).toBe(true);
  });
});
