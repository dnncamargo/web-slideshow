import type { PowerShowElement } from "@powershow/document-schema";

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

export function extractElementRecipeDraft(
  element: PowerShowElement,
  selectedPaths: ReadonlySet<string>,
): ElementRecipeDraft {
  const properties = getSelectableElementProperties(element)
    .filter((property) => selectedPaths.has(property.path))
    .map((property) => ({
      path: property.path,
      value: cloneValue(getValueAtPath(element, property.path)),
    }));

  return {
    type: element.type,
    properties,
  };
}
