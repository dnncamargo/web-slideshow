import type {
  FundamentalTextStyleId,
  Presentation,
  TextStyle,
  TextStyleTypographyProperties,
  TextStyleVisualProperties,
  TextStyleLayoutProperties,
  TextStyleRole,
} from "@web-slideshow/document-schema";
import {
  FUNDAMENTAL_TEXT_STYLE_IDS,
  FundamentalTextStyleIdSchema,
  PresentationSchema,
  SYSTEM_TABLE_CELL_TEXT_STYLE_ID,
  SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID,
  SYSTEM_TOPICS_TEXT_STYLE_ID,
  TEXT_STYLE_LAYOUT_PROPERTY_NAMES,
  TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES_R2,
  TEXT_STYLE_VISUAL_PROPERTY_NAMES,
  stripLocalTextStyleProperties,
} from "@web-slideshow/document-schema";

import { someElement, updateElementById, visitElements } from "./element-hierarchy";
import { forEachNavigablePresentationAuthoringTree, forEachPresentationAuthoringTree, updatePresentationAuthoringTrees } from "./presentation-authoring-trees";
import type { AuthoringTarget } from "./authoring-target";

export type TextStyleOwnedProperty =
  | { scope: "typography"; property: (typeof TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES_R2)[number] }
  | { scope: "style"; property: (typeof TEXT_STYLE_VISUAL_PROPERTY_NAMES)[number] }
  | { scope: "layout"; property: (typeof TEXT_STYLE_LAYOUT_PROPERTY_NAMES)[number] };

export type TextStyleUsageLocation = {
  target: AuthoringTarget;
  elementId: string;
};

export function normalizeTextStyleTypographyProperties(
  typography: TextStyleTypographyProperties | undefined,
): TextStyleTypographyProperties {
  if (!typography) return {};
  return Object.fromEntries(
    Object.entries(typography).filter(([, value]) => value !== undefined),
  ) as TextStyleTypographyProperties;
}

export function normalizeTextStyleVisualProperties(
  style: TextStyleVisualProperties | undefined,
): TextStyleVisualProperties {
  if (!style) return {};
  return Object.fromEntries(Object.entries(style).filter(([, value]) => value !== undefined)) as TextStyleVisualProperties;
}

export function normalizeTextStyleLayoutProperties(
  layout: TextStyleLayoutProperties | undefined,
): TextStyleLayoutProperties {
  if (!layout) return {};
  return Object.fromEntries(
    Object.entries(layout).filter(([, value]) => value !== undefined),
  ) as TextStyleLayoutProperties;
}

export interface TextStyleListItem {
  id: FundamentalTextStyleId | string;
  style: TextStyle | undefined;
}

export function listPresentationTextStyles(
  presentation: { textStyles?: readonly TextStyle[] },
): readonly TextStyleListItem[] {
  const persisted = presentation.textStyles ?? [];
  return [
    ...FUNDAMENTAL_TEXT_STYLE_IDS.map((id) => ({ id, style: persisted.find((style) => style.id === id) })),
    ...persisted.filter((style) => !FundamentalTextStyleIdSchema.safeParse(style.id).success).map((style) => ({ id: style.id, style })),
  ];
}

export function upsertFundamentalTextStyleOverride(
  presentation: Presentation,
  id: FundamentalTextStyleId,
  patch: { style?: TextStyleVisualProperties; typography?: TextStyleTypographyProperties; layout?: TextStyleLayoutProperties } | TextStyleTypographyProperties | undefined,
): Presentation {
  const existing = presentation.textStyles ?? [];
  const current = existing.find((style) => style.id === id);
  let stylePatch: TextStyleVisualProperties | undefined;
  let typographyPatch: TextStyleTypographyProperties | undefined;
  let hasStylePatch = false;
  let hasTypographyPatch = false;
  let layoutPatch: TextStyleLayoutProperties | undefined;
  let hasLayoutPatch = false;
  if (patch !== undefined && "style" in patch) {
    hasStylePatch = true;
    stylePatch = patch.style;
  }
  if (patch !== undefined && "typography" in patch) {
    hasTypographyPatch = true;
    typographyPatch = patch.typography;
  }
  if (patch !== undefined && "layout" in patch) {
    hasLayoutPatch = true;
    layoutPatch = patch.layout;
  }
  if (patch !== undefined && !hasStylePatch && !hasTypographyPatch && !hasLayoutPatch) {
    hasTypographyPatch = true;
    typographyPatch = patch as TextStyleTypographyProperties;
  }
  const normalizedTypography = hasTypographyPatch
    ? normalizeTextStyleTypographyProperties(typographyPatch)
    : current && "typography" in current && current.typography !== undefined ? current.typography : {};
  const normalizedStyle = hasStylePatch
    ? normalizeTextStyleVisualProperties(stylePatch)
    : current && "style" in current && current.style !== undefined ? current.style : {};
  const normalizedLayout = hasLayoutPatch
    ? normalizeTextStyleLayoutProperties(layoutPatch)
    : current && current.layout !== undefined ? current.layout : {};
  const remaining = existing.filter((style) => style.id !== id);
  const nextStyles = Object.keys(normalizedTypography).length > 0 || Object.keys(normalizedStyle).length > 0 || Object.keys(normalizedLayout).length > 0
    ? [...remaining, { id, ...(Object.keys(normalizedStyle).length > 0 ? { style: normalizedStyle } : {}), ...(Object.keys(normalizedTypography).length > 0 ? { typography: normalizedTypography } : {}), ...(Object.keys(normalizedLayout).length > 0 ? { layout: normalizedLayout } : {}) }]
    : remaining;
  return withTextStyles(presentation, nextStyles);
}

export function resetFundamentalTextStyleOverride(
  presentation: Presentation,
  id: FundamentalTextStyleId,
): Presentation {
  return withTextStyles(
    presentation,
    (presentation.textStyles ?? []).filter((style) => style.id !== id),
  );
}

export function createTextStyleId(
  name: string,
  existingIds: readonly string[],
): string {
  const base = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "style";
  const used = new Set([...FUNDAMENTAL_TEXT_STYLE_IDS, ...existingIds]);
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function addCustomTextStyle(
  presentation: Presentation,
  name: string,
  role: TextStyleRole,
): Presentation {
  const trimmedName = name.trim();
  if (!trimmedName) return presentation;
  const id = createTextStyleId(trimmedName, (presentation.textStyles ?? []).map((style) => style.id));
  return withTextStyles(presentation, [
    ...(presentation.textStyles ?? []),
    { id, name: trimmedName, role },
  ]);
}

export type StructuredTableTextStyleIds = {
  columnHeader: typeof SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID;
  tableCell: typeof SYSTEM_TABLE_CELL_TEXT_STYLE_ID;
};

export function ensureStructuredTableTextStyles(
  presentation: Presentation,
): { presentation: Presentation; ids: StructuredTableTextStyleIds } {
  const existing = presentation.textStyles ?? [];
  const missing = [
    !existing.some((style) => style.id === SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID)
      ? { id: SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID, name: "Column header", role: "body" as const }
      : undefined,
    !existing.some((style) => style.id === SYSTEM_TABLE_CELL_TEXT_STYLE_ID)
      ? { id: SYSTEM_TABLE_CELL_TEXT_STYLE_ID, name: "Table cell", role: "body" as const }
      : undefined,
  ].filter((style): style is NonNullable<typeof style> => style !== undefined);

  return {
    presentation: missing.length === 0
      ? presentation
      : withTextStyles(presentation, [...existing, ...missing]),
    ids: {
      columnHeader: SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID,
      tableCell: SYSTEM_TABLE_CELL_TEXT_STYLE_ID,
    },
  };
}

export function ensureTopicsTextStyle(presentation: Presentation): Presentation {
  const existing = presentation.textStyles ?? [];
  if (existing.some((style) => style.id === SYSTEM_TOPICS_TEXT_STYLE_ID)) {
    return presentation;
  }

  return withTextStyles(presentation, [
    ...existing,
    { id: SYSTEM_TOPICS_TEXT_STYLE_ID, name: "Topics", role: "body" },
  ]);
}

export function updateCustomTextStyle(
  presentation: Presentation,
  id: string,
  patch: { name?: string; role?: TextStyleRole; style?: TextStyleVisualProperties; typography?: TextStyleTypographyProperties; layout?: TextStyleLayoutProperties },
): Presentation {
  return withTextStyles(presentation, (presentation.textStyles ?? []).map((style) => {
    if (style.id !== id || !("name" in style)) return style;
    const updated = {
      ...style,
      ...(patch.name === undefined || !patch.name.trim() ? {} : { name: patch.name.trim() }),
      ...(patch.role === undefined ? {} : { role: patch.role }),
    };
    const next = { ...updated };
    if (patch.style !== undefined) {
      const style = normalizeTextStyleVisualProperties(patch.style);
      if (Object.keys(style).length > 0) next.style = style;
      else delete next.style;
    }
    if (patch.typography !== undefined) {
      const typography = normalizeTextStyleTypographyProperties(patch.typography);
      if (Object.keys(typography).length > 0) next.typography = typography;
      else delete next.typography;
    }
    if (patch.layout !== undefined) {
      const layout = normalizeTextStyleLayoutProperties(patch.layout);
      if (Object.keys(layout).length > 0) next.layout = layout;
      else delete next.layout;
    }
    return next;
  }));
}

function areTextStyleColorValuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left === "string" || typeof right === "string") return false;
  if (left === undefined || right === undefined || left === null || right === null) return false;
  if (typeof left !== "object" || typeof right !== "object") return false;
  const leftColor = left as { kind?: unknown; colorId?: unknown };
  const rightColor = right as { kind?: unknown; colorId?: unknown };
  return leftColor.kind === "palette"
    && rightColor.kind === "palette"
    && leftColor.colorId === rightColor.colorId;
}

export function areTextStyleOwnedPropertyValuesEqual(
  property: TextStyleOwnedProperty,
  left: unknown,
  right: unknown,
): boolean {
  if (property.scope === "style" || property.property === "textDecorationColor") {
    return areTextStyleColorValuesEqual(left, right);
  }
  if (property.property === "textStroke") {
    if (left === right) return true;
    if (left === undefined || right === undefined || left === null || right === null) return false;
    if (typeof left !== "object" || typeof right !== "object") return false;
    const leftStroke = left as { width?: unknown; color?: unknown };
    const rightStroke = right as { width?: unknown; color?: unknown };
    return leftStroke.width === rightStroke.width
      && areTextStyleColorValuesEqual(leftStroke.color, rightStroke.color);
  }
  return left === right;
}

function getTextStyleOwnedPropertyValue(
  style: TextStyle | undefined,
  property: TextStyleOwnedProperty,
): unknown {
  if (style === undefined) return undefined;
  if (property.scope === "typography") return style.typography?.[property.property];
  if (property.scope === "style") return style.style?.[property.property];
  return style.layout?.[property.property];
}

export function areTextStyleDefinitionsEqualForAuthoring(
  left: TextStyle | undefined,
  right: TextStyle | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  if (left.id !== right.id) return false;
  if ("name" in left || "name" in right) {
    if (!("name" in left) || !("name" in right) || left.name !== right.name || left.role !== right.role) {
      return false;
    }
  }
  const properties: TextStyleOwnedProperty[] = [
    ...TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES_R2.map((property) => ({ scope: "typography" as const, property })),
    ...TEXT_STYLE_VISUAL_PROPERTY_NAMES.map((property) => ({ scope: "style" as const, property })),
    ...TEXT_STYLE_LAYOUT_PROPERTY_NAMES.map((property) => ({ scope: "layout" as const, property })),
  ];
  return properties.every((property) => areTextStyleOwnedPropertyValuesEqual(
    property,
    getTextStyleOwnedPropertyValue(left, property),
    getTextStyleOwnedPropertyValue(right, property),
  ));
}

function buildChangedTextStyleOwner(
  before: TextStyle | undefined,
  after: TextStyle | undefined,
  changedProperties: readonly TextStyleOwnedProperty[],
): Pick<TextStyle, "typography" | "style" | "layout"> {
  const typography: Record<string, unknown> = {};
  const style: Record<string, unknown> = {};
  const layout: Record<string, unknown> = {};
  for (const property of changedProperties) {
    const afterValue = getTextStyleOwnedPropertyValue(after, property);
    const value = afterValue !== undefined ? afterValue : getTextStyleOwnedPropertyValue(before, property);
    if (property.scope === "typography") typography[property.property] = value;
    else if (property.scope === "style") style[property.property] = value;
    else layout[property.property] = value;
  }
  return {
    ...(Object.keys(typography).length > 0 ? { typography: typography as TextStyleTypographyProperties } : {}),
    ...(Object.keys(style).length > 0 ? { style: style as TextStyleVisualProperties } : {}),
    ...(Object.keys(layout).length > 0 ? { layout: layout as TextStyleLayoutProperties } : {}),
  };
}

export function propagateTextStyleDefinitionChanges(
  presentation: Presentation,
  textStyleId: string,
  before: TextStyle | undefined,
  after: TextStyle | undefined,
): Presentation {
  const changedProperties: TextStyleOwnedProperty[] = [
    ...TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES_R2
      .map((property) => ({ scope: "typography" as const, property }))
      .filter((property) => !areTextStyleOwnedPropertyValuesEqual(
        property,
        getTextStyleOwnedPropertyValue(before, property),
        getTextStyleOwnedPropertyValue(after, property),
      )),
    ...TEXT_STYLE_VISUAL_PROPERTY_NAMES
      .map((property) => ({ scope: "style" as const, property }))
      .filter((property) => !areTextStyleOwnedPropertyValuesEqual(
        property,
        getTextStyleOwnedPropertyValue(before, property),
        getTextStyleOwnedPropertyValue(after, property),
      )),
    ...TEXT_STYLE_LAYOUT_PROPERTY_NAMES
      .map((property) => ({ scope: "layout" as const, property }))
      .filter((property) => !areTextStyleOwnedPropertyValuesEqual(
        property,
        getTextStyleOwnedPropertyValue(before, property),
        getTextStyleOwnedPropertyValue(after, property),
      )),
  ];
  if (changedProperties.length === 0) return presentation;

  const owner = buildChangedTextStyleOwner(before, after, changedProperties);
  return updatePresentationAuthoringTrees(presentation, (elements) => {
    const usageIds: string[] = [];
    visitElements(elements, (element) => {
      if (element.type === "text" && element.variant === textStyleId && element.styleDetached !== true) {
        usageIds.push(element.id);
      }
    });
    return usageIds.reduce((current, elementId) => updateElementById(current, elementId, (element) => {
      if (element.type !== "text" || element.variant !== textStyleId || element.styleDetached === true) return element;
      const hasLocalChangedProperty = changedProperties.some((property) =>
        property.scope === "typography"
          ? element.typography?.[property.property] !== undefined
          : property.scope === "style"
            ? element.style?.[property.property] !== undefined
            : element.layout?.[property.property] !== undefined,
      );
      if (!hasLocalChangedProperty) return element;
      const cleared = stripLocalTextStyleProperties(element.typography, element.style, element.layout, owner);
      const nextElement = { ...element };
      if (cleared.typography === undefined) delete nextElement.typography;
      else nextElement.typography = cleared.typography;
      if (cleared.style === undefined) delete nextElement.style;
      else nextElement.style = cleared.style;
      if (cleared.layout === undefined) delete nextElement.layout;
      else nextElement.layout = cleared.layout;
      return nextElement;
    }), elements);
  });
}

export function isTextStyleUsed(presentation: Presentation, id: string): boolean {
  let used = false;
  forEachPresentationAuthoringTree(presentation, (elements) => {
    if (used) return;
    used = someElement(elements, (element) =>
      element.type === "text" && element.variant === id && element.styleDetached !== true,
    );
  });
  return used;
}

export function findTextStyleUsageLocations(
  presentation: Presentation,
  textStyleId: string,
): TextStyleUsageLocation[] {
  const locations: TextStyleUsageLocation[] = [];
  forEachNavigablePresentationAuthoringTree(presentation, (elements, target) => {
    visitElements(elements, (element) => {
      if (element.type === "text" && element.variant === textStyleId && element.styleDetached !== true) {
        locations.push({ target, elementId: element.id });
      }
    });
  });
  return locations;
}

export function removeUnusedCustomTextStyle(presentation: Presentation, id: string): Presentation | null {
  if (FundamentalTextStyleIdSchema.safeParse(id).success || isTextStyleUsed(presentation, id)) return null;
  const styles = presentation.textStyles ?? [];
  if (!styles.some((style) => style.id === id)) return null;
  return withTextStyles(presentation, styles.filter((style) => style.id !== id));
}

function withTextStyles(presentation: Presentation, styles: TextStyle[]): Presentation {
  const next = styles.length > 0 ? { ...presentation, textStyles: styles } : (() => {
    const { textStyles: _removed, ...withoutStyles } = presentation;
    return withoutStyles;
  })();
  return PresentationSchema.parse(next);
}
