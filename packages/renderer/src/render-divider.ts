import type {
  DividerElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderStyle } from "./render-style";

// ============================================================
// BEGIN: DIVIDER EFFECTIVE GEOMETRY DEFAULTS
//
// These are renderer-only defaults used when the canonical
// element does not declare explicit style dimensions. They are
// not persisted back to the document.
// ============================================================

const DIVIDER_DEFAULT_GEOMETRY: Readonly<
  Record<
    DividerElement["orientation"],
    Readonly<{ width: string; height: string }>
  >
> = {
  horizontal: {
    width: "100%",
    height: "2px",
  },

  vertical: {
    width: "2px",
    height: "100%",
  },
};

// ============================================================
// END: DIVIDER EFFECTIVE GEOMETRY DEFAULTS
// ============================================================

export function renderDivider(
  element: DividerElement,
): string {
  if (element.hidden) {
    return "";
  }

  const styles: string[] = [];

  const baseStyle = renderStyle(
    element.style,
  );

  if (baseStyle) {
    styles.push(baseStyle);
  }

  const defaults =
    DIVIDER_DEFAULT_GEOMETRY[
      element.orientation
    ];

  if (element.style?.width === undefined) {
    styles.push(`width:${defaults.width}`);
  }

  if (element.style?.height === undefined) {
    styles.push(`height:${defaults.height}`);
  }

  const hasBackground =
    element.style?.background !== undefined ||
    element.style?.backgroundGradient !== undefined;

  if (!hasBackground) {
    styles.push("background:currentColor");
  }

  const customClass =
    element.style?.className?.trim();

  const classes = [
    "powershow-element",
    "powershow-divider",
    `powershow-divider-${element.orientation}`,
  ];

  if (customClass) {
    classes.push(customClass);
  }

  return (
    `<div` +
    ` class="${escapeHtml(
      classes.join(" "),
    )}"` +
    ` role="separator"` +
    ` aria-orientation="${escapeHtml(
      element.orientation,
    )}"` +
    ` data-powershow-id="${escapeHtml(
      element.id,
    )}"` +
    ` data-powershow-type="divider"` +
    ` style="${escapeHtml(
      styles.join(";"),
    )}"` +
    `></div>`
  );
}