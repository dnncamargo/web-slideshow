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

  it("keeps an unsized Gallery measurable through its active item", () => {
    const html = renderGallery(gallery());
    const firstStart = html.indexOf('data-powershow-gallery-index="0"');
    const secondStart = html.indexOf('data-powershow-gallery-index="1"');
    const first = html.slice(firstStart, secondStart);
    const second = html.slice(secondStart);
    expect(first).toContain("position:relative");
    expect(first).toContain("height:auto");
    expect(second).toContain("position:absolute");
    expect(second).toContain("inset:0");
    expect(second).toContain('aria-hidden="true"');
  });

  it("fills an authored Gallery height with every stacked item", () => {
    const html = renderGallery(gallery({ layout: { height: 400 } }));
    const firstStart = html.indexOf('data-powershow-gallery-index="0"');
    const secondStart = html.indexOf('data-powershow-gallery-index="1"');
    expect(html).toContain("height:400px");
    expect(html.slice(firstStart, secondStart)).toContain("position:absolute");
    expect(html.slice(secondStart)).toContain("position:absolute");
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
    expect(html).toContain('class="powershow-image-crop-viewport" style="position:absolute"');
    expect(html).toContain("powershow-image-media");
  });

  it("marks an unsized active crop as width-constrained and height-sizing", () => {
    const html = renderGallery(gallery({
      items: [{ src: "/photo.png", alt: "Photo", crop: { x: 10, y: 20, width: 60, height: 50 } }],
    }));
    const start = html.indexOf('data-powershow-gallery-index="0"');
    const item = html.slice(start, html.indexOf(">", start));
    expect(item).toContain('data-powershow-image-width-authored="true"');
    expect(item).toContain('data-powershow-image-height-authored="false"');
    expect(item).toContain("position:relative");
  });

  it("constrains cropped overlay items to the existing Gallery frame", () => {
    const html = renderGallery(gallery({
      items: [
        { src: "/first.png", alt: "First" },
        { src: "/second.png", alt: "Second", crop: { x: 10, y: 20, width: 60, height: 50 } },
      ],
    }));
    const start = html.indexOf('data-powershow-gallery-index="1"');
    const item = html.slice(start, html.indexOf(">", start));
    expect(item).toContain('data-powershow-image-width-authored="true"');
    expect(item).toContain('data-powershow-image-height-authored="true"');
    expect(item).toContain("position:absolute");
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
