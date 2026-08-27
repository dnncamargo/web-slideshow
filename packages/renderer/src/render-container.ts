import type {
  ContainerElement,
  ElementLink,
  PowerShowElement,
} from "@powershow/document-schema";

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

function hasAbsoluteChild(element: ContainerElement): boolean {
  return element.children.some((child) => {
    if (child.type === "container") {
      return child.layout?.position === "absolute";
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
): string {
  if (element.hidden) {
    return "";
  }

  const styles = [
    ...renderLayout(element),
    ...renderVisualStyle(element),
    ...renderTypography(element),
    ...renderEffect(element),
  ];
  const childrenLayout = element.layout?.children;
  const mode = childrenLayout?.mode ?? "flow";
  const direction = childrenLayout?.direction ?? "column";
  const distribution = childrenLayout?.distribution ?? "packed";
  const horizontalAlign = childrenLayout?.horizontalAlign;
  const verticalAlign = childrenLayout?.verticalAlign;
  const isStack = mode === "stack";
  const isLinked = element.link !== undefined;
  const hasPattern = element.style?.background?.pattern !== undefined;
  const needsContainingBlock = hasAbsoluteChild(element) || isLinked || hasPattern;
  const hasAuthoredAbsolute = element.layout?.position === "absolute";

  styles.push(isStack ? "display:grid" : "display:flex");

  if (needsContainingBlock && !hasAuthoredAbsolute) {
    styles.push("position:relative");
  }

  if (hasPattern) {
    styles.push("isolation:isolate");
  }

  if (isLinked) {
    styles.push("z-index:0");
  }

  if (isStack) {
    if (horizontalAlign) {
      styles.push(`justify-items:${horizontalAlign}`);
    }
    if (verticalAlign) {
      styles.push(`align-items:${verticalAlign}`);
    }
  } else {
    styles.push(`flex-direction:${direction}`);

    if (childrenLayout?.gap !== undefined) {
      styles.push(`gap:${renderLength(childrenLayout.gap)}`);
    }

    if (distribution !== "packed") {
      styles.push(`justify-content:${distribution}`);
    } else if (direction === "row" && horizontalAlign) {
      styles.push(`justify-content:${renderMainAxisAlignment(horizontalAlign)}`);
    } else if (direction === "column" && verticalAlign) {
      styles.push(`justify-content:${renderMainAxisAlignment(verticalAlign)}`);
    }

    if (direction === "row" && verticalAlign) {
      styles.push(`align-items:${renderCrossAxisAlignment(verticalAlign)}`);
    } else if (direction === "column" && horizontalAlign) {
      styles.push(`align-items:${renderCrossAxisAlignment(horizontalAlign)}`);
    }
  }

  const classes = ["powershow-element", "powershow-container"];
  if (isStack) classes.push("powershow-container-stack");
  if (element.role) classes.push(`powershow-container-${element.role}`);
  if (element.style?.className?.trim()) classes.push(element.style.className.trim());

  const tag = getTagName(element.role);
  const pattern = element.style?.background?.pattern;
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

  return (
    `<${tag} class="${escapeHtml(classes.join(" "))}"` +
    ` data-powershow-id="${escapeHtml(element.id)}"` +
    ` data-powershow-type="container"${role}` +
    ` style="${escapeHtml(styles.join(";"))}">` +
    patternLayer +
    children +
    (element.link ? renderLinkSurface(element.link) : "") +
    `</${tag}>`
  );
}
