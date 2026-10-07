// @vitest-environment jsdom

import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PresentationNotes,
  SlideNotes,
} from "../src/features/persistence/presentation-notes";
import type { PresentationNotesRepository } from "../src/features/persistence/presentation-notes-repository";
import { useEditorNotes } from "../src/features/editor/notes/use-editor-notes";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function NotesHookHarness({
  repository,
  aspectRatio,
}: {
  repository: PresentationNotesRepository;
  aspectRatio: "16:9" | "4:3";
}) {
  const notes = useEditorNotes({
    presentationId: "presentation-1",
    notesRepository: repository,
    selectedSlideId: "slide-1",
    aspectRatio,
    enabled: true,
  });
  const noteRef = useRef(notes);
  noteRef.current = notes;

  return (
    <>
      <output data-status>{notes.status}</output>
      <output data-slide-notes>{JSON.stringify(notes.slideNotes)}</output>
      <button type="button" data-add onClick={notes.onAddPointedNote}>
        add
      </button>
      {notes.slideNotes.pointed.map((pointedNote) => (
        <textarea
          key={pointedNote.id}
          data-pointed-id={pointedNote.id}
          value={pointedNote.text}
          onChange={(event) =>
            noteRef.current.onPointedNoteChange(
              pointedNote.id,
              event.target.value,
            )
          }
        />
      ))}
      {notes.slideNotes.pointed.map((pointedNote) => (
        <button
          key={`remove-${pointedNote.id}`}
          type="button"
          data-remove-id={pointedNote.id}
          onClick={() => notes.onRemovePointedNote(pointedNote.id)}
        >
          remove
        </button>
      ))}
    </>
  );
}

function readSlideNotes(container: HTMLDivElement): SlideNotes {
  const value = container.querySelector("[data-slide-notes]")?.textContent;

  if (!value) throw new Error("expected current slide notes");
  return JSON.parse(value) as SlideNotes;
}

describe("useEditorNotes pointed-note authoring", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("allocates globally unique centered ids and schedules complete add/edit/remove snapshots", async () => {
    const repository: PresentationNotesRepository = {
      getNotes: vi.fn(async (): Promise<PresentationNotes> => ({
        bySlideId: {
          "slide-1": {
            text: "ordinary",
            pointed: [{ id: "pointed-note", text: "old", x: 10, y: 20 }],
          },
          "slide-2": {
            text: "other",
            pointed: [{ id: "pointed-note-2", text: "other", x: 30, y: 40 }],
          },
        },
      })),
      setSlideNotes: vi.fn(async () => undefined),
    };

    act(() =>
      root.render(
        <NotesHookHarness repository={repository} aspectRatio="16:9" />,
      ),
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector("[data-status]")?.textContent).toBe("ready");
    expect(repository.setSlideNotes).not.toHaveBeenCalled();

    act(() =>
      container.querySelector<HTMLButtonElement>("[data-add]")?.click(),
    );

    expect(readSlideNotes(container)).toEqual({
      text: "ordinary",
      pointed: [
        { id: "pointed-note", text: "old", x: 10, y: 20 },
        { id: "pointed-note-3", text: "", x: 480, y: 270 },
      ],
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(repository.setSlideNotes).toHaveBeenLastCalledWith(
      "presentation-1",
      "slide-1",
      readSlideNotes(container),
    );

    vi.mocked(repository.setSlideNotes).mockClear();

    const addedTextarea = container.querySelector<HTMLTextAreaElement>(
      '[data-pointed-id="pointed-note-3"]',
    );
    if (!addedTextarea) throw new Error("expected the added pointed note");

    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(addedTextarea, "edited");
      addedTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(readSlideNotes(container)).toEqual({
      text: "ordinary",
      pointed: [
        { id: "pointed-note", text: "old", x: 10, y: 20 },
        { id: "pointed-note-3", text: "edited", x: 480, y: 270 },
      ],
    });

    act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-remove-id="pointed-note-3"]')
        ?.click(),
    );

    expect(readSlideNotes(container)).toEqual({
      text: "ordinary",
      pointed: [{ id: "pointed-note", text: "old", x: 10, y: 20 }],
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(repository.setSlideNotes).toHaveBeenLastCalledWith(
      "presentation-1",
      "slide-1",
      readSlideNotes(container),
    );
  });

  it("uses the logical center for 4:3 slides", async () => {
    const repository: PresentationNotesRepository = {
      getNotes: vi.fn(async () => ({ bySlideId: {} })),
      setSlideNotes: vi.fn(async () => undefined),
    };

    act(() =>
      root.render(
        <NotesHookHarness repository={repository} aspectRatio="4:3" />,
      ),
    );
    await act(async () => {
      await Promise.resolve();
    });

    act(() =>
      container.querySelector<HTMLButtonElement>("[data-add]")?.click(),
    );

    expect(readSlideNotes(container).pointed).toEqual([
      { id: "pointed-note", text: "", x: 480, y: 360 },
    ]);
  });
});
