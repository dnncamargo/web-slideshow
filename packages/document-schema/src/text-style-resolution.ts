import type {
  ElementTypography,
  TextStyleLayoutProperties,
  TextStyleVisualProperties,
} from "./element-properties";
import type { Presentation } from "./presentation";
import type { TextElement } from "./elements";
import type { TextStyleRole } from "./text-style";
import {
  FundamentalTextStyleIdSchema,
  TEXT_STYLE_LAYOUT_PROPERTY_NAMES,
  TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES_R2,
  TEXT_STYLE_VISUAL_PROPERTY_NAMES,
} from "./text-style";

export type ResolvedTextStyle = {
  role: TextStyleRole;
  style: TextStyleVisualProperties;
  typography: ElementTypography;
  layout: TextStyleLayoutProperties;
};

function resolveOwnedProperties<T extends object, K extends keyof T>(
  local: T | undefined,
  linked: T | undefined,
  properties: readonly K[],
): T {
  const resolved = { ...(local ?? {}) } as T;
  for (const property of properties) {
    const value = linked?.[property];
    if (value !== undefined) {
      resolved[property] = value;
    }
  }
  return resolved;
}

function selectProperties<T extends object, K extends keyof T>(
  value: T | undefined,
  properties: readonly K[],
): Pick<T, K> {
  const selected = {} as Pick<T, K>;
  for (const property of properties) {
    const propertyValue = value?.[property];
    if (propertyValue !== undefined) {
      selected[property] = propertyValue;
    }
  }
  return selected;
}

export function resolveTextStyle(
  presentation: Presentation,
  text: TextElement,
): ResolvedTextStyle {
  const styles = presentation.textStyles ?? [];
  const style = styles.find((candidate) => candidate.id === text.variant);
  const fundamentalVariant = FundamentalTextStyleIdSchema.safeParse(text.variant);

  if (fundamentalVariant.success) {
    const inherited = text.styleDetached ? undefined : style;
    return {
      role: fundamentalVariant.data,
      style: resolveOwnedProperties(
        selectProperties(text.style, TEXT_STYLE_VISUAL_PROPERTY_NAMES),
        selectProperties(inherited?.style, TEXT_STYLE_VISUAL_PROPERTY_NAMES),
        TEXT_STYLE_VISUAL_PROPERTY_NAMES,
      ),
      typography: resolveOwnedProperties(text.typography, inherited?.typography, TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES_R2),
      layout: resolveOwnedProperties(
        selectProperties(text.layout, TEXT_STYLE_LAYOUT_PROPERTY_NAMES),
        selectProperties(inherited?.layout, TEXT_STYLE_LAYOUT_PROPERTY_NAMES),
        TEXT_STYLE_LAYOUT_PROPERTY_NAMES,
      ),
    };
  }

  if (!style || !("role" in style)) {
    throw new Error(`Unresolved custom text style variant: ${text.variant}`);
  }

  return {
    role: style.role,
    style: resolveOwnedProperties(
      selectProperties(text.style, TEXT_STYLE_VISUAL_PROPERTY_NAMES),
      selectProperties(style.style, TEXT_STYLE_VISUAL_PROPERTY_NAMES),
      TEXT_STYLE_VISUAL_PROPERTY_NAMES,
    ),
    typography: resolveOwnedProperties(text.typography, style.typography, TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES_R2),
    layout: resolveOwnedProperties(
      selectProperties(text.layout, TEXT_STYLE_LAYOUT_PROPERTY_NAMES),
      selectProperties(style.layout, TEXT_STYLE_LAYOUT_PROPERTY_NAMES),
      TEXT_STYLE_LAYOUT_PROPERTY_NAMES,
    ),
  };
}
