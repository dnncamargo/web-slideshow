import type { Presentation } from "@powershow/document-schema";

export type SaveStatus = "clean" | "dirty" | "saving" | "error";

export interface EditorSaveState {
  lastSavedPresentation: Presentation | null;
  isSaving: boolean;
  hasSaveError: boolean;
}

export type EditorSaveAction =
  | { type: "save-start" }
  | { type: "save-success"; presentation: Presentation }
  | { type: "save-error" };

export function createInitialEditorSaveState(): EditorSaveState {
  return {
    lastSavedPresentation: null,
    isSaving: false,
    hasSaveError: false,
  };
}

/**
 * Pure save-state reducer.
 *
 * `lastSavedPresentation` is the immutable root-snapshot identity the document
 * is compared against. Dirty is derived by root-reference inequality, never by
 * deep comparison.
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
      };
    case "save-error":
      return { ...state, isSaving: false, hasSaveError: true };
  }
}

export function isDocumentDirty(
  current: Presentation,
  lastSaved: Presentation | null,
): boolean {
  return lastSaved === null || current !== lastSaved;
}

/**
 * Save status priority: saving > error > dirty > clean.
 */
export function resolveSaveStatus(
  state: EditorSaveState,
  current: Presentation,
): SaveStatus {
  if (state.isSaving) {
    return "saving";
  }

  if (state.hasSaveError) {
    return "error";
  }

  if (isDocumentDirty(current, state.lastSavedPresentation)) {
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
