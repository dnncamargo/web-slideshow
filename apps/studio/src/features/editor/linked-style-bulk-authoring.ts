import {
  PresentationSchema,
  type ContainerElement,
  type ContainerLayout,
  type ElementEffect,
  type ElementTypography,
  type ElementVisualStyle,
  type LinkedContainerStyle,
  type Presentation,
} from "@powershow/document-schema";

import { updateElementById } from "./element-tree";
import { visitContainers } from "./element-hierarchy";

export type LinkedStyleContainerLocation = {
  slideIndex: number;
  elementId: string;
};

type PropertyBag = Record<string, unknown>;

const LAYOUT_DIRECT_PROPERTIES = [
  "position", "top", "right", "bottom", "left", "width", "height",
  "minWidth", "minHeight", "maxWidth", "maxHeight", "margin", "marginTop",
  "marginRight", "marginBottom", "marginLeft", "padding", "paddingTop",
  "paddingRight", "paddingBottom", "paddingLeft", "flexShrink", "overflow",
] as const;
const CHILDREN_PROPERTIES = [
  "mode", "direction", "gap", "distribution", "horizontalAlign", "verticalAlign",
] as const;
const STYLE_DIRECT_PROPERTIES = ["color", "borderRadius"] as const;
const TYPOGRAPHY_PROPERTIES = [
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "textAlign", "lineHeight",
  "letterSpacing", "textTransform", "whiteSpace", "textWrapStyle", "overflowWrap",
  "textDecorationLine", "textDecorationColor",
] as const;

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => valuesEqual(value, right[index]));
  }
  const leftEntries = Object.entries(left as PropertyBag).filter(([, value]) => value !== undefined);
  const rightEntries = Object.entries(right as PropertyBag).filter(([, value]) => value !== undefined);
  return leftEntries.length === rightEntries.length && leftEntries.every(([key, value]) =>
    Object.prototype.hasOwnProperty.call(right, key) && valuesEqual(value, (right as PropertyBag)[key]));
}

function matchesAuthoredShallowProperties(localBag: object | undefined, linkedBag: object | undefined, keys: readonly string[]): boolean {
  const local = (localBag ?? {}) as PropertyBag;
  const linked = (linkedBag ?? {}) as PropertyBag;
  return keys.every((key) => linked[key] === undefined || (local[key] !== undefined && valuesEqual(local[key], linked[key])));
}

function matchesLinkedContainerStyle(container: ContainerElement, linked: LinkedContainerStyle): boolean {
  if (container.linkedStyleId !== undefined) return false;
  return matchesAuthoredShallowProperties(container.layout, linked.layout, LAYOUT_DIRECT_PROPERTIES) &&
    matchesAuthoredShallowProperties(container.layout?.children, linked.layout?.children, CHILDREN_PROPERTIES) &&
    (linked.layout?.children?.fit === undefined || (container.layout?.children?.fit !== undefined && valuesEqual(container.layout.children.fit, linked.layout.children.fit))) &&
    matchesAuthoredShallowProperties(container.style, linked.style, STYLE_DIRECT_PROPERTIES) &&
    matchesAuthoredShallowProperties(container.style?.background, linked.style?.background, ["color"]) &&
    (linked.style?.background?.gradient === undefined || (container.style?.background?.gradient !== undefined && valuesEqual(container.style.background.gradient, linked.style.background.gradient))) &&
    (linked.style?.background?.pattern === undefined || (container.style?.background?.pattern !== undefined && valuesEqual(container.style.background.pattern, linked.style.background.pattern))) &&
    (linked.style?.border === undefined || (container.style?.border !== undefined && valuesEqual(container.style.border, linked.style.border))) &&
    matchesAuthoredShallowProperties(container.typography, linked.typography, TYPOGRAPHY_PROPERTIES) &&
    (linked.typography?.textStroke === undefined || (container.typography?.textStroke !== undefined && valuesEqual(container.typography.textStroke, linked.typography.textStroke))) &&
    matchesAuthoredShallowProperties(container.effect, linked.effect, ["opacity"]) &&
    (linked.effect?.shadow === undefined || (container.effect?.shadow !== undefined && valuesEqual(container.effect.shadow, linked.effect.shadow)));
}

function removeLinkedLayoutProperties(localLayout: ContainerLayout | undefined, linkedLayout: ContainerLayout | undefined): ContainerLayout | undefined {
  if (localLayout === undefined) return undefined;
  const next = { ...localLayout, ...(localLayout.children === undefined ? {} : { children: { ...localLayout.children } }) };
  const local = next as PropertyBag;
  const linked = (linkedLayout ?? {}) as PropertyBag;
  for (const key of LAYOUT_DIRECT_PROPERTIES) if (linked[key] !== undefined) delete local[key];
  const children = next.children;
  const linkedChildren = linkedLayout?.children as PropertyBag | undefined;
  if (children !== undefined) {
    const childBag = children as PropertyBag;
    for (const key of CHILDREN_PROPERTIES) if (linkedChildren?.[key] !== undefined) delete childBag[key];
    if (linkedChildren?.fit !== undefined) delete childBag.fit;
    if (Object.keys(childBag).length === 0) delete local.children;
  }
  return Object.keys(local).length === 0 ? undefined : next;
}

function removeLinkedStyleProperties(localStyle: ElementVisualStyle | undefined, linkedStyle: LinkedContainerStyle["style"]): ElementVisualStyle | undefined {
  if (localStyle === undefined) return undefined;
  const next = { ...localStyle, ...(localStyle.background === undefined ? {} : { background: { ...localStyle.background } }) };
  const local = next as PropertyBag;
  const linked = (linkedStyle ?? {}) as PropertyBag;
  for (const key of STYLE_DIRECT_PROPERTIES) if (linked[key] !== undefined) delete local[key];
  const background = next.background;
  const linkedBackground = linkedStyle?.background as PropertyBag | undefined;
  if (background !== undefined) {
    const backgroundBag = background as PropertyBag;
    if (linkedBackground?.color !== undefined) delete backgroundBag.color;
    if (linkedBackground?.gradient !== undefined) delete backgroundBag.gradient;
    if (linkedBackground?.pattern !== undefined) delete backgroundBag.pattern;
    if (Object.keys(backgroundBag).length === 0) delete local.background;
  }
  if (linkedStyle?.border !== undefined) delete local.border;
  return Object.keys(local).length === 0 ? undefined : next;
}

function removeLinkedTypographyProperties(localTypography: ElementTypography | undefined, linkedTypography: ElementTypography | undefined): ElementTypography | undefined {
  if (localTypography === undefined) return undefined;
  const next = { ...localTypography };
  const local = next as PropertyBag;
  const linked = (linkedTypography ?? {}) as PropertyBag;
  for (const key of TYPOGRAPHY_PROPERTIES) if (linked[key] !== undefined) delete local[key];
  if (linkedTypography?.textStroke !== undefined) delete local.textStroke;
  return Object.keys(local).length === 0 ? undefined : next;
}

function removeLinkedEffectProperties(localEffect: ElementEffect | undefined, linkedEffect: ElementEffect | undefined): ElementEffect | undefined {
  if (localEffect === undefined) return undefined;
  const next = { ...localEffect };
  const local = next as PropertyBag;
  const linked = (linkedEffect ?? {}) as PropertyBag;
  if (linked.opacity !== undefined) delete local.opacity;
  if (linked.shadow !== undefined) delete local.shadow;
  return Object.keys(local).length === 0 ? undefined : next;
}

function transfer(container: ContainerElement, linked: LinkedContainerStyle): ContainerElement {
  const layout = removeLinkedLayoutProperties(container.layout, linked.layout);
  const style = removeLinkedStyleProperties(container.style, linked.style);
  const typography = removeLinkedTypographyProperties(container.typography, linked.typography);
  const effect = removeLinkedEffectProperties(container.effect, linked.effect);
  const hasLocalEdge = [layout?.top, layout?.right, layout?.bottom, layout?.left].some((value) => value !== undefined);
  const finalLayout = hasLocalEdge && layout?.position === undefined && linked.layout?.position !== undefined
    ? { ...layout, position: "absolute" as const }
    : layout;
  const {
    layout: _localLayout,
    style: _localStyle,
    typography: _localTypography,
    effect: _localEffect,
    ...structural
  } = container;
  return {
    ...structural,
    ...(finalLayout === undefined ? {} : { layout: finalLayout }),
    ...(style === undefined ? {} : { style }),
    ...(typography === undefined ? {} : { typography }),
    ...(effect === undefined ? {} : { effect }),
    linkedStyleId: linked.id,
  };
}

function locationsFor(presentation: Presentation, predicate: (container: ContainerElement) => boolean): LinkedStyleContainerLocation[] {
  const locations: LinkedStyleContainerLocation[] = [];
  presentation.slides.forEach((slide, slideIndex) => {
    visitContainers(slide.elements, (container) => {
      if (predicate(container)) locations.push({ slideIndex, elementId: container.id });
    });
  });
  return locations;
}

export function findMatchingContainersForLinkedStyle(presentation: Presentation, linkedStyleId: string): LinkedStyleContainerLocation[] {
  const linked = presentation.linkedStyles?.find((style) => style.id === linkedStyleId);
  return linked === undefined ? [] : locationsFor(presentation, (container) => matchesLinkedContainerStyle(container, linked));
}

export function findContainersLinkedToStyle(presentation: Presentation, linkedStyleId: string): LinkedStyleContainerLocation[] {
  return locationsFor(presentation, (container) => container.linkedStyleId === linkedStyleId);
}

export function attachLinkedStyleToMatchingContainers(presentation: Presentation, linkedStyleId: string): { presentation: Presentation; attachedLocations: LinkedStyleContainerLocation[] } {
  const linked = presentation.linkedStyles?.find((style) => style.id === linkedStyleId);
  if (linked === undefined) return { presentation, attachedLocations: [] };
  const attachedLocations = findMatchingContainersForLinkedStyle(presentation, linkedStyleId);
  if (attachedLocations.length === 0) return { presentation, attachedLocations };
  const idsBySlide = new Map<number, Set<string>>();
  for (const location of attachedLocations) {
    const ids = idsBySlide.get(location.slideIndex) ?? new Set<string>();
    ids.add(location.elementId);
    idsBySlide.set(location.slideIndex, ids);
  }
  const result = PresentationSchema.parse({
    ...presentation,
    slides: presentation.slides.map((slide, slideIndex) => {
      const ids = idsBySlide.get(slideIndex);
      if (ids === undefined) return slide;
      return { ...slide, elements: Array.from(ids).reduce((elements, id) => updateElementById(elements, id, (element) => element.type === "container" && matchesLinkedContainerStyle(element, linked) ? transfer(element, linked) : element), slide.elements) };
    }),
  });
  return { presentation: result, attachedLocations };
}
