import { describe, expect, it } from "vitest";

import type { Presentation } from "@web-slideshow/document-schema";

import {
  createEmptyNotes,
  type SlideNotes,
} from "../src/features/persistence/presentation-notes";
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

function slideNotes(
  text = "",
  pointed: SlideNotes["pointed"] = [],
): SlideNotes {
  return { text, pointed };
}

describe("editor private notes state", () => {
  it("starts idle with empty notes", () => {
    const state = createInitialEditorNotesState();

    expect(state.status).toBe("idle");
    expect(state.notes).toEqual(createEmptyNotes());
    expect(state.isSaving).toBe(false);
    expect(state.failedSlideIds).toEqual([]);
  });

  it("loads normalized notes into separate state without touching presentation", () => {
    const presentation = makePresentation("pres-1");
    const loaded = editorNotesReducer(createInitialEditorNotesState(), {
      type: "notes-load-success",
      notes: { bySlideId: { "slide-1": slideNotes("note") } },
    });

    expect(loaded.status).toBe("ready");
    expect(loaded.notes.bySlideId["slide-1"]).toEqual(slideNotes("note"));
    expect(presentation).toBe(presentation);
  });

  it("treats a notes load failure as non-fatal to presentation editing", () => {
    const after = editorNotesReducer(createInitialEditorNotesState(), {
      type: "notes-load-error",
    });

    expect(after.status).toBe("error");
    expect(after.notes).toEqual(createEmptyNotes());
  });

  it("resolves ordinary text for missing, selected, and rich slides", () => {
    const notes = {
      bySlideId: {
        "slide-1": slideNotes("first"),
        "slide-2": slideNotes("second", [
          { id: "pointed-1", text: "marker", x: 1, y: 2 },
        ]),
      },
    };

    expect(getNoteForSlide(notes, "")).toBe("");
    expect(getNoteForSlide(notes, "slide-missing")).toBe("");
    expect(getNoteForSlide(notes, "slide-1")).toBe("first");
    expect(getNoteForSlide(notes, "slide-2")).toBe("second");
  });

  it("editing ordinary text preserves pointed entries", () => {
    const state = editorNotesReducer(createInitialEditorNotesState(), {
      type: "notes-load-success",
      notes: {
        bySlideId: {
          "slide-1": slideNotes("old", [
            { id: "pointed-1", text: "keep", x: 10, y: 20 },
          ]),
        },
      },
    });

    const edited = editorNotesReducer(state, {
      type: "slide-notes-edit",
      slideId: "slide-1",
      slideNotes: slideNotes("new", [
        { id: "pointed-1", text: "keep", x: 10, y: 20 },
      ]),
    });

    expect(edited.notes.bySlideId["slide-1"]).toEqual({
      text: "new",
      pointed: [{ id: "pointed-1", text: "keep", x: 10, y: 20 }],
    });
  });

  it("editing notes does not mark the canonical presentation dirty", () => {
    const current = makePresentation("pres-1");
    const notesState = editorNotesReducer(createInitialEditorNotesState(), {
      type: "notes-load-success",
      notes: createEmptyNotes(),
    });
    const edited = editorNotesReducer(notesState, {
      type: "slide-notes-edit",
      slideId: "slide-1",
      slideNotes: slideNotes("edited note"),
    });
    const saving = editorNotesReducer(edited, {
      type: "note-save-start",
      slideId: "slide-1",
      slideNotes: slideNotes("edited note"),
    });
    const saved = editorNotesReducer(saving, {
      type: "note-save-success",
      slideId: "slide-1",
      slideNotes: slideNotes("edited note"),
    });

    expect(getNoteForSlide(saved.notes, "slide-1")).toBe("edited note");
    expect(saved.failedSlideIds).toEqual([]);
    expect(isDocumentDirty(current, current)).toBe(false);
  });

  it("tracks save failures and clears them after a successful retry", () => {
    const state = createInitialEditorNotesState();
    const failed = editorNotesReducer(state, {
      type: "note-save-error",
      slideId: "slide-1",
      slideNotes: slideNotes("lost note"),
    });
    const retrying = editorNotesReducer(failed, {
      type: "note-save-start",
      slideId: "slide-1",
      slideNotes: slideNotes("retried"),
    });
    const retried = editorNotesReducer(retrying, {
      type: "note-save-success",
      slideId: "slide-1",
      slideNotes: slideNotes("retried"),
    });

    expect(failed.failedSlideIds).toEqual(["slide-1"]);
    expect(retried.failedSlideIds).toEqual([]);
    expect(retried.isSaving).toBe(false);
  });

  it("keeps pointed entries when ordinary text is cleared", () => {
    const state = editorNotesReducer(createInitialEditorNotesState(), {
      type: "notes-load-success",
      notes: {
        bySlideId: {
          "slide-1": slideNotes("existing", [
            { id: "pointed-1", text: "keep", x: 1, y: 2 },
          ]),
        },
      },
    });
    const cleared = editorNotesReducer(state, {
      type: "slide-notes-edit",
      slideId: "slide-1",
      slideNotes: slideNotes("", [
        { id: "pointed-1", text: "keep", x: 1, y: 2 },
      ]),
    });

    expect(cleared.notes.bySlideId["slide-1"]).toEqual({
      text: "",
      pointed: [{ id: "pointed-1", text: "keep", x: 1, y: 2 }],
    });
  });
});
