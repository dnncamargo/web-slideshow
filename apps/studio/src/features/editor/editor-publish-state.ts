import type { Presentation } from "@powershow/document-schema";

/**
 * Local-only publish lifecycle UI state. Not persisted; reload resets it.
 */
export type PublishStatus = "idle" | "publishing" | "success" | "error";

export interface EditorPublishState {
  status: PublishStatus;
  publishedPresentation: Presentation | null;
}

export type EditorPublishAction =
  | { type: "publish-start" }
  | { type: "publish-success"; presentation: Presentation }
  | { type: "publish-error" }
  | { type: "publish-reset" };

export function createInitialEditorPublishState(): EditorPublishState {
  return { status: "idle", publishedPresentation: null };
}

/**
 * Pure publish-state reducer.
 *
 * `publishedPresentation` is the immutable root-snapshot identity whose
 * successful publish is still reflected in the local UI. When the canonical
 * root changes, the UI returns to the normal idle action state.
 */
export function editorPublishReducer(
  state: EditorPublishState,
  action: EditorPublishAction,
): EditorPublishState {
  switch (action.type) {
    case "publish-start":
      return { ...state, status: "publishing" };
    case "publish-success":
      return { status: "success", publishedPresentation: action.presentation };
    case "publish-error":
      return { ...state, status: "error" };
    case "publish-reset":
      return createInitialEditorPublishState();
  }
}

export function isPublishEnabled(
  state: EditorPublishState,
  saveStatus: string,
  hasPublishCallback: boolean,
): boolean {
  // Never publish while a request is in flight or no callback exists.
  if (!hasPublishCallback || state.status === "publishing") {
    return false;
  }

  // Never publish while the canonical Editor snapshot has unsaved changes.
  return saveStatus === "clean";
}

export function resolvePublishButtonLabelStatus(
  state: EditorPublishState,
  current: Presentation,
): PublishStatus {
  if (state.status === "success") {
    // Only this exact snapshot remains "Published" in the local UI.
    return current === state.publishedPresentation ? "success" : "idle";
  }

  return state.status;
}