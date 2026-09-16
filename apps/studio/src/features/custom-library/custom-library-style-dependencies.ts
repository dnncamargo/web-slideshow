import {
  getFontResourceFaces,
  FundamentalTextStyleIdSchema,
  mapPresentationColorValues,
  type FontResource,
  type LinkedStyle,
  type CustomTextStyle,
  type PresentationPalette,
  type TextStyle,
} from "@powershow/document-schema";

import { normalizeFontFamily } from "../fonts/font-face-helpers";
import type { CustomLibraryElementRecipe } from "./custom-library-recipe";
import type { CustomLibraryFontDraft } from "./custom-library-font";

export interface CustomLibraryStyleDependencies {
  fonts?: CustomLibraryFontDraft[];
  textStyles?: CustomTextStyle[];
  linkedStyles?: LinkedStyle[];
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

function collectCanonicalElementReferences(
  value: unknown,
  textStyleIds: Set<string>,
  linkedStyleIds: Set<string>,
): void {
  if (!isRecord(value)) return;

  if (typeof value.variant === "string" && !FundamentalTextStyleIdSchema.safeParse(value.variant).success) {
    textStyleIds.add(value.variant);
  }
  if (typeof value.linkedStyleId === "string") {
    linkedStyleIds.add(value.linkedStyleId);
  }

  if (value.type === "container" && Array.isArray(value.children)) {
    value.children.forEach((child) => collectCanonicalElementReferences(child, textStyleIds, linkedStyleIds));
  }
  if (value.type === "topics" && Array.isArray(value.items)) {
    value.items.forEach((item) => {
      if (!isRecord(item)) return;
      collectContentSlotReferences(item.content, textStyleIds, linkedStyleIds);
      collectCanonicalElementReferencesFromTopics(item.children, textStyleIds, linkedStyleIds);
    });
  }
  if (value.type === "table" && value.mode === "structured") {
    collectTableReferences(value.columns, textStyleIds, linkedStyleIds);
    collectTableReferences(value.rows, textStyleIds, linkedStyleIds);
  }
}

function collectContentSlotReferences(
  value: unknown,
  textStyleIds: Set<string>,
  linkedStyleIds: Set<string>,
): void {
  if (!isRecord(value) || !Array.isArray(value.children)) return;
  value.children.forEach((child) => collectCanonicalElementReferences(child, textStyleIds, linkedStyleIds));
}

function collectCanonicalElementReferencesFromTopics(
  value: unknown,
  textStyleIds: Set<string>,
  linkedStyleIds: Set<string>,
): void {
  if (!Array.isArray(value)) return;
  value.forEach((item) => {
    if (!isRecord(item)) return;
    collectContentSlotReferences(item.content, textStyleIds, linkedStyleIds);
    collectCanonicalElementReferencesFromTopics(item.children, textStyleIds, linkedStyleIds);
  });
}

function collectTableReferences(
  value: unknown,
  textStyleIds: Set<string>,
  linkedStyleIds: Set<string>,
): void {
  if (!Array.isArray(value)) return;
  value.forEach((entry) => {
    if (!isRecord(entry)) return;
    collectContentSlotReferences(entry.header, textStyleIds, linkedStyleIds);
    if (Array.isArray(entry.cells)) {
      entry.cells.forEach((cell) => collectContentSlotReferences(cell, textStyleIds, linkedStyleIds));
    }
  });
}

function collectRecipeReferences(
  recipe: CustomLibraryElementRecipe,
  textStyleIds: Set<string>,
  linkedStyleIds: Set<string>,
): void {
  recipe.properties.forEach((property) => {
    if (property.path === "variant" && typeof property.value === "string" && !FundamentalTextStyleIdSchema.safeParse(property.value).success) {
      textStyleIds.add(property.value);
    }
    if (property.path === "linkedStyleId" && typeof property.value === "string") {
      linkedStyleIds.add(property.value);
    }
    collectBoundedPayloadReferences(recipe, property, textStyleIds, linkedStyleIds);
  });
  recipe.children?.forEach((child) => collectRecipeReferences(child, textStyleIds, linkedStyleIds));
}

function collectBoundedPayloadReferences(
  recipe: CustomLibraryElementRecipe,
  property: { path: string; value: unknown },
  textStyleIds: Set<string>,
  linkedStyleIds: Set<string>,
): void {
  if (recipe.type === "topics" && property.path === "items" && Array.isArray(property.value)) {
    property.value.forEach((item) => {
      if (!isRecord(item)) return;
      collectContentSlotReferences(item.content, textStyleIds, linkedStyleIds);
      collectCanonicalElementReferencesFromTopics(item.children, textStyleIds, linkedStyleIds);
    });
  }
  if (recipe.type === "table" && (property.path === "columns" || property.path === "rows")) {
    collectTableReferences(property.value, textStyleIds, linkedStyleIds);
  }
}

function mapPortableDefinitions(
  textStyles: CustomTextStyle[],
  linkedStyles: LinkedStyle[],
  palette: PresentationPalette | undefined,
): { textStyles: CustomTextStyle[]; linkedStyles: LinkedStyle[] } {
  const mapped = mapPresentationColorValues(
    {
      schemaVersion: 1,
      id: "custom-library-dependencies",
      title: "Custom Library dependencies",
      description: "",
      aspectRatio: "16:9",
      slides: [],
      textStyles,
      linkedStyles,
    },
    (value, path) => {
      if (typeof value === "string") return value;
      const paletteColor = palette?.colors.find((color) => color.id === value.colorId);
      if (paletteColor === undefined) {
        throw new Error(`Custom Library dependency contains an unresolved palette reference at ${path.join(".")}`);
      }
      return paletteColor.value;
    },
  );

  return {
    textStyles: (mapped.textStyles ?? []) as CustomTextStyle[],
    linkedStyles: mapped.linkedStyles ?? [],
  };
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

export function snapshotCustomLibraryStyleDependencies(
  recipe: CustomLibraryElementRecipe,
  fontResources: readonly FontResource[] | undefined,
  textStyles?: readonly TextStyle[],
  linkedStyles?: readonly LinkedStyle[],
  palette?: PresentationPalette,
): CustomLibraryStyleDependencies | undefined {
  const textStyleIds = new Set<string>();
  const linkedStyleIds = new Set<string>();
  collectRecipeReferences(recipe, textStyleIds, linkedStyleIds);

  const capturedTextStyles: CustomTextStyle[] = [];
  for (const id of textStyleIds) {
    const style = textStyles?.find((candidate) => candidate.id === id);
    if (style === undefined || FundamentalTextStyleIdSchema.safeParse(style.id).success || !("role" in style)) {
      throw new Error(`Unresolved custom text style dependency: ${id}`);
    }
    capturedTextStyles.push(structuredClone(style));
  }

  const capturedLinkedStyles: LinkedStyle[] = [];
  for (const id of linkedStyleIds) {
    const style = linkedStyles?.find((candidate) => candidate.id === id);
    if (style === undefined) {
      throw new Error(`Unresolved linked style dependency: ${id}`);
    }
    capturedLinkedStyles.push(structuredClone(style));
  }

  const portable = mapPortableDefinitions(capturedTextStyles, capturedLinkedStyles, palette);
  const capturedFamilies = new Set(collectCustomLibraryStyleFontFamilies(recipe));
  portable.textStyles.forEach((style) => collectTypographyFamily(style, capturedFamilies));
  portable.linkedStyles.forEach((style) => collectTypographyFamily(style, capturedFamilies));

  if (!fontResources || fontResources.length === 0) {
    if (portable.textStyles.length === 0 && portable.linkedStyles.length === 0) return undefined;
    return {
      ...(portable.textStyles.length > 0 ? { textStyles: portable.textStyles } : {}),
      ...(portable.linkedStyles.length > 0 ? { linkedStyles: portable.linkedStyles } : {}),
    };
  }

  const resourcesByFamily = new Map<string, FontResource>();
  fontResources.forEach((resource) => {
    const normalizedFamily = normalizeFontFamily(resource.family);
    if (!resourcesByFamily.has(normalizedFamily)) {
      resourcesByFamily.set(normalizedFamily, resource);
    }
  });

  const fonts: CustomLibraryFontDraft[] = [];
  const capturedFontFamilies = new Set<string>();
  capturedFamilies.forEach((family) => {
    const normalizedFamily = normalizeFontFamily(family);
    if (capturedFontFamilies.has(normalizedFamily)) return;
    const resource = resourcesByFamily.get(normalizedFamily);
    if (!resource) return;
    capturedFontFamilies.add(normalizedFamily);
    fonts.push({
      family: resource.family,
      faces: structuredClone([...getFontResourceFaces(resource)]),
    });
  });

  return fonts.length > 0 || portable.textStyles.length > 0 || portable.linkedStyles.length > 0
    ? {
        ...(fonts.length > 0 ? { fonts } : {}),
        ...(portable.textStyles.length > 0 ? { textStyles: portable.textStyles } : {}),
        ...(portable.linkedStyles.length > 0 ? { linkedStyles: portable.linkedStyles } : {}),
      }
    : undefined;
}
