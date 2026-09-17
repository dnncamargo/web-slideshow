import {
  FundamentalTextStyleIdSchema,
  LinkedStyleSchema,
  PresentationSchema,
  TextStyleSchema,
  type LinkedStyle,
  type Presentation,
  type CustomTextStyle,
} from "@powershow/document-schema";

import type { CustomLibraryItemDraft } from "./custom-library-item";
import { addCustomLibraryFontToPresentation } from "./custom-library-font-apply";
import type { CustomLibraryElementRecipe } from "./custom-library-recipe";
import {
  placeCustomLibraryElementRecipe,
  type CustomLibraryPlacementMode,
} from "./custom-library-placement";
import type { CustomLibraryApplyFailureReason } from "./custom-library-apply";
import { createLinkedStyleId } from "../editor/linked-style-authoring";
import { createTextStyleId } from "../editor/text-style-helpers";

export type CustomLibraryItemApplyFailureReason =
  | CustomLibraryApplyFailureReason
  | "font-dependency-conflict";

export type CustomLibraryItemApplyResult =
  | {
      ok: true;
      presentation: Presentation;
      appliedElementId: string;
      mode: CustomLibraryPlacementMode;
    }
  | {
      ok: false;
      reason: CustomLibraryItemApplyFailureReason;
    };

type StyleRemap = {
  textStyles: Map<string, string>;
  linkedStyles: Map<string, string>;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, stableValue((value as Record<string, unknown>)[key])]),
  );
}

function structurallyEqual(first: unknown, second: unknown): boolean {
  return JSON.stringify(stableValue(first)) === JSON.stringify(stableValue(second));
}

function materializeTextStyles(
  presentation: Presentation,
  dependencies: readonly CustomTextStyle[] | undefined,
): { presentation: Presentation; remap: Map<string, string> } | null {
  let styles = [...(presentation.textStyles ?? [])];
  const remap = new Map<string, string>();
  const reservedIncomingIds = new Set((dependencies ?? []).map((style) => style.id));

  for (const dependency of dependencies ?? []) {
    const existing = styles.find((style) => style.id === dependency.id);
    if (existing !== undefined) {
      if (structurallyEqual(existing, dependency)) {
        remap.set(dependency.id, dependency.id);
        continue;
      }
      const id = createTextStyleId(dependency.name, [
        ...FundamentalTextStyleIdSchema.options,
        ...styles.map((style) => style.id),
        ...reservedIncomingIds,
      ]);
      const clone = { ...structuredClone(dependency), id };
      const parsed = TextStyleSchema.safeParse(clone);
      if (!parsed.success) return null;
      styles.push(parsed.data);
      remap.set(dependency.id, id);
      continue;
    }

    const parsed = TextStyleSchema.safeParse(structuredClone(dependency));
    if (!parsed.success) return null;
    styles.push(parsed.data);
    remap.set(dependency.id, dependency.id);
  }

  const next = styles.length === 0
    ? (() => {
        const { textStyles: _removed, ...withoutStyles } = presentation;
        return withoutStyles;
      })()
    : { ...presentation, textStyles: styles };
  const parsedPresentation = PresentationSchema.safeParse(next);
  return parsedPresentation.success ? { presentation: parsedPresentation.data, remap } : null;
}

function materializeLinkedStyles(
  presentation: Presentation,
  dependencies: readonly LinkedStyle[] | undefined,
): { presentation: Presentation; remap: Map<string, string> } | null {
  let styles = [...(presentation.linkedStyles ?? [])];
  const remap = new Map<string, string>();
  const reservedIncomingIds = new Set((dependencies ?? []).map((style) => style.id));

  for (const dependency of dependencies ?? []) {
    const existing = styles.find((style) => style.id === dependency.id);
    if (existing !== undefined) {
      if (structurallyEqual(existing, dependency)) {
        remap.set(dependency.id, dependency.id);
        continue;
      }
      const id = createLinkedStyleId(dependency.name, [
        ...styles.map((style) => style.id),
        ...reservedIncomingIds,
      ]);
      const clone = { ...structuredClone(dependency), id };
      const parsed = LinkedStyleSchema.safeParse(clone);
      if (!parsed.success) return null;
      styles.push(parsed.data);
      remap.set(dependency.id, id);
      continue;
    }

    const parsed = LinkedStyleSchema.safeParse(structuredClone(dependency));
    if (!parsed.success) return null;
    styles.push(parsed.data);
    remap.set(dependency.id, dependency.id);
  }

  const next = styles.length === 0
    ? (() => {
        const { linkedStyles: _removed, ...withoutStyles } = presentation;
        return withoutStyles;
      })()
    : { ...presentation, linkedStyles: styles };
  const parsedPresentation = PresentationSchema.safeParse(next);
  return parsedPresentation.success ? { presentation: parsedPresentation.data, remap } : null;
}

function remapCanonicalElement(
  value: unknown,
  remap: StyleRemap,
): void {
  if (!isRecord(value)) return;
  if (typeof value.variant === "string") {
    value.variant = remap.textStyles.get(value.variant) ?? value.variant;
  }
  if (typeof value.linkedStyleId === "string") {
    value.linkedStyleId = remap.linkedStyles.get(value.linkedStyleId) ?? value.linkedStyleId;
  }
  if (value.type === "container" && Array.isArray(value.children)) {
    value.children.forEach((child) => remapCanonicalElement(child, remap));
  }
  if (value.type === "topics" && Array.isArray(value.items)) {
    value.items.forEach((item) => {
      if (!isRecord(item)) return;
      remapContentSlot(item.content, remap);
      remapTopics(item.children, remap);
    });
  }
  if (value.type === "table" && value.mode === "structured") {
    remapTable(value.columns, remap);
    remapTable(value.rows, remap);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function remapContentSlot(value: unknown, remap: StyleRemap): void {
  if (!isRecord(value) || !Array.isArray(value.children)) return;
  value.children.forEach((child) => remapCanonicalElement(child, remap));
}

function remapTopics(value: unknown, remap: StyleRemap): void {
  if (!Array.isArray(value)) return;
  value.forEach((item) => {
    if (!isRecord(item)) return;
    remapContentSlot(item.content, remap);
    remapTopics(item.children, remap);
  });
}

function remapTable(value: unknown, remap: StyleRemap): void {
  if (!Array.isArray(value)) return;
  value.forEach((entry) => {
    if (!isRecord(entry)) return;
    remapContentSlot(entry.header, remap);
    if (Array.isArray(entry.cells)) {
      entry.cells.forEach((cell) => remapContentSlot(cell, remap));
    }
  });
}

function remapRecipe(recipe: CustomLibraryElementRecipe, remap: StyleRemap): CustomLibraryElementRecipe {
  const working = structuredClone(recipe);
  working.properties.forEach((property) => {
    if (property.path === "variant" && typeof property.value === "string") {
      property.value = remap.textStyles.get(property.value) ?? property.value;
    }
    if (property.path === "linkedStyleId" && typeof property.value === "string") {
      property.value = remap.linkedStyles.get(property.value) ?? property.value;
    }
    if (working.type === "topics" && property.path === "items") {
      remapTopics(property.value, remap);
    }
    if (working.type === "table" && (property.path === "columns" || property.path === "rows")) {
      remapTable(property.value, remap);
    }
  });
  working.children?.forEach((child) => {
    const remapped = remapRecipe(child, remap);
    child.properties = remapped.properties;
    child.children = remapped.children;
  });
  return working;
}

function isLinkedStyleCompatible(
  linked: LinkedStyle | undefined,
  elementType: string,
): boolean {
  if (linked === undefined) return false;
  if (elementType === "container") return !("target" in linked);
  if (elementType === "topics") return "target" in linked && linked.target === "topics";
  return false;
}

function referencesHaveBacking(
  recipe: CustomLibraryElementRecipe,
  presentation: Presentation,
  dependencies: CustomLibraryItemDraft["dependencies"],
): boolean {
  const textStyleIds = new Set([
    ...(presentation.textStyles ?? []).map((style) => style.id),
    ...(dependencies?.textStyles ?? []).map((style) => style.id),
  ]);
  const linkedStyles = new Map<string, LinkedStyle>(
    (presentation.linkedStyles ?? []).map((style) => [style.id, style]),
  );
  (dependencies?.linkedStyles ?? []).forEach((style) => linkedStyles.set(style.id, style));

  const checkElement = (value: unknown): boolean => {
    if (!isRecord(value)) return true;
    if (typeof value.variant === "string" &&
        !FundamentalTextStyleIdSchema.safeParse(value.variant).success &&
        !textStyleIds.has(value.variant)) return false;
    if (typeof value.linkedStyleId === "string" &&
        !isLinkedStyleCompatible(linkedStyles.get(value.linkedStyleId), typeof value.type === "string" ? value.type : "")) return false;
    if (value.type === "container" && Array.isArray(value.children) && !value.children.every(checkElement)) return false;
    if (value.type === "topics" && Array.isArray(value.items)) {
      return value.items.every((item) => {
        if (!isRecord(item)) return true;
        return checkSlot(item.content) && checkTopics(item.children);
      });
    }
    if (value.type === "table" && value.mode === "structured") {
      return checkTable(value.columns) && checkTable(value.rows);
    }
    return true;
  };
  const checkSlot = (value: unknown): boolean =>
    !isRecord(value) || !Array.isArray(value.children) || value.children.every(checkElement);
  const checkTopics = (value: unknown): boolean =>
    !Array.isArray(value) || value.every((item) => {
      if (!isRecord(item)) return true;
      return checkSlot(item.content) && checkTopics(item.children);
    });
  const checkTable = (value: unknown): boolean =>
    !Array.isArray(value) || value.every((entry) => {
      if (!isRecord(entry)) return true;
      return checkSlot(entry.header) && (!Array.isArray(entry.cells) || entry.cells.every(checkSlot));
    });
  const checkRecipe = (current: CustomLibraryElementRecipe): boolean => {
    if (current.type !== "container" && current.type !== "topics") {
      if (current.properties.some((property) => property.path === "linkedStyleId")) return false;
    }
    for (const property of current.properties) {
      if (property.path === "variant" && typeof property.value === "string" &&
          !FundamentalTextStyleIdSchema.safeParse(property.value).success &&
          !textStyleIds.has(property.value)) return false;
      if (property.path === "linkedStyleId" && typeof property.value === "string" &&
          !isLinkedStyleCompatible(linkedStyles.get(property.value), current.type)) return false;
      if (current.type === "topics" && property.path === "items" && !checkTopics(property.value)) return false;
      if (current.type === "table" && (property.path === "columns" || property.path === "rows") && !checkTable(property.value)) return false;
    }
    return current.children?.every(checkRecipe) ?? true;
  };

  return checkRecipe(recipe);
}

function recipeReferencesResolve(
  recipe: CustomLibraryElementRecipe,
  presentation: Presentation,
): boolean {
  const textStyleIds = new Set((presentation.textStyles ?? []).map((style) => style.id));
  let valid = true;
  const checkElement = (value: unknown): void => {
    if (!isRecord(value)) return;
    if (typeof value.variant === "string" && !FundamentalTextStyleIdSchema.safeParse(value.variant).success && !textStyleIds.has(value.variant)) valid = false;
    if (typeof value.linkedStyleId === "string" && !isLinkedStyleCompatible(
      presentation.linkedStyles?.find((style) => style.id === value.linkedStyleId),
      typeof value.type === "string" ? value.type : "",
    )) valid = false;
    if (value.type === "container" && Array.isArray(value.children)) value.children.forEach(checkElement);
    if (value.type === "topics" && Array.isArray(value.items)) value.items.forEach((item) => {
      if (!isRecord(item)) return;
      checkSlot(item.content);
      checkTopics(item.children);
    });
    if (value.type === "table" && value.mode === "structured") {
      checkTable(value.columns);
      checkTable(value.rows);
    }
  };
  const checkSlot = (value: unknown): void => {
    if (!isRecord(value) || !Array.isArray(value.children)) return;
    value.children.forEach(checkElement);
  };
  const checkTopics = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    value.forEach((item) => {
      if (!isRecord(item)) return;
      checkSlot(item.content);
      checkTopics(item.children);
    });
  };
  const checkTable = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    value.forEach((entry) => {
      if (!isRecord(entry)) return;
      checkSlot(entry.header);
      if (Array.isArray(entry.cells)) entry.cells.forEach((cell) => checkSlot(cell));
    });
  };
  const checkRecipe = (current: CustomLibraryElementRecipe): void => {
    current.properties.forEach((property) => {
      if (property.path === "variant" && typeof property.value === "string" && !FundamentalTextStyleIdSchema.safeParse(property.value).success && !textStyleIds.has(property.value)) valid = false;
      if (property.path === "linkedStyleId" && typeof property.value === "string" && !isLinkedStyleCompatible(
        presentation.linkedStyles?.find((style) => style.id === property.value),
        current.type,
      )) valid = false;
      if (current.type === "topics" && property.path === "items") {
        checkTopics(property.value);
      }
      if (current.type === "table" && (property.path === "columns" || property.path === "rows")) checkTable(property.value);
    });
    current.children?.forEach(checkRecipe);
  };
  checkRecipe(recipe);
  return valid;
}

export function applyCustomLibraryItemToPresentation(
  item: CustomLibraryItemDraft,
  presentation: Presentation,
  selectedSlideIndex: number,
  selectedElementId: string | null,
): CustomLibraryItemApplyResult {
  if (!presentation.slides[selectedSlideIndex]) {
    return { ok: false, reason: "invalid-recipe-application" };
  }

  if (!referencesHaveBacking(item.root, presentation, item.dependencies)) {
    return { ok: false, reason: "invalid-recipe-application" };
  }

  let workingPresentation = presentation;
  for (const dependency of item.dependencies?.fonts ?? []) {
    const result = addCustomLibraryFontToPresentation(workingPresentation, dependency);
    if (result.kind === "conflict") {
      return { ok: false, reason: "font-dependency-conflict" };
    }
    workingPresentation = result.presentation;
  }

  const textStyles = materializeTextStyles(workingPresentation, item.dependencies?.textStyles);
  if (textStyles === null) {
    return { ok: false, reason: "invalid-recipe-application" };
  }
  workingPresentation = textStyles.presentation;

  const linkedStyles = materializeLinkedStyles(workingPresentation, item.dependencies?.linkedStyles);
  if (linkedStyles === null) {
    return { ok: false, reason: "invalid-recipe-application" };
  }
  workingPresentation = linkedStyles.presentation;

  const workingRecipe = remapRecipe(item.root, {
    textStyles: textStyles.remap,
    linkedStyles: linkedStyles.remap,
  });
  if (!recipeReferencesResolve(workingRecipe, workingPresentation)) {
    return { ok: false, reason: "invalid-recipe-application" };
  }

  const workingSlide = workingPresentation.slides[selectedSlideIndex];
  if (!workingSlide) {
    return { ok: false, reason: "invalid-recipe-application" };
  }

  const placement = placeCustomLibraryElementRecipe(
    workingRecipe,
    workingSlide,
    workingPresentation.slides,
    selectedElementId,
  );
  if (!placement.ok) {
    return placement;
  }

  return {
    ok: true,
    presentation: {
      ...workingPresentation,
      slides: workingPresentation.slides.map((slide, index) =>
        index === selectedSlideIndex ? placement.slide : slide,
      ),
    },
    appliedElementId: placement.appliedElementId,
    mode: placement.mode,
  };
}
