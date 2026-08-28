import type {
  FundamentalTypographyStyleId,
  Presentation,
  TypographyStyle,
  TypographyStyleProperties,
  TypographyStyleRole,
} from "@powershow/document-schema";
import {
  FUNDAMENTAL_TYPOGRAPHY_STYLE_IDS,
  FundamentalTypographyStyleIdSchema,
  PresentationSchema,
} from "@powershow/document-schema";

import { someElement } from "./element-tree";

export function normalizeTypographyStyleProperties(
  typography: TypographyStyleProperties | undefined,
): TypographyStyleProperties {
  if (!typography) return {};
  return Object.fromEntries(
    Object.entries(typography).filter(([, value]) => value !== undefined),
  ) as TypographyStyleProperties;
}

export interface TypographyStyleListItem {
  id: FundamentalTypographyStyleId | string;
  style: TypographyStyle | undefined;
}

export function listPresentationTypographyStyles(
  presentation: { typographyStyles?: readonly TypographyStyle[] },
): readonly TypographyStyleListItem[] {
  const persisted = presentation.typographyStyles ?? [];
  return [
    ...FUNDAMENTAL_TYPOGRAPHY_STYLE_IDS.map((id) => ({ id, style: persisted.find((style) => style.id === id) })),
    ...persisted.filter((style) => !FundamentalTypographyStyleIdSchema.safeParse(style.id).success).map((style) => ({ id: style.id, style })),
  ];
}

export function upsertFundamentalTypographyOverride(
  presentation: Presentation,
  id: FundamentalTypographyStyleId,
  typography: TypographyStyleProperties | undefined,
): Presentation {
  const normalized = normalizeTypographyStyleProperties(typography);
  const existing = presentation.typographyStyles ?? [];
  const remaining = existing.filter((style) => style.id !== id);
  const nextStyles = normalized && Object.keys(normalized).length > 0
    ? [...remaining, { id, typography: normalized }]
    : remaining;
  return withTypographyStyles(presentation, nextStyles);
}

export function resetFundamentalTypographyOverride(
  presentation: Presentation,
  id: FundamentalTypographyStyleId,
): Presentation {
  return withTypographyStyles(
    presentation,
    (presentation.typographyStyles ?? []).filter((style) => style.id !== id),
  );
}

export function createTypographyStyleId(
  name: string,
  existingIds: readonly string[],
): string {
  const base = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "style";
  const used = new Set([...FUNDAMENTAL_TYPOGRAPHY_STYLE_IDS, ...existingIds]);
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function addCustomTypographyStyle(
  presentation: Presentation,
  name: string,
  role: TypographyStyleRole,
): Presentation {
  const trimmedName = name.trim();
  if (!trimmedName) return presentation;
  const id = createTypographyStyleId(trimmedName, (presentation.typographyStyles ?? []).map((style) => style.id));
  return withTypographyStyles(presentation, [
    ...(presentation.typographyStyles ?? []),
    { id, name: trimmedName, role, typography: {} },
  ]);
}

export function updateCustomTypographyStyle(
  presentation: Presentation,
  id: string,
  patch: { name?: string; role?: TypographyStyleRole; typography?: TypographyStyleProperties },
): Presentation {
  return withTypographyStyles(presentation, (presentation.typographyStyles ?? []).map((style) => {
    if (style.id !== id || !("name" in style)) return style;
    return {
      ...style,
      ...(patch.name === undefined || !patch.name.trim() ? {} : { name: patch.name.trim() }),
      ...(patch.role === undefined ? {} : { role: patch.role }),
      ...(patch.typography === undefined ? {} : { typography: normalizeTypographyStyleProperties(patch.typography) }),
    };
  }));
}

export function isTypographyStyleUsed(presentation: Presentation, id: string): boolean {
  return presentation.slides.some((slide) => someElement(slide.elements, (element) => element.type === "text" && element.variant === id));
}

export function removeUnusedCustomTypographyStyle(presentation: Presentation, id: string): Presentation | null {
  if (FundamentalTypographyStyleIdSchema.safeParse(id).success || isTypographyStyleUsed(presentation, id)) return null;
  const styles = presentation.typographyStyles ?? [];
  if (!styles.some((style) => style.id === id)) return null;
  return withTypographyStyles(presentation, styles.filter((style) => style.id !== id));
}

function withTypographyStyles(presentation: Presentation, styles: TypographyStyle[]): Presentation {
  const next = styles.length > 0 ? { ...presentation, typographyStyles: styles } : (() => {
    const { typographyStyles: _removed, ...withoutStyles } = presentation;
    return withoutStyles;
  })();
  return PresentationSchema.parse(next);
}
