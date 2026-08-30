import {
  PresentationSchema,
  type ContainerElement,
  type ContainerLayout,
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
type PropertyPath = readonly [string, ...string[]];

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

function cloneBag(value: object): PropertyBag {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    Array.isArray(entry)
      ? entry.map((item) => item !== null && typeof item === "object" ? cloneBag(item) : item)
      : entry !== null && typeof entry === "object"
        ? cloneBag(entry)
        : entry,
  ]));
}

function hasValue(value: unknown): boolean {
  return value !== undefined;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => valuesEqual(value, right[index]));
  }
  const leftEntries = Object.entries(left as PropertyBag).filter(([, value]) => hasValue(value));
  const rightEntries = Object.entries(right as PropertyBag).filter(([, value]) => hasValue(value));
  if (leftEntries.length !== rightEntries.length) return false;
  return leftEntries.every(([key, value]) => Object.prototype.hasOwnProperty.call(right, key) && valuesEqual(value, (right as PropertyBag)[key]));
}

function suppliedPaths(style: LinkedContainerStyle): PropertyPath[] {
  const paths: PropertyPath[] = [];
  const layout = style.layout;
  for (const property of LAYOUT_DIRECT_PROPERTIES) {
    if (hasValue(layout?.[property])) paths.push(["layout", property]);
  }
  for (const property of CHILDREN_PROPERTIES) {
    if (hasValue(layout?.children?.[property])) paths.push(["layout", "children", property]);
  }
  if (hasValue(layout?.children?.fit)) paths.push(["layout", "children", "fit"]);

  const visual = style.style;
  for (const property of STYLE_DIRECT_PROPERTIES) {
    if (hasValue(visual?.[property])) paths.push(["style", property]);
  }
  for (const property of ["color"] as const) {
    if (hasValue(visual?.background?.[property])) paths.push(["style", "background", property]);
  }
  for (const property of ["gradient", "pattern"] as const) {
    if (hasValue(visual?.background?.[property])) paths.push(["style", "background", property]);
  }
  if (hasValue(visual?.border)) paths.push(["style", "border"]);

  for (const property of TYPOGRAPHY_PROPERTIES) {
    if (hasValue(style.typography?.[property])) paths.push(["typography", property]);
  }
  if (hasValue(style.typography?.textStroke)) paths.push(["typography", "textStroke"]);
  if (hasValue(style.effect?.opacity)) paths.push(["effect", "opacity"]);
  if (hasValue(style.effect?.shadow)) paths.push(["effect", "shadow"]);
  return paths;
}

function readPath(root: ContainerElement | LinkedContainerStyle, path: PropertyPath): unknown {
  let value: unknown = root;
  for (const key of path) {
    if (value === null || typeof value !== "object") return undefined;
    value = (value as PropertyBag)[key];
  }
  return value;
}

function deletePath(root: ContainerElement, path: PropertyPath): void {
  const parents: PropertyBag[] = [];
  let value: unknown = root;
  for (const key of path.slice(0, -1)) {
    if (value === null || typeof value !== "object") return;
    parents.push(value as PropertyBag);
    value = (value as PropertyBag)[key];
  }
  if (value === null || typeof value !== "object") return;
  delete (value as PropertyBag)[path[path.length - 1]!];
  for (let index = parents.length - 1; index >= 0; index -= 1) {
    const parent = parents[index]!;
    const key = path[index]!;
    const child = parent[key];
    if (child !== null && typeof child === "object" && !Array.isArray(child) && Object.keys(child as PropertyBag).length === 0) {
      delete parent[key];
    }
  }
}

function matches(container: ContainerElement, style: LinkedContainerStyle): boolean {
  if (container.linkedStyleId !== undefined) return false;
  return suppliedPaths(style).every((path) => {
    const localValue = readPath(container, path);
    return hasValue(localValue) && valuesEqual(localValue, readPath(style, path));
  });
}

function transfer(container: ContainerElement, style: LinkedContainerStyle): ContainerElement {
  const paths = suppliedPaths(style);
  const next = {
    ...container,
    ...(container.layout === undefined ? {} : { layout: cloneBag(container.layout) as ContainerLayout }),
    ...(container.style === undefined ? {} : { style: cloneBag(container.style) as ContainerElement["style"] }),
    ...(container.typography === undefined ? {} : { typography: cloneBag(container.typography) as ContainerElement["typography"] }),
    ...(container.effect === undefined ? {} : { effect: cloneBag(container.effect) as ContainerElement["effect"] }),
  };
  for (const path of paths) deletePath(next, path);

  const localLayout = next.layout;
  const hasLocalEdge = [localLayout?.top, localLayout?.right, localLayout?.bottom, localLayout?.left].some(hasValue);
  if (hasLocalEdge && localLayout?.position === undefined && style.layout?.position !== undefined) {
    next.layout = { ...localLayout, position: "absolute" } as ContainerLayout;
  }
  return { ...next, linkedStyleId: style.id };
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
  const style = presentation.linkedStyles?.find((candidate) => candidate.id === linkedStyleId);
  return style === undefined ? [] : locationsFor(presentation, (container) => matches(container, style));
}

export function findContainersLinkedToStyle(presentation: Presentation, linkedStyleId: string): LinkedStyleContainerLocation[] {
  return locationsFor(presentation, (container) => container.linkedStyleId === linkedStyleId);
}

export function attachLinkedStyleToMatchingContainers(
  presentation: Presentation,
  linkedStyleId: string,
): { presentation: Presentation; attachedLocations: LinkedStyleContainerLocation[] } {
  const style = presentation.linkedStyles?.find((candidate) => candidate.id === linkedStyleId);
  if (style === undefined) return { presentation, attachedLocations: [] };
  const attachedLocations = findMatchingContainersForLinkedStyle(presentation, linkedStyleId);
  if (attachedLocations.length === 0) return { presentation, attachedLocations };
  const locations = new Map<number, Set<string>>();
  for (const location of attachedLocations) {
    const ids = locations.get(location.slideIndex) ?? new Set<string>();
    ids.add(location.elementId);
    locations.set(location.slideIndex, ids);
  }
  const transformed = PresentationSchema.parse({
    ...presentation,
    slides: presentation.slides.map((slide, slideIndex) => {
      const ids = locations.get(slideIndex);
      if (ids === undefined) return slide;
      return { ...slide, elements: Array.from(ids).reduce((elements, id) => updateElementById(elements, id, (element) => element.type === "container" && matches(element, style) ? transfer(element, style) : element), slide.elements) };
    }),
  });
  return { presentation: transformed, attachedLocations };
}
