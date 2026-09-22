import type {
  ElementTypography,
  Presentation,
  TextElement,
  TextStyleLayoutProperties,
  TextStyleRole,
} from "@web-slideshow/document-schema";
import {
  PresentationSchema,
  resolveTextStyle,
  stripLocalTextStyleProperties,
  TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES_R2,
  TEXT_STYLE_LAYOUT_PROPERTY_NAMES,
  TEXT_STYLE_VISUAL_PROPERTY_NAMES,
} from "@web-slideshow/document-schema";
import { resolveThemeTextTypographyBaseline } from "@web-slideshow/theme/element-style-defaults";

import { createTextStyleId } from "./text-style-helpers";

export interface EffectiveTextStyleForAuthoring {
  role: TextStyleRole;
  style: TextElement["style"];
  typography: ElementTypography;
  layout: TextStyleLayoutProperties;
}

export interface CreatedTextStyleFromText {
  presentation: Presentation;
  textStyleId: string;
  text: TextElement;
}

/** Applies a Text Style relationship change using destination-owned properties only. */
export function attachTextStyle(
  presentation: Presentation,
  text: TextElement,
  variant: TextElement["variant"],
): TextElement {
  const destinationStyle = presentation.textStyles?.find((style) => style.id === variant);
  const typography = { ...(text.typography ?? {}) };
  const style = { ...(text.style ?? {}) };
  const layout = { ...(text.layout ?? {}) };

  const local = stripLocalTextStyleProperties(
    Object.keys(typography).length > 0 ? typography : undefined,
    Object.keys(style).length > 0 ? style : undefined,
    Object.keys(layout).length > 0 ? layout : undefined,
    destinationStyle ?? {},
  );
  const { styleDetached: _styleDetached, typography: _typography, style: _style, layout: _layout, ...attached } = text;

  return {
    ...attached,
    variant,
    ...(local.style === undefined ? {} : { style: local.style }),
    ...(local.typography === undefined ? {} : { typography: local.typography }),
    ...(local.layout === undefined ? {} : { layout: local.layout }),
  };
}

export function createTextStyleFromText(
  presentation: Presentation,
  text: TextElement,
  name: string,
): CreatedTextStyleFromText | null {
  const trimmedName = name.trim();
  if (!trimmedName) return null;

  const resolved = resolveEffectiveTextStyleForAuthoring(presentation, text);
  const baseline = resolveThemeTextTypographyBaseline(resolved.role);
  const typography = Object.fromEntries(
    TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES_R2.flatMap((property) => {
      const value = resolved.typography[property];
      const baselineValue = property in baseline
        ? baseline[property as keyof typeof baseline]
        : undefined;
      return value !== undefined && !Object.is(value, baselineValue)
        ? [[property, value]]
        : [];
    }),
  );
  const style = resolved.style?.color === undefined ? undefined : { color: resolved.style.color };
  const layout = Object.fromEntries(
    Object.entries(resolved.layout).filter(([, value]) => value !== undefined),
  ) as TextStyleLayoutProperties;
  const textStyleId = createTextStyleId(
    trimmedName,
    (presentation.textStyles ?? []).map((candidate) => candidate.id),
  );
  const nextStyle = {
    id: textStyleId,
    name: trimmedName,
    role: resolved.role,
    ...(Object.keys(style ?? {}).length > 0 ? { style } : {}),
    ...(Object.keys(typography).length > 0 ? { typography } : {}),
    ...(Object.keys(layout).length > 0 ? { layout } : {}),
  };
  const { styleDetached: _styleDetached, typography: _typography, style: _style, layout: _layout, ...attached } = text;
  const local = stripLocalTextStyleProperties(text.typography, text.style, text.layout, nextStyle);
  const nextText = {
    ...attached,
    variant: textStyleId,
    ...(local.style === undefined ? {} : { style: local.style }),
    ...(local.typography === undefined ? {} : { typography: local.typography }),
    ...(local.layout === undefined ? {} : { layout: local.layout }),
  };

  return {
    presentation: PresentationSchema.parse({
      ...presentation,
      textStyles: [...(presentation.textStyles ?? []), nextStyle],
    }),
    textStyleId,
    text: nextText,
  };
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
    layout: resolved.layout,
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
  const local = stripLocalTextStyleProperties(text.typography, text.style, text.layout);
  const materializedStyle = {
    ...(local.style ?? {}),
    ...(resolved.style?.color === undefined ? {} : { color: resolved.style.color }),
  };
  const materializedLayout = {
    ...(local.layout ?? {}),
    ...resolved.layout,
  };

  return {
    ...text,
    variant: resolved.role,
    styleDetached: true,
    ...(Object.keys(materializedStyle).length > 0 ? { style: materializedStyle } : {}),
    ...(Object.keys(materializedLayout).length > 0 ? { layout: materializedLayout } : {}),
    typography: {
      ...materializedTypography,
      ...(local.typography ?? {}),
    },
  };
}
