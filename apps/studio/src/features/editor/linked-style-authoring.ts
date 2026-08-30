import {
  PresentationSchema,
  resolveLinkedContainerStyle,
  type ContainerElement,
  type ElementVisualStyle,
  type LinkedContainerStyle,
  type Presentation,
} from "@powershow/document-schema";

import { findElementById, updateElementById } from "./element-tree";
import { collectLinkedStyleReferenceCounts } from "./element-hierarchy";
import { createTextStyleId } from "./text-style-helpers";

type ShareableStyle = Omit<ElementVisualStyle, "className">;

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
  if (!presentation.linkedStyles?.some((style) => style.id === linkedStyleId)) return presentation;
  return replaceContainerInSlide(presentation, slideIndex, containerId, (container) => ({ ...container, linkedStyleId }));
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
