import type {
  ElementTypography,
  Presentation,
  TextElement,
  TextStyleRole,
} from "@powershow/document-schema";
import {
  resolveTextStyle,
  stripLocalTextStyleProperties,
  TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES_R2,
} from "@powershow/document-schema";
import { resolveThemeTextTypographyBaseline } from "@powershow/theme/element-style-defaults";

export interface EffectiveTextStyleForAuthoring {
  role: TextStyleRole;
  style: TextElement["style"];
  typography: ElementTypography;
}

export function resolveEffectiveTextStyleForAuthoring(
  presentation: Presentation,
  text: TextElement,
): EffectiveTextStyleForAuthoring {
  const resolved = resolveTextStyle(presentation, text);
  const baseline = resolveThemeTextTypographyBaseline(resolved.role);

  return {
    role: resolved.role,
    style: resolved.style,
    typography: {
      ...baseline,
      ...resolved.typography,
    },
  };
}

export function detachTextStyle(
  presentation: Presentation,
  text: TextElement,
): TextElement {
  if (text.styleDetached === true) {
    return text;
  }

  const resolved = resolveEffectiveTextStyleForAuthoring(presentation, text);
  const materializedTypography = Object.fromEntries(
    TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES_R2.flatMap((property) => {
      const value = resolved.typography[property];
      return value === undefined ? [] : [[property, value]];
    }),
  ) as ElementTypography;
  const local = stripLocalTextStyleProperties(text.typography, text.style);
  const materializedStyle = {
    ...(local.style ?? {}),
    ...(resolved.style?.color === undefined ? {} : { color: resolved.style.color }),
  };

  return {
    ...text,
    variant: resolved.role,
    styleDetached: true,
    ...(Object.keys(materializedStyle).length > 0 ? { style: materializedStyle } : {}),
    typography: {
      ...materializedTypography,
      ...(local.typography ?? {}),
    },
  };
}
