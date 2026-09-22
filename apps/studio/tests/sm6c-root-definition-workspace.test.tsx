// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PresentationSchema, type Presentation, type PresentationElement } from "@web-slideshow/document-schema";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { reconcileSelectedElementAfterReplay } from "../src/features/editor/editor-history-selection-reconciliation";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import type { AuthoringTarget } from "../src/features/editor/authoring-target";
import type { PresentationNotesRepository } from "../src/features/persistence/presentation-notes-repository";
import type { PresentationNotes } from "../src/features/persistence/presentation-notes";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function text(id: string, content = id): Extract<PresentationElement, { type: "text" }> {
  return { id, type: "text", hidden: false, variant: "body", content };
}

function image(id: string): Extract<PresentationElement, { type: "image" }> {
  return {
    id,
    type: "image",
    hidden: false,
    src: "/root-image.png",
    alt: "Root image",
    fit: "contain",
    layout: { position: "absolute", left: "40px", top: "40px", width: "240px", height: "80px" },
  };
}

function container(id: string, children: PresentationElement[] = []): Extract<PresentationElement, { type: "container" }> {
  return { id, type: "container", hidden: false, children };
}

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "sm6c-presentation",
    title: "SM6C",
    slides: [
      { id: "slide-1", title: "Retained", elements: [text("slide-text", "Slide content")] },
      { id: "slide-2", title: "Second", elements: [] },
    ],
    rootDefinitions: [{
      id: "root-1",
      name: "Teaching master",
      root: container("root-container", [
        text("root-text", "Master content"),
        image("root-image"),
        text("root-text-2", "Master content 2"),
      ]),
    }],
  });
}

describe("SM6C Root Definition workspace shell", () => {
  let containerElement: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    containerElement = document.createElement("div");
    document.body.appendChild(containerElement);
    root = createRoot(containerElement);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  function render(
    initialPresentation = presentation(),
    onSave = vi.fn(),
    notesRepository?: PresentationNotesRepository,
  ): void {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            initialPresentation={initialPresentation}
            initialAuthoringTarget={{ kind: "root-definition", rootDefinitionId: "root-1" }}
            onSave={onSave}
            notesRepository={notesRepository}
          />
        </StudioI18nProvider>,
      );
    });
  }

  it("renders the existing Root Definition projection without adding a Slide", () => {
    const source = presentation();
    render(source);

    expect(containerElement.querySelector('[data-authoring-target="root-definition"]')).not.toBeNull();
    expect(containerElement.textContent).toContain("Master slide · Teaching master");
    expect(containerElement.querySelector('[data-presentation-id="root-container"]')).not.toBeNull();
    expect(containerElement.querySelector('[data-presentation-id="root-text"]')).not.toBeNull();
    expect(containerElement.querySelector('[data-presentation-id="slide-text"]')).toBeNull();
    expect(source.slides).toHaveLength(2);
    expect(JSON.stringify(source)).not.toContain("root-definition-workspace:");
  });

  it("keeps Root Definition selection and Inspector read-only", () => {
    const source = presentation();
    render(source);

    const rootText = containerElement.querySelector<HTMLElement>('[data-presentation-id="root-text"]');
    if (!rootText) throw new Error("expected Root Definition text in Canvas");
    act(() => rootText.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    expect(containerElement.textContent).toContain("root-text");
    expect(containerElement.querySelector('input[type="text"]')).toBeNull();
    expect(containerElement.textContent).toContain("Master content is read-only in this workspace.");
    expect(source.slides).toHaveLength(2);
  });

  it("locks Slide navigation and destructive workspace actions in Root Definition mode", () => {
    const source = presentation();
    render(source);

    const retainedSlide = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Retained"));
    expect(retainedSlide?.disabled).toBe(true);
    const newSlide = containerElement.querySelector<HTMLButtonElement>("button[aria-expanded]");
    expect(newSlide?.disabled).toBe(true);
    expect(containerElement.textContent).not.toContain("Duplicate element");

    act(() => retainedSlide?.click());
    expect(containerElement.querySelector('[data-authoring-target="root-definition"]')).not.toBeNull();
    expect(containerElement.querySelector('[data-presentation-id="root-text"]')).not.toBeNull();
    expect(source.slides).toHaveLength(2);
  });

  it("explicitly exits to the retained Slide without saving or changing Presentation", () => {
    const source = presentation();
    const onSave = vi.fn();
    render(source, onSave);

    const exit = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Exit master editing");
    if (!exit) throw new Error("expected explicit master exit action");
    act(() => exit.click());

    expect(containerElement.querySelector('[data-authoring-target="slide"]')).not.toBeNull();
    expect(containerElement.querySelector('[data-presentation-id="slide-text"]')).not.toBeNull();
    expect(containerElement.querySelector('[data-presentation-id="root-text"]')).toBeNull();
    expect(containerElement.textContent).not.toContain("Master slide · Teaching master");
    expect(source.slides).toHaveLength(2);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps Notes and Resources unavailable without touching the notes repository", () => {
    const getNotes = vi.fn(() => new Promise<PresentationNotes>(() => {}));
    const setSlideNote = vi.fn(async () => {});
    const notesRepository: PresentationNotesRepository = {
      getNotes,
      setSlideNote,
    };
    render(presentation(), vi.fn(), notesRepository);

    const notes = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Notes");
    const resources = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Custom Resources");
    expect(notes?.disabled).toBe(true);
    expect(resources?.disabled).toBe(true);

    act(() => {
      notes?.click();
      resources?.click();
    });
    expect(containerElement.textContent).not.toContain("Speaker notes");
    expect(containerElement.textContent).not.toContain("Custom Resources workspace");
    expect(getNotes.mock.calls.flat()).not.toContain(
      "root-definition-workspace:root-1",
    );
    expect(setSlideNote).not.toHaveBeenCalled();
  });

  it("blocks Delete, Cut, and Paste without changing either canonical tree", async () => {
    const source = presentation();
    const onSave = vi.fn(async () => {});
    render(source, onSave);

    const rootText = containerElement.querySelector<HTMLElement>('[data-presentation-id="root-text"]');
    if (!rootText) throw new Error("expected Root Definition text in Canvas");
    act(() => rootText.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    for (const event of [
      new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true }),
      new KeyboardEvent("keydown", { key: "x", ctrlKey: true, bubbles: true, cancelable: true }),
      new KeyboardEvent("keydown", { key: "v", ctrlKey: true, bubbles: true, cancelable: true }),
    ]) {
      await act(async () => window.dispatchEvent(event));
    }

    expect(onSave).not.toHaveBeenCalled();
    expect(containerElement.querySelector('[data-presentation-id="root-text"]')).not.toBeNull();
    expect(containerElement.querySelector('[data-presentation-id="root-image"]')).not.toBeNull();
    expect(containerElement.querySelector('[data-presentation-id="slide-text"]')).toBeNull();
    expect(source.slides).toHaveLength(2);
    expect(source.rootDefinitions?.[0]?.root.children).toHaveLength(3);
  });

  it("selects Root Definition geometry without exposing drag or resize affordances", () => {
    render();

    const rootImage = containerElement.querySelector<HTMLElement>('[data-presentation-id="root-image"]');
    if (!rootImage) throw new Error("expected absolutely positioned Root Definition image");
    act(() => rootImage.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    expect(rootImage.classList.contains("studio-editor-draggable")).toBe(false);
    expect(containerElement.querySelector("[class*='canvasResizeOverlay']")).toBeNull();
    expect(containerElement.textContent).toContain("root-image");
  });

  it("blocks the existing Tree move action at the Root Definition boundary", async () => {
    const source = presentation();
    const onSave = vi.fn(async () => {});
    render(source, onSave);

    const elementsTab = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Elements");
    if (!elementsTab) throw new Error("expected Elements tab");
    act(() => elementsTab.click());

    const rootText = containerElement.querySelector<HTMLElement>('[data-presentation-id="root-text"]');
    if (!rootText) throw new Error("expected Root Definition text in Canvas");
    act(() => rootText.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const moveDown = containerElement.querySelector<HTMLButtonElement>('button[aria-label="Move down"]');
    if (!moveDown) throw new Error("expected Tree move action");
    expect(moveDown.disabled).toBe(false);
    act(() => moveDown.click());

    expect(onSave).not.toHaveBeenCalled();
    expect(source.slides).toHaveLength(2);
    expect(source.rootDefinitions?.[0]?.root.children).toHaveLength(3);
  });

  it("reconciles history selection against the active Root Definition tree", () => {
    const source = presentation();
    const target: AuthoringTarget = { kind: "root-definition", rootDefinitionId: "root-1" };

    expect(reconcileSelectedElementAfterReplay(
      { id: "root-text", type: "text", contentSlotId: null },
      source,
      target,
    )).toEqual({ id: "root-text", type: "text", contentSlotId: null });
    expect(reconcileSelectedElementAfterReplay(
      { id: "slide-text", type: "text", contentSlotId: null },
      source,
      target,
    )).toBeNull();
    expect(reconcileSelectedElementAfterReplay(
      { id: "root-text", type: "text", contentSlotId: null },
      source,
      { kind: "root-definition", rootDefinitionId: "missing" },
    )).toBeNull();
  });
});
