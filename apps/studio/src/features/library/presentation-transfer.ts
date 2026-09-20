import {
  PresentationSchema,
  FUNDAMENTAL_TEXT_STYLE_IDS,
  SYSTEM_TABLE_CELL_TEXT_STYLE_ID,
  SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID,
  SYSTEM_TOPICS_TEXT_STYLE_ID,
  type ContentSlot,
  type PresentationElement,
  type TopicItem,
  type RootDefinition,
  type Presentation,
} from "@web-slideshow/document-schema";

const PRESERVED_TEXT_STYLE_IDS = new Set<string>([
  ...FUNDAMENTAL_TEXT_STYLE_IDS,
  SYSTEM_TABLE_CELL_TEXT_STYLE_ID,
  SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID,
  SYSTEM_TOPICS_TEXT_STYLE_ID,
]);

type IdCounters = {
  slide: number;
  "content-slot": number;
  "topic-item": number;
  "table-column": number;
  "table-row": number;
  "table-cell": number;
  "text-style": number;
  "linked-style": number;
  "root-definition": number;
} & Record<PresentationElement["type"], number>;

type StructuralIdMap = Map<string, string>;

function nextId<Family extends keyof IdCounters>(
  counters: IdCounters,
  family: Family,
): string {
  counters[family] += 1;
  return `${family}-${counters[family]}`;
}

function createIdCounters(): IdCounters {
  return {
    slide: 0,
    "content-slot": 0,
    "topic-item": 0,
    "table-column": 0,
    "table-row": 0,
    "table-cell": 0,
    "text-style": 0,
    "linked-style": 0,
    text: 0,
    image: 0,
    gallery: 0,
    code: 0,
    terminal: 0,
    table: 0,
    plot: 0,
    interactive: 0,
    divider: 0,
    embed: 0,
    blocks: 0,
    scripted: 0,
    topics: 0,
    container: 0,
    "root-definition": 0,
  };
}

function remapTextStyleVariant(
  variant: string,
  textStyleIds: ReadonlyMap<string, string>,
): string {
  return textStyleIds.get(variant) ?? variant;
}

function normalizeContentSlot(
  slot: ContentSlot,
  counters: IdCounters,
  textStyleIds: ReadonlyMap<string, string>,
  linkedStyleIds: ReadonlyMap<string, string>,
  family: "content-slot" | "table-cell" = "content-slot",
  structuralIds?: StructuralIdMap,
): ContentSlot {
  const normalizedId = nextId(counters, family);
  structuralIds?.set(slot.id, normalizedId);

  return {
    ...slot,
    id: normalizedId,
    children: slot.children.map((child) =>
      normalizeElement(child, counters, textStyleIds, linkedStyleIds, structuralIds),
    ),
  };
}

function normalizeTopicItem(
  item: TopicItem,
  counters: IdCounters,
  textStyleIds: ReadonlyMap<string, string>,
  linkedStyleIds: ReadonlyMap<string, string>,
  structuralIds?: StructuralIdMap,
): TopicItem {
  const normalizedId = nextId(counters, "topic-item");
  structuralIds?.set(item.id, normalizedId);

  return {
    ...item,
    id: normalizedId,
    content: normalizeContentSlot(item.content, counters, textStyleIds, linkedStyleIds, "content-slot", structuralIds),
    children: item.children.map((child) =>
      normalizeTopicItem(child, counters, textStyleIds, linkedStyleIds, structuralIds),
    ),
  };
}

function normalizeElement(
  element: RootDefinition["root"],
  counters: IdCounters,
  textStyleIds: ReadonlyMap<string, string>,
  linkedStyleIds: ReadonlyMap<string, string>,
  structuralIds: StructuralIdMap,
): RootDefinition["root"];

function normalizeElement(
  element: PresentationElement,
  counters: IdCounters,
  textStyleIds: ReadonlyMap<string, string>,
  linkedStyleIds: ReadonlyMap<string, string>,
  structuralIds?: StructuralIdMap,
): PresentationElement;

function normalizeElement(
  element: PresentationElement,
  counters: IdCounters,
  textStyleIds: ReadonlyMap<string, string>,
  linkedStyleIds: ReadonlyMap<string, string>,
  structuralIds?: StructuralIdMap,
): PresentationElement {
  const normalizedId = nextId(counters, element.type);
  structuralIds?.set(element.id, normalizedId);

  switch (element.type) {
    case "text":
      return {
        ...element,
        id: normalizedId,
        variant: remapTextStyleVariant(element.variant, textStyleIds),
      };
    case "container":
      return {
        ...element,
        id: normalizedId,
        linkedStyleId: element.linkedStyleId === undefined
          ? undefined
          : linkedStyleIds.get(element.linkedStyleId) ?? element.linkedStyleId,
        children: element.children.map((child) =>
          normalizeElement(child, counters, textStyleIds, linkedStyleIds, structuralIds),
        ),
      };
    case "topics":
      return {
        ...element,
        id: normalizedId,
        linkedStyleId: element.linkedStyleId === undefined
          ? undefined
          : linkedStyleIds.get(element.linkedStyleId) ?? element.linkedStyleId,
        items: element.items.map((item) =>
          normalizeTopicItem(item, counters, textStyleIds, linkedStyleIds, structuralIds),
        ),
      };
    case "table":
      if (element.mode !== "structured") {
        return { ...element, id: normalizedId };
      }

      return {
        ...element,
        id: normalizedId,
        columns: element.columns.map((column) => {
          const normalizedColumnId = nextId(counters, "table-column");
          structuralIds?.set(column.id, normalizedColumnId);
          return {
            ...column,
            id: normalizedColumnId,
            header: normalizeContentSlot(
              column.header,
              counters,
              textStyleIds,
              linkedStyleIds,
              "content-slot",
              structuralIds,
            ),
          };
        }),
        rows: element.rows.map((row) => {
          const normalizedRowId = nextId(counters, "table-row");
          structuralIds?.set(row.id, normalizedRowId);
          return {
            ...row,
            id: normalizedRowId,
            cells: row.cells.map((cell) =>
              normalizeContentSlot(
                cell,
                counters,
                textStyleIds,
                linkedStyleIds,
                "table-cell",
                structuralIds,
              ),
            ),
          };
        }),
      };
    default:
      return { ...element, id: normalizedId };
  }
}

/** Normalize imported internal identities without rewriting authored content. */
export function normalizeImportedPresentation(
  source: Presentation,
): Presentation {
  const counters = createIdCounters();
  const textStyleIds = new Map<string, string>();
  const linkedStyleIds = new Map<string, string>();

  const textStyles = source.textStyles?.map((style) => {
    if (!("name" in style) || PRESERVED_TEXT_STYLE_IDS.has(style.id)) {
      return style;
    }

    const id = nextId(counters, "text-style");
    textStyleIds.set(style.id, id);
    return { ...style, id };
  });

  const linkedStyles = source.linkedStyles?.map((style) => {
    const id = nextId(counters, "linked-style");
    linkedStyleIds.set(style.id, id);
    return { ...style, id };
  });

  const rootDefinitionIds = new Map<string, string>();
  const rootDefinitionStructuralIds = new Map<string, StructuralIdMap>();
  const rootDefinitions = source.rootDefinitions?.map((definition: RootDefinition) => {
    const normalizedId = nextId(counters, "root-definition");
    const structuralIds = new Map<string, string>();
    rootDefinitionIds.set(definition.id, normalizedId);
    rootDefinitionStructuralIds.set(definition.id, structuralIds);

    const root = normalizeElement(
      definition.root,
      counters,
      textStyleIds,
      linkedStyleIds,
      structuralIds,
    );

    return {
      ...definition,
      id: normalizedId,
      root,
      ...(definition.localChildTargetIds === undefined
        ? {}
        : {
            localChildTargetIds: definition.localChildTargetIds.map(
              (targetId) => structuralIds.get(targetId) ?? targetId,
            ),
          }),
    };
  });

  return {
    ...source,
    textStyles,
    linkedStyles,
    ...(rootDefinitions === undefined ? {} : { rootDefinitions }),
    ...(source.defaultRootDefinitionId === undefined
      ? {}
      : {
          defaultRootDefinitionId:
            rootDefinitionIds.get(source.defaultRootDefinitionId) ??
            source.defaultRootDefinitionId,
        }),
    slides: source.slides.map((slide) => {
      const effectiveRootDefinitionId =
        slide.rootDefinitionId ?? source.defaultRootDefinitionId;
      const structuralIds = effectiveRootDefinitionId === undefined
        ? undefined
        : rootDefinitionStructuralIds.get(effectiveRootDefinitionId);

      return {
        ...slide,
        id: nextId(counters, "slide"),
        ...(slide.rootDefinitionId === undefined
          ? {}
          : {
              rootDefinitionId:
                rootDefinitionIds.get(slide.rootDefinitionId) ??
                slide.rootDefinitionId,
            }),
        ...(slide.localRootChildren === undefined
          ? {}
          : {
              localRootChildren: slide.localRootChildren.map((record) => ({
                ...record,
                targetContainerId:
                  structuralIds?.get(record.targetContainerId) ??
                  record.targetContainerId,
                children: record.children.map((element) =>
                  normalizeElement(
                    element,
                    counters,
                    textStyleIds,
                    linkedStyleIds,
                  ),
                ),
              })),
            }),
        elements: slide.elements.map((element) =>
          normalizeElement(element, counters, textStyleIds, linkedStyleIds),
        ),
      };
    }),
  };
}

export class PresentationImportError extends Error {
  readonly kind: "malformed-json" | "invalid-presentation";

  constructor(kind: "malformed-json" | "invalid-presentation", message: string) {
    super(message);
    this.name = "PresentationImportError";
    this.kind = kind;
  }
}

/** Serialize the canonical document itself; there is deliberately no envelope. */
export function serializePresentationForExport(
  presentation: Presentation,
): string {
  return `${JSON.stringify(presentation, null, 2)}\n`;
}

/** Parse and normalize imported JSON at the canonical schema boundary. */
export function parsePresentationImport(text: string): Presentation {
  let candidate: unknown;

  try {
    candidate = JSON.parse(text) as unknown;
  } catch (error) {
    throw new PresentationImportError(
      "malformed-json",
      "The selected file is not valid JSON.",
    );
  }

  const parsed = PresentationSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new PresentationImportError(
      "invalid-presentation",
      "The selected file is not a valid presentation.",
    );
  }

  return PresentationSchema.parse(parsed.data);
}

/** Copy a parsed document for a new private draft and normalize imported IDs. */
export function prepareImportedPresentation(
  source: Presentation,
  newId: string,
): Presentation {
  return PresentationSchema.parse(
    normalizeImportedPresentation({ ...source, id: newId }),
  );
}

function normalizeInstanceToken(displayName: string): string {
  const normalized = displayName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "instance";
}

export function buildPresentationExportFilename(title: string, displayName: string): string {
  const safeTitle = title
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. -]+$/g, "")
    .slice(0, 120)
    .trim();

  return `${safeTitle || "presentation"}.${normalizeInstanceToken(displayName)}.json`;
}
