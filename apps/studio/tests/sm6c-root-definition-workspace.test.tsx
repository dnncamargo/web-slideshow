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

  it("mounts the normal Inspector for safe Root Definition Text editing", () => {
    const source = presentation();
    render(source);

    const rootText = containerElement.querySelector<HTMLElement>('[data-presentation-id="root-text"]');
    if (!rootText) throw new Error("expected Root Definition text in Canvas");
    act(() => rootText.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    expect(containerElement.textContent).toContain("root-text");
    expect(containerElement.querySelector<HTMLTextAreaElement>("#text-content")).not.toBeNull();
    expect(containerElement.textContent).not.toContain("Master content is read-only in this workspace.");
    expect(containerElement.querySelector('button[aria-label="Move up"]')).toBeNull();
    expect(containerElement.querySelector('button[aria-label="Move down"]')).toBeNull();
    expect(source.slides).toHaveLength(2);
  });

  it("edits, saves, undoes, redoes, and remounts canonical Root Definition Text", async () => {
    const source = presentation();
    const onSave = vi.fn(async (_saved: Presentation) => {});
    render(source, onSave);

    const rootText = containerElement.querySelector<HTMLElement>('[data-presentation-id="root-text"]');
    if (!rootText) throw new Error("expected Root Definition text in Canvas");
    act(() => rootText.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const textarea = containerElement.querySelector<HTMLTextAreaElement>("#text-content");
    if (!textarea) throw new Error("expected Root Definition Text content control");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => {
      textarea.focus();
      setter.call(textarea, "Edited root content");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      setter.call(textarea, "Edited root content again");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.blur();
    });

    expect(textarea.value).toBe("Edited root content again");
    expect(containerElement.querySelector<HTMLElement>('[data-presentation-id="root-text"]')?.textContent).toContain("Edited root content again");

    const save = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Save");
    if (!save) throw new Error("expected Save action");
    expect(save.disabled).toBe(false);
    await act(async () => save.click());
    expect(onSave).toHaveBeenCalledTimes(1);

    const saved = onSave.mock.calls[0]?.[0];
    if (!saved) throw new Error("expected saved Presentation");
    expect(saved.rootDefinitions?.[0]?.root.id).toBe("root-container");
    expect(saved.rootDefinitions?.[0]?.root.children[0]).toMatchObject({ id: "root-text", content: "Edited root content again" });
    expect(saved.slides).toEqual(source.slides);
    expect(saved.slides).toHaveLength(2);
    expect(JSON.stringify(saved)).not.toContain("root-definition-workspace:");
    expect(source.slides).toEqual(presentation().slides);

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    expect(containerElement.querySelector<HTMLTextAreaElement>("#text-content")?.value).toBe("Master content");
    expect(containerElement.querySelector('[data-presentation-id="root-text"]')).not.toBeNull();

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
    expect(containerElement.querySelector<HTMLTextAreaElement>("#text-content")?.value).toBe("Edited root content again");
    expect(containerElement.querySelector('[data-presentation-id="root-text"]')).not.toBeNull();

    const exit = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Exit master editing");
    if (!exit) throw new Error("expected explicit master exit action");
    act(() => exit.click());
    expect(containerElement.querySelector('[data-presentation-id="slide-text"]')).not.toBeNull();
    expect(containerElement.querySelector('[data-presentation-id="root-text"]')).toBeNull();

    await act(async () => root.unmount());
    root = createRoot(containerElement);
    render(saved, vi.fn(async () => {}));
    expect(containerElement.querySelector('[data-authoring-target="root-definition"]')).not.toBeNull();
    expect(containerElement.querySelector('[data-presentation-id="root-text"]')?.textContent).toContain("Edited root content again");
  });

  it("captures discrete Root Definition Text writes on the active target", async () => {
    render();

    const rootText = containerElement.querySelector<HTMLElement>('[data-presentation-id="root-text"]');
    if (!rootText) throw new Error("expected Root Definition text in Canvas");
    act(() => rootText.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const variant = containerElement.querySelector<HTMLSelectElement>("#text-variant");
    if (!variant) throw new Error("expected Text variant control");
    await act(async () => {
      variant.value = "title";
      variant.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(variant.value).toBe("title");

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    expect(containerElement.querySelector<HTMLSelectElement>("#text-variant")?.value).toBe("body");
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
    expect(containerElement.querySelector<HTMLSelectElement>("#text-variant")?.value).toBe("title");
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

    const save = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Save");
    if (!save) throw new Error("expected Save action");
    expect(save.disabled).toBe(true);

    const rootText = containerElement.querySelector<HTMLElement>('[data-presentation-id="root-text"]');
    if (!rootText) throw new Error("expected Root Definition text in Canvas");
    act(() => rootText.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    for (const event of [
      new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true }),
      new KeyboardEvent("keydown", { key: "c", ctrlKey: true, bubbles: true, cancelable: true }),
      new KeyboardEvent("keydown", { key: "x", ctrlKey: true, bubbles: true, cancelable: true }),
      new KeyboardEvent("keydown", { key: "v", ctrlKey: true, bubbles: true, cancelable: true }),
    ]) {
      await act(async () => window.dispatchEvent(event));
    }

    expect(save.disabled).toBe(true);
    expect(containerElement.querySelector(".studio-editor-pending-cut")).toBeNull();
    expect(containerElement.querySelector('[data-presentation-id="root-text"]')).not.toBeNull();
    expect(containerElement.querySelector('[data-presentation-id="root-image"]')).not.toBeNull();
    expect(containerElement.querySelector('[data-presentation-id="slide-text"]')).toBeNull();
    expect(source.slides).toHaveLength(2);
    expect(source.rootDefinitions?.[0]?.root.children).toHaveLength(3);

    const exit = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Exit master editing");
    if (!exit) throw new Error("expected explicit master exit action");
    act(() => exit.click());
    expect(containerElement.querySelector('[data-presentation-id="slide-text"]')).not.toBeNull();
    expect(containerElement.querySelector('[data-presentation-id="root-text"]')).toBeNull();
    expect(containerElement.textContent).not.toContain("Master content");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("selects Root Definition geometry without exposing drag or resize affordances", () => {
    render();

    const rootImage = containerElement.querySelector<HTMLElement>('[data-presentation-id="root-image"]');
    if (!rootImage) throw new Error("expected absolutely positioned Root Definition image");
    act(() => rootImage.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    expect(rootImage.classList.contains("studio-editor-draggable")).toBe(false);
    expect(containerElement.querySelector("[class*='canvasResizeOverlay']")).toBeNull();
    expect(containerElement.textContent).toContain("root-image");
    expect(containerElement.textContent).toContain("Master content is read-only in this workspace.");
    expect(containerElement.querySelector("#image-src")).toBeNull();
  });

  it("keeps the Root Container Inspector read-only", () => {
    render();

    const rootContainer = containerElement.querySelector<HTMLElement>('[data-presentation-id="root-container"]');
    if (!rootContainer) throw new Error("expected Root Definition Container in Canvas");
    act(() => rootContainer.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    expect(containerElement.textContent).toContain("Master content is read-only in this workspace.");
    expect(containerElement.querySelector("#container-direction")).toBeNull();
  });

  it("allows descendant Tree movement while preserving Root Definition ownership", async () => {
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

    const rootOrder = () => Array.from(
      containerElement.querySelectorAll<HTMLElement>("[class*='slideCanvas'] [data-presentation-id]"),
    )
      .map((element) => element.dataset.presentationId)
      .filter((id): id is string => id === "root-text" || id === "root-image" || id === "root-text-2");
    expect(rootOrder()).toEqual(["root-text", "root-image", "root-text-2"]);

    const moveDown = containerElement.querySelector<HTMLButtonElement>('button[aria-label="Move down"]');
    if (!moveDown) throw new Error("expected Tree move action");
    expect(moveDown.disabled).toBe(false);
    act(() => moveDown.click());

    const save = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Save");
    if (!save) throw new Error("expected Save action");
    expect(rootOrder()).toEqual(["root-image", "root-text", "root-text-2"]);
    expect(save.disabled).toBe(false);
    act(() => save.click());
    expect(onSave).toHaveBeenCalledTimes(1);
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
