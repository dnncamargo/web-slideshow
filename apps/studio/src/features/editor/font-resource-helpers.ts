import type {
  ContentSlot,
  PowerShowElement,
  Presentation,
  TopicItem,
} from "@powershow/document-schema";

export {
  areFontFacesEquivalent,
  normalizeFontFamily,
} from "@/features/fonts/font-face-helpers";
import { normalizeFontFamily } from "@/features/fonts/font-face-helpers";
import { someElement } from "./element-tree";

export function createFontResourceId(
  family: string,
  existingIds: readonly string[],
): string {
  const baseId =
    family
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "font";
  const usedIds = new Set(existingIds);

  if (!usedIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;

  while (usedIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

function matchesFontFamily(
  fontFamily: string | undefined,
  normalizedFamily: string,
): boolean {
  return fontFamily !== undefined && normalizeFontFamily(fontFamily) === normalizedFamily;
}

function contentSlotUsesFontFamily(
  slot: ContentSlot,
  normalizedFamily: string,
): boolean {
  return matchesFontFamily(slot.typography?.fontFamily, normalizedFamily) ||
    someElement(slot.children, (element) => elementUsesFontFamily(element, normalizedFamily));
}

function topicItemsUseFontFamily(
  items: readonly TopicItem[],
  normalizedFamily: string,
): boolean {
  return items.some((item) =>
    contentSlotUsesFontFamily(item.content, normalizedFamily) ||
    topicItemsUseFontFamily(item.children, normalizedFamily),
  );
}

function structuredTableSlotsUseFontFamily(
  element: Extract<PowerShowElement, { type: "table"; mode: "structured" }>,
  normalizedFamily: string,
): boolean {
  return element.columns.some((column) => contentSlotUsesFontFamily(column.header, normalizedFamily)) ||
    element.rows.some((row) => row.cells.some((cell) => contentSlotUsesFontFamily(cell, normalizedFamily)));
}

function elementUsesFontFamily(
  element: PowerShowElement,
  normalizedFamily: string,
): boolean {
  if (
    (element.type === "container" || element.type === "text" || element.type === "topics") &&
    matchesFontFamily(element.typography?.fontFamily, normalizedFamily)
  ) {
    return true;
  }

  if (element.type === "code" || element.type === "terminal") {
    if (matchesFontFamily(element.typography?.fontFamily, normalizedFamily)) {
      return true;
    }
  }

  if (element.type === "table" && element.mode !== "structured" && matchesFontFamily(element.typography?.fontFamily, normalizedFamily)) {
    return true;
  }

  if (element.type === "terminal" && matchesFontFamily(element.titleTypography?.fontFamily, normalizedFamily)) {
    return true;
  }

  if (element.type === "table" && element.mode === "structured" && structuredTableSlotsUseFontFamily(element, normalizedFamily)) {
    return true;
  }

  if (element.type === "topics" && topicItemsUseFontFamily(element.items, normalizedFamily)) {
    return true;
  }

  return false;
}

export function presentationUsesFontFamily(
  presentation: Presentation,
  family: string,
): boolean {
  const normalizedFamily = normalizeFontFamily(family);

  return presentation.slides.some((slide) =>
    someElement(slide.elements, (element) => elementUsesFontFamily(element, normalizedFamily)),
  ) || (presentation.textStyles ?? []).some((style) =>
    matchesFontFamily(style.typography?.fontFamily, normalizedFamily),
  ) || (presentation.linkedStyles ?? []).some((style) =>
    matchesFontFamily(style.typography?.fontFamily, normalizedFamily),
  );
}
