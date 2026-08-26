import {
  detachColorValue,
  isPaletteColorReference,
  type ColorValue,
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

function resolveColor(value: ColorValue, palette: PresentationPalette | undefined, path: string): string {
  const resolved = detachColorValue(value, palette);
  if (resolved === undefined) throw new PaletteRecipeResolutionError(path);
  return resolved;
}

function resolveRecipeValue(value: unknown, path: string, palette: PresentationPalette | undefined): unknown {
  if (isPaletteColorReference(value as ColorValue)) {
    return resolveColor(value as ColorValue, palette, path);
  }
  if (path === "effect.shadow" || path === "typography.textStroke") {
    const atomic = value as { color?: ColorValue };
    if (atomic.color !== undefined) return { ...cloneValue(value) as object, color: resolveColor(atomic.color, palette, `${path}.color`) };
  }
  if (path === "style.background.gradient" || path === "style.border.gradient") {
    const gradient = value as { stops?: Array<{ color: ColorValue }> };
    if (gradient.stops) return {
      ...cloneValue(value) as object,
      stops: gradient.stops.map((stop, index) => ({ ...stop, color: resolveColor(stop.color, palette, `${path}.stops.${index}.color`) })),
    };
  }
  return cloneValue(value);
}

export function extractElementRecipeDraft(
  element: PowerShowElement,
  selectedPaths: ReadonlySet<string>,
  palette?: PresentationPalette,
): ElementRecipeDraft {
  const properties = getSelectableElementProperties(element)
    .filter((property) => selectedPaths.has(property.path))
    .map((property) => ({
      path: property.path,
      value: resolveRecipeValue(getValueAtPath(element, property.path), property.path, palette),
    }));

  return {
    type: element.type,
    properties,
  };
}
