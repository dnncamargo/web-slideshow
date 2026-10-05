import { describe, expect, it } from "vitest";

import type { Presentation, ShapeElement } from "@web-slideshow/document-schema";

import { createQrCodeGeometry, renderElement, renderShape } from "../src";

const pathGeometry = {
  mode: "path" as const,
  viewBox: { x: 10, y: 20, width: 80, height: 60 },
  commands: [
    { type: "move" as const, x: 10, y: 20 },
    { type: "line" as const, x: 30, y: 40 },
    { type: "quadratic" as const, controlX: 40, controlY: 50, x: 50, y: 60 },
    { type: "cubic" as const, control1X: 60, control1Y: 70, control2X: 70, control2Y: 80, x: 80, y: 90 },
    { type: "arc" as const, radiusX: 10, radiusY: 12, rotationDeg: 15, largeArc: true, sweep: false, x: 10, y: 20 },
    { type: "close" as const },
    { type: "move" as const, x: 25, y: 30 },
    { type: "line" as const, x: 35, y: 40 },
    { type: "close" as const },
  ],
  fillRule: "evenodd" as const,
};

type ShapeOverrides = {
  id?: string;
  hidden?: boolean;
  geometry?: ShapeElement["geometry"];
  layout?: ShapeElement["layout"];
  style?: ShapeElement["style"];
  effect?: ShapeElement["effect"];
  link?: ShapeElement["link"];
  transform?: ShapeElement["transform"];
};

function shape(overrides: ShapeOverrides = {}): ShapeElement {
  return {
    id: overrides.id ?? "shape-1",
    type: "shape",
    hidden: overrides.hidden ?? false,
    geometry: overrides.geometry ?? pathGeometry,
    ...(overrides.layout === undefined ? {} : { layout: overrides.layout }),
    ...(overrides.style === undefined ? {} : { style: overrides.style }),
    ...(overrides.effect === undefined ? {} : { effect: overrides.effect }),
    ...(overrides.link === undefined ? {} : { link: overrides.link }),
    ...(overrides.transform === undefined ? {} : { transform: overrides.transform }),
  };
}

function presentationWithImageFill(url = "https://example.test/shape.png"): Presentation {
  return {
    schemaVersion: 1,
    id: "presentation-shape-image",
    title: "Shape image",
    description: "",
    aspectRatio: "16:9",
    resources: {
      files: [{
        id: "shape-image",
        name: "Shape image",
        kind: "image",
        representation: "binary",
        contentType: "image/png",
        source: { type: "url", url },
      }],
    },
    slides: [{ id: "slide-1", title: "", summary: "", speakerNotes: "", elements: [] }],
  };
}

describe("canonical Shape renderer", () => {
  it("serializes path commands and preserves multiple subpaths", () => {
    const html = renderShape(shape());
    expect(html).toContain("M 10 20 L 30 40 Q 40 50 50 60 C 60 70 70 80 80 90 A 10 12 15 1 0 10 20 Z M 25 30 L 35 40 Z");
    expect(html).toContain('viewBox="10 20 80 60"');
  });

  it("emits evenodd fill and clip rules", () => {
    const html = renderShape(shape({
      style: { fill: { type: "image", src: "/hole.png", fit: "contain" } },
    }));
    expect(html).toContain('fill-rule="evenodd"');
    expect(html).toContain('clip-rule="evenodd"');
  });

  it("generates regular polygons with an upward first vertex", () => {
    const html = renderShape(shape({
      geometry: { mode: "generated", generator: "polygon", config: { points: 4 } },
    }));
    expect(html).toContain("M 50 0 L 100 50 L 50 100 L 0 50 Z");
    expect(html.match(/ L /g)).toHaveLength(3);
  });

  it("generates star polygons and applies clockwise rotation", () => {
    const star = renderShape(shape({
      geometry: { mode: "generated", generator: "polygon", config: { points: 5, innerRadius: 0.4 } },
    }));
    const rotated = renderShape(shape({
      geometry: { mode: "generated", generator: "polygon", config: { points: 4, rotationDeg: 90 } },
    }));
    expect(star).toContain("M 50 0 L 50 30");
    expect(rotated).toContain("M 100 50 L 50 100");
  });

  it("generates centered and shifted triangles", () => {
    expect(renderShape(shape({
      geometry: { mode: "generated", generator: "triangle", config: { apexX: 50 } },
    }))).toContain("M 50 0 L 100 100 L 0 100 Z");
    expect(renderShape(shape({
      geometry: { mode: "generated", generator: "triangle", config: { apexX: 20 } },
    }))).toContain("M 20 0 L 100 100 L 0 100 Z");
  });

  it("renders omitted, color, and palette-backed fills", () => {
    expect(renderShape(shape())).toContain('fill="none"');
    expect(renderShape(shape({ style: { fill: { type: "color", color: "#ff0000" } } }))).toContain('fill="#ff0000"');
    expect(renderShape(shape({ style: { fill: { type: "color", color: { kind: "palette", colorId: "accent" } } } }))).toContain('fill="var(--ps-palette-0061006300630065006e0074)"');
  });

  it("renders linear and radial gradients with ordered stops", () => {
    const linear = renderShape(shape({
      style: { fill: { type: "gradient", gradient: {
        type: "linear", angle: 90,
        stops: [{ color: "#000000", position: 10 }, { color: "#ffffff", position: 80 }],
      } } },
    }));
    const radial = renderShape(shape({
      style: { fill: { type: "gradient", gradient: {
        type: "radial", shape: "circle",
        stops: [{ color: "#111111", position: 0 }, { color: "#eeeeee", position: 100 }],
      } } },
    }));
    expect(linear).toContain('<linearGradient id="presentation-shape-fill-00730068006100700065002d0031" x1="0%" y1="50%" x2="100%" y2="50%">');
    expect(linear).toContain('offset="10%"');
    expect(linear.indexOf('offset="10%"')).toBeLessThan(linear.indexOf('offset="80%"'));
    expect(radial).toContain("<radialGradient");
    expect(radial).toContain('gradientUnits="userSpaceOnUse"');
    expect(radial).toContain('r="30"');
  });

  it.each([
    [0, 'x1="50%" y1="100%" x2="50%" y2="0%"'],
    [90, 'x1="0%" y1="50%" x2="100%" y2="50%"'],
    [180, 'x1="50%" y1="0%" x2="50%" y2="100%"'],
    [270, 'x1="100%" y1="50%" x2="0%" y2="50%"'],
  ] as const)("maps canonical linear gradient angle %d", (angle, expected) => {
    const html = renderShape(shape({
      style: { fill: { type: "gradient", gradient: {
        type: "linear", angle,
        stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 100 }],
      } } },
    }));
    expect(html).toContain(expected);
  });

  it("renders solid, dashed, dotted, gradient, and non-scaling strokes", () => {
    const solid = renderShape(shape({ style: { stroke: { width: 2, color: "#000" } } }));
    const dashed = renderShape(shape({ style: { stroke: { width: 2, style: "dashed", color: "#000" } } }));
    const dotted = renderShape(shape({ style: { stroke: { width: 2, style: "dotted", color: "#000" } } }));
    const gradient = renderShape(shape({ style: { stroke: {
      width: 3, gradient: { type: "linear", stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 100 }] },
    } } }));
    expect(solid).toContain('stroke="#000"');
    expect(dashed).toContain('stroke-dasharray="8 4"');
    expect(dotted).toContain('stroke-dasharray="1 4"');
    expect(gradient).toContain('stroke="url(#presentation-shape-stroke-');
    expect(gradient).toContain('<linearGradient id="presentation-shape-stroke-');
    expect(solid).toContain('vector-effect="non-scaling-stroke"');
  });

  it("keeps layout, margins, opacity, and shadow on the canonical element box", () => {
    const html = renderShape(shape({
      layout: { width: "60%", height: 240, position: "absolute", top: 10, left: 20, margin: 4 },
      effect: { opacity: 0.8, shadow: { x: 0, y: 4, blur: 12, color: "#000" } },
    }));
    const root = html.slice(0, html.indexOf(">"));
    expect(root).toContain("width:60%");
    expect(root).toContain("height:240px");
    expect(root).toContain("position:absolute");
    expect(root).toContain("top:10px");
    expect(root).toContain("left:20px");
    expect(root).toContain("margin:4px");
    expect(root).toContain("opacity:0.8");
    expect(root).toContain("box-shadow:0px 4px 12px #000");
  });

  it("renders authored Shape transform and rounded corners on the root box", () => {
    const html = renderShape(shape({
      transform: { translateXPercent: 12, translateYPercent: -4, rotationDeg: 30 },
      style: { borderRadius: "1rem" },
    }));
    const root = html.slice(0, html.indexOf(">"));
    expect(root).toContain("transform:translate(12%, -4%) rotate(30deg)");
    expect(root).toContain("transform-origin:50% 50%");
    expect(root).toContain("border-radius:1rem");
    expect(root).toContain('data-presentation-authored-transform="translate(12%, -4%) rotate(30deg)"');
  });

  it("renders _self and _blank links on the Shape root", () => {
    const self = renderShape(shape({ link: { kind: "url", href: "https://example.com", target: "_self" } }));
    const blank = renderShape(shape({ link: { kind: "url", href: "https://example.com", target: "_blank" } }));
    expect(self).toMatch(/^<a /);
    expect(self).toContain('target="_self"');
    expect(blank).toContain('target="_blank"');
    expect(blank).toContain('rel="noopener noreferrer"');
    expect(self).toContain('data-presentation-type="shape"');
  });

  it("renders hidden Shapes as empty output", () => {
    expect(renderShape(shape({ hidden: true }))).toBe("");
  });

  it("renders a Shape nested inside a Container and contains absolute Shapes", () => {
    const html = renderElement({
      type: "container",
      id: "container-1",
      hidden: false,
      children: [shape({ layout: { position: "absolute", left: 8, top: 12 } })],
    });
    expect(html).toContain('data-presentation-type="shape"');
    expect(html).toContain("position:relative");
    expect(html).toContain("position:absolute");
  });

  it.each(["contain", "cover", "fill"] as const)("renders image fill fit %s and focal point", (fit) => {
    const html = renderShape(shape({
      style: { fill: { type: "image", src: "/assets/fill.png", fit, focalPoint: { x: 25, y: 75 } } },
    }));
    expect(html).toContain('clipPath');
    expect(html).toContain('class="presentation-image-media"');
    expect(html).toContain(`object-fit:${fit}`);
    expect(html).toContain("object-position:25% 75%");
  });

  it("resolves raster Presentation Files through the shared renderer path", () => {
    const html = renderElement(shape({
      style: { fill: { type: "image", fileResourceId: "shape-image", fit: "cover", focalPoint: { x: 25, y: 75 }, crop: { x: 10, y: 20, width: 70, height: 60 } } },
    }), { presentation: presentationWithImageFill() });

    expect(html).toContain('src="https://example.test/shape.png"');
    expect(html).toContain('data-presentation-image-fit="cover"');
    expect(html).toContain('data-presentation-image-focal-x="25"');
    expect(html).toContain('data-presentation-image-focal-y="75"');
    expect(html).toContain("data-presentation-image-crop=");
  });

  it("omits unresolved Shape image media while preserving the Shape root and geometry", () => {
    const html = renderElement(shape({
      style: { fill: { type: "image", fileResourceId: "missing-image", fit: "contain" }, stroke: { width: 2, color: "#123456" } },
    }), { presentation: presentationWithImageFill() });

    expect(html).toContain('data-presentation-type="shape"');
    expect(html).toContain('d="M 10 20');
    expect(html).toContain('stroke="#123456"');
    expect(html).not.toContain("<img");
    expect(html).not.toContain('src=""');
  });

  it("clips image fills with the same geometry and emits existing crop hydration metadata", () => {
    const html = renderShape(shape({
      geometry: { mode: "generated", generator: "triangle", config: { apexX: 50 } },
      style: { fill: { type: "image", src: "/assets/crop.png", fit: "cover", crop: { x: 10, y: 20, width: 70, height: 60 } } },
    }));
    expect(html).toContain('clip-path="url(#presentation-shape-clip-');
    expect(html).toContain("data-presentation-image-crop=");
    expect(html).toContain('class="presentation-shape-image-crop"');
    expect(html).toContain('class="presentation-image-crop-viewport"');
    expect(html.match(/M 50 0 L 100 100 L 0 100 Z/g)).toHaveLength(2);
    expect(html).toContain('data-presentation-image-width-authored="true"');
    expect(html).toContain('data-presentation-image-height-authored="true"');
  });

  it("renders QR modules as vector SVG geometry with a quiet-zone background", () => {
    const element = shape({
      geometry: { mode: "generated", generator: "qr-code", config: { value: "hello", errorCorrection: "M", quietZone: 4 } },
    });
    const first = renderShape(element);
    expect(first).toContain('viewBox="0 0 29 29"');
    expect(first).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(first).toContain('fill="#ffffff"');
    expect(first).toContain("<path");
    expect(first).not.toContain("presentation-placeholder-shape-qr");
    expect(first).not.toContain("[qr-code]");
    expect(first).toContain('stroke="none"');
    expect(first).not.toContain('fill="none" stroke=');
    expect(first).toBe(renderShape(element));
  });

  it("renders QR border as one outer frame with color, styles, and radius", () => {
    const html = renderShape(shape({
      geometry: { mode: "generated", generator: "qr-code", config: { value: "hello", errorCorrection: "M", quietZone: 4 } },
      style: { stroke: { width: 2, color: "#ff0000", style: "dashed" }, borderRadius: 3 },
    }));
    expect(html).toContain('<path');
    expect(html).toContain('stroke="none"');
    expect(html).toContain('fill="none" stroke-width="2px"');
    expect(html).toContain('stroke="#ff0000"');
    expect(html).toContain('stroke-dasharray="8 4"');
    expect(html).toContain('rx="3px" ry="3px"');
    expect(html.match(/rx="3px" ry="3px"/g)).toHaveLength(2);
    expect(html).toContain('x="0" y="0" width="29" height="29"');
    expect(html).toContain('overflow="visible"');
  });

  it("renders QR gradient and dotted borders on the outer frame only", () => {
    const html = renderShape(shape({
      geometry: { mode: "generated", generator: "qr-code", config: { value: "hello", errorCorrection: "M", quietZone: 4 } },
      style: { stroke: {
        width: "0.2rem", style: "dotted", gradient: {
          type: "linear", stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 100 }],
        },
      }, borderRadius: "0.5rem" },
    }));
    expect(html).toContain('stroke="none"');
    expect(html).toContain('stroke="url(#presentation-shape-stroke-');
    expect(html).toContain('stroke-dasharray="1 4"');
    expect(html).toContain('stroke-linecap="round"');
    expect(html).toContain('rx="0.5rem" ry="0.5rem"');
    expect(html.match(/rx="0.5rem" ry="0.5rem"/g)).toHaveLength(2);
    expect(html.match(/stroke="url\(#presentation-shape-stroke-/g)).toHaveLength(1);
  });

  it("keeps ordinary Shape strokes on the geometry path", () => {
    const html = renderShape(shape({ style: { stroke: { width: 2, color: "#000" } } }));
    expect(html).toContain('<path d="M 10 20');
    expect(html).toContain('stroke="#000"');
    expect(html).not.toContain('fill="none" stroke-width="2px"');
  });

  it("changes QR geometry when content changes", () => {
    const base = { mode: "generated" as const, generator: "qr-code" as const, config: { value: "hello", errorCorrection: "M" as const, quietZone: 4 } };
    expect(renderShape(shape({ geometry: base }))).not.toBe(renderShape(shape({ geometry: { ...base, config: { ...base.config, value: "goodbye" } } })));
  });

  it.each(["L", "M", "Q", "H"] as const)("accepts error correction %s", (errorCorrection) => {
    const geometry = createQrCodeGeometry({ value: "hello", errorCorrection, quietZone: 4 });
    expect(geometry.size).toBeGreaterThan(0);
    expect(geometry.modules).toHaveLength(geometry.size);
  });

  it("honors quiet zone zero and keeps the QR viewBox square", () => {
    const html = renderShape(shape({
      geometry: { mode: "generated", generator: "qr-code", config: { value: "hello", errorCorrection: "M", quietZone: 0 } },
    }));
    expect(html).toContain('viewBox="0 0 21 21"');
    expect(html).toContain('preserveAspectRatio="xMidYMid meet"');
  });

  it("uses normal Shape fill and preserves QR links, layout, and effects", () => {
    const html = renderShape(shape({
      geometry: { mode: "generated", generator: "qr-code", config: { value: "hello", errorCorrection: "M", quietZone: 4 } },
      style: { fill: { type: "color", color: { kind: "palette", colorId: "accent" } } },
      layout: { width: 200, height: 200, position: "absolute", left: 8, top: 12 },
      effect: { opacity: 0.5 },
      link: { kind: "url", href: "https://example.com", target: "_blank" },
    }));
    expect(html).toContain('fill="var(--ps-palette-0061006300630065006e0074)"');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("width:200px;height:200px;position:absolute");
    expect(html).toContain("opacity:0.5");
  });

  it("renders hidden QR Shapes as empty output", () => {
    expect(renderShape(shape({
      hidden: true,
      geometry: { mode: "generated", generator: "qr-code", config: { value: "hello", errorCorrection: "M", quietZone: 4 } },
    }))).toBe("");
  });

  it("is deterministic for the same input", () => {
    const element = shape({
      id: "shape unsafe id",
      style: { fill: { type: "gradient", gradient: {
        type: "linear", angle: 45,
        stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 100 }],
      } } },
    });
    expect(renderShape(element)).toBe(renderShape(element));
    expect(renderShape(element)).not.toContain("Math.random");
  });
});
