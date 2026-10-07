import {
  updateSlideNoteText,
  createEmptyNotes,
  type PresentationNotes,
  type SlideNotes,
} from "../persistence/presentation-notes";

export { getNoteForSlide } from "../persistence/presentation-notes";

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
  failedSlideIds: string[];
}
export type EditorNotesAction =
  | { type: "notes-load-start" }
  | { type: "notes-load-success"; notes: PresentationNotes }
  | { type: "notes-load-error" }
  | { type: "note-save-start"; slideId: string; slideNotes: SlideNotes }
  | { type: "note-save-success"; slideId: string; slideNotes: SlideNotes }
  | { type: "note-save-error"; slideId: string; slideNotes: SlideNotes }
  | { type: "note-edit"; slideId: string; note: string };

export function createInitialEditorNotesState(): EditorNotesState {
  return {
    notes: createEmptyNotes(),
    status: "idle",
    isSaving: false,
    failedSlideIds: [],
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
        failedSlideIds: [],
      };
    case "notes-load-error":
      return { ...state, status: "error" };
    case "note-edit":
      return {
        ...state,
        notes: updateSlideNoteText(state.notes, action.slideId, action.note),
      };

    case "note-save-start":
      return {
        ...state,
        isSaving: true,
      };

    case "note-save-success":
      return {
        ...state,
        isSaving: false,
        failedSlideIds: state.failedSlideIds.filter(
          (slideId) => slideId !== action.slideId,
        ),
      };

    case "note-save-error":
      return {
        ...state,
        isSaving: false,
        failedSlideIds: state.failedSlideIds.includes(action.slideId)
          ? state.failedSlideIds
          : [...state.failedSlideIds, action.slideId],
      };
  }
}
