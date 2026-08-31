import {
  PresentationSchema,
  type ContainerElement,
  type LinkedContainerStyle,
  type Presentation,
} from "@powershow/document-schema";

import { updateElementById } from "./element-tree";
import { visitContainers } from "./element-hierarchy";
import { adoptLinkedContainerStyle } from "./linked-style-authoring";

type PropertyBag = Record<string, unknown>;

export type LinkedStyleContainerLocation = {
  slideIndex: number;
  elementId: string;
};

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
      return { ...slide, elements: Array.from(ids).reduce((elements, id) => updateElementById(elements, id, (element) => element.type === "container" && matchesLinkedContainerStyle(element, linked) ? adoptLinkedContainerStyle(element, linked) : element), slide.elements) };
    }),
  });
  return { presentation: result, attachedLocations };
}
