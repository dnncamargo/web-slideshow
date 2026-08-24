import { describe, expect, it } from "vitest";

import { renderElement } from "../src/render-element";
import {
  resolveCroppedImageBoxSize,
  resolveImageCropGeometry,
} from "../src/image-crop";

const crop = { x: 10, y: 20, width: 60, height: 50 } as const;
const image = (overrides: Record<string, unknown> = {}) => ({
  id: "image-crop",
  type: "image" as const,
  hidden: false,
  src: "/image.png",
  alt: "Image",
  fit: "contain" as const,
  crop,
  ...overrides,
});

describe("Image crop geometry", () => {
  it.each([
    [{ widthAuthored: true, heightAuthored: true, renderedWidth: 400, renderedHeight: 300 }, { width: 400, height: 300 }],
    [{ widthAuthored: true, heightAuthored: false, renderedWidth: 400 }, { width: 400, height: 222.222222 }],
    [{ widthAuthored: false, heightAuthored: true, renderedHeight: 300 }, { width: 540, height: 300 }],
    [{ widthAuthored: false, heightAuthored: false }, { width: 720, height: 400 }],
    [{ widthAuthored: false, heightAuthored: false, availableWidth: 360 }, { width: 360, height: 200 }],
    [{ widthAuthored: false, heightAuthored: false, availableHeight: 200 }, { width: 360, height: 200 }],
    [{ widthAuthored: false, heightAuthored: false, availableWidth: 500, availableHeight: 250 }, { width: 450, height: 250 }],
  ] as const)("resolves authored and parent-constrained box sizes", (input, expected) => {
    const size = resolveCroppedImageBoxSize({
      naturalCropWidth: 720,
      naturalCropHeight: 400,
      ...input,
    });
    expect(size).toEqual({
      width: expect.closeTo(expected.width, 5),
      height: expect.closeTo(expected.height, 5),
    });
    expect(size === null || Object.values(size).every(Number.isFinite)).toBe(true);
  });

  it("resolves contain uniformly and positions the effective crop by focal point", () => {
    const geometry = resolveImageCropGeometry({
      sourceWidth: 1200,
      sourceHeight: 800,
      boxWidth: 600,
      boxHeight: 400,
      crop,
      fit: "contain",
      focalPoint: { x: 0, y: 100 },
    });

    expect(geometry.cropSourceX).toBe(120);
    expect(geometry.cropSourceY).toBe(160);
    expect(geometry.cropSourceWidth).toBe(720);
    expect(geometry.cropSourceHeight).toBe(400);
    expect(geometry.viewportWidth).toBe(600);
    expect(geometry.viewportHeight).toBeCloseTo(333.333333);
    expect(geometry.viewportLeft).toBe(0);
    expect(geometry.viewportTop).toBeCloseTo(66.666666);
    expect(geometry.fullMediaLeft).toBe(-100);
  });

  it("resolves cover uniformly and leaves the viewport larger than the box", () => {
    const geometry = resolveImageCropGeometry({
      sourceWidth: 1200,
      sourceHeight: 800,
      boxWidth: 600,
      boxHeight: 400,
      crop,
      fit: "cover",
      focalPoint: { x: 100, y: 0 },
    });

    expect(geometry.viewportWidth).toBe(720);
    expect(geometry.viewportHeight).toBe(400);
    expect(geometry.viewportLeft).toBe(-120);
    expect(geometry.viewportTop).toBeCloseTo(0);
    expect(geometry.fullMediaWidth).toBe(1200);
    expect(geometry.fullMediaHeight).toBe(800);
  });

  it("resolves fill with independent axis scales and defaults focal point to center", () => {
    const geometry = resolveImageCropGeometry({
      sourceWidth: 1200,
      sourceHeight: 800,
      boxWidth: 600,
      boxHeight: 400,
      crop,
      fit: "fill",
    });

    expect(geometry.viewportWidth).toBe(600);
    expect(geometry.viewportHeight).toBe(400);
    expect(geometry.viewportLeft).toBe(0);
    expect(geometry.viewportTop).toBe(0);
    expect(geometry.fullMediaWidth).toBe(1000);
    expect(geometry.fullMediaHeight).toBe(800);
    expect(Object.values(geometry).every(Number.isFinite)).toBe(true);
  });

  it.each([
    [{ x: 0, y: 0 }, 0, 0],
    [{ x: 50, y: 50 }, 0, 0],
    [{ x: 100, y: 100 }, 0, 0],
  ] as const)("accepts focal point %o without invalid geometry", (focalPoint, left, top) => {
    const geometry = resolveImageCropGeometry({
      sourceWidth: 400,
      sourceHeight: 300,
      boxWidth: 200,
      boxHeight: 100,
      crop,
      fit: "fill",
      focalPoint,
    });
    expect(geometry.viewportLeft).toBe(left);
    expect(geometry.viewportTop).toBe(top);
  });
});

describe("cropped Image DOM", () => {
  it.each([
    ["unlinked", image({ layout: { position: "absolute", top: 20, left: 30, width: 400, height: 300 } })],
    ["linked", image({ layout: { position: "absolute", top: 20, left: 30, width: 400, height: 300 }, link: { kind: "url", href: "https://example.com" } })],
  ] as const)("preserves absolute positioning on the %s crop box", (_kind, element) => {
    const html = renderElement(element);
    const style = html.slice(0, html.indexOf(">"));
    expect(style).toContain("position:absolute");
    expect(style).toContain("top:20px");
    expect(style).toContain("left:30px");
    expect(style).not.toContain("position:relative");
  });

  it("gives a flow crop a renderer-owned containing block", () => {
    const html = renderElement(image());
    expect(html.slice(0, html.indexOf(">"))).toContain("position:relative");
  });

  it("keeps the canonical box on the outer unlinked node", () => {
    const html = renderElement(image({ layout: { width: 600, height: 400 }, effect: { opacity: 0.8 } }));
    expect(html).toMatch(/^<div /);
    expect(html).toContain('data-powershow-id="image-crop"');
    expect(html).toContain('data-powershow-type="image"');
    expect(html).toContain('data-powershow-image-crop="{&quot;x&quot;:10,&quot;y&quot;:20,&quot;width&quot;:60,&quot;height&quot;:50}"');
    expect(html).toContain("width:600px");
    expect(html).toContain("height:400px");
    expect(html).toContain("opacity:0.8");
    expect(html).toContain('class="powershow-image-crop-viewport"');
    expect(html).toContain('src="/image.png"');
    expect(html).toContain('alt="Image"');
    expect(html).not.toContain("layout.overflow");
  });

  it("keeps a linked cropped Image anchored at the outer box", () => {
    const html = renderElement(image({
      link: { kind: "url", href: "https://example.com", target: "_blank" },
      style: { className: "hero", borderRadius: 12 },
      fit: "cover",
      focalPoint: { x: 25, y: 75 },
    }));
    expect(html).toMatch(/^<a /);
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html.indexOf('data-powershow-image-crop')).toBeLessThan(html.indexOf('class="powershow-image-crop-viewport"'));
    expect(html).toContain("hero");
    expect(html).toContain("border-radius:12px");
    expect(html).toContain("data-powershow-image-fit=\"cover\"");
    expect(html).toContain("data-powershow-image-focal-x=\"25\"");
  });

  it("leaves an uncropped Image on its existing single-img path", () => {
    const html = renderElement(image({ crop: undefined }));
    expect(html).toMatch(/^<img /);
    expect(html).not.toContain("powershow-image-crop-viewport");
    expect(html).not.toContain("data-powershow-image-crop");
  });
});
