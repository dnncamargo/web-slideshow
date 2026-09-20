import {
  PresentationSchema,
  type Presentation,
} from "@web-slideshow/document-schema";

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

/** Copy a parsed document for a new private draft, changing only its root id. */
export function prepareImportedPresentation(
  source: Presentation,
  newId: string,
): Presentation {
  return { ...source, id: newId };
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
