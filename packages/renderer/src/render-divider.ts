import type {
  DividerElement,
  Presentation,
} from "@web-slideshow/document-schema";
import { resolveLinkedDividerStyle } from "@web-slideshow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderLength } from "./render-length";
import { renderBackground } from "./render-visual";

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
  presentation?: Presentation,
): string {
  if (element.hidden) {
    return "";
  }

  if (element.linkedStyleId !== undefined && presentation === undefined) {
    throw new Error(`Cannot render linked divider style without presentation context: ${element.linkedStyleId}`);
  }
  const resolved = element.linkedStyleId === undefined
    ? {}
    : resolveLinkedDividerStyle(presentation!, element);
  const effectiveElement = { ...element, ...resolved };
  const styles: string[] = [];

  const layout = effectiveElement.layout;
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
      effectiveElement.orientation
    ];

  if (layout?.width === undefined) {
    styles.push(`width:${defaults.width}`);
  }

  if (layout?.height === undefined) {
    styles.push(`height:${defaults.height}`);
  }

  if (effectiveElement.style?.background?.color === undefined) {
    styles.push("background:currentColor");
  }

  if (effectiveElement.style?.background !== undefined) {
    styles.push(...renderBackground(effectiveElement.style.background));
  }

  if (effectiveElement.style?.borderRadius !== undefined) styles.push(`border-radius:${renderLength(effectiveElement.style.borderRadius)}`);
  if (effectiveElement.effect?.opacity !== undefined) styles.push(`opacity:${effectiveElement.effect.opacity}`);

  const customClass =
    effectiveElement.style?.className?.trim();

  const classes = [
    "presentation-element",
    "presentation-divider",
    `presentation-divider-${effectiveElement.orientation}`,
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
      effectiveElement.orientation,
    )}"` +
    ` data-presentation-id="${escapeHtml(
      element.id,
    )}"` +
    ` data-presentation-type="divider"` +
    ` style="${escapeHtml(
      styles.join(";"),
    )}"` +
    `></div>`
  );
}
