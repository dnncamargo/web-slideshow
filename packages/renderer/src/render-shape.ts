import type {
  Border,
  ElementLink,
  Gradient,
  ShapeElement,
  ShapeGeometry,
  ShapeViewBox,
  ShapePathCommand,
} from "@web-slideshow/document-schema";

import { escapeHtml } from "./escape-html";
import { createQrCodeGeometry } from "./qr-code-geometry";
import { renderImageCropMetadata } from "./render-canonical-image";
import { renderColorValue } from "./render-palette";
import { renderLength } from "./render-length";
import { renderShadow } from "./render-visual";

const DEFAULT_INTRINSIC_SIZE = 100;
const SVG_CENTER = 50;
const SVG_RADIUS = 50;
const AUTHORED_LINK_APPEARANCE = "color:inherit;text-decoration:inherit";

type RenderedGeometry = {
  viewBox: ShapeViewBox;
  path: string;
  fillRule: "nonzero" | "evenodd";
  preserveAspectRatio?: "none" | "xMidYMid meet";
  background?: "light";
  frame?: ShapeViewBox;
};

function number(value: number): string {
  if (Math.abs(value) < 1e-12) return "0";
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 1e-12) return String(rounded);
  return String(value);
}

function pathCommand(command: ShapePathCommand): string {
  switch (command.type) {
    case "move":
      return `M ${number(command.x)} ${number(command.y)}`;
    case "line":
      return `L ${number(command.x)} ${number(command.y)}`;
    case "quadratic":
      return `Q ${number(command.controlX)} ${number(command.controlY)} ${number(command.x)} ${number(command.y)}`;
    case "cubic":
      return `C ${number(command.control1X)} ${number(command.control1Y)} ${number(command.control2X)} ${number(command.control2Y)} ${number(command.x)} ${number(command.y)}`;
    case "arc":
      return `A ${number(command.radiusX)} ${number(command.radiusY)} ${number(command.rotationDeg)} ${command.largeArc ? 1 : 0} ${command.sweep ? 1 : 0} ${number(command.x)} ${number(command.y)}`;
    case "close":
      return "Z";
  }
}

function renderPathGeometry(
  geometry: Extract<ShapeGeometry, { mode: "path" }>,
): RenderedGeometry {
  return {
    viewBox: geometry.viewBox,
    path: geometry.commands.map(pathCommand).join(" "),
    fillRule: geometry.fillRule ?? "nonzero",
  };
}

function polygonVertex(
  radius: number,
  index: number,
  count: number,
  rotationDeg: number,
): string {
  const angle = (-90 + rotationDeg + (index * 360) / count) * Math.PI / 180;
  const x = SVG_CENTER + radius * Math.cos(angle);
  const y = SVG_CENTER + radius * Math.sin(angle);
  return `${number(x)} ${number(y)}`;
}

function renderPolygonGeometry(
  geometry: Extract<ShapeGeometry, { mode: "generated"; generator: "polygon" }>,
): RenderedGeometry {
  const { points, innerRadius, rotationDeg = 0 } = geometry.config;
  const vertices = innerRadius === undefined || innerRadius === 1
    ? Array.from({ length: points }, (_, index) =>
        polygonVertex(SVG_RADIUS, index, points, rotationDeg))
    : Array.from({ length: points * 2 }, (_, index) =>
        polygonVertex(
          index % 2 === 0 ? SVG_RADIUS : SVG_RADIUS * innerRadius,
          Math.floor(index / 2),
          points,
          rotationDeg,
        ));

  return {
    viewBox: { x: 0, y: 0, width: 100, height: 100 },
    path: `M ${vertices.join(" L ")} Z`,
    fillRule: "nonzero",
  };
}

function renderTriangleGeometry(
  geometry: Extract<ShapeGeometry, { mode: "generated"; generator: "triangle" }>,
): RenderedGeometry {
  const { apexX } = geometry.config;
  return {
    viewBox: { x: 0, y: 0, width: 100, height: 100 },
    path: `M ${number(apexX)} 0 L 100 100 L 0 100 Z`,
    fillRule: "nonzero",
  };
}

function renderQrCodeGeometry(
  geometry: Extract<ShapeGeometry, { mode: "generated"; generator: "qr-code" }>,
): RenderedGeometry {
  const qr = createQrCodeGeometry(geometry.config);
  const quietZone = geometry.config.quietZone;
  const totalSize = qr.size + quietZone * 2;
  const rectangles: string[] = [];

  for (let row = 0; row < qr.size; row += 1) {
    let column = 0;
    while (column < qr.size) {
      if (!qr.modules[row]?.[column]) {
        column += 1;
        continue;
      }

      const start = column;
      while (column < qr.size && qr.modules[row]?.[column]) column += 1;
      const width = column - start;
      const x = start + quietZone;
      const y = row + quietZone;
      rectangles.push(`M ${x} ${y} h ${width} v 1 h -${width} Z`);
    }
  }

  return {
    viewBox: { x: 0, y: 0, width: totalSize, height: totalSize },
    path: rectangles.join(" "),
    fillRule: "nonzero",
    preserveAspectRatio: "xMidYMid meet",
    background: "light",
    frame: { x: 0, y: 0, width: totalSize, height: totalSize },
  };
}

function materializeGeometry(geometry: ShapeGeometry): RenderedGeometry | null {
  if (geometry.mode === "path") return renderPathGeometry(geometry);
  if (geometry.generator === "polygon") return renderPolygonGeometry(geometry);
  if (geometry.generator === "triangle") return renderTriangleGeometry(geometry);
  if (geometry.generator === "qr-code") return renderQrCodeGeometry(geometry);
  return null;
}

function encodedId(value: string): string {
  return value
    .split("")
    .map((character) => character.charCodeAt(0).toString(16).padStart(4, "0"))
    .join("");
}

function paintServerId(elementId: string, role: "fill" | "stroke"): string {
  return `presentation-shape-${role}-${encodedId(elementId)}`;
}

function renderGradientStops(gradient: Gradient): string {
  return gradient.stops
    .map((stop) =>
      `<stop offset="${number(stop.position)}%" stop-color="${escapeHtml(renderColorValue(stop.color))}"></stop>`)
    .join("");
}

function renderGradientDefinition(
  elementId: string,
  role: "fill" | "stroke",
  gradient: Gradient,
  viewBox: RenderedGeometry["viewBox"],
): string {
  const id = paintServerId(elementId, role);
  const stops = renderGradientStops(gradient);

  if (gradient.type === "linear") {
    const angle = (gradient.angle ?? 180) * Math.PI / 180;
    const dx = Math.sin(angle) * 50;
    const dy = -Math.cos(angle) * 50;
    return `<linearGradient id="${id}" x1="${number(50 - dx)}%" y1="${number(50 - dy)}%" x2="${number(50 + dx)}%" y2="${number(50 + dy)}%">${stops}</linearGradient>`;
  }

  if (gradient.shape === "circle") {
    const radius = Math.min(viewBox.width, viewBox.height) / 2;
    return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${number(viewBox.x + viewBox.width / 2)}" cy="${number(viewBox.y + viewBox.height / 2)}" r="${number(radius)}">${stops}</radialGradient>`;
  }

  return `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">${stops}</radialGradient>`;
}

function renderFill(
  elementId: string,
  fill: NonNullable<ShapeElement["style"]>["fill"],
  viewBox: RenderedGeometry["viewBox"],
): { attribute: string; definition: string } {
  if (!fill) {
    return { attribute: "none", definition: "" };
  }

  if (fill.type === "color") {
    return { attribute: renderColorValue(fill.color), definition: "" };
  }

  if (fill.type === "gradient") {
    const id = paintServerId(elementId, "fill");
    return {
      attribute: `url(#${id})`,
      definition: renderGradientDefinition(elementId, "fill", fill.gradient, viewBox),
    };
  }

  return { attribute: "none", definition: "" };
}

function renderStroke(
  elementId: string,
  border: Border | undefined,
  viewBox: RenderedGeometry["viewBox"],
): { attributes: string[]; definition: string } {
  if (!border) return { attributes: ["stroke=\"none\""], definition: "" };

  const attributes = [
    `stroke-width="${escapeHtml(renderLength(border.width))}"`,
    `stroke-linejoin="round"`,
  ];
  if (border.style === "dashed") {
    attributes.push("stroke-dasharray=\"8 4\"");
  } else if (border.style === "dotted") {
    attributes.push("stroke-dasharray=\"1 4\"", "stroke-linecap=\"round\"");
  }

  if (border.color !== undefined) {
    attributes.push(`stroke="${escapeHtml(renderColorValue(border.color))}"`);
    return { attributes, definition: "" };
  }

  const id = paintServerId(elementId, "stroke");
  attributes.push(`stroke="url(#${id})"`);
  return {
    attributes,
    definition: renderGradientDefinition(elementId, "stroke", border.gradient!, viewBox),
  };
}

function renderImageStyle(
  fill: Extract<NonNullable<NonNullable<ShapeElement["style"]>["fill"]>, { type: "image" }>,
): string {
  return [
    "display:block",
    "width:100%",
    "height:100%",
    `object-fit:${fill.fit}`,
    `object-position:${fill.focalPoint?.x ?? 50}% ${fill.focalPoint?.y ?? 50}%`,
  ].join(";");
}

function renderImageSurface(
  fill: Extract<NonNullable<NonNullable<ShapeElement["style"]>["fill"]>, { type: "image" }>,
): string {
  const media = `<img class="presentation-image-media" src="${escapeHtml(fill.src)}" alt="" style="${escapeHtml(renderImageStyle(fill))}">`;
  if (!fill.crop) {
    return `<div class="presentation-shape-image-surface" style="width:100%;height:100%;overflow:hidden">${media}</div>`;
  }

  const metadata = renderImageCropMetadata({
    crop: fill.crop,
    fit: fill.fit,
    focalPoint: fill.focalPoint,
    widthConstrained: true,
    heightConstrained: true,
  });
  const croppedMedia = `<img class="presentation-image-media" src="${escapeHtml(fill.src)}" alt="" style="display:block;position:absolute;max-width:none">`;
  return `<div class="presentation-shape-image-crop" style="position:relative;width:100%;height:100%;overflow:hidden" ${metadata}><div class="presentation-image-crop-viewport" style="position:absolute;overflow:hidden">${croppedMedia}</div></div>`;
}

function renderShapeTransform(transform: ShapeElement["transform"]): string {
  if (transform === undefined) return "none";

  const transforms: string[] = [];
  if (transform.translateXPercent !== undefined || transform.translateYPercent !== undefined) {
    transforms.push(`translate(${number(transform.translateXPercent ?? 0)}%, ${number(transform.translateYPercent ?? 0)}%)`);
  }
  if (transform.rotationDeg !== undefined) {
    transforms.push(`rotate(${number(transform.rotationDeg)}deg)`);
  }
  return transforms.length === 0 ? "none" : transforms.join(" ");
}

function renderLayout(element: ShapeElement, viewBox: RenderedGeometry["viewBox"]): string[] {
  const layout = element.layout;
  const intrinsicWidth = viewBox.width >= viewBox.height
    ? DEFAULT_INTRINSIC_SIZE
    : DEFAULT_INTRINSIC_SIZE * viewBox.width / viewBox.height;
  const intrinsicHeight = viewBox.height >= viewBox.width
    ? DEFAULT_INTRINSIC_SIZE
    : DEFAULT_INTRINSIC_SIZE * viewBox.height / viewBox.width;
  const output: string[] = [];

  const dimensions = [
    ["width", layout?.width ?? intrinsicWidth],
    ["height", layout?.height ?? intrinsicHeight],
  ] as const;
  for (const [property, value] of dimensions) {
    output.push(`${property}:${renderLength(value)}`);
  }

  if (layout?.position !== undefined) output.push(`position:${layout.position}`);
  for (const [property, value] of [
    ["top", layout?.top],
    ["right", layout?.right],
    ["bottom", layout?.bottom],
    ["left", layout?.left],
    ["margin", layout?.margin],
    ["margin-top", layout?.marginTop],
    ["margin-right", layout?.marginRight],
    ["margin-bottom", layout?.marginBottom],
    ["margin-left", layout?.marginLeft],
  ] as const) {
    if (value !== undefined) output.push(`${property}:${renderLength(value)}`);
  }

  if (element.effect?.opacity !== undefined) output.push(`opacity:${element.effect.opacity}`);
  if (element.effect?.shadow) output.push(`box-shadow:${renderShadow(element.effect.shadow)}`);
  if (element.style?.borderRadius !== undefined) output.push(`border-radius:${renderLength(element.style.borderRadius)}`);
  const authoredTransform = renderShapeTransform(element.transform);
  if (authoredTransform !== "none") {
    output.push(`transform:${authoredTransform}`, "transform-origin:50% 50%");
  }
  return output;
}

function renderLinkAttributes(link: ElementLink): string[] {
  const attributes = [
    `href="${escapeHtml(link.href)}"`,
    'data-presentation-link="true"',
  ];

  if (link.target === "_blank") {
    attributes.push('target="_blank"', 'rel="noopener noreferrer"');
  } else if (link.target === "_self") {
    attributes.push('target="_self"');
  }
  return attributes;
}

function renderShapeBox(
  element: ShapeElement,
  content: string,
  styles: string[],
): string {
  const tag = element.link ? "a" : "div";
  const classes = "presentation-element presentation-shape";
  const attributes = [
    `class="${classes}"`,
    `data-presentation-id="${escapeHtml(element.id)}"`,
    'data-presentation-type="shape"',
    `data-presentation-authored-transform="${escapeHtml(renderShapeTransform(element.transform))}"`,
  ];

  if (element.link) {
    attributes.unshift(...renderLinkAttributes(element.link));
  }

  attributes.push(`style="${escapeHtml((element.link ? `display:inline-block;${AUTHORED_LINK_APPEARANCE};` : "") + styles.join(";"))}"`);

  return `<${tag} ${attributes.join(" ")}>${content}</${tag}>`;
}

export function renderShape(element: ShapeElement): string {
  if (element.hidden) return "";

  const renderedGeometry = materializeGeometry(element.geometry);
  if (!renderedGeometry) return "";

  const fill = renderFill(element.id, element.style?.fill, renderedGeometry.viewBox);
  const stroke = renderStroke(element.id, element.style?.stroke, renderedGeometry.viewBox);
  const isQr = renderedGeometry.frame !== undefined;
  const imageFill = element.style?.fill?.type === "image" ? element.style.fill : undefined;
  const clipId = `presentation-shape-clip-${encodedId(element.id)}`;
  const clip = imageFill
    ? `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><path d="${escapeHtml(renderedGeometry.path)}" fill-rule="${renderedGeometry.fillRule}" clip-rule="${renderedGeometry.fillRule}"></path></clipPath>`
    : "";
  const definitions = [fill.definition, stroke.definition, clip].filter(Boolean).join("");
  const pathAttributes = [
    `d="${escapeHtml(renderedGeometry.path)}"`,
    `fill="${escapeHtml(fill.attribute)}"`,
    `fill-rule="${renderedGeometry.fillRule}"`,
    ...(isQr ? ['stroke="none"'] : stroke.attributes),
    'vector-effect="non-scaling-stroke"',
  ];
  const frameMarkup = renderedGeometry.frame !== undefined && element.style?.stroke !== undefined
    ? `<rect x="${number(renderedGeometry.frame.x)}" y="${number(renderedGeometry.frame.y)}" width="${number(renderedGeometry.frame.width)}" height="${number(renderedGeometry.frame.height)}" fill="none" ${stroke.attributes.join(" ")}${element.style.borderRadius !== undefined ? ` rx="${escapeHtml(renderLength(element.style.borderRadius))}" ry="${escapeHtml(renderLength(element.style.borderRadius))}"` : ""} vector-effect="non-scaling-stroke"></rect>`
    : "";
  const imageMarkup = imageFill
    ? `<foreignObject x="${number(renderedGeometry.viewBox.x)}" y="${number(renderedGeometry.viewBox.y)}" width="${number(renderedGeometry.viewBox.width)}" height="${number(renderedGeometry.viewBox.height)}" clip-path="url(#${clipId})">${renderImageSurface(imageFill)}</foreignObject>`
    : "";
  const svg = `<svg class="presentation-shape-surface" viewBox="${number(renderedGeometry.viewBox.x)} ${number(renderedGeometry.viewBox.y)} ${number(renderedGeometry.viewBox.width)} ${number(renderedGeometry.viewBox.height)}" preserveAspectRatio="${renderedGeometry.preserveAspectRatio ?? "none"}" width="100%" height="100%" overflow="visible" aria-hidden="true">` +
    (definitions ? `<defs>${definitions}</defs>` : "") +
    (renderedGeometry.background === "light" ? `<rect x="${number(renderedGeometry.viewBox.x)}" y="${number(renderedGeometry.viewBox.y)}" width="${number(renderedGeometry.viewBox.width)}" height="${number(renderedGeometry.viewBox.height)}" fill="#ffffff"></rect>` : "") +
    imageMarkup +
    `<path ${pathAttributes.join(" ")}></path>` +
    frameMarkup +
    `</svg>`;

  return renderShapeBox(element, svg, renderLayout(element, renderedGeometry.viewBox));
}
