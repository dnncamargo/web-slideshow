import type {
  ElementTypography,
  Presentation,
  TextElement,
  TextStyleRole,
} from "@powershow/document-schema";
import {
  resolveTextTypography,
  stripLocalTypographyStyleProperties,
  TYPOGRAPHY_STYLE_V1_PROPERTY_NAMES,
} from "@powershow/document-schema";
import { resolveThemeTextTypographyBaseline } from "@powershow/theme/element-style-defaults";

export interface EffectiveTextTypographyForAuthoring {
  role: TextStyleRole;
  typography: ElementTypography;
}

export function resolveEffectiveTextTypographyForAuthoring(
  presentation: Presentation,
  text: TextElement,
): EffectiveTextTypographyForAuthoring {
  const resolved = resolveTextTypography(presentation, text);
  const baseline = resolveThemeTextTypographyBaseline(resolved.role);

  return {
    role: resolved.role,
    typography: {
      ...baseline,
      ...resolved.typography,
    },
  };
}

export function detachTextTypographyStyle(
  presentation: Presentation,
  text: TextElement,
): TextElement {
  if (text.styleDetached === true) {
    return text;
  }

  const resolved = resolveEffectiveTextTypographyForAuthoring(presentation, text);
  const materializedTypography = Object.fromEntries(
    TYPOGRAPHY_STYLE_V1_PROPERTY_NAMES.flatMap((property) => {
      const value = resolved.typography[property];
      return value === undefined ? [] : [[property, value]];
    }),
  ) as ElementTypography;
  const elementOnlyTypography = stripLocalTypographyStyleProperties(text.typography);

  return {
    ...text,
    variant: resolved.role,
    styleDetached: true,
    typography: {
      ...materializedTypography,
      ...elementOnlyTypography,
    },
  };
}
