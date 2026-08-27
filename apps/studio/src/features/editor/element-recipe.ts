import {
  mapPowerShowElementColorValues,
  type PowerShowElement,
  type PresentationPalette,
} from "@powershow/document-schema";

import { getSelectableElementProperties } from "./element-property-selection";

export interface ElementRecipeProperty {
  path: string;
  value: unknown;
}

export interface ElementRecipeDraft {
  type: PowerShowElement["type"];
  properties: ElementRecipeProperty[];
}

function getValueAtPath(element: PowerShowElement, path: string): unknown {
  let value: unknown = element;

  for (const segment of path.split(".")) {
    if (typeof value !== "object" || value === null || !(segment in value)) {
      return undefined;
    }
    value = (value as Record<string, unknown>)[segment];
  }

  return value;
}

function cloneValue(value: unknown): unknown {
  return structuredClone(value);
}

export class PaletteRecipeResolutionError extends Error {
  constructor(path: string) {
    super(`Custom Library recipe contains an unresolved palette reference at ${path}`);
    this.name = "PaletteRecipeResolutionError";
  }
}

export function extractElementRecipeDraft(
  element: PowerShowElement,
  selectedPaths: ReadonlySet<string>,
  palette?: PresentationPalette,
): ElementRecipeDraft {
  const mappedElement = mapPowerShowElementColorValues(element, (value, path) => {
    if (typeof value === "string") return value;
    const paletteColor = palette?.colors.find((color) => color.id === value.colorId);
    if (paletteColor === undefined) {
      throw new PaletteRecipeResolutionError(path.join("."));
    }
    return paletteColor.value;
  });
  const properties = getSelectableElementProperties(element)
    .filter((property) => selectedPaths.has(property.path))
    .map((property) => ({
      path: property.path,
      value: cloneValue(getValueAtPath(mappedElement, property.path)),
    }));

  return {
    type: element.type,
    properties,
  };
}
