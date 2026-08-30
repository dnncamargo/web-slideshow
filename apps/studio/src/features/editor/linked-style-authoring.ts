import {
  PresentationSchema,
  resolveLinkedContainerStyle,
  type ContainerElement,
  type ElementVisualStyle,
  type Presentation,
} from "@powershow/document-schema";

import { findElementById, updateElementById } from "./element-tree";
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
