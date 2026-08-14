import { describe, expect, it } from "vitest";

import type { Presentation } from "@powershow/document-schema";

import {
  EDITOR_AUTOSAVE_DELAY_MS,
  editorSaveReducer,
  isAutosaveEligible,
  isDocumentDirty,
  isSaveEnabled,
  resolveSaveStatus,
  type EditorSaveState,
} from "../src/features/editor/editor-save-state";

function makePresentation(id: string): Presentation {
  const snapshot = {} as Presentation;
  Object.defineProperty(snapshot, "id", { value: id, enumerable: true });
  return snapshot;
}

function baseState(lastSaved: Presentation | null, over: Partial<EditorSaveState> = {}): EditorSaveState {
  return {
    lastSavedPresentation: lastSaved,
    isSaving: false,
    hasSaveError: false,
    failedPresentation: null,
    ...over,
  };
}

describe("editor autosave save-state", () => {
  it("uses a 1500ms autosave delay", () => {
    expect(EDITOR_AUTOSAVE_DELAY_MS).toBe(1500);
  });

  it("detects dirty by root identity, not deep comparison", () => {
    const a = makePresentation("id");
    const same = a;
    const different = makePresentation("id");

    expect(isDocumentDirty(a, a)).toBe(false);
    expect(isDocumentDirty(a, same)).toBe(false);
    expect(isDocumentDirty(a, different)).toBe(true);
  });

  it("is not autosave eligible when clean", () => {
    const a = makePresentation("a");
    expect(isAutosaveEligible(baseState(a), a, true)).toBe(false);
  });

  it("is autosave eligible when dirty", () => {
    const a = makePresentation("a");
    const b = makePresentation("b");
    expect(isAutosaveEligible(baseState(a), b, true)).toBe(true);
  });

  it("is not autosave eligible while a save is running", () => {
    const a = makePresentation("a");
    const b = makePresentation("b");
    expect(
      isAutosaveEligible(baseState(a, { isSaving: true }), b, true),
    ).toBe(false);
  });

  it("is not autosave eligible without an onSave callback", () => {
    const b = makePresentation("b");
    expect(isAutosaveEligible(baseState(null), b, false)).toBe(false);
  });

  it("sets the exact snapshot as the saved baseline on success", () => {
    const b = makePresentation("b");
    const next = editorSaveReducer(
      baseState(null, { isSaving: true }),
      { type: "save-success", presentation: b },
    );

    expect(next.lastSavedPresentation).toBe(b);
    expect(next.isSaving).toBe(false);
    expect(next.hasSaveError).toBe(false);
    expect(resolveSaveStatus(next, b)).toBe("clean");
  });

  it("leaves a newer edited snapshot dirty when B succeeds while current is C", () => {
    const a = makePresentation("a");
    const b = makePresentation("b");
    const c = makePresentation("c");

    // B succeeds
    const afterB = editorSaveReducer(baseState(a), {
      type: "save-success",
      presentation: b,
    });

    // current is C, not B
    expect(resolveSaveStatus(afterB, c)).toBe("dirty");

    // C becomes autosave eligible after B finishes
    expect(isAutosaveEligible(afterB, c, true)).toBe(true);
  });

  it("does not auto-retry the same failed snapshot", () => {
    const a = makePresentation("a");
    const b = makePresentation("b");

    const afterError = editorSaveReducer(baseState(a), {
      type: "save-error",
      presentation: b,
    });

    expect(afterError.failedPresentation).toBe(b);
    expect(isAutosaveEligible(afterError, b, true)).toBe(false);
  });

  it("makes a newer snapshot autosave eligible after a failure", () => {
    const a = makePresentation("a");
    const b = makePresentation("b");
    const c = makePresentation("c");

    const afterError = editorSaveReducer(baseState(a), {
      type: "save-error",
      presentation: b,
    });

    expect(isAutosaveEligible(afterError, b, true)).toBe(false);
    expect(isAutosaveEligible(afterError, c, true)).toBe(true);
  });

  it("keeps explicit Save retry available after failure", () => {
    const a = makePresentation("a");
    const b = makePresentation("b");

    const afterError = editorSaveReducer(baseState(a), {
      type: "save-error",
      presentation: b,
    });

    expect(isSaveEnabled(afterError, b, true)).toBe(true);
  });

  it("clears the failure on a later successful save", () => {
    const a = makePresentation("a");
    const b = makePresentation("b");

    const afterError = editorSaveReducer(baseState(a), {
      type: "save-error",
      presentation: b,
    });
    const afterRetry = editorSaveReducer(afterError, {
      type: "save-success",
      presentation: b,
    });

    expect(afterRetry.failedPresentation).toBeNull();
    expect(afterRetry.hasSaveError).toBe(false);
    expect(resolveSaveStatus(afterRetry, b)).toBe("clean");
  });
});
