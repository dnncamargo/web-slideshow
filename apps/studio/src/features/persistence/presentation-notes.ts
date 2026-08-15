/**
 * PowerShow private presentation notes domain helpers.
 *
 * Notes live in a dedicated private per-presentation Firestore document:
 *   users/{uid}/presentations/{presentationId}/private/notes
 *
 * The document shape is:
 *   { bySlideId: Record<slideId, string> }
 *
 * Notes are plain-text and fully separate from the canonical Presentation
 * document. They never affect draftRevision, publication state, or the main
 * presentation document.
 */

export interface PresentationNotes {
  bySlideId: Record<string, string>;
}

export function createEmptyNotes(): PresentationNotes {
  return { bySlideId: {} };
}

/**
 * Safely normalize an externally persisted notes document into the domain
 * model. Malformed or unexpected data degrades to empty notes; non-string or
 * empty-string entries are omitted so empty notes are never persisted.
 */
export function normalizePersistedNotes(persisted: unknown): PresentationNotes {
  if (typeof persisted !== "object" || persisted === null) {
    return createEmptyNotes();
  }

  const bySlideId = (persisted as Record<string, unknown>).bySlideId;

  if (
    typeof bySlideId !== "object" ||
    bySlideId === null ||
    Array.isArray(bySlideId)
  ) {
    return createEmptyNotes();
  }

  const normalized: Record<string, string> = {};

  for (const [slideId, text] of Object.entries(bySlideId)) {
    if (typeof text !== "string" || text.length === 0) {
      continue;
    }

    normalized[slideId] = text;
  }

  return { bySlideId: normalized };
}

/**
 * Serialize notes to a Firestore-safe plain value. Empty-string entries are
 * omitted so an emptied note is removed from the persisted document.
 */
export function makeFirestoreSafeNotes(
  notes: PresentationNotes,
): Record<string, unknown> {
  const bySlideId: Record<string, string> = {};

  for (const [slideId, text] of Object.entries(notes.bySlideId)) {
    if (typeof text === "string" && text.length > 0) {
      bySlideId[slideId] = text;
    }
  }

  return { bySlideId };
}

/**
 * Apply a single slide note. Empty text removes the note; non-empty text is
 * preserved exactly. Returns a new, immutable notes value.
 */
export function applySlideNote(
  notes: PresentationNotes,
  slideId: string,
  note: string,
): PresentationNotes {
  const next = { ...notes.bySlideId };

  if (typeof note === "string" && note.length > 0) {
    next[slideId] = note;
  } else {
    delete next[slideId];
  }

  return { bySlideId: next };
}
