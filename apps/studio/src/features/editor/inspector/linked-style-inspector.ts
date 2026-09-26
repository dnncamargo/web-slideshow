import {
  isLinkedContainerStyle,
  resolveLinkedCodeStyle,
  resolveLinkedDividerStyle,
  resolveLinkedTableStyle,
  resolveLinkedTerminalStyle,
  type CodeElement,
  type ContainerElement,
  type DividerElement,
  type LinkedCodeStyle,
  type LinkedContainerStyle,
  type LinkedDividerStyle,
  type LinkedSimpleTableStyle,
  type LinkedStructuredTableStyle,
  type LinkedTerminalStyle,
  type LinkedTopicsStyle,
  type Presentation,
  type TableElement,
  type TerminalElement,
  type TopicsElement,
} from "@web-slideshow/document-schema";

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

export type TopicsShareableProperty =
  | "kind" | "layout.margin" | "layout.marginTop" | "layout.marginRight"
  | "layout.marginBottom" | "layout.marginLeft" | "layout.itemGap"
  | "rootMarkerStyle" | "markerColor";

export type TargetElement = CodeElement | TerminalElement | TableElement | DividerElement;
export type TargetLinkedStyle = LinkedCodeStyle | LinkedTerminalStyle | LinkedSimpleTableStyle | LinkedStructuredTableStyle | LinkedDividerStyle;
export type TargetShareableProperty =
  | "layout.position" | "layout.top" | "layout.right" | "layout.bottom" | "layout.left" | "layout.width" | "layout.height"
  | "layout.margin" | "layout.marginTop" | "layout.marginRight" | "layout.marginBottom" | "layout.marginLeft"
  | "style.color" | "style.background.color" | "style.background.gradient" | "style.borderRadius" | "style.border"
  | "style.commandColor" | "style.promptColor" | "style.outputColor" | "style.commentColor" | "style.errorColor"
  | "style.headerBackground" | "style.bodyRowAlternateBackground" | "style.dividerOpacity"
  | "typography.fontFamily" | "typography.fontSize" | "typography.lineHeight" | "typography.letterSpacing"
  | "titleTypography.fontFamily" | "titleTypography.fontSize" | "titleTypography.lineHeight" | "titleTypography.letterSpacing"
  | "effect.opacity" | "effect.shadow";

export type TargetLinkedStyleInspection = {
  linked: TargetLinkedStyle | undefined;
  resolved: ReturnType<typeof resolveLinkedCodeStyle> | ReturnType<typeof resolveLinkedTerminalStyle> | ReturnType<typeof resolveLinkedTableStyle> | ReturnType<typeof resolveLinkedDividerStyle> | undefined;
  getProperty: (property: TargetShareableProperty) => { localValue: unknown; linkedValue: unknown; effectiveValue: unknown; source: LinkedSource; owned: boolean };
};

function targetLinkedStyleForElement(
  presentation: Pick<Presentation, "linkedStyles"> | undefined,
  element: TargetElement,
): TargetLinkedStyle | undefined {
  const candidate = element.linkedStyleId === undefined
    ? undefined
    : presentation?.linkedStyles?.find((style) => style.id === element.linkedStyleId);
  if (candidate === undefined || !("target" in candidate)) return undefined;
  if (element.type === "code" && candidate.target === "code") return candidate;
  if (element.type === "terminal" && candidate.target === "terminal") return candidate;
  if (element.type === "divider" && candidate.target === "divider") return candidate;
  if (element.type === "table" && candidate.target === "table" && candidate.mode === (element.mode === "structured" ? "structured" : "simple")) return candidate;
  return undefined;
}

function readTargetProperty(value: TargetElement | TargetLinkedStyle | undefined, property: TargetShareableProperty): unknown {
  if (value === undefined) return undefined;
  const parts = property.split(".");
  const namespace = parts[0];
  const key = parts[1];
  if (namespace === "layout") return value.layout?.[key as keyof NonNullable<typeof value.layout>];
  if (namespace === "style") {
    if (key === "background") return value.style?.background?.[parts[2] as keyof NonNullable<typeof value.style.background>];
    return value.style?.[key as keyof NonNullable<typeof value.style>];
  }
  if (namespace === "effect") return value.effect?.[key as keyof NonNullable<typeof value.effect>];
  if (namespace === "typography" && "typography" in value) return value.typography?.[key as keyof NonNullable<typeof value.typography>];
  if (namespace === "titleTypography" && "titleTypography" in value) return value.titleTypography?.[key as keyof NonNullable<typeof value.titleTypography>];
  return undefined;
}

export function inspectTargetLinkedStyle(
  presentation: Pick<Presentation, "linkedStyles"> | undefined,
  element: TargetElement,
): TargetLinkedStyleInspection {
  const linked = targetLinkedStyleForElement(presentation, element);
  const resolved = linked === undefined && element.linkedStyleId !== undefined ? undefined
    : element.type === "code" ? resolveLinkedCodeStyle(presentation ?? { linkedStyles: [] }, element)
      : element.type === "terminal" ? resolveLinkedTerminalStyle(presentation ?? { linkedStyles: [] }, element)
        : element.type === "table" ? resolveLinkedTableStyle(presentation ?? { linkedStyles: [] }, element)
          : resolveLinkedDividerStyle(presentation ?? { linkedStyles: [] }, element);
  return {
    linked,
    resolved,
    getProperty: (property) => {
      const localValue = readTargetProperty(element, property);
      const linkedValue = readTargetProperty(linked, property);
      const effectiveValue = readTargetProperty(resolved as TargetElement | TargetLinkedStyle | undefined, property);
      const owned = linkedValue !== undefined;
      return { localValue, linkedValue, effectiveValue, source: owned ? "linked" : localValue !== undefined ? "local" : "theme", owned };
    },
  };
}

export function linkedStyleForContainer(presentation: Pick<Presentation, "linkedStyles"> | undefined, element: ContainerElement) {
  if (element.linkedStyleId === undefined) return undefined;
  const linked = presentation?.linkedStyles?.find((style) => style.id === element.linkedStyleId);
  return linked !== undefined && isLinkedContainerStyle(linked) ? linked : undefined;
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

export function linkedStyleForTopics(
  presentation: Pick<Presentation, "linkedStyles"> | undefined,
  element: TopicsElement,
): LinkedTopicsStyle | undefined {
  if (element.linkedStyleId === undefined) return undefined;
  const linked = presentation?.linkedStyles?.find((style) => style.id === element.linkedStyleId);
  return linked !== undefined && "target" in linked && linked.target === "topics" ? linked : undefined;
}

export function getTopicsShareablePropertySource(
  presentation: Pick<Presentation, "linkedStyles"> | undefined,
  element: TopicsElement,
  property: TopicsShareableProperty,
): { localValue: unknown; linkedValue: unknown; source: LinkedSource } {
  const linked = linkedStyleForTopics(presentation, element);
  const localValue = property === "kind" ? element.kind
    : property === "rootMarkerStyle" ? element.rootMarkerStyle
      : property === "markerColor" ? element.markerColor
        : property === "layout.itemGap" ? element.itemGap
          : element.layout?.[property.slice("layout.".length) as keyof NonNullable<TopicsElement["layout"]>];
  const linkedValue = linked === undefined ? undefined
    : property === "kind" ? linked.kind
      : property === "rootMarkerStyle" ? linked.rootMarkerStyle
        : property === "markerColor" ? linked.markerColor
          : property === "layout.itemGap" ? linked.itemGap
            : linked.layout?.[property.slice("layout.".length) as keyof NonNullable<LinkedTopicsStyle["layout"]>];
  return {
    localValue,
    linkedValue,
    source: localValue !== undefined ? "local" : linkedValue !== undefined ? "linked" : "theme",
  };
}
