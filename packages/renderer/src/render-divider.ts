import type {
  DividerElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderLength } from "./render-length";

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

  const layout = element.layout;
  if (layout) {
    if (layout.width !== undefined) styles.push(`width:${renderLength(layout.width)}`);
    if (layout.height !== undefined) styles.push(`height:${renderLength(layout.height)}`);
    if (layout.position !== undefined) styles.push(`position:${layout.position}`);
    for (const [property, value] of [["top", layout.top], ["right", layout.right], ["bottom", layout.bottom], ["left", layout.left]] as const) {
      if (value !== undefined) styles.push(`${property}:${renderLength(value)}`);
    }
  }

  const defaults =
    DIVIDER_DEFAULT_GEOMETRY[
      element.orientation
    ];

  if (layout?.width === undefined) {
    styles.push(`width:${defaults.width}`);
  }

  if (layout?.height === undefined) {
    styles.push(`height:${defaults.height}`);
  }

  if (element.style?.background?.color !== undefined) {
    styles.push(`background:${element.style.background.color}`);
  } else {
    styles.push("background:currentColor");
  }

  if (element.style?.borderRadius !== undefined) styles.push(`border-radius:${renderLength(element.style.borderRadius)}`);
  if (element.effect?.opacity !== undefined) styles.push(`opacity:${element.effect.opacity}`);

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
