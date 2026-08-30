import type { ContainerElement, LinkedContainerStyle, Presentation } from "@powershow/document-schema";

export type LinkedSource = "local" | "linked" | "theme";
export type ContainerShareableProperty =
  | "layout.position" | "layout.top" | "layout.right" | "layout.bottom" | "layout.left"
  | "layout.width" | "layout.height" | "layout.minWidth" | "layout.minHeight" | "layout.maxWidth" | "layout.maxHeight"
  | "layout.margin" | "layout.marginTop" | "layout.marginRight" | "layout.marginBottom" | "layout.marginLeft"
  | "layout.padding" | "layout.paddingTop" | "layout.paddingRight" | "layout.paddingBottom" | "layout.paddingLeft"
  | "layout.flexShrink" | "layout.children.mode" | "layout.children.direction" | "layout.children.gap"
  | "layout.children.distribution" | "layout.children.horizontalAlign" | "layout.children.verticalAlign" | "layout.children.fit" | "layout.overflow"
  | "style.color" | "style.background.color" | "style.background.gradient" | "style.background.pattern" | "style.border" | "style.borderRadius"
  | "effect.opacity" | "effect.shadow";

export function linkedStyleForContainer(presentation: Pick<Presentation, "linkedStyles"> | undefined, element: ContainerElement) {
  return element.linkedStyleId === undefined ? undefined : presentation?.linkedStyles?.find((style) => style.id === element.linkedStyleId);
}

/** Source inspection only; effective values remain owned by resolveLinkedContainerStyle. */
export function getContainerShareablePropertySource(
  presentation: Pick<Presentation, "linkedStyles"> | undefined,
  element: ContainerElement,
  property: ContainerShareableProperty,
): { localValue: unknown; linkedValue: unknown; source: LinkedSource } {
  const linked = linkedStyleForContainer(presentation, element);
  const read = (bag: ContainerElement | LinkedContainerStyle, source: "local" | "linked"): unknown => {
    switch (property) {
      case "layout.position": return bag?.layout?.position;
      case "layout.top": return bag?.layout?.top;
      case "layout.right": return bag?.layout?.right;
      case "layout.bottom": return bag?.layout?.bottom;
      case "layout.left": return bag?.layout?.left;
      case "layout.width": return bag?.layout?.width;
      case "layout.height": return bag?.layout?.height;
      case "layout.minWidth": return bag?.layout?.minWidth;
      case "layout.minHeight": return bag?.layout?.minHeight;
      case "layout.maxWidth": return bag?.layout?.maxWidth;
      case "layout.maxHeight": return bag?.layout?.maxHeight;
      case "layout.margin": return bag?.layout?.margin;
      case "layout.marginTop": return bag?.layout?.marginTop;
      case "layout.marginRight": return bag?.layout?.marginRight;
      case "layout.marginBottom": return bag?.layout?.marginBottom;
      case "layout.marginLeft": return bag?.layout?.marginLeft;
      case "layout.padding": return bag?.layout?.padding;
      case "layout.paddingTop": return bag?.layout?.paddingTop;
      case "layout.paddingRight": return bag?.layout?.paddingRight;
      case "layout.paddingBottom": return bag?.layout?.paddingBottom;
      case "layout.paddingLeft": return bag?.layout?.paddingLeft;
      case "layout.flexShrink": return bag?.layout?.flexShrink;
      case "layout.children.mode": return bag?.layout?.children?.mode;
      case "layout.children.direction": return bag?.layout?.children?.direction;
      case "layout.children.gap": return bag?.layout?.children?.gap;
      case "layout.children.distribution": return bag?.layout?.children?.distribution;
      case "layout.children.horizontalAlign": return bag?.layout?.children?.horizontalAlign;
      case "layout.children.verticalAlign": return bag?.layout?.children?.verticalAlign;
      case "layout.children.fit": return bag?.layout?.children?.fit;
      case "layout.overflow": return bag?.layout?.overflow;
      case "style.color": return bag?.style?.color;
      case "style.background.color": return bag?.style?.background?.color;
      case "style.background.gradient": return bag?.style?.background?.gradient;
      case "style.background.pattern": return bag?.style?.background?.pattern;
      case "style.border": return bag?.style?.border;
      case "style.borderRadius": return bag?.style?.borderRadius;
      case "effect.opacity": return bag?.effect?.opacity;
      case "effect.shadow": return bag?.effect?.shadow;
      default: return source === "local" ? undefined : undefined;
    }
  };
  const localValue = read(element, "local");
  const linkedValue = linked === undefined ? undefined : read(linked, "linked");
  return { localValue, linkedValue, source: localValue !== undefined ? "local" : linkedValue !== undefined ? "linked" : "theme" };
}
