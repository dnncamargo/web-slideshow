import type {
  ElementTypography,
  Presentation,
  TextElement,
  TextStyle,
  TextVisualStyle,
} from "@web-slideshow/document-schema";
import {
  stripLocalTextStyleProperties,
  TEXT_STYLE_LAYOUT_PROPERTY_NAMES,
  TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES_R2,
  TEXT_STYLE_VISUAL_PROPERTY_NAMES,
} from "@web-slideshow/document-schema";

export type TextStyleInspectorProperty =
  | (typeof TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES_R2)[number]
  | (typeof TEXT_STYLE_VISUAL_PROPERTY_NAMES)[number]
  | (typeof TEXT_STYLE_LAYOUT_PROPERTY_NAMES)[number];

export type TextStyleInspectorSource = "local" | "linked" | "theme";

export interface TextStylePropertyInfo {
  source: TextStyleInspectorSource;
  linkedValue: unknown;
}
function linkedStyleFor(
  presentation: Presentation,
  element: TextElement,
): TextStyle | undefined {
  if (element.styleDetached === true) return undefined;
  return presentation.textStyles?.find((style) => style.id === element.variant);
}

function readLocalValue(
  element: TextElement,
  property: TextStyleInspectorProperty,
): unknown {
  if (property === "color") return element.style?.color;
  if (TEXT_STYLE_LAYOUT_PROPERTY_NAMES.includes(property as (typeof TEXT_STYLE_LAYOUT_PROPERTY_NAMES)[number])) {
    return element.layout?.[property as keyof NonNullable<TextElement["layout"]>];
  }
  return element.typography?.[property as keyof ElementTypography];
}

function readLinkedValue(
  style: TextStyle | undefined,
  property: TextStyleInspectorProperty,
): unknown {
  if (property === "color") return style?.style?.color;
  if (TEXT_STYLE_LAYOUT_PROPERTY_NAMES.includes(property as (typeof TEXT_STYLE_LAYOUT_PROPERTY_NAMES)[number])) {
    return style?.layout?.[property as keyof NonNullable<TextStyle["layout"]>];
  }
  return style?.typography?.[property as keyof ElementTypography];
}

export function getTextStylePropertyInfo(
  presentation: Presentation | undefined,
  element: TextElement,
  property: TextStyleInspectorProperty,
): TextStylePropertyInfo | undefined {
  if (presentation === undefined || element.styleDetached === true) return undefined;
  const linkedValue = readLinkedValue(linkedStyleFor(presentation, element), property);
  return {
    source: readLocalValue(element, property) !== undefined
      ? "local"
      : linkedValue !== undefined
        ? "linked"
        : "theme",
    linkedValue,
  };
}

function ownerForProperty(property: TextStyleInspectorProperty): Pick<TextStyle, "typography" | "style" | "layout"> {
  if (property === "color") {
    return { style: { color: "#000000" } as TextVisualStyle };
  }
  if (TEXT_STYLE_LAYOUT_PROPERTY_NAMES.includes(property as (typeof TEXT_STYLE_LAYOUT_PROPERTY_NAMES)[number])) {
    return { layout: { [property]: 0 } };
  }
  return {
    typography: {
      [property]: property === "textStroke" ? { width: 0, color: "#000000" } : 0,
    } as ElementTypography,
  };
}

export function clearLocalTextStyleProperty(
  element: TextElement,
  property: TextStyleInspectorProperty,
): TextElement {
  const cleared = stripLocalTextStyleProperties(
    element.typography,
    element.style,
    element.layout,
    ownerForProperty(property),
  );
  const next = { ...element };
  if (cleared.typography === undefined) delete next.typography;
  else next.typography = cleared.typography;
  if (cleared.style === undefined) delete next.style;
  else next.style = cleared.style;
  if (cleared.layout === undefined) delete next.layout;
  else next.layout = cleared.layout;
  return next;
}
