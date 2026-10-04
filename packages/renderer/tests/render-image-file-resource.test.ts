import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type ImageElement,
} from "@web-slideshow/document-schema";

import { renderElement } from "../src/render-element";

const file = {
  id: "file-image",
  name: "Image",
  kind: "image" as const,
  representation: "binary" as const,
  contentType: "image/png" as const,
  source: { type: "url" as const, url: "https://cdn.example.test/image.png" },
};

function image(overrides: Partial<Extract<ImageElement, { fileResourceId: string }>> = {}): Extract<ImageElement, { fileResourceId: string }> {
  return {
    id: "image-resource",
    type: "image",
    hidden: false,
    fileResourceId: "file-image",
    alt: "Resource image",
    fit: "contain",
    ...overrides,
  };
}

function presentation(element: ImageElement, files = [file]) {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation-1",
    title: "Presentation",
    resources: { files },
    slides: [{ id: "slide-1", elements: [element] }],
  });
}

describe("renderElement Presentation File-backed Image", () => {
  it("resolves the Presentation-owned binary File URL", () => {
    const html = renderElement(image(), { presentation: presentation(image()) });

    expect(html).toContain('src="https://cdn.example.test/image.png"');
    expect(html).not.toContain("file-image");
  });

  it("uses the resolved URL for cropped Images", () => {
    const resourceImage = image({ crop: { x: 10, y: 20, width: 50, height: 60 } });
    const html = renderElement(resourceImage, { presentation: presentation(resourceImage) });

    expect(html).toContain('class="presentation-image-crop-viewport"');
    expect(html).toContain('src="https://cdn.example.test/image.png"');
  });

  it("uses the resolved URL for linked Images", () => {
    const resourceImage = image({ link: { kind: "url", href: "https://example.test/next" } });
    const html = renderElement(resourceImage, { presentation: presentation(resourceImage) });

    expect(html).toContain('href="https://example.test/next"');
    expect(html).toContain('src="https://cdn.example.test/image.png"');
  });

  it("fails closed when the resource cannot be resolved", () => {
    const resourceImage = image();
    const unresolvedPresentation = presentation(resourceImage);
    unresolvedPresentation.resources = undefined;

    expect(renderElement(resourceImage)).toBe("");
    expect(renderElement(resourceImage, { presentation: unresolvedPresentation })).toBe("");
  });
});
