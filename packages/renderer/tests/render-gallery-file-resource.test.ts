import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type GalleryElement,
} from "@web-slideshow/document-schema";

import { renderElement } from "../src/render-element";

const file = {
  id: "file-image",
  name: "Image",
  kind: "image" as const,
  representation: "binary" as const,
  contentType: "image/png" as const,
  source: { type: "url" as const, url: "https://cdn.example.test/gallery.png" },
};

function gallery(overrides: Partial<GalleryElement> = {}): GalleryElement {
  return {
    id: "gallery-file",
    type: "gallery",
    hidden: false,
    fit: "contain",
    items: [{ fileResourceId: "file-image", alt: "File image" }],
    ...overrides,
  };
}

function presentation(element: GalleryElement) {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation-gallery-file",
    title: "Gallery",
    resources: { files: [file] },
    slides: [{ id: "slide-1", elements: [element] }],
  });
}

describe("renderElement Presentation File-backed Gallery items", () => {
  it("resolves the Presentation-owned File URL", () => {
    const element = gallery();
    const html = renderElement(element, { presentation: presentation(element) });

    expect(html).toContain('src="https://cdn.example.test/gallery.png"');
    expect(html).toContain('data-presentation-gallery-index="0"');
  });

  it("uses the resolved URL for cropped and focal-point media", () => {
    const element = gallery({
      fit: "cover",
      items: [{
        fileResourceId: "file-image",
        alt: "File image",
        focalPoint: { x: 25, y: 75 },
        crop: { x: 10, y: 20, width: 60, height: 50 },
      }],
    });
    const html = renderElement(element, { presentation: presentation(element) });

    expect(html).toContain('src="https://cdn.example.test/gallery.png"');
    expect(html).toContain('data-presentation-image-fit="cover"');
    expect(html).toContain('data-presentation-image-focal-x="25"');
    expect(html).toContain("presentation-image-crop-viewport");
  });

  it("preserves unresolved item frames and indexes without emitting empty media", () => {
    const element = gallery({
      items: [
        { src: "/direct.png", alt: "Direct" },
        { fileResourceId: "missing-file", alt: "Missing" },
        { src: "/last.png", alt: "Last" },
      ],
    });
    const validPresentation = presentation(gallery());
    validPresentation.resources = undefined;
    const html = renderElement(element, { presentation: validPresentation });

    expect(html.match(/class="presentation-gallery-item/g)).toHaveLength(3);
    expect(html).toContain('data-presentation-gallery-index="0"');
    expect(html).toContain('data-presentation-gallery-index="1"');
    expect(html).toContain('data-presentation-gallery-index="2"');
    expect(html).toContain('src="/direct.png"');
    expect(html).toContain('src="/last.png"');
    expect(html).not.toContain('src=""');
    const unresolvedFrame = html.slice(
      html.indexOf('data-presentation-gallery-index="1"'),
      html.indexOf('data-presentation-gallery-index="2"'),
    );
    expect(unresolvedFrame).not.toContain("<img");
  });
});
