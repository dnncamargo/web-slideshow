import { describe, expect, it } from "vitest";

import {
  EmbedElementSchema,
  GalleryElementSchema,
  ImageElementSchema,
  PowerShowElementSchema,
} from "../src/elements";

function embed(overrides: Record<string, unknown> = {}) {
  return {
    id: "embed-1",

    type: "embed",

    src: "https://example.com/",

    hidden: false,

    ...overrides,
  };
}

describe("Embed element schema", () => {
  it("parses a valid HTTPS Embed", () => {
    const result = EmbedElementSchema.safeParse(embed());

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.type).toBe("embed");

      expect(result.data.src).toBe("https://example.com/");
    }
  });

  it("parses a valid HTTP Embed", () => {
    const result = EmbedElementSchema.safeParse(
      embed({ src: "http://example.com/path" }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.src).toBe("http://example.com/path");
    }
  });

  it("accepts Embed through PowerShowElementSchema", () => {
    const result = PowerShowElementSchema.safeParse(embed());

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.type).toBe("embed");
    }
  });

  it("defaults title to Embedded content", () => {
    const result = EmbedElementSchema.safeParse(embed());

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.title).toBe("Embedded content");
    }
  });

  it("preserves an explicit non-empty title", () => {
    const result = EmbedElementSchema.safeParse(
      embed({ title: "Live chart" }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.title).toBe("Live chart");
    }
  });

  it("rejects an empty title", () => {
    const result = EmbedElementSchema.safeParse(
      embed({ title: "" }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects a javascript: src", () => {
    const result = EmbedElementSchema.safeParse(
      embed({ src: "javascript:alert(1)" }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects a data: src", () => {
    const result = EmbedElementSchema.safeParse(
      embed({ src: "data:text/html,<svg/>" }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects a blob: src", () => {
    const result = EmbedElementSchema.safeParse(
      embed({ src: "blob:https://example.com/abc" }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects a relative src", () => {
    const result = EmbedElementSchema.safeParse(
      embed({ src: "/embedded/page" }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects a malformed HTTP/HTTPS URL", () => {
    const result = EmbedElementSchema.safeParse(
      embed({ src: "https:// example.com/" }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects surrounding whitespace in src", () => {
    const result = EmbedElementSchema.safeParse(
      embed({ src: " https://example.com/ " }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects unknown srcDoc/srcdoc/html fields", () => {
    const result = EmbedElementSchema.safeParse(
      embed({
        srcdoc: "<script>alert(1)</script>",
        srcDoc: "<script>alert(1)</script>",
        html: "<b>raw</b>",
      }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects sandbox or allow configuration fields", () => {
    const result = EmbedElementSchema.safeParse(
      embed({
        sandbox: "allow-scripts",
        allow: "fullscreen",
      }),
    );

    expect(result.success).toBe(false);
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

      expect(result.data).not.toHaveProperty("title");
    }
  });

  it("leaves existing GalleryElement parsing unchanged", () => {
    const result = GalleryElementSchema.safeParse({
      id: "gallery-1",

      type: "gallery",

      hidden: false,

      fit: "contain",

      items: [{ src: "/first.png", alt: "First" }],
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.type).toBe("gallery");
    }
  });

  it("accepts the canonical surface envelope and rejects legacy aggregate fields", () => {
    expect(EmbedElementSchema.safeParse(embed({
      layout: { width: "80%", height: 240, position: "absolute", top: 10, right: "5%", bottom: 20, left: 30 },
      style: { background: { color: "#123456" }, borderRadius: 8, className: "embed" },
      effect: { opacity: 0.8 },
    })).success).toBe(true);
    expect(EmbedElementSchema.safeParse(embed({ style: { opacity: 0.8 } })).success).toBe(false);
    expect(EmbedElementSchema.safeParse(embed({ layout: { padding: 8 } })).success).toBe(false);
  });
});
