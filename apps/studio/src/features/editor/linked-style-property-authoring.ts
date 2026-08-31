import { PresentationSchema, type LinkedContainerStyle, type Presentation } from "@powershow/document-schema";
import { createLinkedStyleId } from "./linked-style-authoring";

export type LinkedStyleAuthorableProperty =
  | "layoutMode" | "direction" | "gap" | "distribution" | "horizontalAlign" | "verticalAlign" | "overflow" | "fit"
  | "position" | "top" | "right" | "bottom" | "left" | "width" | "height" | "preserveSize"
  | "padding" | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft"
  | "margin" | "marginTop" | "marginRight" | "marginBottom" | "marginLeft"
  | "color" | "backgroundColor" | "gradient" | "pattern" | "border" | "borderRadius" | "opacity" | "shadow";

export const LINKED_STYLE_PROPERTY_ORDER: readonly LinkedStyleAuthorableProperty[] = [
  "layoutMode", "direction", "gap", "distribution", "horizontalAlign", "verticalAlign", "overflow", "fit",
  "position", "top", "right", "bottom", "left", "width", "height", "preserveSize",
  "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
  "color", "backgroundColor", "gradient", "pattern", "border", "borderRadius", "opacity", "shadow",
];

export const LINKED_STYLE_PROPERTY_GROUPS = {
  layout: ["layoutMode", "direction", "gap", "distribution", "horizontalAlign", "verticalAlign", "overflow", "fit"],
  position: ["position", "top", "right", "bottom", "left"],
  size: ["width", "height", "preserveSize"],
  spacing: ["padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "margin", "marginTop", "marginRight", "marginBottom", "marginLeft"],
  appearance: ["color", "backgroundColor", "gradient", "pattern", "border", "borderRadius"],
  effects: ["opacity", "shadow"],
} as const;

type PropertyBag = Record<string, unknown>;

function has(value: unknown): boolean { return value !== undefined; }

export function hasLinkedStyleProperty(style: LinkedContainerStyle, property: LinkedStyleAuthorableProperty | "fit"): boolean {
  switch (property) {
    case "layoutMode": return has(style.layout?.children?.mode);
    case "direction": return has(style.layout?.children?.direction);
    case "gap": return has(style.layout?.children?.gap);
    case "distribution": return has(style.layout?.children?.distribution);
    case "horizontalAlign": return has(style.layout?.children?.horizontalAlign);
    case "verticalAlign": return has(style.layout?.children?.verticalAlign);
    case "overflow": return has(style.layout?.overflow);
    case "fit": return has(style.layout?.children?.fit);
    case "position": return has(style.layout?.position);
    case "top": return has(style.layout?.top);
    case "right": return has(style.layout?.right);
    case "bottom": return has(style.layout?.bottom);
    case "left": return has(style.layout?.left);
    case "width": return has(style.layout?.width);
    case "height": return has(style.layout?.height);
    case "preserveSize": return has(style.layout?.flexShrink);
    case "padding": return has(style.layout?.padding);
    case "paddingTop": return has(style.layout?.paddingTop);
    case "paddingRight": return has(style.layout?.paddingRight);
    case "paddingBottom": return has(style.layout?.paddingBottom);
    case "paddingLeft": return has(style.layout?.paddingLeft);
    case "margin": return has(style.layout?.margin);
    case "marginTop": return has(style.layout?.marginTop);
    case "marginRight": return has(style.layout?.marginRight);
    case "marginBottom": return has(style.layout?.marginBottom);
    case "marginLeft": return has(style.layout?.marginLeft);
    case "color": return has(style.style?.color);
    case "backgroundColor": return has(style.style?.background?.color);
    case "gradient": return has(style.style?.background?.gradient);
    case "pattern": return has(style.style?.background?.pattern);
    case "border": return has(style.style?.border);
    case "borderRadius": return has(style.style?.borderRadius);
    case "opacity": return has(style.effect?.opacity);
    case "shadow": return has(style.effect?.shadow);
  }
}

export function listLinkedStyleAuthoredProperties(style: LinkedContainerStyle): LinkedStyleAuthorableProperty[] {
  return LINKED_STYLE_PROPERTY_ORDER.filter((property) => hasLinkedStyleProperty(style, property));
}

export function listAvailableLinkedStyleProperties(style: LinkedContainerStyle): LinkedStyleAuthorableProperty[] {
  return LINKED_STYLE_PROPERTY_ORDER.filter((property) => property !== "fit" && !hasLinkedStyleProperty(style, property))
    .filter((property) => !(property === "top" || property === "right" || property === "bottom" || property === "left") || style.layout?.position === "absolute");
}

export function addLinkedStyleProperty(style: LinkedContainerStyle, property: LinkedStyleAuthorableProperty): LinkedContainerStyle {
  if (hasLinkedStyleProperty(style, property)) return style;
  const layout = { ...style.layout };
  const children = { ...layout.children };
  const visual = { ...style.style };
  const background = { ...visual.background };
  const effect = { ...style.effect };
  switch (property) {
    case "layoutMode": children.mode = "flow"; break;
    case "direction": children.direction = "column"; break;
    case "gap": children.gap = 0; break;
    case "distribution": children.distribution = "space-between"; break;
    case "horizontalAlign": children.horizontalAlign = "start"; break;
    case "verticalAlign": children.verticalAlign = "start"; break;
    case "overflow": layout.overflow = "visible"; break;
    case "position": layout.position = "absolute"; break;
    case "top": layout.top = 0; break;
    case "right": layout.right = 0; break;
    case "bottom": layout.bottom = 0; break;
    case "left": layout.left = 0; break;
    case "width": layout.width = "100%"; break;
    case "height": layout.height = "100%"; break;
    case "preserveSize": layout.flexShrink = 0; break;
    case "padding": layout.padding = 0; break;
    case "paddingTop": layout.paddingTop = 0; break;
    case "paddingRight": layout.paddingRight = 0; break;
    case "paddingBottom": layout.paddingBottom = 0; break;
    case "paddingLeft": layout.paddingLeft = 0; break;
    case "margin": layout.margin = 0; break;
    case "marginTop": layout.marginTop = 0; break;
    case "marginRight": layout.marginRight = 0; break;
    case "marginBottom": layout.marginBottom = 0; break;
    case "marginLeft": layout.marginLeft = 0; break;
    case "color": visual.color = "#e2e8f0"; break;
    case "backgroundColor": background.color = "#0f141d"; break;
    case "gradient": background.gradient = { type: "linear", angle: 135, stops: [{ color: "#7c3aed", position: 0 }, { color: "#06b6d4", position: 100 }] }; break;
    case "pattern": background.pattern = { image: "radial-gradient(#64748b 1px, transparent 1px)", size: "12px 12px" }; break;
    case "border": visual.border = { width: 1, style: "solid", color: "#94a3b8" }; break;
    case "borderRadius": visual.borderRadius = 0; break;
    case "opacity": effect.opacity = 1; break;
    case "shadow": effect.shadow = { x: 0, y: 4, blur: 12, color: "#000000" }; break;
  }
  return {
    ...style,
    ...(Object.keys(layout).length || Object.keys(children).length ? { layout: { ...layout, ...(Object.keys(children).length ? { children } : {}) } } : {}),
    ...(Object.keys(visual).length || Object.keys(background).length ? { style: { ...visual, ...(Object.keys(background).length ? { background } : {}) } } : {}),
    ...(Object.keys(effect).length ? { effect } : {}),
  };
}

export function removeLinkedStyleProperty(style: LinkedContainerStyle, property: LinkedStyleAuthorableProperty): LinkedContainerStyle {
  if (property === "position" && [style.layout?.top, style.layout?.right, style.layout?.bottom, style.layout?.left].some(has)) return style;
  const layout = style.layout === undefined ? undefined : { ...style.layout, ...(style.layout.children === undefined ? {} : { children: { ...style.layout.children } }) };
  const visual = style.style === undefined ? undefined : { ...style.style, ...(style.style.background === undefined ? {} : { background: { ...style.style.background } }) };
  const effect = style.effect === undefined ? undefined : { ...style.effect };
  switch (property) {
    case "layoutMode": if (layout?.children) delete (layout.children as PropertyBag).mode; break;
    case "direction": if (layout?.children) delete (layout.children as PropertyBag).direction; break;
    case "gap": if (layout?.children) delete (layout.children as PropertyBag).gap; break;
    case "distribution": if (layout?.children) delete (layout.children as PropertyBag).distribution; break;
    case "horizontalAlign": if (layout?.children) delete (layout.children as PropertyBag).horizontalAlign; break;
    case "verticalAlign": if (layout?.children) delete (layout.children as PropertyBag).verticalAlign; break;
    case "overflow": if (layout) delete (layout as PropertyBag).overflow; break;
    case "position": if (layout) delete (layout as PropertyBag).position; break;
    case "top": if (layout) delete (layout as PropertyBag).top; break;
    case "right": if (layout) delete (layout as PropertyBag).right; break;
    case "bottom": if (layout) delete (layout as PropertyBag).bottom; break;
    case "left": if (layout) delete (layout as PropertyBag).left; break;
    case "width": if (layout) delete (layout as PropertyBag).width; break;
    case "height": if (layout) delete (layout as PropertyBag).height; break;
    case "preserveSize": if (layout) delete (layout as PropertyBag).flexShrink; break;
    case "padding": if (layout) delete (layout as PropertyBag).padding; break;
    case "paddingTop": if (layout) delete (layout as PropertyBag).paddingTop; break;
    case "paddingRight": if (layout) delete (layout as PropertyBag).paddingRight; break;
    case "paddingBottom": if (layout) delete (layout as PropertyBag).paddingBottom; break;
    case "paddingLeft": if (layout) delete (layout as PropertyBag).paddingLeft; break;
    case "margin": if (layout) delete (layout as PropertyBag).margin; break;
    case "marginTop": if (layout) delete (layout as PropertyBag).marginTop; break;
    case "marginRight": if (layout) delete (layout as PropertyBag).marginRight; break;
    case "marginBottom": if (layout) delete (layout as PropertyBag).marginBottom; break;
    case "marginLeft": if (layout) delete (layout as PropertyBag).marginLeft; break;
    case "color": if (visual) delete (visual as PropertyBag).color; break;
    case "backgroundColor": if (visual?.background) delete (visual.background as PropertyBag).color; break;
    case "gradient": if (visual?.background) delete (visual.background as PropertyBag).gradient; break;
    case "pattern": if (visual?.background) delete (visual.background as PropertyBag).pattern; break;
    case "border": if (visual) delete (visual as PropertyBag).border; break;
    case "borderRadius": if (visual) delete (visual as PropertyBag).borderRadius; break;
    case "opacity": if (effect) delete (effect as PropertyBag).opacity; break;
    case "shadow": if (effect) delete (effect as PropertyBag).shadow; break;
  }
  if (layout?.children && Object.keys(layout.children).length === 0) delete (layout as PropertyBag).children;
  if (visual?.background && Object.keys(visual.background).length === 0) delete (visual as PropertyBag).background;
  return {
    ...style,
    ...(layout && Object.keys(layout).length ? { layout } : { layout: undefined }),
    ...(visual && Object.keys(visual).length ? { style: visual } : { style: undefined }),
    ...(effect && Object.keys(effect).length ? { effect } : { effect: undefined }),
  };
}

export function createLinkedStyleWithProperty(presentation: Presentation, name: string, property: LinkedStyleAuthorableProperty): { presentation: Presentation; linkedStyleId?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { presentation };
  const ids = (presentation.linkedStyles ?? []).map((style) => style.id);
  const id = createLinkedStyleId(trimmed, ids);
  const candidate = addLinkedStyleProperty({ id, name: trimmed }, property);
  const parsed = PresentationSchema.safeParse({ ...presentation, linkedStyles: [...(presentation.linkedStyles ?? []), candidate] });
  return parsed.success ? { presentation: parsed.data, linkedStyleId: id } : { presentation };
}
