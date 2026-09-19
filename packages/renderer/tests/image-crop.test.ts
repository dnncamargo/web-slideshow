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
    expect(html).toContain('data-presentation-id="image-crop"');
    expect(html).toContain('data-presentation-type="image"');
    expect(html).toContain('data-presentation-image-crop="{&quot;x&quot;:10,&quot;y&quot;:20,&quot;width&quot;:60,&quot;height&quot;:50}"');
    expect(html).toContain("width:600px");
    expect(html).toContain("height:400px");
    expect(html).toContain("opacity:0.8");
    expect(html).toContain('class="presentation-image-crop-viewport"');
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
    expect(html.indexOf('data-presentation-image-crop')).toBeLessThan(html.indexOf('class="presentation-image-crop-viewport"'));
    expect(html).toContain("hero");
    expect(html).toContain("border-radius:12px");
    expect(html).toContain("data-presentation-image-fit=\"cover\"");
    expect(html).toContain("data-presentation-image-focal-x=\"25\"");
  });

  it("keeps cropped linked appearance on the outer box and media neutral", () => {
    const html = renderElement(image({
      link: { kind: "url", href: "https://example.com" },
      style: {
        border: { width: 2, style: "solid", color: "#fff" },
        borderRadius: 16,
      },
      effect: {
        opacity: 0.8,
        shadow: { x: 0, y: 4, blur: 12, color: "#000" },
      },
    }));
    const mediaStart = html.indexOf("<img");
    const media = html.slice(mediaStart, html.indexOf(">", mediaStart));
    const outer = html.slice(0, mediaStart);

    expect(outer).toContain("border-width:2px");
    expect(outer).toContain("border-radius:16px");
    expect(outer).toContain("opacity:0.8");
    expect(outer).toContain("box-shadow:0px 4px 12px #000");
    expect(media).toContain("display:block");
    expect(media).toContain("position:absolute");
    expect(media).toContain("max-width:none");
    expect(media).not.toContain("object-fit");
    expect(media).not.toContain("object-position");
    expect(media).not.toContain("border-radius");
    expect(media).not.toContain("width:100%");
    expect(media).not.toContain("height:100%");
  });

  it("uses the same neutral crop media style for an unlinked Image", () => {
    const html = renderElement(image({
      layout: { width: 400, height: 300 },
      style: { borderRadius: 16 },
      fit: "cover",
      focalPoint: { x: 25, y: 75 },
    }));
    const mediaStart = html.indexOf("<img");
    const media = html.slice(mediaStart, html.indexOf(">", mediaStart));

    expect(media).toContain("display:block");
    expect(media).not.toContain("object-fit");
    expect(media).not.toContain("object-position");
    expect(media).not.toContain("border-radius");
    expect(media).not.toContain("width:100%");
    expect(media).not.toContain("height:100%");
  });

  it("preserves non-crop linked media styling", () => {
    const html = renderElement(image({
      crop: undefined,
      link: { kind: "url", href: "https://example.com" },
      layout: { width: 400, height: 300 },
      style: { borderRadius: 16 },
      fit: "cover",
      focalPoint: { x: 25, y: 75 },
    }));
    const mediaStart = html.indexOf("<img");
    const media = html.slice(mediaStart, html.indexOf(">", mediaStart));

    expect(media).toContain("object-fit:cover");
    expect(media).toContain("object-position:25% 75%");
    expect(media).toContain("width:100%");
    expect(media).toContain("height:100%");
    expect(media).toContain("border-radius:16px");
  });

  it("leaves an uncropped Image on its existing single-img path", () => {
    const html = renderElement(image({ crop: undefined }));
    expect(html).toMatch(/^<img /);
    expect(html).not.toContain("presentation-image-crop-viewport");
    expect(html).not.toContain("data-presentation-image-crop");
  });
});

describe("Image background", () => {
  const background = {
    color: { kind: "palette" as const, colorId: "surface" },
    gradient: {
      type: "radial" as const,
      stops: [
        { color: "#000000", position: 0 },
        { color: "#ffffff", position: 100 },
      ],
    },
  };

  it.each([
    ["normal", image({ crop: undefined, style: { background } })],
    ["crop", image({ style: { background } })],
    ["link", image({ crop: undefined, link: { kind: "url", href: "https://example.com" }, style: { background } })],
  ] as const)("emits Background on the %s Image root without a wrapper", (_kind, element) => {
    const html = renderElement(element);
    const root = html.slice(0, html.indexOf(">") + 1);
    expect(root).toContain("background:var(--ps-palette-0073007500720066006100630065)");
    expect(root).toContain("background-image:radial-gradient(ellipse,#000000 0%,#ffffff 100%)");
    expect(html.match(/presentation-image-crop-viewport/g)?.length ?? 0).toBe(element.crop ? 1 : 0);
  });

  it("does not emit background styles when Background is absent", () => {
    const html = renderElement(image({ crop: undefined }));
    expect(html).not.toContain("background:");
    expect(html).not.toContain("background-image:");
  });

  it("emits a literal color-only Background on the normal Image root", () => {
    const html = renderElement(image({ crop: undefined, style: { background: { color: "#123456" } } }));
    const root = html.slice(0, html.indexOf(">") + 1);
    expect(root).toContain("background:#123456");
    expect(root).not.toContain("background-image:");
  });
});

describe("Image gradient borders", () => {
  const gradient = {
    type: "linear" as const,
    angle: 90,
    stops: [
      { color: "#7c3aed", position: 0 },
      { color: "#06b6d4", position: 100 },
    ],
  };

  it("wraps an uncropped Image so the frame owns the gradient ring", () => {
    const html = renderElement(image({
      crop: undefined,
      style: { border: { width: 3, style: "dotted", gradient }, borderRadius: 16 },
      effect: { opacity: 0.8, shadow: { x: 0, y: 4, blur: 12, color: "#000" } },
      layout: { width: 400, height: 300 },
    }));

    expect(html).toMatch(/^<div /);
    expect(html).toContain('data-presentation-id="image-crop"');
    expect(html).toContain('data-presentation-type="image"');
    expect(html).toContain("presentation-gradient-border");
    expect(html).toContain("presentation-image-gradient-frame");
    expect(html).toContain("border-width:3px");
    expect(html).toContain("border-style:solid");
    expect(html).toContain("border-color:transparent");
    expect(html).toContain("--presentation-gradient-border-width:3px");
    expect(html).toContain("--presentation-gradient-border-paint:linear-gradient(90deg,#7c3aed 0%,#06b6d4 100%)");
    expect(html).toContain("border-radius:16px");
    expect(html).toContain("width:400px");
    expect(html).toContain("height:300px");
    expect(html).toContain("max-width:100%");
    expect(html).toContain("max-height:100%");
    expect(html).toContain("opacity:0.8");
    expect(html).toContain("box-shadow:0px 4px 12px #000");
    expect(html).not.toContain("border-image:");
    expect(html).toContain('class="presentation-image-media"');
  });

  it.each([
    ["intrinsic", {}, false, false],
    ["width-only", { width: 400 }, true, false],
    ["height-only", { height: 300 }, false, true],
    ["width-and-height", { width: 400, height: 300 }, true, true],
  ] as const)("preserves %s normal gradient Image sizing", (_name, dimensions, fillsWidth, fillsHeight) => {
    const html = renderElement(image({
      crop: undefined,
      layout: dimensions,
      style: { border: { width: 2, style: "dashed", gradient } },
    }));
    const mediaStart = html.indexOf("<img");
    const root = html.slice(0, html.indexOf(">"));
    const media = html.slice(mediaStart, html.indexOf(">", mediaStart));

    expect(root).toContain("presentation-image-gradient-frame");
    expect(media).toContain("max-width:100%");
    expect(media).toContain("max-height:100%");
    expect(media).toContain(fillsWidth ? "width:100%" : "object-fit:contain");
    expect(media).toContain(fillsHeight ? "height:100%" : "object-position:50% 50%");
    if (!fillsWidth) expect(media).not.toMatch(/(?:^|;)width:100%(?:;|$)/);
    if (!fillsHeight) expect(media).not.toMatch(/(?:^|;)height:100%(?:;|$)/);
  });

  it("reuses the crop box as the gradient owner", () => {
    const html = renderElement(image({
      crop,
      style: { border: { width: 2, style: "dashed", gradient }, borderRadius: 12 },
    }));
    const root = html.slice(0, html.indexOf(">"));

    expect(root).toContain("presentation-gradient-border");
    expect(root).toContain("border-width:2px");
    expect(root).toContain("border-style:solid");
    expect(root).toContain("border-color:transparent");
    expect(root).toContain("--presentation-gradient-border-width:2px");
    expect(root).toContain("border-radius:12px");
    expect(html).toContain("presentation-image-crop-viewport");
    expect(html).not.toContain("border-image:");
  });

  it("keeps a linked cropped gradient owner on the existing anchor", () => {
    const html = renderElement(image({
      crop,
      link: { kind: "url", href: "https://example.com/crop" },
      style: { border: { width: 2, style: "solid", gradient }, borderRadius: 12 },
    }));
    const root = html.slice(0, html.indexOf(">"));

    expect(html).toMatch(/^<a /);
    expect(root).toContain("presentation-gradient-border");
    expect(root).toContain("border-width:2px");
    expect(root).toContain("border-style:solid");
    expect(root).toContain("border-color:transparent");
    expect(root).toContain('href="https://example.com/crop"');
    expect(html).toContain("presentation-image-crop-viewport");
    expect(html).not.toContain("border-image:");
  });

  it("keeps solid Image borders on the existing native path", () => {
    const html = renderElement(image({
      crop: undefined,
      style: { border: { width: 2, style: "dashed", color: "#fff" }, borderRadius: 12 },
    }));

    expect(html).toMatch(/^<img /);
    expect(html).toContain("border-width:2px");
    expect(html).toContain("border-style:dashed");
    expect(html).toContain("border-color:#fff");
    expect(html).not.toContain("presentation-gradient-border");
  });

  it("keeps Background declarations independent from the gradient ring", () => {
    const html = renderElement(image({
      style: {
        background: {
          color: "#101218",
          gradient: { type: "radial", stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 100 }] },
        },
        border: { width: 2, style: "solid", gradient },
      },
    }));

    expect(html).toContain("background:#101218");
    expect(html).toContain("background-image:radial-gradient(ellipse,#000 0%,#fff 100%)");
    expect(html).toContain("--presentation-gradient-border-paint:");
    const mediaStart = html.indexOf("<img");
    const media = html.slice(mediaStart, html.indexOf(">", mediaStart));
    expect(media).not.toContain("background:");
    expect(media).not.toContain("opacity:");
    expect(media).not.toContain("box-shadow:");
    expect(media).not.toContain("border-width:");
    expect(html).not.toContain("border-image:");
  });
});
