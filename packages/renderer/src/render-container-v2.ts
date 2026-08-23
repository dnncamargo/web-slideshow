import type {
  ElementLink,
  Length,
  PowerShowElement,
  V2ContainerChild,
  V2ContainerElement,
  V2ContainerStyle,
  V2ContainerTypography,
} from "@powershow/document-schema";

import { isV2ContainerElement } from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderBackgroundPattern } from "./render-background-pattern";
import { renderLength } from "./render-length";
import { renderBorder, renderGradient, renderShadow } from "./render-visual";

type RenderLegacyChild = (element: PowerShowElement) => string;
type Alignment = "start" | "center" | "end" | "stretch";
type Distribution = "packed" | "space-between" | "space-around" | "space-evenly";

// ============================================================
// LOW-LEVEL CSS EMISSION
//
// This renderer emits canonical V2 responsibilities directly. It does
// NOT reconstruct a legacy ElementStyle compatibility object and then
// pretend that legacy contract is canonical.
// ============================================================

function pushLength(
  target: string[],
  property: string,
  value: Length | undefined,
): void {
  if (value === undefined) {
    return;
  }

  target.push(`${property}:${renderLength(value)}`);
}

function pushStyle(
  target: string[],
  property: string,
  value: string | number | undefined,
): void {
  if (value === undefined) {
    return;
  }

  target.push(`${property}:${value}`);
}

function finish(output: string[]): string {
  return output.filter((fragment) => fragment.length > 0).join(";");
}

function renderContainerLayoutCss(layout: V2ContainerElement["layout"]): string {
  if (!layout) {
    return "";
  }

  const output: string[] = [];

  pushLength(output, "width", layout.width);
  pushLength(output, "height", layout.height);

  pushLength(output, "min-width", layout.minWidth);
  pushLength(output, "min-height", layout.minHeight);

  pushLength(output, "max-width", layout.maxWidth);
  pushLength(output, "max-height", layout.maxHeight);

  pushLength(output, "margin", layout.margin);
  pushLength(output, "margin-top", layout.marginTop);
  pushLength(output, "margin-right", layout.marginRight);
  pushLength(output, "margin-bottom", layout.marginBottom);
  pushLength(output, "margin-left", layout.marginLeft);

  pushLength(output, "padding", layout.padding);
  pushLength(output, "padding-top", layout.paddingTop);
  pushLength(output, "padding-right", layout.paddingRight);
  pushLength(output, "padding-bottom", layout.paddingBottom);
  pushLength(output, "padding-left", layout.paddingLeft);

  pushStyle(output, "overflow", layout.overflow);

  if (layout.position === "absolute") {
    output.push("position:absolute");
    pushLength(output, "top", layout.top);
    pushLength(output, "right", layout.right);
    pushLength(output, "bottom", layout.bottom);
    pushLength(output, "left", layout.left);
  }

  return finish(output);
}

function renderBackgroundStyle(style: V2ContainerStyle | undefined): string {
  const background = style?.background;

  if (!background) {
    return "";
  }

  const output: string[] = [];

  if (background.color !== undefined) {
    output.push(`background:${background.color}`);
  }

  if (background.gradient !== undefined) {
    output.push(`background-image:${renderGradient(background.gradient)}`);
  }

  return finish(output);
}

function renderVisualSurfaceCss(
  style: V2ContainerStyle | undefined,
): string {
  if (!style) {
    return "";
  }

  const output: string[] = [];

  pushStyle(output, "color", style.color);
  output.push(renderBackgroundStyle(style));

  if (style.borderRadius !== undefined) {
    pushLength(output, "border-radius", style.borderRadius);
  }

  if (style.border) {
    output.push(...renderBorder(style.border));
  }

  return finish(output);
}

function renderTypographyCss(
  typography: V2ContainerTypography | undefined,
): string {
  if (!typography) {
    return "";
  }

  const output: string[] = [];

  if (typography.fontFamily !== undefined) {
    output.push(`font-family:${typography.fontFamily}`);
  }

  pushLength(output, "font-size", typography.fontSize);
  pushStyle(output, "font-weight", typography.fontWeight);
  pushStyle(output, "font-style", typography.fontStyle);
  pushStyle(output, "text-align", typography.textAlign);
  pushStyle(output, "line-height", typography.lineHeight);
  pushLength(output, "letter-spacing", typography.letterSpacing);
  pushStyle(output, "text-transform", typography.textTransform);
  pushStyle(output, "white-space", typography.whiteSpace);
  pushStyle(output, "text-wrap-style", typography.textWrapStyle);
  pushStyle(output, "overflow-wrap", typography.overflowWrap);
  pushStyle(output, "text-decoration-line", typography.textDecorationLine);

  if (typography.textDecorationColor !== undefined) {
    output.push(`text-decoration-color:${typography.textDecorationColor}`);
  }

  if (typography.textStroke !== undefined) {
    output.push(
      `-webkit-text-stroke:${renderLength(typography.textStroke.width)} ${typography.textStroke.color}`,
    );
  }

  return finish(output);
}

function renderEffectCss(effect: V2ContainerElement["effect"]): string {
  if (!effect) {
    return "";
  }

  const output: string[] = [];

  pushStyle(output, "opacity", effect.opacity);

  if (effect.shadow) {
    output.push(`box-shadow:${renderShadow(effect.shadow)}`);
  }

  return finish(output);
}

// ============================================================
// ALIGNMENT / DISTRIBUTION
// ============================================================

function renderMainAxisAlignment(value: Alignment): string {
  switch (value) {
    case "start":
      return "flex-start";

    case "center":
      return "center";

    case "end":
      return "flex-end";

    case "stretch":
      // Flexbox does not stretch items along the main axis.
      return "flex-start";
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

function renderGridAlignment(value: Alignment): string {
  switch (value) {
    case "start":
      return "start";

    case "center":
      return "center";

    case "end":
      return "end";

    case "stretch":
      return "stretch";
  }
}

function renderDistribution(
  value: Distribution,
): string | null {
  switch (value) {
    case "packed":
      return null;

    case "space-between":
      return "space-between";

    case "space-around":
      return "space-around";

    case "space-evenly":
      return "space-evenly";
  }
}

// ============================================================
// END: ALIGNMENT / DISTRIBUTION
// ============================================================

function renderStackChild(child: string): string {
  if (!child) {
    return "";
  }

  const stackArea = "grid-area:1 / 1";

  return child.includes(" style=")
    ? child.replace(" style=\"", ` style=\"${stackArea};`)
    : child.replace(/^(<[^\s>]+)/, `$1 style=\"${stackArea}\"`);
}

function getTagName(
  role: V2ContainerElement["role"],
): "div" | "main" | "header" | "footer" {
  switch (role) {
    case "main":
      return "main";

    case "header":
      return "header";

    case "footer":
      return "footer";

    default:
      return "div";
  }
}

function isAbsoluteChild(child: V2ContainerChild): boolean {
  return isV2ContainerElement(child)
    ? child.layout?.position === "absolute"
    : child.style?.position === "absolute" ||
      (child.style?.placement?.mode ?? undefined) === "absolute";
}

function renderContainerLinkSurface(link: ElementLink): string {
  const attributes: string[] = [
    `href="${escapeHtml(link.href)}"`,
    'data-powershow-link="true"',
    'data-powershow-container-link-surface="true"',
    'style="position:absolute;inset:0;z-index:100"',
  ];

  if (link.target === "_blank") {
    attributes.push('target="_blank"', 'rel="noopener noreferrer"');
  } else if (link.target === "_self") {
    attributes.push('target="_self"');
  }

  return `<a ${attributes.join(" ")}></a>`;
}

function renderV2Child(
  child: V2ContainerChild,
  renderLegacyChild: RenderLegacyChild,
): string {
  return isV2ContainerElement(child)
    ? renderContainerV2(child, renderLegacyChild)
    : renderLegacyChild(child);
}

/**
 * Renders only the candidate semantic Container shape.
 *
 * The legacy renderer remains the production path for PowerShowElement
 * containers in this checkpoint.
 */
export function renderContainerV2(
  element: V2ContainerElement,
  renderLegacyChild: RenderLegacyChild,
): string {
  if (element.hidden) {
    return "";
  }

  const styles: string[] = [];

  const layoutCss = renderContainerLayoutCss(element.layout);
  const visualSurfaceCss = renderVisualSurfaceCss(element.style);
  const typographyCss = renderTypographyCss(element.typography);
  const effectCss = renderEffectCss(element.effect);

  for (const fragment of [layoutCss, visualSurfaceCss, typographyCss, effectCss]) {
    if (fragment !== "") {
      styles.push(fragment);
    }
  }

  const childrenLayout = element.layout?.children;
  const mode = childrenLayout?.mode ?? "flow";
  const direction = childrenLayout?.direction ?? "column";
  const isStack = mode === "stack";
  const hasAbsoluteChild = element.children.some((child) =>
    isAbsoluteChild(child),
  );
  const isLinked = element.link !== undefined;
  const pattern = element.style?.background?.pattern;
  const hasPattern = pattern !== undefined;

  styles.push(isStack ? "display:grid" : "display:flex");

  // A Container needs renderer-owned position:relative only when it hosts
  // absolute descendants or renderer-owned overlays but does NOT already
  // establish a containing block through authored absolute positioning.
  //
  // layout.position = "absolute" is author intent and MUST always survive.
  // hasAbsoluteChild is the REASON a containing block may be required; it is
  // never itself proof that one already exists.
  const needsContainingBlock = hasAbsoluteChild || isLinked || hasPattern;
  const hasAuthoredAbsolute = element.layout?.position === "absolute";

  if (needsContainingBlock && !hasAuthoredAbsolute) {
    styles.push("position:relative");
  }

  // The linked Container root establishes a stacking context so
  // descendant positioned layers (including nested linked surfaces)
  // are trapped beneath the renderer-owned overlay z-index.
  if (isLinked) {
    styles.push("z-index:0");
  }

  // A patterned Container emits isolation:isolate so the renderer-owned
  // negative pattern layer stays inside the Container's own stacking
  // context: above the root background/gradient and below authored children.
  if (hasPattern) {
    styles.push("isolation:isolate");
  }

  if (!isStack) {
    styles.push(`flex-direction:${direction}`);
  }

  if (!isStack && childrenLayout?.gap !== undefined) {
    styles.push(`gap:${renderLength(childrenLayout.gap)}`);
  }

  const horizontalAlign = childrenLayout?.horizontalAlign;
  const verticalAlign = childrenLayout?.verticalAlign;

  if (isStack) {
    if (horizontalAlign) {
      styles.push(`justify-items:${renderGridAlignment(horizontalAlign)}`);
    }

    if (verticalAlign) {
      styles.push(`align-items:${renderGridAlignment(verticalAlign)}`);
    }
  } else {
    const distribution = renderDistribution(
      childrenLayout?.distribution ?? "packed",
    );

    if (direction === "row") {
      if (distribution) {
        styles.push(`justify-content:${distribution}`);
      } else if (horizontalAlign) {
        styles.push(
          `justify-content:${renderMainAxisAlignment(horizontalAlign)}`,
        );
      }

      if (verticalAlign) {
        styles.push(`align-items:${renderCrossAxisAlignment(verticalAlign)}`);
      }
    } else {
      if (horizontalAlign) {
        styles.push(`align-items:${renderCrossAxisAlignment(horizontalAlign)}`);
      }

      if (distribution) {
        styles.push(`justify-content:${distribution}`);
      } else if (verticalAlign) {
        styles.push(
          `justify-content:${renderMainAxisAlignment(verticalAlign)}`,
        );
      }
    }
  }

  const classes = ["powershow-element", "powershow-container"];

  if (isStack) {
    classes.push("powershow-container-stack");
  }

  if (element.role) {
    classes.push(`powershow-container-${element.role}`);
  }

  const customClass = element.style?.className?.trim();

  if (customClass) {
    classes.push(customClass);
  }

  const patternLayer = hasPattern
    ? `<div class="powershow-container-background-pattern" aria-hidden="true" style="${escapeHtml(
        `position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;${renderBackgroundPattern(
          pattern,
        )}`,
      )}"></div>`
    : "";

  const children = element.children
    .map((child) => {
      const renderedChild = renderV2Child(child, renderLegacyChild);

      return isStack ? renderStackChild(renderedChild) : renderedChild;
    })
    .join("");

  const tag = getTagName(element.role);
  const roleAttribute = element.role
    ? ` data-powershow-role="${escapeHtml(element.role)}"`
    : "";

  return (
    `<${tag}` +
    ` class="${escapeHtml(classes.join(" "))}"` +
    ` data-powershow-id="${escapeHtml(element.id)}"` +
    ` data-powershow-type="container"` +
    roleAttribute +
    ` style="${escapeHtml(styles.join(";"))}"` +
    `>` +
    patternLayer +
    children +
    (element.link ? renderContainerLinkSurface(element.link) : "") +
    `</${tag}>`
  );
}