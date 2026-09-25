import type {
  ContainerLayout,
  CodeTypography,
  CodeVisualStyle,
  DividerEffect,
  DividerLayout,
  DividerVisualStyle,
  ElementEffect,
  ElementTypography,
  ElementVisualStyle,
  ResizablePositionedLayout,
  SimpleTableTypography,
  SimpleTableVisualStyle,
  StructuredTableVisualStyle,
  TerminalTitleTypography,
  TerminalTypography,
  TerminalVisualStyle,
  TopicsLayout,
} from "./element-properties";
import type {
  CodeElement,
  ContainerElement,
  DividerElement,
  TableElement,
  TerminalElement,
  TopicsElement,
  TopicMarkerStyle,
} from "./elements";
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

export type ResolvedLinkedCodeStyle = {
  layout?: ResizablePositionedLayout;
  style?: CodeVisualStyle;
  typography?: CodeTypography;
  effect?: ElementEffect;
};

export type ResolvedLinkedTerminalStyle = {
  layout?: ResizablePositionedLayout;
  style?: TerminalVisualStyle;
  typography?: TerminalTypography;
  titleTypography?: TerminalTitleTypography;
  effect?: ElementEffect;
};

export type ResolvedLinkedTableStyle = {
  layout?: ResizablePositionedLayout;
  style?: SimpleTableVisualStyle | StructuredTableVisualStyle;
  typography?: SimpleTableTypography;
  effect?: ElementEffect;
};

export type ResolvedLinkedDividerStyle = {
  layout?: DividerLayout;
  style?: DividerVisualStyle;
  effect?: DividerEffect;
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

function resolveResizableLayout(
  linked: ResizablePositionedLayout | undefined,
  local: ResizablePositionedLayout | undefined,
): ResizablePositionedLayout | undefined {
  if (linked === undefined && local === undefined) return undefined;
  return {
    ...authoredProperties(linked),
    ...authoredProperties(local),
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

function findLinkedStyle(
  presentation: Pick<Presentation, "linkedStyles">,
  linkedStyleId: string | undefined,
  target: string,
): NonNullable<Presentation["linkedStyles"]>[number] | undefined {
  const linked = linkedStyleId === undefined
    ? undefined
    : presentation.linkedStyles?.find((style) => style.id === linkedStyleId);

  if (linkedStyleId !== undefined && linked === undefined) {
    throw new Error(`Unresolved linked ${target} style: ${linkedStyleId}`);
  }

  return linked;
}

function assertTarget(
  linked: NonNullable<Presentation["linkedStyles"]>[number] | undefined,
  linkedStyleId: string | undefined,
  target: string,
): void {
  if (linked !== undefined && (!("target" in linked) || linked.target !== target)) {
    throw new Error(`Linked style is not compatible with ${target}: ${linkedStyleId}`);
  }
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

export function resolveLinkedCodeStyle(
  presentation: Pick<Presentation, "linkedStyles">,
  element: CodeElement,
): ResolvedLinkedCodeStyle {
  const linked = findLinkedStyle(presentation, element.linkedStyleId, "code");
  assertTarget(linked, element.linkedStyleId, "code");
  const codeLinked = linked !== undefined && "target" in linked && linked.target === "code" ? linked : undefined;
  const layout = resolveResizableLayout(codeLinked?.layout, element.layout);
  const style = resolveStyle(codeLinked?.style, element.style) as CodeVisualStyle | undefined;
  const typography = resolveTypography(codeLinked?.typography, element.typography) as CodeTypography | undefined;
  const effect = resolveEffect(codeLinked?.effect, element.effect);
  return {
    ...(layout === undefined ? {} : { layout }),
    ...(style === undefined ? {} : { style }),
    ...(typography === undefined ? {} : { typography }),
    ...(effect === undefined ? {} : { effect }),
  };
}

export function resolveLinkedTerminalStyle(
  presentation: Pick<Presentation, "linkedStyles">,
  element: TerminalElement,
): ResolvedLinkedTerminalStyle {
  const linked = findLinkedStyle(presentation, element.linkedStyleId, "terminal");
  assertTarget(linked, element.linkedStyleId, "terminal");
  const terminalLinked = linked !== undefined && "target" in linked && linked.target === "terminal" ? linked : undefined;
  const layout = resolveResizableLayout(terminalLinked?.layout, element.layout);
  const style = resolveStyle(terminalLinked?.style, element.style) as TerminalVisualStyle | undefined;
  const typography = resolveTypography(terminalLinked?.typography, element.typography) as TerminalTypography | undefined;
  const titleTypography = resolveTypography(terminalLinked?.titleTypography, element.titleTypography) as TerminalTitleTypography | undefined;
  const effect = resolveEffect(terminalLinked?.effect, element.effect);
  return {
    ...(layout === undefined ? {} : { layout }),
    ...(style === undefined ? {} : { style }),
    ...(typography === undefined ? {} : { typography }),
    ...(titleTypography === undefined ? {} : { titleTypography: titleTypography as TerminalTitleTypography }),
    ...(effect === undefined ? {} : { effect }),
  };
}

export function resolveLinkedTableStyle(
  presentation: Pick<Presentation, "linkedStyles">,
  element: TableElement,
): ResolvedLinkedTableStyle {
  const linked = findLinkedStyle(presentation, element.linkedStyleId, "table");
  const elementMode = element.mode === "structured" ? "structured" : "simple";
  if (linked !== undefined && (!("target" in linked) || linked.target !== "table" || linked.mode !== elementMode)) {
    throw new Error(`Linked table style mode is incompatible with ${elementMode} table: ${element.linkedStyleId}`);
  }
  const tableLinked = linked !== undefined && "target" in linked && linked.target === "table" ? linked : undefined;
  const layout = resolveResizableLayout(tableLinked?.layout, element.layout);
  const style = resolveStyle(tableLinked?.style, element.style) as SimpleTableVisualStyle | StructuredTableVisualStyle | undefined;
  const typography = element.mode !== "structured" && tableLinked?.mode === "simple"
    ? resolveTypography(tableLinked.typography, element.typography) as SimpleTableTypography | undefined
    : undefined;
  const effect = resolveEffect(tableLinked?.effect, element.effect);
  return {
    ...(layout === undefined ? {} : { layout }),
    ...(style === undefined ? {} : { style: style as SimpleTableVisualStyle | StructuredTableVisualStyle }),
    ...(typography === undefined ? {} : { typography: typography as SimpleTableTypography }),
    ...(effect === undefined ? {} : { effect }),
  };
}

export function resolveLinkedDividerStyle(
  presentation: Pick<Presentation, "linkedStyles">,
  element: DividerElement,
): ResolvedLinkedDividerStyle {
  const linked = findLinkedStyle(presentation, element.linkedStyleId, "divider");
  assertTarget(linked, element.linkedStyleId, "divider");
  const dividerLinked = linked !== undefined && "target" in linked && linked.target === "divider" ? linked : undefined;
  const layout = resolveLayout(dividerLinked?.layout, element.layout) as DividerLayout | undefined;
  const style = resolveStyle(dividerLinked?.style, element.style) as DividerVisualStyle | undefined;
  const effect = resolveEffect(dividerLinked?.effect, element.effect) as DividerEffect | undefined;
  return {
    ...(layout === undefined ? {} : { layout }),
    ...(style === undefined ? {} : { style }),
    ...(effect === undefined ? {} : { effect }),
  };
}
