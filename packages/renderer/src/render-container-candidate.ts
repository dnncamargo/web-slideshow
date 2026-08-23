import type {
  CandidateContainerChild,
  CandidateContainerElement,
  ElementLink,
  ProductionNonContainerElement,
} from "@powershow/document-schema";

import { quoteCssString } from "./escape-css-string";
import { escapeHtml } from "./escape-html";
import { renderBackgroundPattern } from "./render-background-pattern";
import { isAbsolutePlacement } from "./render-placement";
import { renderLength } from "./render-length";
import { renderBorder, renderGradient, renderShadow } from "./render-visual";
import { isCandidateContainerElement } from "@powershow/document-schema";

type Alignment = "start" | "center" | "end" | "stretch";
type RenderProductionChild = (element: ProductionNonContainerElement) => string;

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

function addCssString(
  output: string[],
  property: string,
  value: string | undefined,
): void {
  if (value !== undefined) {
    output.push(`${property}:${quoteCssString(value)}`);
  }
}

function renderLayout(element: CandidateContainerElement): string[] {
  const layout = element.layout;
  const output: string[] = [];

  if (!layout) {
    return output;
  }

  addLength(output, "width", layout.width);
  addLength(output, "height", layout.height);
  addLength(output, "min-width", layout.minWidth);
  addLength(output, "min-height", layout.minHeight);
  addLength(output, "max-width", layout.maxWidth);
  addLength(output, "max-height", layout.maxHeight);
  addLength(output, "margin", layout.margin);
  addLength(output, "margin-top", layout.marginTop);
  addLength(output, "margin-right", layout.marginRight);
  addLength(output, "margin-bottom", layout.marginBottom);
  addLength(output, "margin-left", layout.marginLeft);
  addLength(output, "padding", layout.padding);
  addLength(output, "padding-top", layout.paddingTop);
  addLength(output, "padding-right", layout.paddingRight);
  addLength(output, "padding-bottom", layout.paddingBottom);
  addLength(output, "padding-left", layout.paddingLeft);
  addStyle(output, "overflow", layout.overflow);
  addStyle(output, "position", layout.position);
  addLength(output, "top", layout.top);
  addLength(output, "right", layout.right);
  addLength(output, "bottom", layout.bottom);
  addLength(output, "left", layout.left);

  return output;
}

function renderVisualStyle(element: CandidateContainerElement): string[] {
  const style = element.style;
  const output: string[] = [];

  if (!style) {
    return output;
  }

  addStyle(output, "color", style.color);

  if (style.background?.color) {
    addStyle(output, "background", style.background.color);
  }

  if (style.background?.gradient) {
    output.push(`background-image:${renderGradient(style.background.gradient)}`);
  }

  addLength(output, "border-radius", style.borderRadius);

  if (style.border) {
    output.push(...renderBorder(style.border));
  }

  return output;
}

function renderTypography(element: CandidateContainerElement): string[] {
  const typography = element.typography;
  const output: string[] = [];

  if (!typography) {
    return output;
  }

  addCssString(output, "font-family", typography.fontFamily);
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
  addStyle(output, "text-decoration-color", typography.textDecorationColor);

  if (typography.textStroke) {
    output.push(
      `-webkit-text-stroke:${renderLength(typography.textStroke.width)} ${typography.textStroke.color}`,
    );
  }

  return output;
}

function renderEffect(element: CandidateContainerElement): string[] {
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
  return value;
}

function renderDistribution(
  value: "packed" | "space-between" | "space-around" | "space-evenly",
): string | undefined {
  return value === "packed" ? undefined : value;
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
  role: CandidateContainerElement["role"],
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

function renderContainerLinkSurface(link: ElementLink): string {
  const attributes = [
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

function hasAbsoluteChild(element: CandidateContainerElement): boolean {
  return element.children.some((child) => {
    if (isCandidateContainerElement(child)) {
      return child.layout?.position === "absolute";
    }

    return (
      child.style?.position === "absolute" ||
      isAbsolutePlacement(child.style?.placement)
    );
  });
}

function renderChild(
  child: CandidateContainerChild,
  renderProductionChild: RenderProductionChild,
): string {
  return isCandidateContainerElement(child)
    ? renderCandidateContainer(child, renderProductionChild)
    : renderProductionChild(child);
}

export function renderCandidateContainer(
  element: CandidateContainerElement,
  renderProductionChild: RenderProductionChild,
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
  const linked = element.link !== undefined;
  const patterned = element.style?.background?.pattern !== undefined;
  const authoredAbsolute = element.layout?.position === "absolute";

  styles.push(isStack ? "display:grid" : "display:flex");

  const requiresContainingBlock =
    hasAbsoluteChild(element) || linked || patterned;

  if (requiresContainingBlock && !authoredAbsolute) {
    styles.push("position:relative");
  }

  if (patterned) {
    styles.push("isolation:isolate");
  }

  if (linked) {
    styles.push("z-index:0");
  }

  if (isStack) {
    if (horizontalAlign) {
      styles.push(`justify-items:${renderGridAlignment(horizontalAlign)}`);
    }

    if (verticalAlign) {
      styles.push(`align-items:${renderGridAlignment(verticalAlign)}`);
    }
  } else {
    styles.push(`flex-direction:${direction}`);

    if (childrenLayout?.gap !== undefined) {
      styles.push(`gap:${renderLength(childrenLayout.gap)}`);
    }

    const distributedMainAxis = renderDistribution(distribution);

    if (direction === "row") {
      if (distributedMainAxis) {
        styles.push(`justify-content:${distributedMainAxis}`);
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

      if (distributedMainAxis) {
        styles.push(`justify-content:${distributedMainAxis}`);
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

  const tag = getTagName(element.role);
  const pattern = element.style?.background?.pattern;
  const patternLayer = pattern
    ? `<div class="powershow-container-background-pattern" aria-hidden="true" style="${escapeHtml(
        "position:absolute;inset:0;z-index:-1;pointer-events:none;" +
          "border-radius:inherit;" +
          renderBackgroundPattern(pattern),
      )}"></div>`
    : "";

  const children = element.children
    .map((child) => {
      const rendered = renderChild(child, renderProductionChild);

      return isStack ? renderStackChild(rendered) : rendered;
    })
    .join("");

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
