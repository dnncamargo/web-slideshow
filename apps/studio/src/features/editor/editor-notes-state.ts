import {
  applySlideNote,
  createEmptyNotes,
  type PresentationNotes,
} from "../persistence/presentation-notes";

/**
 * Editor-local private notes state.
 *
 * Notes are held entirely separate from the canonical Presentation state:
 * they never mark the Presentation dirty, never touch draftRevision, and never
 * influence publish state. This module only tracks what the Editor needs to
 * load, edit, and save per-slide notes.
 */
export type EditorNotesStatus = "idle" | "loading" | "error" | "ready";

export interface EditorNotesState {
  notes: PresentationNotes;
  status: EditorNotesStatus;
  isSaving: boolean;
  hasSaveError: boolean;
  failedNote: { slideId: string; note: string } | null;
}

export type EditorNotesAction =
  | { type: "notes-load-start" }
  | { type: "notes-load-success"; notes: PresentationNotes }
  | { type: "notes-load-error" }
  | { type: "note-save-start"; slideId: string; note: string }
  | { type: "note-save-success"; slideId: string; note: string }
  | { type: "note-save-error"; slideId: string; note: string }
  | { type: "note-edit"; slideId: string; note: string };

export function createInitialEditorNotesState(): EditorNotesState {
  return {
    notes: createEmptyNotes(),
    status: "idle",
    isSaving: false,
    hasSaveError: false,
    failedNote: null,
  };
}

export function editorNotesReducer(
  state: EditorNotesState,
  action: EditorNotesAction,
): EditorNotesState {
  switch (action.type) {
    case "notes-load-start":
      return { ...state, status: "loading" };
    case "notes-load-success":
      return {
        ...state,
        notes: action.notes,
        status: "ready",
        hasSaveError: false,
      };
    case "notes-load-error":
      return { ...state, status: "error" };
    case "note-edit":
      return {
        ...state,
        notes: applySlideNote(state.notes, action.slideId, action.note),
      };

    case "note-save-start":
      return {
        ...state,
        isSaving: true,
        hasSaveError: false,
        failedNote: null,
      };

    case "note-save-success":
      return {
        ...state,
        isSaving: false,
        hasSaveError: false,
        failedNote: null,
      };

    case "note-save-error":
      return {
        ...state,
        isSaving: false,
        hasSaveError: true,
        failedNote: {
          slideId: action.slideId,
          note: action.note,
        },
      };
  }
}

/**
 * Resolve the note text for a slide. Missing slides or missing notes resolve
 * to an empty string so the Editor always has a stable value to edit.
 */
export function getNoteForSlide(
  notes: PresentationNotes,
  slideId: string,
): string {
  if (slideId.length === 0) {
    return "";
  }

  return notes.bySlideId[slideId] ?? "";
}
