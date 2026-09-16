import { describe, expect, it } from "vitest";

import type { Slide, TextElement } from "@powershow/document-schema";

import { insertElementAfterId } from "../src/features/editor/element-operations";
import { createQrImageElement } from "../src/features/editor/qr-image-authoring";

function slide(elements: Slide["elements"] = []): Slide {
  return { id: "slide-1", title: "", summary: "", speakerNotes: "", elements };
}

function text(id: string, link?: TextElement["link"]): TextElement {
  return { id, type: "text", hidden: false, variant: "body", content: "Source", ...(link ? { link } : {}) };
}

describe("QR image authoring", () => {
  it("creates a canonical snapshot Image containing the source URL", () => {
    const href = "https://example.com/lesson?q=qr";
    const image = createQrImageElement(href, [slide([text("source")])]);

    expect(image).toMatchObject({ type: "image", alt: `QR code for ${href}` });
    expect(image?.src.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    const encodedSvg = image?.src.split(",", 2)[1] ?? "";
    const svg = decodeURIComponent(encodedSvg);
    expect(svg).toMatch(/^<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain('viewBox="0 0 37 37"');
    expect(svg).toContain(href);
    expect(image?.src).toContain("%3Csvg");
  });

  it("rejects empty and invalid URLs", () => {
    expect(createQrImageElement("", [])).toBeNull();
    expect(createQrImageElement("javascript:alert(1)", [])).toBeNull();
  });

  it("inserts the ordinary Image beside the source in its parent", () => {
    const source = text("source", { kind: "url", href: "https://example.com" });
    const parent = { id: "parent", type: "container" as const, hidden: false, children: [source] };
    const image = createQrImageElement("https://example.com", [slide([parent])]);
    const elements = insertElementAfterId([parent], source.id, image!);

    const nextParent = elements[0];
    expect(nextParent?.type).toBe("container");
    if (nextParent?.type !== "container") return;
    expect(nextParent.children.map((element) => element.type)).toEqual(["text", "image"]);
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
    const image = createQrImageElement(source.link.href, [slide([source])]);
    const elements = insertElementAfterId([source], source.id, image!);

    expect(elements.map((element) => element.type)).toEqual(["container", "image"]);
    expect(elements[0]?.type === "container" ? elements[0].children : []).toHaveLength(0);
    expect(source.link.href).toBe("https://example.com/container");
  });
});
