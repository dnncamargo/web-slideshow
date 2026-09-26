import {
  PresentationSchema,
  resolveLinkedContainerStyle,
  resolveLinkedCodeStyle,
  resolveLinkedDividerStyle,
  resolveLinkedTableStyle,
  resolveLinkedTerminalStyle,
  type ContainerElement,
  type ContainerLayout,
  type CodeElement,
  type DividerElement,
  type ElementEffect,
  type ElementTypography,
  type ElementVisualStyle,
  type LinkedCodeStyle,
  type LinkedContainerStyle,
  type LinkedDividerStyle,
  type LinkedTableStyle,
  type LinkedTerminalStyle,
  type LinkedTopicsStyle,
  type Presentation,
  type SimpleTableElement,
  type StructuredTableElement,
  type TableElement,
  type TerminalElement,
  type TopicsElement,
  isLinkedContainerStyle,
} from "@web-slideshow/document-schema";
import { parseAuthoringLength, TOPICS_ITEM_GAP_DEFAULT_PX } from "@web-slideshow/theme/element-style-defaults";

import { findElementById, updateElementById } from "./element-tree";
import { collectLinkedStyleReferenceCounts } from "./element-hierarchy";
import { forEachPresentationAuthoringTree } from "./presentation-authoring-trees";
import { createTextStyleId } from "./text-style-helpers";
import type { LinkedStyleProperty } from "./linked-style-property-authoring";

export {
  changedTargetLinkedStyleProperties,
  clearLinkedTargetStyleProperty,
  propagateTargetLinkedStyleDefinitionChanges,
  propagateLinkedTargetStyleDefinitionChanges,
  updateLinkedTargetStyle,
  updateTargetLinkedStyleDefinition,
} from "./target-linked-style-definition-authoring";
export type {
  TargetLinkedStyle,
  TargetLinkedStyleDefinitionPatch,
  TargetLinkedStylePatch,
  TargetLinkedStyleProperty,
} from "./target-linked-style-definition-authoring";

type ShareableStyle = Omit<ElementVisualStyle, "className">;
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

/** Clears one canonical linked-container property while preserving all other local fields. */
export function clearLinkedContainerStyleProperty(
  container: ContainerElement,
  property: Exclude<LinkedStyleProperty, "fit">,
): ContainerElement {
  const layout = container.layout === undefined
    ? undefined
    : { ...container.layout, ...(container.layout.children === undefined ? {} : { children: { ...container.layout.children } }) };
  const style = container.style === undefined
    ? undefined
    : { ...container.style, ...(container.style.background === undefined ? {} : { background: { ...container.style.background } }) };
  const effect = container.effect === undefined ? undefined : { ...container.effect };
  const layoutBag = layout as PropertyBag | undefined;
  const childrenBag = layout?.children as PropertyBag | undefined;
  const styleBag = style as PropertyBag | undefined;
  const backgroundBag = style?.background as PropertyBag | undefined;
  const effectBag = effect as PropertyBag | undefined;

  switch (property) {
    case "layoutMode": if (childrenBag) delete childrenBag.mode; break;
    case "direction": if (childrenBag) delete childrenBag.direction; break;
    case "gap": if (childrenBag) delete childrenBag.gap; break;
    case "distribution": if (childrenBag) delete childrenBag.distribution; break;
    case "horizontalAlign": if (childrenBag) delete childrenBag.horizontalAlign; break;
    case "verticalAlign": if (childrenBag) delete childrenBag.verticalAlign; break;
    case "overflow": if (layoutBag) delete layoutBag.overflow; break;
    case "position": if (layoutBag) delete layoutBag.position; break;
    case "top": case "right": case "bottom": case "left":
    case "width": case "height": case "padding": case "paddingTop": case "paddingRight":
    case "paddingBottom": case "paddingLeft": case "margin": case "marginTop":
    case "marginRight": case "marginBottom": case "marginLeft":
      if (layoutBag) delete layoutBag[property];
      break;
    case "preserveSize": if (layoutBag) delete layoutBag.flexShrink; break;
    case "color": if (styleBag) delete styleBag.color; break;
    case "backgroundColor": if (backgroundBag) delete backgroundBag.color; break;
    case "gradient": if (backgroundBag) delete backgroundBag.gradient; break;
    case "pattern": if (backgroundBag) delete backgroundBag.pattern; break;
    case "border": if (styleBag) delete styleBag.border; break;
    case "borderRadius": if (styleBag) delete styleBag.borderRadius; break;
    case "opacity": if (effectBag) delete effectBag.opacity; break;
    case "shadow": if (effectBag) delete effectBag.shadow; break;
  }

  if (layout?.children && Object.keys(layout.children).length === 0) delete (layoutBag as PropertyBag).children;
  if (style?.background && Object.keys(style.background).length === 0) delete (styleBag as PropertyBag).background;
  const { layout: _layout, style: _style, effect: _effect, ...structural } = container;
  return {
    ...structural,
    ...(layout && Object.keys(layout).length > 0 ? { layout } : {}),
    ...(style && Object.keys(style).length > 0 ? { style } : {}),
    ...(effect && Object.keys(effect).length > 0 ? { effect } : {}),
  };
}

/** Transfers ownership of the linked style's authored canonical properties to it. */
export function adoptLinkedContainerStyle(container: ContainerElement, linked: LinkedContainerStyle): ContainerElement {
  const layout = removeLinkedLayoutProperties(container.layout, linked.layout);
  const style = removeLinkedStyleProperties(container.style, linked.style);
  const typography = removeLinkedTypographyProperties(container.typography, linked.typography);
  const effect = removeLinkedEffectProperties(container.effect, linked.effect);
  const hasLocalEdge = [layout?.top, layout?.right, layout?.bottom, layout?.left].some((value) => value !== undefined);
  const finalLayout = hasLocalEdge && layout?.position === undefined && linked.layout?.position !== undefined
    ? { ...layout, position: "absolute" as const }
    : layout;
  const { layout: _localLayout, style: _localStyle, typography: _localTypography, effect: _localEffect, ...structural } = container;
  return {
    ...structural,
    ...(finalLayout === undefined ? {} : { layout: finalLayout }),
    ...(style === undefined ? {} : { style }),
    ...(typography === undefined ? {} : { typography }),
    ...(effect === undefined ? {} : { effect }),
    linkedStyleId: linked.id,
  };
}

function authoredObject<T extends object>(value: T | undefined): T | undefined {
  if (value === undefined) return undefined;
  const result = Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => [key, entry !== undefined && typeof entry === "object" && entry !== null && !Array.isArray(entry)
        ? authoredObject(entry as object)
        : entry])
      .filter(([, entry]) => entry !== undefined),
  ) as T;
  return Object.keys(result).length === 0 ? undefined : result;
}

function isDefaultTopicsMargin(value: unknown): boolean {
  if (typeof value !== "number" && typeof value !== "string") return false;
  return parseAuthoringLength(value)?.value === 0;
}

function isDefaultTopicsRootMarker(kind: TopicsElement["kind"], value: TopicsElement["rootMarkerStyle"]): boolean {
  return value === (kind === "ordered" ? "decimal" : "disc");
}

function shareableStyle(style: ContainerElement["style"]): ShareableStyle | undefined {
  if (style === undefined) return undefined;
  const { className: _className, ...shareable } = style;
  return authoredObject(shareable);
}

function replaceContainerInSlide(
  presentation: Presentation,
  slideIndex: number,
  containerId: string,
  update: (container: ContainerElement) => ContainerElement,
): Presentation {
  return PresentationSchema.parse({
    ...presentation,
    slides: presentation.slides.map((slide, index) => index === slideIndex
      ? {
          ...slide,
          elements: updateElementById(slide.elements, containerId, (element) =>
            element.type === "container" ? update(element) : element,
          ),
        }
      : slide),
  });
}

export function createLinkedStyleId(name: string, existingIds: readonly string[]): string {
  return createTextStyleId(name, existingIds);
}

export function canCreateLinkedStyleFromContainer(container: ContainerElement): boolean {
  if (container.linkedStyleId !== undefined) return false;
  return [
    authoredObject(container.layout),
    shareableStyle(container.style),
    authoredObject(container.typography),
    authoredObject(container.effect),
  ].some((value) => value !== undefined);
}

export interface CreatedLinkedContainerStyleFromElement {
  presentation: Presentation;
  element: ContainerElement;
}

/** Creates the canonical Container linked-style definition and relationship for one element. */
export function createLinkedStyleFromContainerElement(
  presentation: Presentation,
  container: ContainerElement,
  name: string,
): CreatedLinkedContainerStyleFromElement | null {
  const trimmedName = name.trim();
  if (!trimmedName || !canCreateLinkedStyleFromContainer(container)) return null;

  const layout = authoredObject(container.layout);
  const style = shareableStyle(container.style);
  const typography = authoredObject(container.typography);
  const effect = authoredObject(container.effect);
  const id = createLinkedStyleId(trimmedName, (presentation.linkedStyles ?? []).map((item) => item.id));
  const linkedStyle = {
    id,
    name: trimmedName,
    ...(layout === undefined ? {} : { layout }),
    ...(style === undefined ? {} : { style }),
    ...(typography === undefined ? {} : { typography }),
    ...(effect === undefined ? {} : { effect }),
  };
  const {
    layout: _layout,
    style: localStyle,
    typography: _typography,
    effect: _effect,
    ...structural
  } = container;

  return {
    presentation: PresentationSchema.parse({
      ...presentation,
      linkedStyles: [...(presentation.linkedStyles ?? []), linkedStyle],
    }),
    element: {
      ...structural,
      linkedStyleId: id,
      ...(localStyle?.className === undefined
        ? {}
        : { style: { className: localStyle.className } }),
    },
  };
}

export function createLinkedStyleFromContainer(
  presentation: Presentation,
  slideIndex: number,
  containerId: string,
  name: string,
): Presentation {
  const trimmedName = name.trim();
  if (!trimmedName) return presentation;
  const element = presentation.slides[slideIndex] === undefined
    ? undefined
    : findElementById(presentation.slides[slideIndex]!.elements, containerId);
  const container = element?.type === "container" ? element : undefined;
  if (container === undefined) return presentation;
  const created = createLinkedStyleFromContainerElement(presentation, container, trimmedName);
  if (created === null) return presentation;

  return replaceContainerInSlide(
    created.presentation,
    slideIndex,
    containerId,
    () => created.element,
  );
}

export function attachLinkedStyle(
  presentation: Presentation,
  slideIndex: number,
  containerId: string,
  linkedStyleId: string,
): Presentation {
  return replaceContainerInSlide(presentation, slideIndex, containerId, (container) =>
    attachLinkedContainerStyleToElement(presentation, container, linkedStyleId) ?? container,
  );
}

/** Applies the canonical container linked-style relationship to one element. */
export function attachLinkedContainerStyleToElement(
  presentation: Presentation,
  container: ContainerElement,
  linkedStyleId: string,
): ContainerElement | null {
  const linked = presentation.linkedStyles?.find((style) => style.id === linkedStyleId);
  return linked === undefined || !isLinkedContainerStyle(linked) ? null : adoptLinkedContainerStyle(container, linked);
}

type LinkedTopicsStylePatch = Pick<LinkedTopicsStyle, "kind" | "layout" | "rootMarkerStyle" | "markerColor" | "itemGap">;

export type LinkedTopicsStyleProperty =
  | "kind" | "position" | "top" | "right" | "bottom" | "left" | "margin" | "marginTop" | "marginRight" | "marginBottom" | "marginLeft"
  | "itemGap" | "rootMarkerStyle" | "markerColor";

const LINKED_TOPICS_LAYOUT_PROPERTIES = [
  "position", "top", "right", "bottom", "left", "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
] as const;

/** Clears exactly one authored Topics property and prunes only its empty bag. */
export function clearLinkedTopicsStyleProperty(
  topics: TopicsElement,
  property: LinkedTopicsStyleProperty,
): TopicsElement {
  const next = { ...topics };
  if (property === "kind") delete next.kind;
  else if (property === "rootMarkerStyle") delete next.rootMarkerStyle;
  else if (property === "markerColor") delete next.markerColor;
  else if (property === "itemGap") delete next.itemGap;
  else if (next.layout !== undefined) {
    const layout = { ...next.layout } as PropertyBag;
    delete layout[property];
    if (Object.keys(layout).length === 0) delete next.layout;
    else next.layout = layout as TopicsElement["layout"];
  }
  return next;
}

function removeLinkedTopicsProperties(topics: TopicsElement, linked: LinkedTopicsStyle): TopicsElement {
  let next: TopicsElement = { ...topics, linkedStyleId: linked.id };
  for (const property of LINKED_TOPICS_LAYOUT_PROPERTIES) {
    if (linked.layout?.[property] !== undefined) next = clearLinkedTopicsStyleProperty(next, property);
  }
  if (linked.kind !== undefined) next = clearLinkedTopicsStyleProperty(next, "kind");
  if (linked.rootMarkerStyle !== undefined) next = clearLinkedTopicsStyleProperty(next, "rootMarkerStyle");
  if (linked.markerColor !== undefined) next = clearLinkedTopicsStyleProperty(next, "markerColor");
  if (linked.itemGap !== undefined) next = clearLinkedTopicsStyleProperty(next, "itemGap");
  const hasLocalInset = (["top", "right", "bottom", "left"] as const).some((property) => next.layout?.[property] !== undefined);
  if (linked.layout?.position !== undefined && hasLocalInset && next.layout?.position === undefined) {
    next = { ...next, layout: { ...(next.layout ?? {}), position: "absolute" } as TopicsElement["layout"] };
  }
  return next;
}

function replaceTopicsInSlide(
  presentation: Presentation,
  slideIndex: number,
  topicsId: string,
  update: (topics: TopicsElement) => TopicsElement,
): Presentation {
  return PresentationSchema.parse({
    ...presentation,
    slides: presentation.slides.map((slide, index) => index === slideIndex
      ? { ...slide, elements: updateElementById(slide.elements, topicsId, (element) => element.type === "topics" ? update(element) : element) }
      : slide),
  });
}

function topicsLinkedStyleProperties(topics: TopicsElement): LinkedTopicsStylePatch {
  const effectiveKind = topics.kind ?? "unordered";
  const layout = authoredObject(topics.layout);
  const sparseLayout = layout === undefined
    ? undefined
    : authoredObject(Object.fromEntries(
        Object.entries(layout).filter(([key, value]) => !key.startsWith("margin") || !isDefaultTopicsMargin(value)),
      ) as NonNullable<TopicsElement["layout"]>);
  return {
    ...(topics.kind === undefined ? {} : { kind: topics.kind }),
    ...(sparseLayout === undefined ? {} : { layout: sparseLayout }),
    ...(topics.rootMarkerStyle === undefined || isDefaultTopicsRootMarker(effectiveKind, topics.rootMarkerStyle) ? {} : { rootMarkerStyle: topics.rootMarkerStyle }),
    ...(topics.markerColor === undefined ? {} : { markerColor: topics.markerColor }),
    ...(topics.itemGap === undefined || topics.itemGap === TOPICS_ITEM_GAP_DEFAULT_PX ? {} : { itemGap: topics.itemGap }),
  };
}

export function canCreateLinkedStyleFromTopics(topics: TopicsElement): boolean {
  return topics.linkedStyleId === undefined && Object.keys(topicsLinkedStyleProperties(topics)).length > 0;
}

export interface CreatedLinkedTopicsStyleFromElement {
  presentation: Presentation;
  element: TopicsElement;
}

/** Creates the canonical Topics linked-style definition and relationship for one element. */
export function createLinkedStyleFromTopicsElement(
  presentation: Presentation,
  topics: TopicsElement,
  name: string,
): CreatedLinkedTopicsStyleFromElement | null {
  const trimmedName = name.trim();
  if (!trimmedName || !canCreateLinkedStyleFromTopics(topics)) return null;

  const id = createLinkedStyleId(trimmedName, (presentation.linkedStyles ?? []).map((style) => style.id));
  const linkedStyle: LinkedTopicsStyle = { target: "topics", id, name: trimmedName, ...topicsLinkedStyleProperties(topics) };
  const { kind: _kind, layout: _layout, rootMarkerStyle: _rootMarkerStyle, markerColor: _markerColor, itemGap: _itemGap, linkedStyleId: _linkedStyleId, ...local } = topics;

  return {
    presentation: PresentationSchema.parse({
      ...presentation,
      linkedStyles: [...(presentation.linkedStyles ?? []), linkedStyle],
    }),
    element: { ...local, linkedStyleId: id },
  };
}

export function createLinkedStyleFromTopics(
  presentation: Presentation,
  slideIndex: number,
  topicsId: string,
  name: string,
): Presentation {
  const trimmedName = name.trim();
  const element = presentation.slides[slideIndex] === undefined ? undefined : findElementById(presentation.slides[slideIndex]!.elements, topicsId);
  if (element?.type !== "topics") return presentation;
  const created = createLinkedStyleFromTopicsElement(presentation, element, trimmedName);
  if (created === null) return presentation;
  return replaceTopicsInSlide(
    created.presentation,
    slideIndex,
    topicsId,
    () => created.element,
  );
}

export function attachLinkedTopicsStyle(
  presentation: Presentation,
  slideIndex: number,
  topicsId: string,
  linkedStyleId: string,
): Presentation {
  return replaceTopicsInSlide(presentation, slideIndex, topicsId, (topics) =>
    attachLinkedTopicsStyleToElement(presentation, topics, linkedStyleId) ?? topics,
  );
}

/** Applies the canonical Topics linked-style relationship to one element. */
export function attachLinkedTopicsStyleToElement(
  presentation: Presentation,
  topics: TopicsElement,
  linkedStyleId: string,
): TopicsElement | null {
  const linked = presentation.linkedStyles?.find((style): style is LinkedTopicsStyle =>
    "target" in style && style.target === "topics" && style.id === linkedStyleId,
  );
  return linked === undefined ? null : removeLinkedTopicsProperties(topics, linked);
}

export function detachLinkedTopicsStyle(
  presentation: Presentation,
  slideIndex: number,
  topicsId: string,
): Presentation {
  return replaceTopicsInSlide(presentation, slideIndex, topicsId, (topics) =>
    detachLinkedTopicsStyleFromElement(presentation, topics) ?? topics,
  );
}

/** Materializes effective Topics linked-style values and removes the relationship. */
export function detachLinkedTopicsStyleFromElement(
  presentation: Presentation,
  topics: TopicsElement,
): TopicsElement | null {
  if (topics.linkedStyleId === undefined) return null;
  const linked = presentation.linkedStyles?.find((style) => style.id === topics.linkedStyleId);
  if (linked === undefined || !("target" in linked) || linked.target !== "topics") return null;
  const { linkedStyleId: _linkedStyleId, ...unlinked } = topics;
  const layout = { ...(topics.layout ?? {}) } as PropertyBag;
  for (const property of LINKED_TOPICS_LAYOUT_PROPERTIES) {
    if (topics.layout?.[property] === undefined && linked.layout?.[property] !== undefined) layout[property] = linked.layout[property];
  }
  return {
    ...unlinked,
    ...(topics.kind === undefined && linked.kind !== undefined ? { kind: linked.kind } : {}),
    ...(Object.keys(layout).length > 0 ? { layout: layout as TopicsElement["layout"] } : {}),
    ...(topics.rootMarkerStyle === undefined && linked.rootMarkerStyle !== undefined ? { rootMarkerStyle: linked.rootMarkerStyle } : {}),
    ...(topics.markerColor === undefined && linked.markerColor !== undefined ? { markerColor: linked.markerColor } : {}),
    ...(topics.itemGap === undefined && linked.itemGap !== undefined ? { itemGap: linked.itemGap } : {}),
  };
}

export function updateLinkedTopicsStyle(
  presentation: Presentation,
  linkedStyleId: string,
  patch: LinkedTopicsStylePatch,
): Presentation {
  const current = presentation.linkedStyles?.find((style): style is LinkedTopicsStyle => "target" in style && style.target === "topics" && style.id === linkedStyleId);
  if (current === undefined) return presentation;
  const updated: LinkedTopicsStyle = { ...current };
  if (Object.prototype.hasOwnProperty.call(patch, "kind")) {
    if (patch.kind === undefined) delete updated.kind;
    else updated.kind = patch.kind;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "layout")) {
    if (patch.layout === undefined) delete updated.layout;
    else updated.layout = authoredObject(patch.layout);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "rootMarkerStyle")) {
    if (patch.rootMarkerStyle === undefined) delete updated.rootMarkerStyle;
    else updated.rootMarkerStyle = patch.rootMarkerStyle;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "markerColor")) {
    if (patch.markerColor === undefined) delete updated.markerColor;
    else updated.markerColor = patch.markerColor;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "itemGap")) {
    if (patch.itemGap === undefined) delete updated.itemGap;
    else updated.itemGap = patch.itemGap;
  }
  const parsed = PresentationSchema.safeParse({ ...presentation, linkedStyles: presentation.linkedStyles!.map((style) => style.id === linkedStyleId ? updated : style) });
  return parsed.success ? parsed.data : presentation;
}

export function detachLinkedStyle(
  presentation: Presentation,
  slideIndex: number,
  containerId: string,
): Presentation {
  return replaceContainerInSlide(presentation, slideIndex, containerId, (container) =>
    detachLinkedContainerStyleFromElement(presentation, container) ?? container,
  );
}

/** Materializes effective container linked-style values and removes the relationship. */
export function detachLinkedContainerStyleFromElement(
  presentation: Presentation,
  container: ContainerElement,
): ContainerElement | null {
  if (container.linkedStyleId === undefined) return null;
  const linked = presentation.linkedStyles?.find((style) => style.id === container.linkedStyleId);
  if (linked === undefined || !isLinkedContainerStyle(linked)) return null;
  const resolved = resolveLinkedContainerStyle(presentation, container);
  const { linkedStyleId: _linkedStyleId, ...unlinked } = container;
  return {
    ...unlinked,
    ...(resolved.layout === undefined ? {} : { layout: resolved.layout }),
    ...(resolved.style === undefined ? {} : { style: resolved.style }),
    ...(resolved.typography === undefined ? {} : { typography: resolved.typography }),
    ...(resolved.effect === undefined ? {} : { effect: resolved.effect }),
  };
}

// Target-specific authoring primitives. These deliberately operate on one element so
// Editor History can own traversal and undo/redo without duplicating slide lookup here.
type TargetElement = CodeElement | TerminalElement | SimpleTableElement | StructuredTableElement | DividerElement;
type TargetLinkedStyle = LinkedCodeStyle | LinkedTerminalStyle | LinkedTableStyle | LinkedDividerStyle;

function effectiveTableMode(element: SimpleTableElement | StructuredTableElement): "simple" | "structured" {
  return element.mode === "structured" ? "structured" : "simple";
}

function copyBag<T extends object>(value: T | undefined): PropertyBag | undefined {
  return value === undefined ? undefined : { ...(value as PropertyBag) };
}

function removeOwnedBag(value: PropertyBag | undefined, owned: PropertyBag | undefined): PropertyBag | undefined {
  if (value === undefined) return undefined;
  const next: PropertyBag = { ...value };
  for (const key of Object.keys(owned ?? {})) {
    if (key !== "className" && key !== "background") delete next[key];
  }
  if (owned?.background !== undefined && next.background !== undefined) {
    const background = { ...(next.background as PropertyBag) };
    const linkedBackground = owned.background as PropertyBag;
    for (const key of ["color", "gradient"] as const) {
      if (linkedBackground[key] !== undefined) delete background[key];
    }
    if (Object.keys(background).length === 0) delete next.background;
    else next.background = background;
  }
  return Object.keys(next).length === 0 ? undefined : next;
}

function removeTargetOwnedProperties<T extends TargetElement>(element: T, linked: TargetLinkedStyle): T {
  const layout = removeOwnedBag(copyBag(element.layout), copyBag(linked.layout));
  const style = removeOwnedBag(copyBag(element.style), copyBag(linked.style));
  const typography = "typography" in element
    ? removeOwnedBag(copyBag(element.typography), "typography" in linked ? copyBag(linked.typography) : undefined)
    : undefined;
  const titleTypography = element.type === "terminal"
    ? removeOwnedBag(copyBag(element.titleTypography), linked.target === "terminal" ? copyBag(linked.titleTypography) : undefined)
    : undefined;
  const effect = removeOwnedBag(copyBag(element.effect), copyBag(linked.effect));
  const hasLocalEdge = [layout?.top, layout?.right, layout?.bottom, layout?.left].some((value) => value !== undefined);
  const finalLayout = hasLocalEdge && layout?.position === undefined && linked.layout?.position !== undefined
    ? { ...layout, position: "absolute" as const }
    : layout;
  const { layout: _layout, style: _style, effect: _effect, ...structural } = element;
  const local = structural as PropertyBag;
  delete local.typography;
  delete local.titleTypography;
  return {
    ...local,
    ...(finalLayout === undefined ? {} : { layout: finalLayout }),
    ...(style === undefined ? {} : { style }),
    ...(typography === undefined ? {} : { typography }),
    ...(titleTypography === undefined ? {} : { titleTypography }),
    ...(effect === undefined ? {} : { effect }),
    linkedStyleId: linked.id,
  } as T;
}

function linkedForTarget(presentation: Presentation, element: TargetElement, linkedStyleId: string): TargetLinkedStyle | null {
  const linked = presentation.linkedStyles?.find((style) => style.id === linkedStyleId);
  if (linked === undefined || !("target" in linked)) return null;
  if (element.type === "code" && linked.target === "code") return linked;
  if (element.type === "terminal" && linked.target === "terminal") return linked;
  if (element.type === "divider" && linked.target === "divider") return linked;
  if (element.type === "table" && linked.target === "table" && linked.mode === effectiveTableMode(element)) return linked;
  return null;
}

export function attachLinkedCodeStyleToElement(presentation: Presentation, element: CodeElement, linkedStyleId: string): CodeElement | null {
  const linked = linkedForTarget(presentation, element, linkedStyleId);
  return linked?.target === "code" ? removeTargetOwnedProperties(element, linked) : null;
}

export function attachLinkedTerminalStyleToElement(presentation: Presentation, element: TerminalElement, linkedStyleId: string): TerminalElement | null {
  const linked = linkedForTarget(presentation, element, linkedStyleId);
  return linked?.target === "terminal" ? removeTargetOwnedProperties(element, linked) : null;
}

export function attachLinkedTableStyleToElement(presentation: Presentation, element: TableElement, linkedStyleId: string): TableElement | null {
  const linked = linkedForTarget(presentation, element, linkedStyleId);
  return linked?.target === "table" ? removeTargetOwnedProperties(element, linked) : null;
}

export function attachLinkedDividerStyleToElement(presentation: Presentation, element: DividerElement, linkedStyleId: string): DividerElement | null {
  const linked = linkedForTarget(presentation, element, linkedStyleId);
  return linked?.target === "divider" ? removeTargetOwnedProperties(element, linked) : null;
}

function targetStyle(element: TargetElement): PropertyBag | undefined {
  if (element.style === undefined) return undefined;
  const { className: _className, ...shareable } = element.style as ElementVisualStyle;
  return authoredObject(shareable) as PropertyBag | undefined;
}

function targetHasShareableProperties(element: TargetElement): boolean {
  return [authoredObject(element.layout), targetStyle(element),
    "typography" in element ? authoredObject(element.typography) : undefined,
    element.type === "terminal" ? authoredObject(element.titleTypography) : undefined,
    authoredObject(element.effect)].some((value) => value !== undefined);
}

export function canCreateLinkedStyleFromCode(code: CodeElement): boolean {
  return code.linkedStyleId === undefined && targetHasShareableProperties(code);
}

export function canCreateLinkedStyleFromTerminal(terminal: TerminalElement): boolean {
  return terminal.linkedStyleId === undefined && targetHasShareableProperties(terminal);
}

export function canCreateLinkedStyleFromSimpleTable(table: SimpleTableElement): boolean {
  return table.linkedStyleId === undefined && targetHasShareableProperties(table);
}

export function canCreateLinkedStyleFromStructuredTable(table: StructuredTableElement): boolean {
  return table.linkedStyleId === undefined && targetHasShareableProperties(table);
}

export function canCreateLinkedStyleFromDivider(divider: DividerElement): boolean {
  return divider.linkedStyleId === undefined && targetHasShareableProperties(divider);
}

export interface CreatedLinkedCodeStyleFromElement { presentation: Presentation; element: CodeElement; }
export interface CreatedLinkedTerminalStyleFromElement { presentation: Presentation; element: TerminalElement; }
export interface CreatedLinkedSimpleTableStyleFromElement { presentation: Presentation; element: SimpleTableElement; }
export interface CreatedLinkedStructuredTableStyleFromElement { presentation: Presentation; element: StructuredTableElement; }
export interface CreatedLinkedDividerStyleFromElement { presentation: Presentation; element: DividerElement; }

function appendTargetStyle(presentation: Presentation, style: TargetLinkedStyle): Presentation {
  return PresentationSchema.parse({ ...presentation, linkedStyles: [...(presentation.linkedStyles ?? []), style] });
}

export function createLinkedStyleFromCodeElement(presentation: Presentation, element: CodeElement, name: string): CreatedLinkedCodeStyleFromElement | null {
  const trimmedName = name.trim();
  if (!trimmedName || !canCreateLinkedStyleFromCode(element)) return null;
  const id = createLinkedStyleId(trimmedName, (presentation.linkedStyles ?? []).map((style) => style.id));
  const { layout, style, typography, effect, ...local } = element;
  const linked: LinkedCodeStyle = { target: "code", id, name: trimmedName, ...(authoredObject(layout) ? { layout: authoredObject(layout) } : {}), ...(targetStyle(element) ? { style: targetStyle(element) as LinkedCodeStyle["style"] } : {}), ...(authoredObject(typography) ? { typography: authoredObject(typography) } : {}), ...(authoredObject(effect) ? { effect: authoredObject(effect) } : {}) };
  return { presentation: appendTargetStyle(presentation, linked), element: { ...local, linkedStyleId: id, ...(element.style?.className === undefined ? {} : { style: { className: element.style.className } }) } };
}

export function createLinkedStyleFromTerminalElement(presentation: Presentation, element: TerminalElement, name: string): CreatedLinkedTerminalStyleFromElement | null {
  const trimmedName = name.trim();
  if (!trimmedName || !canCreateLinkedStyleFromTerminal(element)) return null;
  const id = createLinkedStyleId(trimmedName, (presentation.linkedStyles ?? []).map((style) => style.id));
  const { layout, style, typography, titleTypography, effect, ...local } = element;
  const linked: LinkedTerminalStyle = { target: "terminal", id, name: trimmedName, ...(authoredObject(layout) ? { layout: authoredObject(layout) } : {}), ...(targetStyle(element) ? { style: targetStyle(element) as LinkedTerminalStyle["style"] } : {}), ...(authoredObject(typography) ? { typography: authoredObject(typography) } : {}), ...(authoredObject(titleTypography) ? { titleTypography: authoredObject(titleTypography) } : {}), ...(authoredObject(effect) ? { effect: authoredObject(effect) } : {}) };
  return { presentation: appendTargetStyle(presentation, linked), element: { ...local, linkedStyleId: id, ...(element.style?.className === undefined ? {} : { style: { className: element.style.className } }) } };
}

function createTableStyle<T extends SimpleTableElement | StructuredTableElement>(presentation: Presentation, element: T, name: string): { presentation: Presentation; element: T } | null {
  const trimmedName = name.trim();
  if (!trimmedName || element.linkedStyleId !== undefined || !targetHasShareableProperties(element)) return null;
  const id = createLinkedStyleId(trimmedName, (presentation.linkedStyles ?? []).map((style) => style.id));
  const mode = effectiveTableMode(element);
  const metadata = mode === "simple" ? { mode: "simple" as const } : { mode: "structured" as const };
  const layout = element.layout;
  const style = element.style;
  const effect = element.effect;
  const typography = mode === "simple" ? (element as SimpleTableElement).typography : undefined;
  const local = { ...element } as PropertyBag;
  delete local.layout;
  delete local.style;
  delete local.effect;
  if (mode === "simple") delete local.typography;
  const linked: LinkedTableStyle = { target: "table", ...metadata, id, name: trimmedName, ...(authoredObject(layout) ? { layout: authoredObject(layout) } : {}), ...(targetStyle(element) ? { style: targetStyle(element) as LinkedTableStyle["style"] } : {}), ...(mode === "simple" && authoredObject(typography) ? { typography: authoredObject(typography) } : {}), ...(authoredObject(effect) ? { effect: authoredObject(effect) } : {}) } as LinkedTableStyle;
  return { presentation: appendTargetStyle(presentation, linked), element: { ...local, linkedStyleId: id, ...(element.style?.className === undefined ? {} : { style: { className: element.style.className } }) } as T };
}

export function createLinkedStyleFromSimpleTableElement(presentation: Presentation, element: SimpleTableElement, name: string): CreatedLinkedSimpleTableStyleFromElement | null { return createTableStyle(presentation, element, name); }
export function createLinkedStyleFromStructuredTableElement(presentation: Presentation, element: StructuredTableElement, name: string): CreatedLinkedStructuredTableStyleFromElement | null { return createTableStyle(presentation, element, name); }

export function createLinkedStyleFromDividerElement(presentation: Presentation, element: DividerElement, name: string): CreatedLinkedDividerStyleFromElement | null {
  const trimmedName = name.trim();
  if (!trimmedName || !canCreateLinkedStyleFromDivider(element)) return null;
  const id = createLinkedStyleId(trimmedName, (presentation.linkedStyles ?? []).map((style) => style.id));
  const { layout, style, effect, ...local } = element;
  const linked: LinkedDividerStyle = { target: "divider", id, name: trimmedName, ...(authoredObject(layout) ? { layout: authoredObject(layout) } : {}), ...(targetStyle(element) ? { style: targetStyle(element) as LinkedDividerStyle["style"] } : {}), ...(authoredObject(effect) ? { effect: authoredObject(effect) } : {}) };
  return { presentation: appendTargetStyle(presentation, linked), element: { ...local, linkedStyleId: id, ...(element.style?.className === undefined ? {} : { style: { className: element.style.className } }) } };
}

function materializeTarget<T extends TargetElement>(presentation: Presentation, element: T): T | null {
  if (element.linkedStyleId === undefined) return null;
  const resolved = element.type === "code" ? resolveLinkedCodeStyle(presentation, element)
    : element.type === "terminal" ? resolveLinkedTerminalStyle(presentation, element)
      : element.type === "table" ? resolveLinkedTableStyle(presentation, element)
        : resolveLinkedDividerStyle(presentation, element);
  const { linkedStyleId: _linkedStyleId, ...local } = element;
  return { ...local, ...(resolved.layout === undefined ? {} : { layout: resolved.layout }), ...(resolved.style === undefined ? {} : { style: resolved.style }), ...(resolved.effect === undefined ? {} : { effect: resolved.effect }), ...("typography" in resolved && resolved.typography !== undefined ? { typography: resolved.typography } : {}), ...("titleTypography" in resolved && resolved.titleTypography !== undefined ? { titleTypography: resolved.titleTypography } : {}) } as T;
}

export function detachLinkedCodeStyleFromElement(presentation: Presentation, element: CodeElement): CodeElement | null { return materializeTarget(presentation, element) as CodeElement | null; }
export function detachLinkedTerminalStyleFromElement(presentation: Presentation, element: TerminalElement): TerminalElement | null { return materializeTarget(presentation, element) as TerminalElement | null; }
export function detachLinkedTableStyleFromElement(presentation: Presentation, element: TableElement): TableElement | null { return materializeTarget(presentation, element) as TableElement | null; }
export function detachLinkedDividerStyleFromElement(presentation: Presentation, element: DividerElement): DividerElement | null { return materializeTarget(presentation, element) as DividerElement | null; }

export type LinkedStylePatch = Pick<LinkedContainerStyle, "layout" | "style" | "typography" | "effect">;

export function updateLinkedStyle(
  presentation: Presentation,
  linkedStyleId: string,
  patch: LinkedStylePatch,
): Presentation {
  const styles = presentation.linkedStyles;
  if (styles === undefined) return presentation;
  // Parse through the canonical boundary; partial patches replace semantic bags.
  const candidate = styles.find((style) => style.id === linkedStyleId);
  if (candidate === undefined || !isLinkedContainerStyle(candidate)) return presentation;
  const updated = {
    ...candidate,
    ...patch,
    ...(patch.layout === undefined ? {} : { layout: authoredObject(patch.layout) }),
    ...(patch.style === undefined ? {} : { style: authoredObject(patch.style) }),
    ...(patch.typography === undefined ? {} : { typography: authoredObject(patch.typography) }),
    ...(patch.effect === undefined ? {} : { effect: authoredObject(patch.effect) }),
  };
  const parsed = PresentationSchema.safeParse({ ...presentation, linkedStyles: styles.map((style) => style.id === linkedStyleId ? updated : style) });
  return parsed.success ? parsed.data : presentation;
}

export function canUpdateLinkedStyle(
  presentation: Presentation,
  linkedStyleId: string,
  patch: LinkedStylePatch,
): boolean {
  const styles = presentation.linkedStyles;
  const current = styles?.find((style) => style.id === linkedStyleId);
  if (!styles || !current || !isLinkedContainerStyle(current)) return false;
  return PresentationSchema.safeParse({
    ...presentation,
    linkedStyles: styles.map((style) => style.id === linkedStyleId ? {
      ...style,
      ...patch,
      ...(patch.layout === undefined ? {} : { layout: authoredObject(patch.layout) }),
      ...(patch.style === undefined ? {} : { style: authoredObject(patch.style) }),
      ...(patch.typography === undefined ? {} : { typography: authoredObject(patch.typography) }),
      ...(patch.effect === undefined ? {} : { effect: authoredObject(patch.effect) }),
    } : style),
  }).success;
}

export function renameLinkedStyle(presentation: Presentation, linkedStyleId: string, name: string): Presentation {
  const trimmed = name.trim();
  if (!trimmed || !presentation.linkedStyles?.some((style) => style.id === linkedStyleId)) return presentation;
  return PresentationSchema.parse({ ...presentation, linkedStyles: presentation.linkedStyles.map((style) => style.id === linkedStyleId ? { ...style, name: trimmed } : style) });
}

export function removeUnusedLinkedStyle(presentation: Presentation, linkedStyleId: string): Presentation | undefined {
  if (!presentation.linkedStyles?.some((style) => style.id === linkedStyleId)) return undefined;
  const referenceCounts = new Map<string, number>();
  forEachPresentationAuthoringTree(presentation, (elements) => {
    collectLinkedStyleReferenceCounts(elements, referenceCounts);
  });
  const referenced = (referenceCounts.get(linkedStyleId) ?? 0) > 0;
  if (referenced) return undefined;
  const linkedStyles = presentation.linkedStyles.filter((style) => style.id !== linkedStyleId);
  return PresentationSchema.parse({ ...presentation, ...(linkedStyles.length === 0 ? { linkedStyles: undefined } : { linkedStyles }) });
}
