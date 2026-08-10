import type {
  ContainerElement,
  PowerShowElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderStyle } from "./render-style";

import { renderLength } from "./render-length";

type RenderChild = (element: PowerShowElement) => string;

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
      // Flexbox não estica itens no eixo principal.
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

function getTagName(
  role: ContainerElement["role"],
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

export function renderContainer(
  element: ContainerElement,
  renderChild: RenderChild,
): string {
  if (element.hidden) {
    return "";
  }

  const styles: string[] = [];

  const baseStyle = renderStyle(element.style);

  if (baseStyle) {
    styles.push(baseStyle);
  }

  styles.push("display:flex");
  styles.push(`flex-direction:${element.direction}`);

  if (element.gap !== undefined) {
    styles.push(`gap:${renderLength(element.gap)}`);
  }

  if (element.width !== undefined) {
    styles.push(`width:${renderLength(element.width)}`);
  }

  const horizontalAlign =
    element.horizontalAlign ?? element.style?.horizontalAlign;

  const verticalAlign = element.verticalAlign ?? element.style?.verticalAlign;

  const distribution = element.distribution ?? "packed";

  const distributedMainAxis = renderDistribution(distribution);

  // ============================================================
  // BEGIN: CONTAINER ALIGNMENT + DISTRIBUTION
  // ============================================================

  if (element.direction === "row") {
    // ----------------------------------------------------------
    // MAIN AXIS = HORIZONTAL
    // ----------------------------------------------------------

    if (distributedMainAxis) {
      styles.push(`justify-content:${distributedMainAxis}`);
    } else if (horizontalAlign) {
      styles.push(
        `justify-content:${renderMainAxisAlignment(horizontalAlign)}`,
      );
    }

    // ----------------------------------------------------------
    // CROSS AXIS = VERTICAL
    // ----------------------------------------------------------

    if (verticalAlign) {
      styles.push(`align-items:${renderCrossAxisAlignment(verticalAlign)}`);
    }
  } else {
    // ----------------------------------------------------------
    // CROSS AXIS = HORIZONTAL
    // ----------------------------------------------------------

    if (horizontalAlign) {
      styles.push(`align-items:${renderCrossAxisAlignment(horizontalAlign)}`);
    }

    // ----------------------------------------------------------
    // MAIN AXIS = VERTICAL
    // ----------------------------------------------------------

    if (distributedMainAxis) {
      styles.push(`justify-content:${distributedMainAxis}`);
    } else if (verticalAlign) {
      styles.push(`justify-content:${renderMainAxisAlignment(verticalAlign)}`);
    }
  }

  // ============================================================
  // END: CONTAINER ALIGNMENT + DISTRIBUTION
  // ============================================================

  const classes = ["powershow-element", "powershow-container"];

  if (element.role) {
    classes.push(`powershow-container-${element.role}`);
  }

  const customClass = element.style?.className?.trim();

  if (customClass) {
    classes.push(customClass);
  }

  const tag = getTagName(element.role);

  const children = element.children.map(renderChild).join("");

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
    children +
    `</${tag}>`
  );
}

// ============================================================
// BEGIN: DISTRIBUTION RENDERING
// ============================================================

type Distribution = NonNullable<ContainerElement["distribution"]>;

function renderDistribution(value: Distribution): string | null {
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
// END: DISTRIBUTION RENDERING
// ============================================================
