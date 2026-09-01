import { describe, expect, it } from "vitest";
import {
  PresentationSchema,
  type GalleryElement,
  type ImageElement,
  type PowerShowElement,
  type Slide,
} from "@powershow/document-schema";

import {
  attachImageToGallery,
  detachGalleryItemToImage,
  reorderGalleryItem,
} from "../src/features/editor/element-operations";
import { findElementById } from "../src/features/editor/element-tree";

function slide(elements: PowerShowElement[]): Slide {
  return { id: "slide-1", title: "Slide", summary: "", speakerNotes: "", elements };
}

function gallery(items: GalleryElement["items"], overrides: Partial<GalleryElement> = {}): GalleryElement {
  return { id: "gallery", type: "gallery", hidden: false, fit: "cover", items, ...overrides };
}

function image(id = "image", overrides: Partial<ImageElement> = {}): ImageElement {
  return { id, type: "image", hidden: false, src: `${id}.png`, alt: id, fit: "contain", ...overrides };
}

function item(src: string) {
  return { src, alt: src };
}

describe("Gallery structural operations", () => {
  it("reorders Gallery items in both directions using final indexes", () => {
    const forward = reorderGalleryItem([gallery([item("A"), item("B"), item("C"), item("D")])], "gallery", 1, 3);
    const backward = reorderGalleryItem([gallery([item("A"), item("B"), item("C")])], "gallery", 2, 0);

    expect((forward.elements[0] as GalleryElement).items.map((entry) => entry.src)).toEqual(["A", "C", "D", "B"]);
    expect((backward.elements[0] as GalleryElement).items.map((entry) => entry.src)).toEqual(["C", "A", "B"]);
  });

  it("detaches media with effective fit, normal Image defaults, and no Gallery surface inheritance", () => {
    const crop = { x: 0.1, y: 0.2, width: 0.7, height: 0.6 };
    const focalPoint = { x: 0.4, y: 0.6 };
    const source = gallery([{ src: "a.png", alt: "Facade", crop, focalPoint }], {
      layout: { width: "80%", height: "70%" },
      style: { opacity: 0.2 },
      effect: { type: "shadow", color: "#000", blur: 4, x: 1, y: 1 },
    });
    const outcome = detachGalleryItemToImage([source], [slide([image("image-element")])], "gallery", 0, "gallery", "after");
    const detached = findElementById(outcome.elements, outcome.imageId ?? "");

    expect(detached).toMatchObject({ type: "image", src: "a.png", alt: "Facade", fit: "cover", crop, focalPoint, layout: { width: "60%", height: "55%" } });
    expect(detached?.id).toBe("image-element-2");
    expect(detached).not.toHaveProperty("style");
    expect(detached).not.toHaveProperty("effect");
    expect((outcome.elements[0] as GalleryElement).items).toEqual([]);
  });

  it("honors explicit item fit and supports Container inside detach", () => {
    const source = gallery([{ src: "a.png", alt: "A", fit: "fill" }]);
    const target = { id: "target", type: "container" as const, hidden: false, children: [] };
    const outcome = detachGalleryItemToImage([source, target], [slide([source, target])], "gallery", 0, "target", "inside");
    const updatedTarget = findElementById(outcome.elements, "target");

    expect(updatedTarget).toMatchObject({ type: "container", children: [{ type: "image", src: "a.png", fit: "fill" }] });
    expect((outcome.elements[0] as GalleryElement).items).toEqual([]);
    expect(detachGalleryItemToImage([source], [slide([source])], "gallery", 0, "gallery", "inside").changed).toBe(false);
  });

  it("attaches only standalone Images and discards standalone-only properties", () => {
    const source = image("image", { src: "b.png", alt: "B", fit: "fill", layout: { width: "20%" }, style: { opacity: 0.5 }, link: { href: "https://example.com" } });
    const target = gallery([item("A"), item("C")]);
    const outcome = attachImageToGallery([source, target], "image", "gallery", 1);
    const updated = findElementById(outcome.elements, "gallery") as GalleryElement;

    expect(updated.items.map((entry) => entry.src)).toEqual(["A", "b.png", "C"]);
    expect(updated.items[1]).toEqual({ src: "b.png", alt: "B", fit: "fill" });
    expect(findElementById(outcome.elements, "image")).toBeNull();
    expect(attachImageToGallery([{ id: "text", type: "text", hidden: false, variant: "body", content: "x" }, target], "text", "gallery", 2).changed).toBe(false);
  });

  it("keeps converted documents valid at schemaVersion 1", () => {
    const source = gallery([item("A")]);
    const outcome = detachGalleryItemToImage([source], [slide([source])], "gallery", 0, "gallery", "after");
    expect(PresentationSchema.safeParse({ schemaVersion: 1, id: "presentation", title: "Presentation", slides: [slide(outcome.elements)] }).success).toBe(true);
  });
});
