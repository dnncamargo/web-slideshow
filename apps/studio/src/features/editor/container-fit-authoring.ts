import type {
  ContainerChildrenFit,
  ContainerElement,
} from "@powershow/document-schema";

export type ContainerFitMode = ContainerChildrenFit["mode"];

export interface ContainerFitSourceSize {
  sourceWidth: number;
  sourceHeight: number;
}

function parsePositiveCssPixels(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function measureContainerFitSourceSize(
  element: HTMLElement,
): ContainerFitSourceSize | null {
  const computed = getComputedStyle(element);
  const paddingLeft = parsePositiveCssPixels(computed.paddingLeft) ?? 0;
  const paddingRight = parsePositiveCssPixels(computed.paddingRight) ?? 0;
  const paddingTop = parsePositiveCssPixels(computed.paddingTop) ?? 0;
  const paddingBottom = parsePositiveCssPixels(computed.paddingBottom) ?? 0;
  const sourceWidth = element.clientWidth - paddingLeft - paddingRight;
  const sourceHeight = element.clientHeight - paddingTop - paddingBottom;

  return Number.isFinite(sourceWidth) && sourceWidth > 0 &&
      Number.isFinite(sourceHeight) && sourceHeight > 0
    ? { sourceWidth, sourceHeight }
    : null;
}

export function updateContainerFit(
  container: ContainerElement,
  mode: ContainerFitMode | null,
  sourceSize?: ContainerFitSourceSize,
): ContainerElement | null {
  const existingFit = container.layout?.children?.fit;
  if (mode !== null && existingFit === undefined && sourceSize === undefined) {
    return null;
  }

  const layout = container.layout;
  const children = layout?.children;

  if (mode === null) {
    if (children?.fit === undefined) return container;

    const nextChildren = { ...children };
    delete nextChildren.fit;
    const nextLayout = { ...layout };
    if (Object.keys(nextChildren).length === 0) {
      delete nextLayout.children;
    } else {
      nextLayout.children = nextChildren;
    }
    return { ...container, layout: nextLayout };
  }

  const fit = existingFit === undefined
    ? {
        mode,
        sourceWidth: sourceSize!.sourceWidth,
        sourceHeight: sourceSize!.sourceHeight,
      }
    : {
        ...existingFit,
        mode,
      };

  return {
    ...container,
    layout: {
      ...layout,
      children: {
        ...children,
        fit,
      },
    },
  };
}

export function isInsideContainerFitSurface(element: Element): boolean {
  return element.closest(".powershow-container-fit-surface") !== null;
}
