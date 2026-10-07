// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SlideNotes } from "../src/features/persistence/presentation-notes";
import { SlideNotesWorkspace } from "../src/features/editor/notes/slide-notes-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function ControlledNotes({
  initialSlideNotes = { text: "", pointed: [] },
  status = "ready",
}: {
  initialSlideNotes?: SlideNotes;
  status?: "idle" | "loading" | "error" | "ready";
}) {
  const [slideNotes, setSlideNotes] = useState(initialSlideNotes);

  return (
    <StudioI18nProvider>
      <SlideNotesWorkspace
        slideNotes={slideNotes}
        note={slideNotes.text}
        status={status}
        hasCurrentSaveError={false}
        onChange={(text) => setSlideNotes((current) => ({ ...current, text }))}
        onAddPointedNote={() =>
          setSlideNotes((current) => ({
            ...current,
            pointed: [
              ...current.pointed,
              {
                id: `pointed-note-${current.pointed.length + 1}`,
                text: "",
                x: 480,
                y: 270,
              },
            ],
          }))
        }
        onPointedNoteChange={(id, text) =>
          setSlideNotes((current) => ({
            ...current,
            pointed: current.pointed.map((pointedNote) =>
              pointedNote.id === id ? { ...pointedNote, text } : pointedNote,
            ),
          }))
        }
        onRemovePointedNote={(id) =>
          setSlideNotes((current) => ({
            ...current,
            pointed: current.pointed.filter(
              (pointedNote) => pointedNote.id !== id,
            ),
          }))
        }
      />
    </StudioI18nProvider>
  );
}

describe("SlideNotesWorkspace", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("renders the ordinary note and authors ordered pointed entries", () => {
    act(() => root.render(<ControlledNotes />));

    expect(container.querySelector("textarea")?.placeholder).toBe(
      "Write private notes for this slide…",
    );
    expect(container.textContent).toContain("No pointed notes.");
    expect(container.textContent).not.toContain("[1]");

    const addButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "+ Add pointed note",
    );
    if (!addButton) throw new Error("expected the Add pointed note button");

    act(() => addButton.click());
    act(() => addButton.click());

    expect(container.textContent).toContain("[1]");
    expect(container.textContent).toContain("[2]");
    expect(container.querySelectorAll("textarea")).toHaveLength(3);
  });

  it("edits pointed text and renumbers survivors without changing their ids", () => {
    act(() =>
      root.render(
        <ControlledNotes
          initialSlideNotes={{
            text: "ordinary",
            pointed: [
              { id: "pointed-note-1", text: "first", x: 480, y: 270 },
              { id: "pointed-note-2", text: "second", x: 480, y: 270 },
            ],
          }}
        />,
      ),
    );

    const pointedTextareas = () =>
      Array.from(
        container.querySelectorAll<HTMLTextAreaElement>("textarea"),
      ).slice(1);
    const secondTextarea = pointedTextareas()[1];
    if (!secondTextarea)
      throw new Error("expected the second pointed textarea");

    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(secondTextarea, "edited second");
      secondTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(pointedTextareas()[1]?.value).toBe("edited second");

    const removeButtons = Array.from(
      container.querySelectorAll("button"),
    ).filter((button) =>
      button.getAttribute("aria-label")?.startsWith("Remove pointed note"),
    );
    const firstRemoveButton = removeButtons[0];
    if (!firstRemoveButton) throw new Error("expected the first remove button");

    act(() => firstRemoveButton.click());

    expect(container.textContent).toContain("[1]");
    expect(container.textContent).not.toContain("[2]");
    expect(pointedTextareas()[0]?.value).toBe("edited second");
    expect(container.querySelector("[data-pointed-note-marker]")).toBeNull();
  });

  it("disables all notes controls while notes are not ready", () => {
    act(() => root.render(<ControlledNotes status="loading" />));

    expect(container.querySelector("textarea")?.disabled).toBe(true);
    const addButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "+ Add pointed note",
    );
    expect(addButton?.disabled).toBe(true);
  });
});
