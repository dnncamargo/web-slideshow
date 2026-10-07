/**
 * Private presentation notes domain helpers.
 *
 * Notes live in a dedicated private per-presentation Firestore document:
 *   users/{uid}/presentations/{presentationId}/private/notes
 *
 * The in-memory domain is normalized to one complete state per slide. Legacy
 * string records are accepted and emitted only at the persistence boundary.
 */

export interface PointedNote {
  id: string;
  text: string;
  x: number;
  y: number;
}

export interface SlideNotes {
  text: string;
  pointed: PointedNote[];
}

export interface PresentationNotes {
  bySlideId: Record<string, SlideNotes>;
}

export function createEmptySlideNotes(): SlideNotes {
  return { text: "", pointed: [] };
}

export function createEmptyNotes(): PresentationNotes {
  return { bySlideId: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidPointedNote(value: unknown): value is PointedNote {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.text === "string" &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    value.x >= 0 &&
    typeof value.y === "number" &&
    Number.isFinite(value.y) &&
    value.y >= 0
  );
}

function normalizeSlideNotes(value: unknown): SlideNotes | null {
  if (typeof value === "string") {
    return { text: value, pointed: [] };
  }

  if (!isRecord(value)) {
    return null;
  }

  const pointed: PointedNote[] = [];
  const pointedIds = new Set<string>();

  if (Array.isArray(value.pointed)) {
    for (const candidate of value.pointed) {
      if (!isValidPointedNote(candidate) || pointedIds.has(candidate.id)) {
        continue;
      }

      pointedIds.add(candidate.id);
      pointed.push({
        id: candidate.id,
        text: candidate.text,
        x: candidate.x,
        y: candidate.y,
      });
    }
  }

  return {
    text: typeof value.text === "string" ? value.text : "",
    pointed,
  };
}

function isEmptySlideNotes(slideNotes: SlideNotes): boolean {
  return slideNotes.text === "" && slideNotes.pointed.length === 0;
}

/**
 * Safely normalize an externally persisted notes document into the domain
 * model. Malformed whole documents degrade to empty notes. Malformed pointed
 * entries are dropped individually so valid entries on the same slide survive.
 */
export function normalizePersistedNotes(persisted: unknown): PresentationNotes {
  if (!isRecord(persisted) || !isRecord(persisted.bySlideId)) {
    return createEmptyNotes();
  }

  const normalized: Record<string, SlideNotes> = {};

  for (const [slideId, persistedSlideNotes] of Object.entries(
    persisted.bySlideId,
  )) {
    const slideNotes = normalizeSlideNotes(persistedSlideNotes);

    if (slideNotes !== null && !isEmptySlideNotes(slideNotes)) {
      normalized[slideId] = slideNotes;
    }
  }

  return { bySlideId: normalized };
}

/**
 * Serialize normalized notes to a Firestore-safe private document.
 * Ordinary-only slides retain the legacy string representation.
 */
export function makeFirestoreSafeNotes(
  notes: PresentationNotes,
): Record<string, unknown> {
  const bySlideId: Record<string, unknown> = {};

  for (const [slideId, slideNotes] of Object.entries(notes.bySlideId)) {
    const safeSlideNotes = normalizeSlideNotes(slideNotes);

    if (safeSlideNotes === null || isEmptySlideNotes(safeSlideNotes)) {
      continue;
    }

    if (safeSlideNotes.pointed.length === 0) {
      bySlideId[slideId] = safeSlideNotes.text;
      continue;
    }

    const richSlideNotes: Record<string, unknown> = {
      pointed: safeSlideNotes.pointed,
    };

    if (safeSlideNotes.text !== "") {
      richSlideNotes.text = safeSlideNotes.text;
    }

    bySlideId[slideId] = richSlideNotes;
  }

  return { bySlideId };
}

/** Resolve the complete normalized state for one slide. */
export function getSlideNotes(
  notes: PresentationNotes,
  slideId: string,
): SlideNotes {
  if (slideId.length === 0) {
    return createEmptySlideNotes();
  }

  return notes.bySlideId[slideId] ?? createEmptySlideNotes();
}

/** Resolve only the ordinary free-form note text for one slide. */
export function getNoteForSlide(
  notes: PresentationNotes,
  slideId: string,
): string {
  return getSlideNotes(notes, slideId).text;
}

/** Replace one slide's complete normalized state without touching other slides. */
export function applySlideNotes(
  notes: PresentationNotes,
  slideId: string,
  slideNotes: SlideNotes,
): PresentationNotes {
  const next = { ...notes.bySlideId };

  if (slideId.length === 0 || isEmptySlideNotes(slideNotes)) {
    delete next[slideId];
  } else {
    next[slideId] = {
      text: slideNotes.text,
      pointed: slideNotes.pointed.map((pointedNote) => ({ ...pointedNote })),
    };
  }

  return { bySlideId: next };
}

/** Update ordinary text while preserving all pointed notes for the slide. */
export function updateSlideNoteText(
  notes: PresentationNotes,
  slideId: string,
  text: string,
): PresentationNotes {
  return applySlideNotes(notes, slideId, {
    ...getSlideNotes(notes, slideId),
    text,
  });
}

/** Append one pointed note while preserving the rest of the slide state. */
export function appendPointedNote(
  notes: PresentationNotes,
  slideId: string,
  pointedNote: PointedNote,
): PresentationNotes {
  return applySlideNotes(notes, slideId, {
    ...getSlideNotes(notes, slideId),
    pointed: [...getSlideNotes(notes, slideId).pointed, { ...pointedNote }],
  });
}

/** Update pointed-note text by stable identity without changing its position. */
export function updatePointedNoteText(
  notes: PresentationNotes,
  slideId: string,
  pointedNoteId: string,
  text: string,
): PresentationNotes {
  const slideNotes = getSlideNotes(notes, slideId);

  return applySlideNotes(notes, slideId, {
    ...slideNotes,
    pointed: slideNotes.pointed.map((pointedNote) =>
      pointedNote.id === pointedNoteId ? { ...pointedNote, text } : pointedNote,
    ),
  });
}

/** Update one pointed-note position by stable identity without changing order. */
export function updatePointedNotePosition(
  notes: PresentationNotes,
  slideId: string,
  pointedNoteId: string,
  x: number,
  y: number,
): PresentationNotes {
  const slideNotes = getSlideNotes(notes, slideId);

  return applySlideNotes(notes, slideId, {
    ...slideNotes,
    pointed: slideNotes.pointed.map((pointedNote) =>
      pointedNote.id === pointedNoteId ? { ...pointedNote, x, y } : pointedNote,
    ),
  });
}

/** Remove exactly one pointed note by stable identity. */
export function removePointedNote(
  notes: PresentationNotes,
  slideId: string,
  pointedNoteId: string,
): PresentationNotes {
  const slideNotes = getSlideNotes(notes, slideId);

  return applySlideNotes(notes, slideId, {
    ...slideNotes,
    pointed: slideNotes.pointed.filter(
      (pointedNote) => pointedNote.id !== pointedNoteId,
    ),
  });
}

/** Collect all pointed-note IDs so authoring IDs remain unique across slides. */
export function getPointedNoteIds(notes: PresentationNotes): Set<string> {
  return new Set(
    Object.values(notes.bySlideId).flatMap((slideNotes) =>
      slideNotes.pointed.map((pointedNote) => pointedNote.id),
    ),
  );
}
