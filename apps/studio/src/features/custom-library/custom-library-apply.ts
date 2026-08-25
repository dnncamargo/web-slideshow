import {
  PowerShowElementSchema,
  type PowerShowElement,
  type Slide,
} from "@powershow/document-schema";

import {
  createElement,
  duplicateElement,
  type ElementCreateType,
} from "../editor/element-operations";
import type { CustomLibraryElementRecipe } from "./custom-library-recipe";

export type CustomLibraryApplyFailureReason =
  | "unsupported-create-type"
  | "invalid-recipe-application"
  | "type-mismatch";

export type CustomLibraryElementApplyResult =
  | { ok: true; element: PowerShowElement }
  | { ok: false; reason: CustomLibraryApplyFailureReason };

const ELEMENT_CREATE_TYPES: ReadonlySet<PowerShowElement["type"]> = new Set([
  "text",
  "container",
  "image",
  "code",
  "terminal",
  "table",
  "topics",
  "divider",
  "gallery",
  "embed",
  "blocks",
  "scripted",
]);

const FORBIDDEN_PATH_SEGMENTS = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

function isElementCreateType(type: PowerShowElement["type"]): type is ElementCreateType {
  return ELEMENT_CREATE_TYPES.has(type);
}

function cloneValue(value: unknown): unknown {
  return structuredClone(value);
}

function applyProperty(
  target: PowerShowElement,
  path: string,
  value: unknown,
): boolean {
  const segments = path.split(".");

  if (
    segments.length === 0 ||
    segments.some((segment) =>
      segment.length === 0 || FORBIDDEN_PATH_SEGMENTS.has(segment),
    )
  ) {
    return false;
  }

  let current: unknown = target;

  for (const segment of segments.slice(0, -1)) {
    if (
      typeof current !== "object" ||
      current === null ||
      Array.isArray(current)
    ) {
      return false;
    }

    const record = current as Record<string, unknown>;
    const next = record[segment];

    if (next === undefined) {
      const created: Record<string, unknown> = {};
      record[segment] = created;
      current = created;
      continue;
    }

    if (typeof next !== "object" || next === null || Array.isArray(next)) {
      return false;
    }

    current = next;
  }

  if (typeof current !== "object" || current === null || Array.isArray(current)) {
    return false;
  }

  (current as Record<string, unknown>)[segments[segments.length - 1]!] =
    cloneValue(value);
  return true;
}

function applyRecipeProperties(
  candidate: PowerShowElement,
  recipe: CustomLibraryElementRecipe,
): boolean {
  return recipe.properties.every((property) =>
    applyProperty(candidate, property.path, property.value),
  );
}

function validateElement(element: PowerShowElement): PowerShowElement | null {
  const parsed = PowerShowElementSchema.safeParse(element);
  return parsed.success ? parsed.data : null;
}

function buildRawCreateCandidate(
  recipe: CustomLibraryElementRecipe,
  slides: readonly Slide[],
): { ok: true; element: PowerShowElement } | { ok: false; reason: CustomLibraryApplyFailureReason } {
  if (!isElementCreateType(recipe.type)) {
    return { ok: false, reason: "unsupported-create-type" };
  }

  const candidate = createElement(recipe.type, slides);

  if (!applyRecipeProperties(candidate, recipe)) {
    return { ok: false, reason: "invalid-recipe-application" };
  }

  if (recipe.children !== undefined) {
    if (recipe.type !== "container") {
      return { ok: false, reason: "invalid-recipe-application" };
    }

    if (candidate.type !== "container") {
      return { ok: false, reason: "invalid-recipe-application" };
    }

    const children: PowerShowElement[] = [];
    for (const childRecipe of recipe.children) {
      const child = buildRawCreateCandidate(childRecipe, slides);
      if (!child.ok) {
        return child;
      }
      children.push(child.element);
    }
    candidate.children = children;
  }

  const validated = validateElement(candidate);
  return validated
    ? { ok: true, element: validated }
    : { ok: false, reason: "invalid-recipe-application" };
}

export function materializeCustomLibraryElementRecipe(
  recipe: CustomLibraryElementRecipe,
  slides: readonly Slide[],
): CustomLibraryElementApplyResult {
  const raw = buildRawCreateCandidate(recipe, slides);
  if (!raw.ok) {
    return raw;
  }

  const element = validateElement(duplicateElement(raw.element, slides));
  return element
    ? { ok: true, element }
    : { ok: false, reason: "invalid-recipe-application" };
}

export function mergeCustomLibraryElementRecipe(
  recipe: CustomLibraryElementRecipe,
  target: PowerShowElement,
  slides: readonly Slide[],
): CustomLibraryElementApplyResult {
  if (recipe.type !== target.type) {
    return { ok: false, reason: "type-mismatch" };
  }

  const candidate = structuredClone(target);
  const existingChildrenCount = target.type === "container"
    ? target.children.length
    : 0;

  if (!applyRecipeProperties(candidate, recipe)) {
    return { ok: false, reason: "invalid-recipe-application" };
  }

  if (recipe.children !== undefined) {
    if (candidate.type !== "container") {
      return { ok: false, reason: "invalid-recipe-application" };
    }

    const children: PowerShowElement[] = [];
    for (const childRecipe of recipe.children) {
      const child = buildRawCreateCandidate(childRecipe, slides);
      if (!child.ok) {
        return child;
      }
      children.push(child.element);
    }
    candidate.children = [...candidate.children, ...children];
  }

  const validatedCandidate = validateElement(candidate);
  if (!validatedCandidate) {
    return { ok: false, reason: "invalid-recipe-application" };
  }

  const freshCandidate = duplicateElement(validatedCandidate, slides);
  const result = structuredClone(target);

  for (const property of recipe.properties) {
    const freshValue = readProperty(freshCandidate, property.path);
    if (!freshValue.found || !applyProperty(result, property.path, freshValue.value)) {
      return { ok: false, reason: "invalid-recipe-application" };
    }
  }

  if (recipe.children !== undefined) {
    if (result.type !== "container" || freshCandidate.type !== "container") {
      return { ok: false, reason: "invalid-recipe-application" };
    }
    result.children = [
      ...result.children,
      ...freshCandidate.children.slice(existingChildrenCount),
    ];
  }

  const validatedResult = validateElement(result);
  return validatedResult
    ? { ok: true, element: validatedResult }
    : { ok: false, reason: "invalid-recipe-application" };
}

function readProperty(
  target: PowerShowElement,
  path: string,
): { found: true; value: unknown } | { found: false } {
  const segments = path.split(".");
  let current: unknown = target;

  for (const segment of segments) {
    if (
      segment.length === 0 ||
      FORBIDDEN_PATH_SEGMENTS.has(segment) ||
      typeof current !== "object" ||
      current === null ||
      Array.isArray(current) ||
      !(segment in current)
    ) {
      return { found: false };
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return { found: true, value: current };
}
