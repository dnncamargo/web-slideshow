import type {
  ContainerLayout,
  ElementEffect,
  ElementTypography,
  ElementVisualStyle,
  TopicsLayout,
} from "./element-properties";
import type { ContainerElement, TopicsElement, TopicMarkerStyle } from "./elements";
import type { Presentation } from "./presentation";

export type ResolvedLinkedContainerStyle = {
  layout?: ContainerLayout;
  style?: ElementVisualStyle;
  typography?: ElementTypography;
  effect?: ElementEffect;
};

export type ResolvedLinkedTopicsStyle = {
  kind: NonNullable<TopicsElement["kind"]>;
  layout?: TopicsLayout;
  rootMarkerStyle?: TopicMarkerStyle;
  markerColor?: TopicsElement["markerColor"];
  itemGap?: number;
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
  if (linked !== undefined && "target" in linked) {
    throw new Error(`Linked style is not compatible with Container: ${container.linkedStyleId}`);
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

/** Resolves canonical Linked Style values with authored Topics overrides. */
export function resolveLinkedTopicsStyle(
  presentation: Pick<Presentation, "linkedStyles">,
  topics: TopicsElement,
): ResolvedLinkedTopicsStyle {
  const linked = topics.linkedStyleId === undefined
    ? undefined
    : presentation.linkedStyles?.find((style) => style.id === topics.linkedStyleId);

  if (topics.linkedStyleId !== undefined && linked === undefined) {
    throw new Error(`Unresolved linked topics style: ${topics.linkedStyleId}`);
  }
  if (linked !== undefined && (!("target" in linked) || linked.target !== "topics")) {
    throw new Error(`Linked style is not compatible with Topics: ${topics.linkedStyleId}`);
  }

  const kind = topics.kind ?? linked?.kind ?? "unordered";
  const layout = linked?.layout === undefined && topics.layout === undefined
    ? undefined
    : { ...authoredProperties(linked?.layout), ...authoredProperties(topics.layout) };
  const rootMarkerStyle = topics.rootMarkerStyle ?? linked?.rootMarkerStyle;
  const markerColor = topics.markerColor ?? linked?.markerColor;
  const itemGap = topics.itemGap ?? linked?.itemGap;

  return {
    kind,
    ...(layout === undefined ? {} : { layout }),
    ...(rootMarkerStyle === undefined ? {} : { rootMarkerStyle }),
    ...(markerColor === undefined ? {} : { markerColor }),
    ...(itemGap === undefined ? {} : { itemGap }),
  };
}
