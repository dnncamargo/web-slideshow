import { describe, expect, it } from "vitest";

import {
  GalleryElementSchema,
  ImageElementSchema,
  PowerShowElementSchema,
} from "../src/elements";

function gallery(overrides: Record<string, unknown> = {}) {
  return {
    id: "gallery-1",

    type: "gallery",

    hidden: false,

    items: [
      { src: "/first.png", alt: "First" },
      { src: "/second.png", alt: "Second" },
    ],

    ...overrides,
  };
}

describe("Gallery element schema", () => {
  it("parses a valid Gallery with multiple items", () => {
    const result =
      PowerShowElementSchema.safeParse(gallery());

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.type).toBe("gallery");
    }
  });

  it("preserves item order", () => {
    const result =
      PowerShowElementSchema.safeParse(gallery());

    expect(result.success).toBe(true);

    if (result.success && result.data.type === "gallery") {
      expect(
        result.data.items.map((item) => item.src),
      ).toEqual(["/first.png", "/second.png"]);
    }
  });

  it("defaults fit to contain", () => {
    const result =
      PowerShowElementSchema.safeParse(gallery());

    expect(result.success).toBe(true);

    if (result.success && result.data.type === "gallery") {
      expect(result.data.fit).toBe("contain");
    }
  });

  it("defaults item alt to an empty string", () => {
    const result = GalleryElementSchema.safeParse(
      gallery({ items: [{ src: "/only.png" }] }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.items[0]?.alt).toBe("");
    }
  });

  it.each(["contain", "cover", "fill"] as const)(
    "accepts %s fit",
    (fit) => {
      const result = PowerShowElementSchema.safeParse(
        gallery({ fit }),
      );

      expect(result.success).toBe(true);
    },
  );

  it("accepts an empty items array", () => {
    const result = PowerShowElementSchema.safeParse(
      gallery({ items: [] }),
    );

    expect(result.success).toBe(true);

    if (result.success && result.data.type === "gallery") {
      expect(result.data.items).toEqual([]);
    }
  });

  it("rejects an empty item src", () => {
    const result = GalleryElementSchema.safeParse(
      gallery({ items: [{ src: "" }] }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects a missing item src", () => {
    const result = GalleryElementSchema.safeParse(
      gallery({ items: [{ alt: "no source" }] }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects an unsupported fit", () => {
    const result = PowerShowElementSchema.safeParse(
      gallery({ fit: "crop" }),
    );

    expect(result.success).toBe(false);
  });

  it("accepts a Gallery through PowerShowElementSchema", () => {
    const result = PowerShowElementSchema.safeParse(
      gallery(),
    );

    expect(result.success).toBe(true);
  });

  it("confirms Gallery items receive no synthetic id", () => {
    const result = PowerShowElementSchema.safeParse(
      gallery(),
    );

    expect(result.success).toBe(true);

    if (result.success && result.data.type === "gallery") {
      expect(result.data.items[0]).not.toHaveProperty("id");
    }
  });

  it("accepts the canonical surface envelope and rejects legacy aggregate fields", () => {
    expect(GalleryElementSchema.safeParse(gallery({
      layout: { width: "80%", height: 240, position: "absolute", top: 10, right: "5%", bottom: 20, left: 30 },
      style: { background: { color: "#123456" }, borderRadius: 8, className: "gallery" },
      effect: { opacity: 0.8 },
    })).success).toBe(true);
    expect(GalleryElementSchema.safeParse(gallery({ style: { width: 200 } })).success).toBe(false);
    expect(GalleryElementSchema.safeParse(gallery({ layout: { overflow: "auto" } })).success).toBe(false);
  });

  it("leaves existing ImageElement parsing unchanged", () => {
    const result = ImageElementSchema.safeParse({
      id: "image-1",

      type: "image",

      hidden: false,

      src: "/photo.png",

      alt: "Photo",

      fit: "cover",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.type).toBe("image");

      expect(result.data.fit).toBe("cover");

      expect(result.data).not.toHaveProperty("items");
    }
  });
});
