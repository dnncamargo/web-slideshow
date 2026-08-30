import type {
  ContainerElement,
  ElementLink,
  PowerShowElement,
  Presentation,
} from "@powershow/document-schema";
import { resolveLinkedContainerStyle } from "@powershow/document-schema";

import { quoteCssString } from "./escape-css-string";
import { escapeHtml } from "./escape-html";
import { renderBackgroundPattern } from "./render-background-pattern";
import { renderLength } from "./render-length";
import { renderBorder, renderGradient, renderShadow } from "./render-visual";
import { renderColorValue } from "./render-palette";

type RenderChild = (element: PowerShowElement) => string;
type Alignment = "start" | "center" | "end" | "stretch";

const CONTAINER_LINK_SURFACE_Z_INDEX = 100;

function addStyle(
  output: string[],
  property: string,
  value: string | number | undefined,
): void {
  if (value !== undefined) {
    output.push(`${property}:${value}`);
  }
}

function addLength(
  output: string[],
  property: string,
  value: Parameters<typeof renderLength>[0] | undefined,
): void {
  if (value !== undefined) {
    output.push(`${property}:${renderLength(value)}`);
  }
}

function renderLayout(element: ContainerElement): string[] {
  const layout = element.layout;
  const output: string[] = [];

  if (!layout) {
    return output;
  }

  const lengths = [
    ["width", layout.width],
    ["height", layout.height],
    ["min-width", layout.minWidth],
    ["min-height", layout.minHeight],
    ["max-width", layout.maxWidth],
    ["max-height", layout.maxHeight],
    ["margin", layout.margin],
    ["margin-top", layout.marginTop],
    ["margin-right", layout.marginRight],
    ["margin-bottom", layout.marginBottom],
    ["margin-left", layout.marginLeft],
    ["padding", layout.padding],
    ["padding-top", layout.paddingTop],
    ["padding-right", layout.paddingRight],
    ["padding-bottom", layout.paddingBottom],
    ["padding-left", layout.paddingLeft],
  ] as const;

  for (const [property, value] of lengths) {
    addLength(output, property, value);
  }

  addStyle(output, "overflow", layout.overflow);
  addStyle(output, "position", layout.position);
  if (layout.flexShrink === 0) {
    output.push("flex-shrink:0");
  }

  for (const [property, value] of [
    ["top", layout.top],
    ["right", layout.right],
    ["bottom", layout.bottom],
    ["left", layout.left],
  ] as const) {
    addLength(output, property, value);
  }

  return output;
}

function renderVisualStyle(element: ContainerElement): string[] {
  const style = element.style;
  const output: string[] = [];

  if (!style) {
    return output;
  }

  if (style.color !== undefined) addStyle(output, "color", renderColorValue(style.color));

  if (style.background?.color) {
    addStyle(output, "background", renderColorValue(style.background.color));
  }

  if (style.background?.gradient) {
    output.push(`background-image:${renderGradient(style.background.gradient)}`);
  }

  if (style.border) {
    output.push(...renderBorder(style.border));
  }

  addLength(output, "border-radius", style.borderRadius);
  return output;
}

function renderTypography(element: ContainerElement): string[] {
  const typography = element.typography;
  const output: string[] = [];

  if (!typography) {
    return output;
  }

  if (typography.fontFamily !== undefined) {
    output.push(`font-family:${quoteCssString(typography.fontFamily)}`);
  }

  addLength(output, "font-size", typography.fontSize);
  addStyle(output, "font-weight", typography.fontWeight);
  addStyle(output, "font-style", typography.fontStyle);
  addStyle(output, "text-align", typography.textAlign);
  addStyle(output, "line-height", typography.lineHeight);
  addLength(output, "letter-spacing", typography.letterSpacing);
  addStyle(output, "text-transform", typography.textTransform);
  addStyle(output, "white-space", typography.whiteSpace);
  addStyle(output, "text-wrap-style", typography.textWrapStyle);
  addStyle(output, "overflow-wrap", typography.overflowWrap);
  addStyle(output, "text-decoration-line", typography.textDecorationLine);
  if (typography.textDecorationColor !== undefined) addStyle(output, "text-decoration-color", renderColorValue(typography.textDecorationColor));

  if (typography.textStroke) {
    output.push(
      `-webkit-text-stroke:${renderLength(typography.textStroke.width)} ${renderColorValue(typography.textStroke.color)}`,
    );
  }

  return output;
}

function renderEffect(element: ContainerElement): string[] {
  const effect = element.effect;
  const output: string[] = [];

  if (!effect) {
    return output;
  }

  addStyle(output, "opacity", effect.opacity);

  if (effect.shadow) {
    output.push(`box-shadow:${renderShadow(effect.shadow)}`);
  }

  return output;
}

function renderMainAxisAlignment(value: Alignment): string {
  switch (value) {
    case "start":
    case "stretch":
      return "flex-start";
    case "center":
      return "center";
    case "end":
      return "flex-end";
  }
}

function renderCrossAxisAlignment(value: Alignment): string {
  switch (value) {
    case "start":
      return "flex-start";
    case "center":
      return "center";
    case "end":
      return "flex-end";
    case "stretch":
      return "stretch";
  }
}

function renderStackChild(child: string): string {
  if (!child) {
    return "";
  }

  return child.includes(" style=")
    ? child.replace(" style=\"", " style=\"grid-area:1 / 1;")
    : child.replace(
        /^(<[\s\S]*?)(?=\s|>)/,
        "$1 style=\"grid-area:1 / 1\"",
      );
}

function renderChildLayout(
  element: ContainerElement,
  output: string[],
): void {
  const childrenLayout = element.layout?.children;
  const mode = childrenLayout?.mode ?? "flow";
  const direction = childrenLayout?.direction ?? "column";
  const distribution = childrenLayout?.distribution ?? "packed";
  const horizontalAlign = childrenLayout?.horizontalAlign;
  const verticalAlign = childrenLayout?.verticalAlign;

  output.push(mode === "stack" ? "display:grid" : "display:flex");

  if (mode === "stack") {
    if (horizontalAlign) output.push(`justify-items:${horizontalAlign}`);
    if (verticalAlign) output.push(`align-items:${verticalAlign}`);
    return;
  }

  output.push(`flex-direction:${direction}`);

  if (childrenLayout?.gap !== undefined) {
    output.push(`gap:${renderLength(childrenLayout.gap)}`);
  }

  if (distribution !== "packed") {
    output.push(`justify-content:${distribution}`);
  } else if (direction === "row" && horizontalAlign) {
    output.push(`justify-content:${renderMainAxisAlignment(horizontalAlign)}`);
  } else if (direction === "column" && verticalAlign) {
    output.push(`justify-content:${renderMainAxisAlignment(verticalAlign)}`);
  }

  if (direction === "row" && verticalAlign) {
    output.push(`align-items:${renderCrossAxisAlignment(verticalAlign)}`);
  } else if (direction === "column" && horizontalAlign) {
    output.push(`align-items:${renderCrossAxisAlignment(horizontalAlign)}`);
  }
}

function getTagName(
  role: ContainerElement["role"],
): "div" | "main" | "header" | "footer" {
  switch (role) {
    case "main":
    case "header":
    case "footer":
      return role;
    default:
      return "div";
  }
}

function hasAbsoluteChild(
  element: ContainerElement,
  presentation: Presentation | undefined,
): boolean {
  return element.children.some((child) => {
    if (child.type === "container") {
      return presentation
        ? resolveLinkedContainerStyle(presentation, child).layout?.position === "absolute"
        : child.layout?.position === "absolute";
    }

    if (child.type === "text" || child.type === "image" || child.type === "gallery" || child.type === "embed" || child.type === "scripted" || child.type === "code" || child.type === "terminal" || child.type === "table" || child.type === "blocks" || child.type === "divider" || child.type === "topics" || child.type === "chart" || child.type === "interactive") {
      return child.layout?.position === "absolute";
    }

    return false;
  });
}

function renderLinkSurface(link: ElementLink): string {
  const attributes = [
    `href="${escapeHtml(link.href)}"`,
    'data-powershow-link="true"',
    'data-powershow-container-link-surface="true"',
    `style="position:absolute;inset:0;z-index:${CONTAINER_LINK_SURFACE_Z_INDEX}"`,
  ];

  if (link.target === "_blank") {
    attributes.push('target="_blank"', 'rel="noopener noreferrer"');
  } else if (link.target === "_self") {
    attributes.push('target="_self"');
  }

  return `<a ${attributes.join(" ")}></a>`;
}

export function renderContainer(
  element: ContainerElement,
  renderChild: RenderChild,
  presentation?: Presentation,
): string {
  if (element.hidden) {
    return "";
  }

  if (element.linkedStyleId !== undefined && presentation === undefined) {
    throw new Error(
      `Cannot render linked container style without presentation context: ${element.linkedStyleId}`,
    );
  }

  const resolved = presentation
    ? resolveLinkedContainerStyle(presentation, element)
    : undefined;
  const renderedElement: ContainerElement = resolved
    ? { ...element, ...resolved }
    : element;

  const styles = [
    ...renderLayout(renderedElement),
    ...renderVisualStyle(renderedElement),
    ...renderTypography(renderedElement),
    ...renderEffect(renderedElement),
  ];
  const childrenLayout = renderedElement.layout?.children;
  const fit = childrenLayout?.fit;
  const mode = childrenLayout?.mode ?? "flow";
  const isStack = mode === "stack";
  const containsAbsoluteChild = hasAbsoluteChild(element, presentation);
  const isFitted = fit !== undefined;
  const isLinked = element.link !== undefined;
  const hasPattern = renderedElement.style?.background?.pattern !== undefined;
  const needsContainingBlock = isFitted
    ? isLinked || hasPattern
    : containsAbsoluteChild || isLinked || hasPattern;
  const hasAuthoredAbsolute = renderedElement.layout?.position === "absolute";

  if (isFitted) {
    styles.push("display:block");
  } else {
    renderChildLayout(renderedElement, styles);
  }

  if (needsContainingBlock && !hasAuthoredAbsolute) {
    styles.push("position:relative");
  }

  if (hasPattern) {
    styles.push("isolation:isolate");
  }

  if (isLinked) {
    styles.push("z-index:0");
  }

  const classes = ["powershow-element", "powershow-container"];
  if (isStack) classes.push("powershow-container-stack");
  if (isFitted) classes.push("powershow-container-fit");
  if (element.role) classes.push(`powershow-container-${element.role}`);
  if (element.style?.className?.trim()) classes.push(element.style.className.trim());

  const tag = getTagName(element.role);
  const pattern = renderedElement.style?.background?.pattern;
  const patternLayer = pattern
    ? `<div class="powershow-container-background-pattern" aria-hidden="true" style="${escapeHtml(
        "position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;" +
          renderBackgroundPattern(pattern),
      )}"></div>`
    : "";
  const children = element.children
    .map((child) => {
      const rendered = renderChild(child);
      return isStack ? renderStackChild(rendered) : rendered;
    })
    .join("");
  const role = element.role
    ? ` data-powershow-role="${escapeHtml(element.role)}"`
    : "";

  const childrenMarkup = isFitted
    ? (() => {
        const surfaceStyles = [
          "position:relative",
          `width:${fit.sourceWidth}px`,
          `height:${fit.sourceHeight}px`,
          "transform-origin:0 0",
        ];
        renderChildLayout(renderedElement, surfaceStyles);
        return `<div class="powershow-container-fit-viewport" data-powershow-container-fit="true" data-powershow-container-fit-mode="${fit.mode}" data-powershow-container-fit-source-width="${fit.sourceWidth}" data-powershow-container-fit-source-height="${fit.sourceHeight}" style="position:relative;width:100%;height:100%;${fit.mode === "cover" ? "overflow:hidden;" : "overflow:visible;"}"><div class="powershow-container-fit-surface" style="${escapeHtml(surfaceStyles.join(";"))}">${children}</div></div>`;
      })()
    : children;

  return (
    `<${tag} class="${escapeHtml(classes.join(" "))}"` +
    ` data-powershow-id="${escapeHtml(element.id)}"` +
    ` data-powershow-type="container"${role}` +
    ` style="${escapeHtml(styles.join(";"))}">` +
    patternLayer +
    childrenMarkup +
    (element.link ? renderLinkSurface(element.link) : "") +
    `</${tag}>`
  );
}
