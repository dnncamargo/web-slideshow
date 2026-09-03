import type {
  FundamentalTextStyleId,
  Presentation,
  TextStyle,
  TextStyleTypographyProperties,
  TextStyleVisualProperties,
  TextStyleRole,
} from "@powershow/document-schema";
import {
  FUNDAMENTAL_TEXT_STYLE_IDS,
  FundamentalTextStyleIdSchema,
  PresentationSchema,
} from "@powershow/document-schema";

import { visitElements } from "./element-hierarchy";

export type TextStyleUsageLocation = {
  slideIndex: number;
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
  patch: { style?: TextStyleVisualProperties; typography?: TextStyleTypographyProperties } | TextStyleTypographyProperties | undefined,
): Presentation {
  const existing = presentation.textStyles ?? [];
  const current = existing.find((style) => style.id === id);
  let stylePatch: TextStyleVisualProperties | undefined;
  let typographyPatch: TextStyleTypographyProperties | undefined;
  let hasStylePatch = false;
  let hasTypographyPatch = false;
  if (patch !== undefined && "style" in patch) {
    hasStylePatch = true;
    stylePatch = patch.style;
  }
  if (patch !== undefined && "typography" in patch) {
    hasTypographyPatch = true;
    typographyPatch = patch.typography;
  }
  if (patch !== undefined && !hasStylePatch && !hasTypographyPatch) {
    hasTypographyPatch = true;
    typographyPatch = patch as TextStyleTypographyProperties;
  }
  const normalizedTypography = hasTypographyPatch
    ? normalizeTextStyleTypographyProperties(typographyPatch)
    : current && "typography" in current && current.typography !== undefined ? current.typography : {};
  const normalizedStyle = hasStylePatch
    ? normalizeTextStyleVisualProperties(stylePatch)
    : current && "style" in current && current.style !== undefined ? current.style : {};
  const remaining = existing.filter((style) => style.id !== id);
  const nextStyles = Object.keys(normalizedTypography).length > 0 || Object.keys(normalizedStyle).length > 0
    ? [...remaining, { id, ...(Object.keys(normalizedStyle).length > 0 ? { style: normalizedStyle } : {}), ...(Object.keys(normalizedTypography).length > 0 ? { typography: normalizedTypography } : {}) }]
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

export function updateCustomTextStyle(
  presentation: Presentation,
  id: string,
  patch: { name?: string; role?: TextStyleRole; style?: TextStyleVisualProperties; typography?: TextStyleTypographyProperties },
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
    return next;
  }));
}

export function isTextStyleUsed(presentation: Presentation, id: string): boolean {
  return findTextStyleUsageLocations(presentation, id).length > 0;
}

export function findTextStyleUsageLocations(
  presentation: Presentation,
  textStyleId: string,
): TextStyleUsageLocation[] {
  const locations: TextStyleUsageLocation[] = [];
  presentation.slides.forEach((slide, slideIndex) => {
    visitElements(slide.elements, (element) => {
      if (element.type === "text" && element.variant === textStyleId && element.styleDetached !== true) {
        locations.push({ slideIndex, elementId: element.id });
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
