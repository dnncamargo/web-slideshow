import { describe, expect, it } from "vitest";

import type {
  GalleryElement,
  Slide,
} from "@powershow/document-schema";

import {
  createElement,
  duplicateElement,
} from "../src/features/editor/element-operations";

function galleryElement(
  overrides: Partial<Omit<GalleryElement, "type">> = {},
): GalleryElement {
  return {
    id: "gallery-1",

    type: "gallery",

    hidden: false,

    fit: "contain",

    items: [
      { src: "/one.png", alt: "One" },
      { src: "/two.png", alt: "Two" },
    ],

    ...overrides,
  };
}

function slide(elements: Slide["elements"] = []): Slide {
  return {
    id: "slide-1",

    title: "",

    summary: "",

    speakerNotes: "",

    elements,
  };
}

describe("Gallery element authoring", () => {
  it("creates a Gallery", () => {
    const created = createElement("gallery", []);

    expect(created.type).toBe("gallery");
  });

  it("defaults the unique id to gallery-element", () => {
    expect(createElement("gallery", []).id).toBe("gallery-element");
  });

  it("uses gallery-element-2 on id collision", () => {
    const created = createElement("gallery", [
      slide([galleryElement({ id: "gallery-element" })]),
    ]);

    expect(created.id).toBe("gallery-element-2");
  });

  it("defaults hidden to false", () => {
    const created = createElement("gallery", []);

    if (created.type === "gallery") {
      expect(created.hidden).toBe(false);
    }
  });

  it("defaults fit to contain", () => {
    const created = createElement("gallery", []);

    if (created.type === "gallery") {
      expect(created.fit).toBe("contain");
    }
  });

  it("defaults items to exactly one item", () => {
    const created = createElement("gallery", []);

    if (created.type === "gallery") {
      expect(created.items).toHaveLength(1);
    }
  });

  it("defaults the single item to src /powershow-demo.svg and alt Gallery image", () => {
    const created = createElement("gallery", []);

    if (created.type === "gallery") {
      expect(created.items[0]).toEqual({
        src: "/powershow-demo.svg",

        alt: "Gallery image",
      });
    }
  });

  it("defaults style width to 60%", () => {
    const created = createElement("gallery", []);

    if (created.type === "gallery") {
      expect(created.style?.width).toBe("60%");
    }
  });

  it("defaults style height to 55%", () => {
    const created = createElement("gallery", []);

    if (created.type === "gallery") {
      expect(created.style?.height).toBe("55%");
    }
  });

  it("duplicates a Gallery with a unique element id", () => {
    const duplicate = duplicateElement(galleryElement(), [slide()]);

    expect(duplicate.id).toBe("gallery-1-copy");

    expect(duplicate.id).not.toBe(galleryElement().id);
  });

  it("duplicate preserves fit", () => {
    const duplicate = duplicateElement(
      galleryElement({ fit: "cover" }),
      [slide()],
    );

    if (duplicate.type === "gallery") {
      expect(duplicate.fit).toBe("cover");
    }
  });

  it("duplicate preserves item values", () => {
    const duplicate = duplicateElement(galleryElement(), [slide()]);

    if (duplicate.type === "gallery") {
      expect(duplicate.items).toEqual([
        { src: "/one.png", alt: "One" },
        { src: "/two.png", alt: "Two" },
      ]);
    }
  });

  it("duplicate items array is not the same reference", () => {
    const source = galleryElement();

    const duplicate = duplicateElement(source, [slide()]);

    if (duplicate.type === "gallery") {
      expect(duplicate.items).not.toBe(source.items);
    }
  });

  it("duplicate item object is not the same reference", () => {
    const source = galleryElement();

    const duplicate = duplicateElement(source, [slide()]);

    if (duplicate.type === "gallery") {
      expect(duplicate.items[0]).not.toBe(source.items[0]);
    }
  });

  it("modifying duplicate item values does not modify the original", () => {
    const source = galleryElement();

    const duplicate = duplicateElement(source, [slide()]);

    if (duplicate.type === "gallery") {
      duplicate.items[0] = {
        src: "/changed.png",

        alt: "Changed",
      };

      expect(source.items[0]).toEqual({
        src: "/one.png",

        alt: "One",
      });

      expect(duplicate.items[0]).toEqual({
        src: "/changed.png",

        alt: "Changed",
      });
    }
  });

  it("keeps Gallery a leaf with no nested item ids", () => {
    const created = createElement("gallery", []);

    if (created.type === "gallery") {
      expect(created.items).toHaveLength(1);

      expect(created.items[0]).not.toHaveProperty("id");
    }
  });
});
