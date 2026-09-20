import {
  PresentationSchema,
  FUNDAMENTAL_TEXT_STYLE_IDS,
  SYSTEM_TABLE_CELL_TEXT_STYLE_ID,
  SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID,
  SYSTEM_TOPICS_TEXT_STYLE_ID,
  type ContentSlot,
  type PresentationElement,
  type TopicItem,
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
} & Record<PresentationElement["type"], number>;

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
): ContentSlot {
  return {
    ...slot,
    id: nextId(counters, family),
    children: slot.children.map((child) =>
      normalizeElement(child, counters, textStyleIds, linkedStyleIds),
    ),
  };
}

function normalizeTopicItem(
  item: TopicItem,
  counters: IdCounters,
  textStyleIds: ReadonlyMap<string, string>,
  linkedStyleIds: ReadonlyMap<string, string>,
): TopicItem {
  return {
    ...item,
    id: nextId(counters, "topic-item"),
    content: normalizeContentSlot(item.content, counters, textStyleIds, linkedStyleIds),
    children: item.children.map((child) =>
      normalizeTopicItem(child, counters, textStyleIds, linkedStyleIds),
    ),
  };
}

function normalizeElement(
  element: PresentationElement,
  counters: IdCounters,
  textStyleIds: ReadonlyMap<string, string>,
  linkedStyleIds: ReadonlyMap<string, string>,
): PresentationElement {
  const normalizedId = nextId(counters, element.type);

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
          normalizeElement(child, counters, textStyleIds, linkedStyleIds),
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
          normalizeTopicItem(item, counters, textStyleIds, linkedStyleIds),
        ),
      };
    case "table":
      if (element.mode !== "structured") {
        return { ...element, id: normalizedId };
      }

      return {
        ...element,
        id: normalizedId,
        columns: element.columns.map((column) => ({
          ...column,
          id: nextId(counters, "table-column"),
          header: normalizeContentSlot(
            column.header,
            counters,
            textStyleIds,
            linkedStyleIds,
          ),
        })),
        rows: element.rows.map((row) => ({
          ...row,
          id: nextId(counters, "table-row"),
          cells: row.cells.map((cell) =>
            normalizeContentSlot(
              cell,
              counters,
              textStyleIds,
              linkedStyleIds,
              "table-cell",
            ),
          ),
        })),
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

  return {
    ...source,
    textStyles,
    linkedStyles,
    slides: source.slides.map((slide) => ({
      ...slide,
      id: nextId(counters, "slide"),
      elements: slide.elements.map((element) =>
        normalizeElement(element, counters, textStyleIds, linkedStyleIds),
      ),
    })),
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
