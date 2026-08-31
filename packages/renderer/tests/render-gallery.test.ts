import { describe, expect, it } from "vitest";

import type { GalleryElement } from "@powershow/document-schema";

import { renderElement } from "../src/render-element";
import { renderGallery } from "../src/render-gallery";

function gallery(overrides: Partial<GalleryElement> = {}): GalleryElement {
  return {
    id: "gallery-1",
    type: "gallery",
    hidden: false,
    fit: "contain",
    items: [
      { src: "/first.png", alt: "First" },
      { src: "/second.png", alt: "Second" },
    ],
    ...overrides,
  };
}

describe("renderGallery", () => {
  it("renders the canonical root and authored surface class", () => {
    const html = renderGallery(gallery({ style: { className: "hero-gallery" } }));
    expect(html).toContain("powershow-element");
    expect(html).toContain("powershow-gallery");
    expect(html).toContain('data-powershow-id="gallery-1"');
    expect(html).toContain('data-powershow-type="gallery"');
    expect(html).toContain("hero-gallery");
  });

  it("keeps canonical item order and emits deterministic index hooks", () => {
    const html = renderGallery(gallery());
    expect(html.indexOf('/first.png"')).toBeLessThan(html.indexOf('/second.png"'));
    expect(html).toContain('data-powershow-gallery-index="0"');
    expect(html).toContain('data-powershow-gallery-index="1"');
  });

  it("stacks item frames and activates only the first item", () => {
    const html = renderGallery(gallery());
    expect(html).toContain("position:absolute");
    expect(html).toContain("inset:0");
    expect(html).toContain("overflow:hidden");
    expect(html).toContain("powershow-gallery-item-active");
    expect(html).toContain("visibility:hidden");
    expect(html).toContain("pointer-events:none");
    for (const forbidden of ["overflow-x:auto", "scroll-snap-type", "scroll-snap-align", "overscroll-behavior-inline", "flex:0 0 100%", "min-width:100%"])
      expect(html).not.toContain(forbidden);
  });

  it("uses root fit as the fallback and item fit as an override", () => {
    const html = renderGallery(gallery({
      fit: "cover",
      items: [{ src: "/first.png", alt: "First" }, { src: "/second.png", alt: "Second", fit: "contain" }],
    }));
    expect(html).toContain("object-fit:cover");
    expect(html).toContain("object-fit:contain");
  });

  it("renders per-item focal point for uncropped media", () => {
    const html = renderGallery(gallery({ items: [{ src: "/photo.png", alt: "Photo", focalPoint: { x: 25, y: 70 } }] }));
    expect(html).toContain("object-position:25% 70%");
  });

  it("reuses the Image crop metadata and viewport/media contract", () => {
    const html = renderGallery(gallery({
      fit: "contain",
      layout: { width: 600, height: 400 },
      items: [{ src: "/photo.png", alt: "Photo", fit: "cover", focalPoint: { x: 25, y: 75 }, crop: { x: 10, y: 20, width: 60, height: 50 } }],
    }));
    expect(html).toContain('data-powershow-image-crop="{&quot;x&quot;:10,&quot;y&quot;:20,&quot;width&quot;:60,&quot;height&quot;:50}"');
    expect(html).toContain('data-powershow-image-fit="cover"');
    expect(html).toContain('data-powershow-image-focal-x="25"');
    expect(html).toContain('data-powershow-image-focal-y="75"');
    expect(html).toContain('data-powershow-image-width-authored="true"');
    expect(html).toContain('data-powershow-image-height-authored="true"');
    expect(html).toContain("powershow-image-crop-viewport");
    expect(html).toContain("powershow-image-media");
  });

  it("escapes src and alt", () => {
    const html = renderGallery(gallery({ items: [{ src: 'https://example.com/image.png?a=1&b="quoted"', alt: '<unsafe & "quoted">' }] }));
    expect(html).toContain('src="https://example.com/image.png?a=1&amp;b=&quot;quoted&quot;"');
    expect(html).toContain('alt="&lt;unsafe &amp; &quot;quoted&quot;&gt;"');
  });

  it("renders an empty Gallery frame without images or carousel CSS", () => {
    const html = renderGallery(gallery({ items: [] }));
    expect(html).toContain("powershow-gallery");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("scroll-snap");
  });

  it("emits no interaction code and dispatches through renderElement", () => {
    const html = renderElement(gallery());
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("addEventListener");
    expect(html).toContain('data-powershow-type="gallery"');
  });

  it("renders nothing when hidden", () => {
    expect(renderGallery(gallery({ hidden: true }))).toBe("");
  });
});
