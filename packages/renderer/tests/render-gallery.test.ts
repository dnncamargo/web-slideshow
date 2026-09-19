import { describe, expect, it } from "vitest";

import type { GalleryElement } from "@web-slideshow/document-schema";

import { renderElement } from "../src/render-element";
import { renderGallery } from "../src/render-gallery";
import { renderCanonicalSurfaceStyle } from "../src/render-canonical-surface";

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

const gradient = {
  type: "linear" as const,
  stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 100 }],
};

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

  it("uses a fixed root frame and an inner surface for gradient borders", () => {
    const html = renderGallery(gallery({
      layout: { width: 600, height: 400, position: "absolute", top: 12, margin: 8 },
      style: {
        className: "gallery-class",
        background: { color: "#101218" },
        border: { width: 3, style: "dashed", gradient },
        borderRadius: 16,
      },
      effect: { opacity: 0.8, shadow: { x: 0, y: 4, blur: 12, color: "#000" } },
    }));

    const surfaceStart = html.indexOf('class="presentation-gallery-gradient-surface');
    const root = html.slice(0, surfaceStart);
    const surface = html.slice(surfaceStart);

    expect(root).toContain("powershow-gallery presentation-gallery-gradient-frame presentation-gradient-border gallery-class");
    expect(root).toContain('data-powershow-id="gallery-1"');
    expect(root).toContain('data-powershow-type="gallery"');
    expect(root).toContain("width:600px");
    expect(root).toContain("height:400px");
    expect(root).toContain("position:absolute");
    expect(root).toContain("top:12px");
    expect(root).toContain("margin:8px");
    expect(root).toContain("background:#101218");
    expect(root).toContain("border-radius:16px");
    expect(root).toContain("box-shadow");
    expect(root).toContain("border:0");
    expect(root).toContain("--presentation-gradient-border-width:3px");
    expect(root).toContain("--presentation-gradient-border-paint:linear-gradient(180deg,#000 0%,#fff 100%)");
    expect(root).not.toContain("border-image:");
    expect(surface).toContain("presentation-gallery-gradient-surface-constrained");
    expect(surface).toContain('data-powershow-gallery-index="0"');
  });

  it("keeps intrinsic gradient Galleries unconstrained and preserves crop metadata", () => {
    const html = renderGallery(gallery({
      fit: "cover",
      style: { border: { width: 2, gradient }, borderRadius: 10 },
      items: [{
        src: "/photo.png",
        alt: "Photo",
        focalPoint: { x: 25, y: 75 },
        crop: { x: 10, y: 20, width: 60, height: 50 },
      }, { src: "/second.png", alt: "Second" }],
    }));

    const surfaceStart = html.indexOf('class="presentation-gallery-gradient-surface');
    const surface = html.slice(surfaceStart);
    const first = surface.slice(surface.indexOf('data-powershow-gallery-index="0"'), surface.indexOf('data-powershow-gallery-index="1"'));

    expect(surface).not.toContain("presentation-gallery-gradient-surface-constrained");
    expect(first).toContain("position:relative");
    expect(first).toContain("width:100%");
    expect(first).toContain("height:auto");
    expect(first).toContain('data-powershow-image-height-authored="false"');
    expect(first).toContain('data-powershow-image-focal-x="25"');
    expect(first).toContain('data-powershow-image-focal-y="75"');
    expect(first).toContain("powershow-image-crop-viewport");
  });

  it("preserves constrained crop metadata inside a fixed gradient Gallery surface", () => {
    const html = renderGallery(gallery({
      layout: { width: 600, height: 400 },
      style: { border: { width: 2, gradient } },
      items: [{
        src: "/photo.png",
        alt: "Photo",
        fit: "cover",
        focalPoint: { x: 10, y: 90 },
        crop: { x: 10, y: 20, width: 60, height: 50 },
      }],
    }));

    expect(html).toContain("presentation-gallery-gradient-surface-constrained");
    expect(html).toContain('data-powershow-image-width-authored="true"');
    expect(html).toContain('data-powershow-image-height-authored="true"');
    expect(html).toContain('data-powershow-image-fit="cover"');
    expect(html).toContain('data-powershow-image-focal-x="10"');
    expect(html).toContain('data-powershow-image-focal-y="90"');
  });

  it("keeps solid Gallery borders and direct item children unchanged", () => {
    const html = renderGallery(gallery({
      style: { border: { width: 2, style: "dashed", color: "#fff" } },
    }));

    expect(html).not.toContain("presentation-gallery-gradient-frame");
    expect(html).not.toContain("presentation-gallery-gradient-surface");
    expect(html).not.toContain("presentation-gradient-border");
    expect(html).toContain("border-width:2px");
    expect(html).toContain("border-style:dashed");
    expect(html).toContain("border-color:#fff");
    expect(html.indexOf('data-powershow-gallery-index="0"')).toBeGreaterThan(html.indexOf(">"));
  });

  it("keeps canonical surface border inclusion defaulted and opt-out narrow", () => {
    const element = gallery({
      layout: { width: 300 },
      style: { background: { color: "#101218" }, border: { width: 2, style: "solid", color: "#fff" }, borderRadius: 8 },
      effect: { opacity: 0.75 },
    });

    const defaultStyle = renderCanonicalSurfaceStyle(element);
    const withoutBorder = renderCanonicalSurfaceStyle(element, { includeBorder: false });

    expect(defaultStyle).toContain("border-width:2px");
    expect(defaultStyle).toContain("border-style:solid");
    expect(defaultStyle).toContain("border-color:#fff");
    expect(withoutBorder).not.toContain("border:");
    expect(withoutBorder).toContain("width:300px");
    expect(withoutBorder).toContain("background:#101218");
    expect(withoutBorder).toContain("border-radius:8px");
    expect(withoutBorder).toContain("opacity:0.75");
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
