import {
  PresentationSchema,
  type ContainerElement,
  type LinkedContainerStyle,
  type Presentation,
  type PresentationElement,
} from "@web-slideshow/document-schema";

import { updateElementById } from "./element-tree";
import { visitContainers, visitElements } from "./element-hierarchy";
import { adoptLinkedContainerStyle } from "./linked-style-authoring";
import { forEachNavigablePresentationAuthoringTree, updatePresentationAuthoringTrees } from "./presentation-authoring-trees";
import type { AuthoringTarget } from "./authoring-target";

type PropertyBag = Record<string, unknown>;

type CanonicalTreeOwnerLocation =
  | { slideIndex: number }
  | { slideIndex: number; localRootChildrenIndex: number }
  | { rootDefinitionId: string };

export type LinkedStyleContainerLocation =
  | { slideIndex: number; elementId: string }
  | { slideIndex: number; localRootChildrenIndex: number; elementId: string }
  | { rootDefinitionId: string; elementId: string };

export type LinkedStyleUsageLocation = {
  target: AuthoringTarget;
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

function forEachCanonicalTree(
  presentation: Presentation,
  visit: (elements: readonly PresentationElement[], location: CanonicalTreeOwnerLocation) => void,
): void {
  presentation.slides.forEach((slide, slideIndex) => {
    visit(slide.elements, { slideIndex });
    slide.localRootChildren?.forEach((entry, localRootChildrenIndex) => {
      visit(entry.children, { slideIndex, localRootChildrenIndex });
    });
  });
  presentation.rootDefinitions?.forEach((rootDefinition) => {
    visit([rootDefinition.root], { rootDefinitionId: rootDefinition.id });
  });
}

function locationsFor(presentation: Presentation, predicate: (container: ContainerElement) => boolean): LinkedStyleContainerLocation[] {
  const locations: LinkedStyleContainerLocation[] = [];
  forEachCanonicalTree(presentation, (elements, owner) => {
    visitContainers(elements, (container) => {
      if (predicate(container)) locations.push({ ...owner, elementId: container.id });
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

/** Finds all supported Linked Style references through the canonical hierarchy traversal. */
export function findElementsLinkedToStyle(presentation: Presentation, linkedStyleId: string): LinkedStyleContainerLocation[] {
  const locations: LinkedStyleContainerLocation[] = [];
  forEachCanonicalTree(presentation, (elements, owner) => {
    visitElements(elements, (element) => {
      if ((element.type === "container" || element.type === "topics") && element.linkedStyleId === linkedStyleId) {
        locations.push({ ...owner, elementId: element.id });
      }
    });
  });
  return locations;
}

export function findContainerLinkedStyleUsageLocations(
  presentation: Presentation,
  linkedStyleId: string,
): LinkedStyleUsageLocation[] {
  const locations: LinkedStyleUsageLocation[] = [];
  forEachNavigablePresentationAuthoringTree(presentation, (elements, target) => {
    visitContainers(elements, (container) => {
      if (container.linkedStyleId === linkedStyleId) {
        locations.push({ target, elementId: container.id });
      }
    });
  });
  return locations;
}

/** Finds owner-aware Resources usages for both Container and Topics Linked Styles. */
export function findLinkedStyleUsageLocations(
  presentation: Presentation,
  linkedStyleId: string,
): LinkedStyleUsageLocation[] {
  const locations: LinkedStyleUsageLocation[] = [];
  forEachNavigablePresentationAuthoringTree(presentation, (elements, target) => {
    visitElements(elements, (element) => {
      if ((element.type === "container" || element.type === "topics") && element.linkedStyleId === linkedStyleId) {
        locations.push({ target, elementId: element.id });
      }
    });
  });
  return locations;
}

export function attachLinkedStyleToMatchingContainers(presentation: Presentation, linkedStyleId: string): { presentation: Presentation; attachedLocations: LinkedStyleContainerLocation[] } {
  const linked = presentation.linkedStyles?.find((style) => style.id === linkedStyleId);
  if (linked === undefined) return { presentation, attachedLocations: [] };
  const attachedLocations = findMatchingContainersForLinkedStyle(presentation, linkedStyleId);
  if (attachedLocations.length === 0) return { presentation, attachedLocations };
  const candidate = updatePresentationAuthoringTrees(presentation, (elements) => {
    const matchingIds: string[] = [];
    visitContainers(elements, (container) => {
      if (matchesLinkedContainerStyle(container, linked)) matchingIds.push(container.id);
    });
    return matchingIds.reduce(
      (current, id) => updateElementById(current, id, (element) => element.type === "container" && matchesLinkedContainerStyle(element, linked) ? adoptLinkedContainerStyle(element, linked) : element),
      elements as PresentationElement[],
    );
  });
  const parsed = PresentationSchema.safeParse(candidate);
  const result = parsed.success ? parsed.data : presentation;
  return { presentation: result, attachedLocations };
}
