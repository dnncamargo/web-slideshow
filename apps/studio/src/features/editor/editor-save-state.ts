import type { Presentation } from "@powershow/document-schema";

export const EDITOR_AUTOSAVE_DELAY_MS = 1500;

export type SaveStatus = "clean" | "dirty" | "saving" | "error";

export interface WorkspacePersistenceState {
  presentationHasSaveError: boolean;
  notesPending: boolean;
  notesSaving: boolean;
  notesHasSaveError: boolean;
}

export interface EditorSaveState {
  lastSavedPresentation: Presentation | null;
  isSaving: boolean;
  hasSaveError: boolean;
  failedPresentation: Presentation | null;
}

export type EditorSaveAction =
  | { type: "save-start" }
  | { type: "save-success"; presentation: Presentation }
  | { type: "save-error"; presentation: Presentation };

export function createInitialEditorSaveState(): EditorSaveState {
  return {
    lastSavedPresentation: null,
    isSaving: false,
    hasSaveError: false,
    failedPresentation: null,
  };
}

/**
 * Pure save-state reducer.
 *
 * `lastSavedPresentation` is the immutable root-snapshot identity the document
 * is compared against. Dirty is derived by root-reference inequality, never by
 * deep comparison.
 *
 * `failedPresentation` is the exact snapshot identity of the most recent failed
 * save. Autosave uses it to avoid retrying the same failed snapshot, while a
 * newly edited snapshot remains eligible.
 */
export function editorSaveReducer(
  state: EditorSaveState,
  action: EditorSaveAction,
): EditorSaveState {
  switch (action.type) {
    case "save-start":
      return { ...state, isSaving: true };
    case "save-success":
      return {
        lastSavedPresentation: action.presentation,
        isSaving: false,
        hasSaveError: false,
        failedPresentation: null,
      };
    case "save-error":
      return {
        ...state,
        isSaving: false,
        hasSaveError: true,
        failedPresentation: action.presentation,
      };
  }
}

export function isDocumentDirty(
  current: Presentation,
  lastSaved: Presentation | null,
): boolean {
  return lastSaved === null || current !== lastSaved;
}

/**
 * Save status priority: saving > error (current is the failed snapshot) >
 * dirty > clean.
 */
export function resolveSaveStatus(
  state: EditorSaveState,
  current: Presentation,
): SaveStatus {
  if (state.isSaving) {
    return "saving";
  }

  if (state.hasSaveError && state.failedPresentation === current) {
    return "error";
  }

  if (isDocumentDirty(current, state.lastSavedPresentation)) {
    return "dirty";
  }

  return "clean";
}

/**
 * Resolve workspace feedback without merging private notes into canonical
 * Presentation state. Publishing continues to use resolveSaveStatus.
 */
export function resolveWorkspaceSaveStatus(
  presentationStatus: SaveStatus,
  notes: WorkspacePersistenceState,
): SaveStatus {
  if (notes.presentationHasSaveError || notes.notesHasSaveError) {
    return "error";
  }

  if (presentationStatus === "saving" || notes.notesSaving) {
    return "saving";
  }

  if (presentationStatus === "dirty" || notes.notesPending) {
    return "dirty";
  }

  return "clean";
}

export function isSaveEnabled(
  state: EditorSaveState,
  current: Presentation,
  hasSaveCallback: boolean,
): boolean {
  if (!hasSaveCallback || state.isSaving) {
    return false;
  }

  return isDocumentDirty(current, state.lastSavedPresentation);
}

/**
 * Whether the current dirty snapshot may be scheduled for autosave.
 *
 * A snapshot that already failed must not be automatically retried (no retry
 * loop). A newer edited snapshot is eligible for a fresh debounced autosave.
 */
export function isAutosaveEligible(
  state: EditorSaveState,
  current: Presentation,
  hasSaveCallback: boolean,
): boolean {
  if (!hasSaveCallback || state.isSaving) {
    return false;
  }

  if (!isDocumentDirty(current, state.lastSavedPresentation)) {
    return false;
  }

  if (state.hasSaveError && state.failedPresentation === current) {
    return false;
  }

  return true;
}
