import { describe, expect, it } from "vitest";

import type { Presentation } from "@powershow/document-schema";

import { createEmptyNotes } from "../src/features/persistence/presentation-notes";
import {
  createInitialEditorNotesState,
  editorNotesReducer,
  getNoteForSlide,
} from "../src/features/editor/editor-notes-state";
import { isDocumentDirty } from "../src/features/editor/editor-save-state";

function makePresentation(id: string): Presentation {
  const snapshot = {} as Presentation;
  Object.defineProperty(snapshot, "id", { value: id, enumerable: true });
  return snapshot;
}

describe("editor private notes state", () => {
  it("starts idle with empty notes", () => {
    const state = createInitialEditorNotesState();

    expect(state.status).toBe("idle");
    expect(state.notes).toEqual(createEmptyNotes());
    expect(state.isSaving).toBe(false);
    expect(state.hasSaveError).toBe(false);
    expect(state.failedNote).toBeNull();
  });

  it("loads notes into separate state without touching presentation", () => {
    const presentation = makePresentation("pres-1");
    const before = createInitialEditorNotesState();

    const loaded = editorNotesReducer(before, {
      type: "notes-load-success",
      notes: { bySlideId: { "slide-1": "note" } },
    });

    expect(loaded.status).toBe("ready");
    expect(loaded.notes.bySlideId).toEqual({ "slide-1": "note" });
    expect(presentation).toBe(presentation);
  });

  it("treats a notes load failure as non-fatal to presentation editing", () => {
    const after = editorNotesReducer(createInitialEditorNotesState(), {
      type: "notes-load-error",
    });

    expect(after.status).toBe("error");
    expect(after.notes).toEqual(createEmptyNotes());
  });

  it("resolves an empty note for a missing slide id", () => {
    const notes = createEmptyNotes();

    expect(getNoteForSlide(notes, "")).toBe("");
    expect(getNoteForSlide(notes, "slide-missing")).toBe("");
  });

  it("resolves each selected slide to its own note", () => {
    const notes = {
      bySlideId: { "slide-1": "first", "slide-2": "second" },
    };

    expect(getNoteForSlide(notes, "slide-1")).toBe("first");
    expect(getNoteForSlide(notes, "slide-2")).toBe("second");
  });

  it("switching slides resolves different notes", () => {
    const state = editorNotesReducer(createInitialEditorNotesState(), {
      type: "notes-load-success",
      notes: { bySlideId: { "slide-1": "note a", "slide-2": "note b" } },
    });

    expect(getNoteForSlide(state.notes, "slide-1")).toBe("note a");
    expect(getNoteForSlide(state.notes, "slide-2")).toBe("note b");
  });

  it("editing notes does not mark the canonical presentation dirty", () => {
    const current = makePresentation("pres-1");
    const lastSaved = current;

    expect(isDocumentDirty(current, lastSaved)).toBe(false);

    const notesState = editorNotesReducer(createInitialEditorNotesState(), {
      type: "notes-load-success",
      notes: createEmptyNotes(),
    });
    const edited = editorNotesReducer(notesState, {
      type: "note-edit",
      slideId: "slide-1",
      note: "edited note",
    });

    const saving = editorNotesReducer(edited, {
      type: "note-save-start",
      slideId: "slide-1",
      note: "edited note",
    });

    const saved = editorNotesReducer(saving, {
      type: "note-save-success",
      slideId: "slide-1",
      note: "edited note",
    });

    expect(getNoteForSlide(edited.notes, "slide-1")).toBe("edited note");
    expect(isDocumentDirty(current, lastSaved)).toBe(false);

    expect(getNoteForSlide(saved.notes, "slide-1")).toBe("edited note");
    expect(saved.isSaving).toBe(false);
    expect(saved.hasSaveError).toBe(false);

    expect(current).toBe(lastSaved);
  });

  it("note save failure does not corrupt canonical presentation state", () => {
    const current = makePresentation("pres-1");
    const lastSaved = current;

    expect(isDocumentDirty(current, lastSaved)).toBe(false);

    const notesState = editorNotesReducer(createInitialEditorNotesState(), {
      type: "notes-load-success",
      notes: createEmptyNotes(),
    });

    const edited = editorNotesReducer(notesState, {
      type: "note-edit",
      slideId: "slide-1",
      note: "lost note",
    });

    const saving = editorNotesReducer(edited, {
      type: "note-save-start",
      slideId: "slide-1",
      note: "lost note",
    });

    const failed = editorNotesReducer(saving, {
      type: "note-save-error",
      slideId: "slide-1",
      note: "lost note",
    });

    expect(failed.hasSaveError).toBe(true);
    expect(failed.isSaving).toBe(false);
    expect(failed.failedNote).toEqual({
      slideId: "slide-1",
      note: "lost note",
    });
    expect(isDocumentDirty(current, lastSaved)).toBe(false);
    expect(getNoteForSlide(failed.notes, "slide-1")).toBe("lost note");
  });

  it("successfully saving a note clears a prior save failure", () => {
    const failed = editorNotesReducer(createInitialEditorNotesState(), {
      type: "note-save-error",
      slideId: "slide-1",
      note: "x",
    });

    const retryEdited = editorNotesReducer(failed, {
      type: "note-edit",
      slideId: "slide-1",
      note: "retried",
    });

    const retrying = editorNotesReducer(retryEdited, {
      type: "note-save-start",
      slideId: "slide-1",
      note: "retried",
    });

    const retried = editorNotesReducer(retrying, {
      type: "note-save-success",
      slideId: "slide-1",
      note: "retried",
    });

    expect(retried.hasSaveError).toBe(false);
    expect(retried.failedNote).toBeNull();
    expect(getNoteForSlide(retried.notes, "slide-1")).toBe("retried");
  });

  it("saving an empty note removes the slide note", () => {
    const notesState = editorNotesReducer(createInitialEditorNotesState(), {
      type: "notes-load-success",
      notes: { bySlideId: { "slide-1": "existing" } },
    });
    const edited = editorNotesReducer(notesState, {
      type: "note-edit",
      slideId: "slide-1",
      note: "",
    });

    const clearing = editorNotesReducer(edited, {
      type: "note-save-start",
      slideId: "slide-1",
      note: "",
    });

    const cleared = editorNotesReducer(clearing, {
      type: "note-save-success",
      slideId: "slide-1",
      note: "",
    });

    expect(getNoteForSlide(cleared.notes, "slide-1")).toBe("");
  });
  it("updates a note locally when edited", () => {
    const state = editorNotesReducer(createInitialEditorNotesState(), {
      type: "notes-load-success",
      notes: {
        bySlideId: {
          "slide-1": "old note",
        },
      },
    });

    const edited = editorNotesReducer(state, {
      type: "note-edit",
      slideId: "slide-1",
      note: "new note",
    });

    expect(getNoteForSlide(edited.notes, "slide-1")).toBe("new note");
    expect(edited.isSaving).toBe(false);
  });
});
