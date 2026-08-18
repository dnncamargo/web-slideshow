import type {
  ContainerElement,
  ElementLink,
  PowerShowElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderStyle } from "./render-style";
import { isAbsolutePlacement } from "./render-placement";

import { renderLength } from "./render-length";

type RenderChild = (element: PowerShowElement) => string;

type Alignment = "start" | "center" | "end" | "stretch";

// ============================================================
// BEGIN: CONTAINER LINK SURFACE
//
// A linked Container renders one clickable surface covering its
// whole box. The surface is an internal transparent anchor overlay
// owned by the renderer; the Container keeps its semantic root
// (<div>, <main>, <header> or <footer>).
//
// The overlay is positioned against the Container box and must win
// pointer input over rendered descendants, including linked child
// elements. The linked Container root therefore creates a stacking
// context (z-index:0) that traps descendant layers, and the surface
// itself uses a deterministic overlay z-index owned by the renderer.
// One pointer click still produces at most one navigation because
// only the topmost native anchor at the clicked point activates.
// ============================================================

const CONTAINER_LINK_SURFACE_Z_INDEX = 100;

// ============================================================
// END: CONTAINER LINK SURFACE
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
    : child.replace(/^(<[^\s>]+)/, `$1 style=\"${stackArea}\"`);
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

// The Container box is the containing block for the absolute link
// surface. Absolute placement and explicit non-static positioning
// already establish a containing block; anything else needs the
// smallest renderer-only requirement: position:relative.
function establishesContainingBlock(
  element: ContainerElement,
  hasAbsoluteChild: boolean,
): boolean {
  if (hasAbsoluteChild) {
    return true;
  }

  if (element.style?.placement?.mode === "absolute") {
    return true;
  }

  const position = element.style?.position;

  return position !== undefined && position !== "static";
}

function renderContainerLinkSurface(link: ElementLink): string {
  const attributes: string[] = [
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

  const styles: string[] = [];

  const baseStyle = renderStyle(element.style);

  if (baseStyle) {
    styles.push(baseStyle);
  }

  const isStack = element.layoutMode === "stack";
  const hasAbsoluteChild = element.children.some((child) =>
    isAbsolutePlacement(child.style?.placement),
  );

  const isLinked = element.link !== undefined;

  styles.push(isStack ? "display:grid" : "display:flex");

  if (hasAbsoluteChild) {
    styles.push("position:relative");
  }

  // A linked Container becomes the containing block for its internal
  // link-surface overlay. If the container is not already positioned
  // by canonical style/placement, add the smallest renderer-only
  // requirement (position:relative). Preserve canonical positioning
  // otherwise.
  if (isLinked && !establishesContainingBlock(element, hasAbsoluteChild)) {
    styles.push("position:relative");
  }

  // The linked Container root establishes a stacking context so
  // descendant positioned layers (including nested linked surfaces)
  // are trapped beneath the renderer-owned overlay z-index. This is
  // what makes the largest linked Container capture the pointer.
  if (isLinked) {
    styles.push("z-index:0");
  }

  if (!isStack) {
    styles.push(`flex-direction:${element.direction}`);
  }

  if (!isStack && element.gap !== undefined) {
    styles.push(`gap:${renderLength(element.gap)}`);
  }

  if (element.width !== undefined) {
    styles.push(`width:${renderLength(element.width)}`);
  }

  const horizontalAlign =
    element.horizontalAlign ?? element.style?.horizontalAlign;

  const verticalAlign = element.verticalAlign ?? element.style?.verticalAlign;

  if (isStack) {
    if (horizontalAlign) {
      styles.push(`justify-items:${renderGridAlignment(horizontalAlign)}`);
    }

    if (verticalAlign) {
      styles.push(`align-items:${renderGridAlignment(verticalAlign)}`);
    }
  } else {
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

  const children = element.children
    .map((child) => {
      const renderedChild = renderChild(child);

      return isStack ? renderStackChild(renderedChild) : renderedChild;
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
    children +
    (element.link ? renderContainerLinkSurface(element.link) : "") +
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
