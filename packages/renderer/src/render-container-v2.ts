import type {
  ElementLink,
  ElementStyle,
  PowerShowElement,
  V2ContainerChild,
  V2ContainerChildrenLayout,
  V2ContainerElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderBackgroundPattern } from "./render-background-pattern";
import { renderLength } from "./render-length";
import { isAbsolutePlacement } from "./render-placement";
import { renderStyle } from "./render-style";
import { isV2ContainerElement } from "@powershow/document-schema";

type RenderLegacyChild = (element: PowerShowElement) => string;
type Alignment = "start" | "center" | "end" | "stretch";

function renderMainAxisAlignment(value: Alignment): string {
  switch (value) {
    case "start":
      return "flex-start";
    case "center":
      return "center";
    case "end":
      return "flex-end";
    case "stretch":
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

function renderStackChild(child: string): string {
  if (!child) {
    return "";
  }

  const stackArea = "grid-area:1 / 1";

  return child.includes(" style=")
    ? child.replace(" style=\"", ` style=\"${stackArea};`)
    : child.replace(/^(<[\s\S]*?)(?=\s|>)/, `$1 style=\"${stackArea}\"`);
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

function addMappedStyle(
  target: ElementStyle,
  key: keyof ElementStyle,
  value: ElementStyle[typeof key] | undefined,
): void {
  if (value !== undefined) {
    (target as Record<string, unknown>)[key] = value;
  }
}

function renderV2Style(element: V2ContainerElement): string {
  const target: ElementStyle = {};
  const layout = element.layout;
  const style = element.style;
  const background = style?.background;

  addMappedStyle(target, "width", layout?.width);
  addMappedStyle(target, "height", layout?.height);
  addMappedStyle(target, "minWidth", layout?.minWidth);
  addMappedStyle(target, "minHeight", layout?.minHeight);
  addMappedStyle(target, "maxWidth", layout?.maxWidth);
  addMappedStyle(target, "maxHeight", layout?.maxHeight);
  addMappedStyle(target, "margin", layout?.margin);
  addMappedStyle(target, "marginTop", layout?.marginTop);
  addMappedStyle(target, "marginRight", layout?.marginRight);
  addMappedStyle(target, "marginBottom", layout?.marginBottom);
  addMappedStyle(target, "marginLeft", layout?.marginLeft);
  addMappedStyle(target, "padding", layout?.padding);
  addMappedStyle(target, "paddingTop", layout?.paddingTop);
  addMappedStyle(target, "paddingRight", layout?.paddingRight);
  addMappedStyle(target, "paddingBottom", layout?.paddingBottom);
  addMappedStyle(target, "paddingLeft", layout?.paddingLeft);
  addMappedStyle(target, "placement", layout?.placement);

  if (style) {
    addMappedStyle(target, "color", style.color);
    addMappedStyle(target, "textDecorationColor", style.textDecorationColor);
    addMappedStyle(target, "fontFamily", style.fontFamily);
    addMappedStyle(target, "fontSize", style.fontSize);
    addMappedStyle(target, "fontWeight", style.fontWeight);
    addMappedStyle(target, "fontStyle", style.fontStyle);
    addMappedStyle(target, "textAlign", style.textAlign);
    addMappedStyle(target, "lineHeight", style.lineHeight);
    addMappedStyle(target, "letterSpacing", style.letterSpacing);
    addMappedStyle(target, "textTransform", style.textTransform);
    addMappedStyle(target, "whiteSpace", style.whiteSpace);
    addMappedStyle(target, "textWrapStyle", style.textWrapStyle);
    addMappedStyle(target, "overflowWrap", style.overflowWrap);
    addMappedStyle(target, "textDecorationLine", style.textDecorationLine);
    addMappedStyle(target, "background", background?.color);
    addMappedStyle(target, "borderRadius", style.borderRadius);
    addMappedStyle(target, "overflow", style.overflow);
    addMappedStyle(target, "backgroundGradient", background?.gradient);
    addMappedStyle(target, "border", style.border);
    addMappedStyle(target, "textStroke", style.textStroke);
  }

  addMappedStyle(target, "opacity", element.effect?.opacity);
  addMappedStyle(target, "shadow", element.effect?.shadow);

  return renderStyle(target);
}

function isAbsoluteV2Child(child: V2ContainerChild): boolean {
  return isV2ContainerElement(child)
    ? isAbsolutePlacement(child.layout?.placement)
    : isAbsolutePlacement(child.style?.placement);
}

function establishesContainingBlock(
  element: V2ContainerElement,
  hasAbsoluteChild: boolean,
): boolean {
  return hasAbsoluteChild || isAbsolutePlacement(element.layout?.placement);
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

function renderDistribution(
  value: NonNullable<V2ContainerChildrenLayout["distribution"]>,
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

function renderV2Child(
  child: V2ContainerChild,
  renderLegacyChild: RenderLegacyChild,
): string {
  return isV2ContainerElement(child)
    ? renderContainerV2(child, renderLegacyChild)
    : renderLegacyChild(child);
}

/**
 * Renders only the candidate semantic Container shape. The legacy renderer
 * remains the production path for PowerShowElement containers in this
 * checkpoint.
 */
export function renderContainerV2(
  element: V2ContainerElement,
  renderLegacyChild: RenderLegacyChild,
): string {
  if (element.hidden) {
    return "";
  }

  const styles: string[] = [];
  const baseStyle = renderV2Style(element);

  if (baseStyle) {
    styles.push(baseStyle);
  }

  const childrenLayout = element.layout?.children;
  const mode = childrenLayout?.mode ?? "flow";
  const direction = childrenLayout?.direction ?? "column";
  const isStack = mode === "stack";
  const pattern = element.style?.background?.pattern;
  const hasAbsoluteChild = element.children.some(isAbsoluteV2Child);
  const isLinked = element.link !== undefined;

  styles.push(isStack ? "display:grid" : "display:flex");

  if (hasAbsoluteChild) {
    styles.push("position:relative");
  }

  if (isLinked && !establishesContainingBlock(element, hasAbsoluteChild)) {
    styles.push("position:relative");
  }

  if (pattern) {
    if (!establishesContainingBlock(element, hasAbsoluteChild)) {
      styles.push("position:relative");
    }

    styles.push("isolation:isolate");
  }

  if (isLinked) {
    styles.push("z-index:0");
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
    const distribution = renderDistribution(childrenLayout?.distribution ?? "packed");

    if (direction === "row") {
      if (distribution) {
        styles.push(`justify-content:${distribution}`);
      } else if (horizontalAlign) {
        styles.push(`justify-content:${renderMainAxisAlignment(horizontalAlign)}`);
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
        styles.push(`justify-content:${renderMainAxisAlignment(verticalAlign)}`);
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

  const patternLayer = pattern
    ? `<div class="powershow-container-background-pattern" aria-hidden="true" style="${escapeHtml(
        "position:absolute;inset:0;z-index:-1;pointer-events:none;" +
          "border-radius:inherit;" +
          renderBackgroundPattern(pattern),
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
