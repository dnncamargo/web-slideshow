import {
  getFontResourceFaces,
  type FontResource,
} from "@powershow/document-schema";

import { normalizeFontFamily } from "../fonts/font-face-helpers";
import type { CustomLibraryElementRecipe } from "./custom-library-recipe";
import type { CustomLibraryFontDraft } from "./custom-library-font";

export interface CustomLibraryStyleDependencies {
  fonts?: CustomLibraryFontDraft[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function collectTypographyFamily(value: unknown, families: Set<string>): void {
  if (!isRecord(value) || !isRecord(value.typography)) return;
  if (typeof value.typography.fontFamily === "string") {
    families.add(value.typography.fontFamily);
  }
}

function collectContentSlotFamilies(value: unknown, families: Set<string>): void {
  if (!isRecord(value)) return;

  collectTypographyFamily(value, families);
  if (Array.isArray(value.children)) {
    value.children.forEach((child) => collectCanonicalElementFamilies(child, families));
  }
}

function collectTopicFamilies(value: unknown, families: Set<string>): void {
  if (!Array.isArray(value)) return;

  value.forEach((item) => {
    if (!isRecord(item)) return;
    collectContentSlotFamilies(item.content, families);
    collectTopicFamilies(item.children, families);
  });
}

function collectTableFamilies(value: unknown, families: Set<string>): void {
  if (!Array.isArray(value)) return;

  value.forEach((entry) => {
    if (!isRecord(entry)) return;
    collectContentSlotFamilies(entry.header, families);
    if (Array.isArray(entry.cells)) {
      entry.cells.forEach((cell) => collectContentSlotFamilies(cell, families));
    }
  });
}

function collectCanonicalElementFamilies(value: unknown, families: Set<string>): void {
  if (!isRecord(value)) return;

  collectTypographyFamily(value, families);
  if (value.type === "container" && Array.isArray(value.children)) {
    value.children.forEach((child) => collectCanonicalElementFamilies(child, families));
  }
  if (value.type === "topics") {
    collectTopicFamilies(value.items, families);
  }
  if (value.type === "table" && value.mode === "structured") {
    collectTableFamilies(value.columns, families);
    collectTableFamilies(value.rows, families);
  }
}

function collectBoundedPayloadFamilies(
  recipe: CustomLibraryElementRecipe,
  property: { path: string; value: unknown },
  families: Set<string>,
): void {
  if (recipe.type === "topics" && property.path === "items") {
    collectTopicFamilies(property.value, families);
  }
  if (recipe.type === "table" && (property.path === "columns" || property.path === "rows")) {
    collectTableFamilies(property.value, families);
  }
}

export function collectCustomLibraryStyleFontFamilies(
  recipe: CustomLibraryElementRecipe,
): string[] {
  const families = new Set<string>();
  recipe.properties.forEach((property) => {
    if (property.path === "typography.fontFamily" && typeof property.value === "string") {
      families.add(property.value);
    }
    collectBoundedPayloadFamilies(recipe, property, families);
  });
  recipe.children?.forEach((child) => {
    collectCustomLibraryStyleFontFamilies(child).forEach((family) => families.add(family));
  });
  return [...families];
}

export function snapshotCustomLibraryStyleFontDependencies(
  recipe: CustomLibraryElementRecipe,
  fontResources: readonly FontResource[] | undefined,
): CustomLibraryStyleDependencies | undefined {
  if (!fontResources || fontResources.length === 0) return undefined;

  const resourcesByFamily = new Map<string, FontResource>();
  fontResources.forEach((resource) => {
    const normalizedFamily = normalizeFontFamily(resource.family);
    if (!resourcesByFamily.has(normalizedFamily)) {
      resourcesByFamily.set(normalizedFamily, resource);
    }
  });

  const fonts: CustomLibraryFontDraft[] = [];
  const capturedFamilies = new Set<string>();
  collectCustomLibraryStyleFontFamilies(recipe).forEach((family) => {
    const normalizedFamily = normalizeFontFamily(family);
    if (capturedFamilies.has(normalizedFamily)) return;
    const resource = resourcesByFamily.get(normalizedFamily);
    if (!resource) return;
    capturedFamilies.add(normalizedFamily);
    fonts.push({
      family: resource.family,
      faces: structuredClone([...getFontResourceFaces(resource)]),
    });
  });

  return fonts.length > 0 ? { fonts } : undefined;
}
