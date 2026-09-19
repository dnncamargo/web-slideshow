import {
  PresentationSchema,
  SYSTEM_TABLE_CELL_TEXT_STYLE_ID,
  SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID,
  SYSTEM_TOPICS_TEXT_STYLE_ID,
  type ContentSlot,
  type GalleryElement,
  type ImageElement,
  type PresentationElement,
  type Presentation as CanonicalPresentation,
  type TextStyle,
  type TopicItem,
  type Presentation,
} from "@web-slideshow/document-schema";

const LEGACY_DEMO_ASSET_PATH = "/powershow-demo.svg";
const CURRENT_DEMO_ASSET_PATH = "/instance-demo.svg";

const LEGACY_TEXT_STYLE_IDS = {
  "powershow:table-column-header": SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID,
  "powershow:table-cell": SYSTEM_TABLE_CELL_TEXT_STYLE_ID,
  "powershow:topics": SYSTEM_TOPICS_TEXT_STYLE_ID,
} as const;

function normalizeLegacyTextStyleId(id: string): TextStyle["id"] {
  return LEGACY_TEXT_STYLE_IDS[id as keyof typeof LEGACY_TEXT_STYLE_IDS] ?? id;
}

function normalizeLegacyImagePath(src: string): string {
  return src === LEGACY_DEMO_ASSET_PATH ? CURRENT_DEMO_ASSET_PATH : src;
}

function normalizeLegacySlot(slot: ContentSlot): ContentSlot {
  const children = normalizeLegacyElements(slot.children);
  return children === slot.children ? slot : { ...slot, children };
}

function normalizeLegacyTopicItem(item: TopicItem): TopicItem {
  const content = normalizeLegacySlot(item.content);
  const children = item.children.map(normalizeLegacyTopicItem);
  return content === item.content && children.every((child, index) => child === item.children[index])
    ? item
    : { ...item, content, children };
}

function normalizeLegacyElement(element: PresentationElement): PresentationElement {
  if (element.type === "text") {
    const variant = normalizeLegacyTextStyleId(element.variant);
    return variant === element.variant ? element : { ...element, variant };
  }

  if (element.type === "image") {
    const src = normalizeLegacyImagePath(element.src);
    return src === element.src ? element : { ...element, src } satisfies ImageElement;
  }

  if (element.type === "gallery") {
    const items = element.items.map((item) => {
      const src = normalizeLegacyImagePath(item.src);
      return src === item.src ? item : { ...item, src };
    });
    return items.every((item, index) => item === element.items[index])
      ? element
      : { ...element, items } satisfies GalleryElement;
  }

  if (element.type === "container") {
    const children = normalizeLegacyElements(element.children);
    return children === element.children ? element : { ...element, children };
  }

  if (element.type === "table" && element.mode === "structured") {
    let changed = false;
    const columns = element.columns.map((column) => {
      const header = normalizeLegacySlot(column.header);
      if (header !== column.header) changed = true;
      return header === column.header ? column : { ...column, header };
    });
    const rows = element.rows.map((row) => {
      let rowChanged = false;
      const cells = row.cells.map((cell) => {
        const normalized = normalizeLegacySlot(cell);
        if (normalized !== cell) rowChanged = true;
        return normalized === cell ? cell : normalized;
      });
      if (rowChanged) changed = true;
      return rowChanged ? { ...row, cells } : row;
    });
    return changed ? { ...element, columns, rows } : element;
  }

  if (element.type === "topics") {
    const items = element.items.map(normalizeLegacyTopicItem);
    return items.every((item, index) => item === element.items[index])
      ? element
      : { ...element, items };
  }

  return element;
}

function normalizeLegacyElements(elements: readonly PresentationElement[]): PresentationElement[] {
  const normalized = elements.map(normalizeLegacyElement);
  return normalized.every((element, index) => element === elements[index])
    ? elements as PresentationElement[]
    : normalized;
}

function normalizeLegacyTextStyles(presentation: CanonicalPresentation): CanonicalPresentation {
  if (presentation.textStyles === undefined) return presentation;

  const canonicalIds = new Set(
    presentation.textStyles
      .filter((style) => !(style.id in LEGACY_TEXT_STYLE_IDS))
      .map((style) => style.id),
  );
  const textStyles: TextStyle[] = presentation.textStyles.flatMap((style) => {
    const id = normalizeLegacyTextStyleId(style.id);
    if (id !== style.id && canonicalIds.has(id)) return [];
    if (id === style.id || !("name" in style)) return [style];
    return [{ ...style, id }];
  });

  return textStyles.length === presentation.textStyles.length &&
    textStyles.every((style, index) => style === presentation.textStyles?.[index])
    ? presentation
    : { ...presentation, textStyles };
}

function normalizeLegacyPresentation(presentation: CanonicalPresentation): CanonicalPresentation {
  const textStyles = normalizeLegacyTextStyles(presentation);
  const slides = textStyles.slides.map((slide) => {
    const elements = normalizeLegacyElements(slide.elements);
    return elements === slide.elements ? slide : { ...slide, elements };
  });
  return slides.every((slide, index) => slide === textStyles.slides[index])
    ? textStyles
    : { ...textStyles, slides };
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
      "The selected file is not a valid PowerShow presentation.",
    );
  }

  return PresentationSchema.parse(normalizeLegacyPresentation(parsed.data));
}

/** Copy a parsed document for a new private draft, changing only its root id. */
export function prepareImportedPresentation(
  source: Presentation,
  newId: string,
): Presentation {
  return { ...source, id: newId };
}

export function buildPresentationExportFilename(title: string): string {
  const safeTitle = title
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. -]+$/g, "")
    .slice(0, 120)
    .trim();

  return `${safeTitle || "presentation"}.powershow.json`;
}
