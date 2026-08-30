import type {
  ContainerLayout,
  ElementEffect,
  ElementTypography,
  ElementVisualStyle,
} from "./element-properties";
import type { ContainerElement } from "./elements";
import type { Presentation } from "./presentation";

export type ResolvedLinkedContainerStyle = {
  layout?: ContainerLayout;
  style?: ElementVisualStyle;
  typography?: ElementTypography;
  effect?: ElementEffect;
};

function authoredProperties<T extends object>(value: T | undefined): Partial<T> {
  return Object.fromEntries(
    Object.entries(value ?? {}).filter(([, property]) => property !== undefined),
  ) as Partial<T>;
}

function resolveLayout(
  linked: ContainerLayout | undefined,
  local: ContainerLayout | undefined,
): ContainerLayout | undefined {
  if (linked === undefined && local === undefined) return undefined;

  const linkedChildren = linked?.children;
  const localChildren = local?.children;
  const { children: _linkedChildren, ...linkedDirect } = linked ?? {};
  const { children: _localChildren, ...localDirect } = local ?? {};

  return {
    ...authoredProperties(linkedDirect),
    ...authoredProperties(localDirect),
    ...(linkedChildren === undefined && localChildren === undefined
      ? {}
      : {
          children: {
            ...authoredProperties(linkedChildren),
            ...authoredProperties(localChildren),
          },
        }),
  };
}

function resolveStyle(
  linked: Omit<ElementVisualStyle, "className"> | undefined,
  local: ElementVisualStyle | undefined,
): ElementVisualStyle | undefined {
  if (linked === undefined && local === undefined) return undefined;

  const linkedBackground = linked?.background;
  const localBackground = local?.background;
  const { background: _linkedBackground, ...linkedDirect } = linked ?? {};
  const { background: _localBackground, ...localDirect } = local ?? {};

  return {
    ...authoredProperties(linkedDirect),
    ...authoredProperties(localDirect),
    ...(linkedBackground === undefined && localBackground === undefined
      ? {}
      : {
          background: {
            ...authoredProperties(linkedBackground),
            ...authoredProperties(localBackground),
          },
        }),
  };
}

function resolveTypography(
  linked: ElementTypography | undefined,
  local: ElementTypography | undefined,
): ElementTypography | undefined {
  if (linked === undefined && local === undefined) return undefined;
  return { ...authoredProperties(linked), ...authoredProperties(local) };
}

function resolveEffect(
  linked: ElementEffect | undefined,
  local: ElementEffect | undefined,
): ElementEffect | undefined {
  if (linked === undefined && local === undefined) return undefined;
  return { ...authoredProperties(linked), ...authoredProperties(local) };
}

/** Resolves canonical Linked Style values with authored Container overrides. */
export function resolveLinkedContainerStyle(
  presentation: Presentation,
  container: ContainerElement,
): ResolvedLinkedContainerStyle {
  const linked = container.linkedStyleId === undefined
    ? undefined
    : presentation.linkedStyles?.find((style) => style.id === container.linkedStyleId);

  if (container.linkedStyleId !== undefined && linked === undefined) {
    throw new Error(`Unresolved linked container style: ${container.linkedStyleId}`);
  }

  const layout = resolveLayout(linked?.layout, container.layout);
  const style = resolveStyle(linked?.style, container.style);
  const typography = resolveTypography(linked?.typography, container.typography);
  const effect = resolveEffect(linked?.effect, container.effect);

  return {
    ...(layout === undefined ? {} : { layout }),
    ...(style === undefined ? {} : { style }),
    ...(typography === undefined ? {} : { typography }),
    ...(effect === undefined ? {} : { effect }),
  };
}
