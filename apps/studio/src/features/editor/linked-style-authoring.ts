import {
  PresentationSchema,
  resolveLinkedContainerStyle,
  type ContainerElement,
  type ContainerLayout,
  type ElementEffect,
  type ElementTypography,
  type ElementVisualStyle,
  type LinkedContainerStyle,
  type Presentation,
} from "@powershow/document-schema";

import { findElementById, updateElementById } from "./element-tree";
import { collectLinkedStyleReferenceCounts } from "./element-hierarchy";
import { createTextStyleId } from "./text-style-helpers";

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
  if (container === undefined || !canCreateLinkedStyleFromContainer(container)) return presentation;

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

  return replaceContainerInSlide(
    { ...presentation, linkedStyles: [...(presentation.linkedStyles ?? []), linkedStyle] },
    slideIndex,
    containerId,
    (current) => {
      const {
        layout: _layout,
        style: localStyle,
        typography: _typography,
        effect: _effect,
        ...structural
      } = current;
      return {
        ...structural,
        linkedStyleId: id,
        ...(localStyle?.className === undefined
          ? {}
          : { style: { className: localStyle.className } }),
      };
    },
  );
}

export function attachLinkedStyle(
  presentation: Presentation,
  slideIndex: number,
  containerId: string,
  linkedStyleId: string,
): Presentation {
  const linked = presentation.linkedStyles?.find((style) => style.id === linkedStyleId);
  if (linked === undefined) return presentation;
  return replaceContainerInSlide(presentation, slideIndex, containerId, (container) => adoptLinkedContainerStyle(container, linked));
}

export function detachLinkedStyle(
  presentation: Presentation,
  slideIndex: number,
  containerId: string,
): Presentation {
  return replaceContainerInSlide(presentation, slideIndex, containerId, (container) => {
    if (container.linkedStyleId === undefined) return container;
    const resolved = resolveLinkedContainerStyle(presentation, container);
    const { linkedStyleId: _linkedStyleId, ...unlinked } = container;
    return {
      ...unlinked,
      ...(resolved.layout === undefined ? {} : { layout: resolved.layout }),
      ...(resolved.style === undefined ? {} : { style: resolved.style }),
      ...(resolved.typography === undefined ? {} : { typography: resolved.typography }),
      ...(resolved.effect === undefined ? {} : { effect: resolved.effect }),
    };
  });
}

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
  if (candidate === undefined) return presentation;
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
  if (!styles || !current) return false;
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
  const referenced = presentation.slides.some((slide) =>
    (collectLinkedStyleReferenceCounts(slide.elements).get(linkedStyleId) ?? 0) > 0);
  if (referenced) return undefined;
  const linkedStyles = presentation.linkedStyles.filter((style) => style.id !== linkedStyleId);
  return PresentationSchema.parse({ ...presentation, ...(linkedStyles.length === 0 ? { linkedStyles: undefined } : { linkedStyles }) });
}
