// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PresentationSchema, type Presentation, type PresentationElement } from "@web-slideshow/document-schema";
import type { CustomLibraryFontRecord } from "../src/features/custom-library/custom-library-font";
import type { CustomLibraryFontRepository } from "../src/features/custom-library/custom-library-font-repository";
import type { CustomLibraryPaletteRecord, CustomLibraryPaletteRepository } from "../src/features/custom-library/custom-library-palette-repository";
import type { CustomLibraryRepository } from "../src/features/custom-library/custom-library-repository";
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

const paletteRecord: CustomLibraryPaletteRecord = {
  id: "library-warm",
  palette: {
    name: "Warm palette",
    colors: [{ name: "Accent", value: "#facc15" }],
  },
};

const fontRecord: CustomLibraryFontRecord = {
  id: "library-inter",
  font: {
    family: "Inter",
    faces: [{
      weight: 400,
      style: "normal",
      subset: "latin",
      source: { type: "url", url: "https://example.com/inter.woff2" },
    }],
  },
};

function paletteRepository(records: CustomLibraryPaletteRecord[] = [paletteRecord]): CustomLibraryPaletteRepository {
  return {
    savePalette: async () => "unused",
    updatePalette: async () => undefined,
    listPalettes: async () => records,
    getPalette: async () => null,
    deletePalette: async () => undefined,
  };
}

function fontRepository(records: CustomLibraryFontRecord[] = [fontRecord]): CustomLibraryFontRepository {
  return {
    saveFont: async () => "unused",
    updateFont: async () => undefined,
    listFonts: async () => records,
    getFont: async () => null,
    deleteFont: async () => undefined,
  };
}

function elementStyleRepository(): CustomLibraryRepository & { listItems: ReturnType<typeof vi.fn> } {
  return {
    saveItem: async () => "unused",
    listItems: vi.fn(async () => []),
    getItem: async () => null,
    deleteItem: async () => undefined,
  };
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
    resources?: {
      paletteRepository?: CustomLibraryPaletteRepository;
      fontRepository?: CustomLibraryFontRepository;
      elementStyleRepository?: CustomLibraryRepository;
    },
    initialAuthoringTarget: AuthoringTarget = { kind: "root-definition", rootDefinitionId: "root-1" },
  ): void {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            initialPresentation={initialPresentation}
            initialAuthoringTarget={initialAuthoringTarget}
            onSave={onSave}
            notesRepository={notesRepository}
            customLibraryPaletteRepository={resources?.paletteRepository}
            customLibraryFontRepository={resources?.fontRepository}
            customLibraryRepository={resources?.elementStyleRepository}
          />
        </StudioI18nProvider>,
      );
    });
  }

  async function flushResources(): Promise<void> {
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  }

  async function save(onSave: ReturnType<typeof vi.fn>): Promise<Presentation> {
    const saveButton = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Save");
    if (!saveButton) throw new Error("expected Save action");
    await act(async () => saveButton.click());
    const saved = onSave.mock.calls.at(-1)?.[0] as Presentation | undefined;
    if (!saved) throw new Error("expected saved Presentation");
    return structuredClone(saved);
  }

  async function undo(): Promise<void> {
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
  }

  async function redo(): Promise<void> {
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
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

  it("places the master exit immediately before Custom Resources and keeps both actions operational", async () => {
    render();

    const toolbar = containerElement.querySelector<HTMLElement>("[class*='canvasToolbarRight']");
    if (!toolbar) throw new Error("expected canvas toolbar actions");
    const actionLabels = Array.from(toolbar.querySelectorAll<HTMLButtonElement>("button"))
      .map((button) => button.textContent?.trim());
    expect(actionLabels.slice(0, 3)).toEqual(["Exit master editing", "Custom Resources", "Notes"]);

    const resources = Array.from(toolbar.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Custom Resources");
    const exit = Array.from(toolbar.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Exit master editing");
    if (!resources || !exit) throw new Error("expected master toolbar actions");
    await act(async () => resources.click());
    expect(containerElement.textContent).toContain("Root Definitions");
    await act(async () => exit.click());
    expect(containerElement.querySelector('[data-authoring-target="slide"]')).not.toBeNull();
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

  it("authorizes the selected Root Container as a local-content receiver with global Undo/Redo", async () => {
    const source = presentation();
    const onSave = vi.fn(async (_saved: Presentation) => {});
    render(source, onSave);

    const rootContainer = containerElement.querySelector<HTMLElement>('[data-presentation-id="root-container"]');
    if (!rootContainer) throw new Error("expected Root Container in Canvas");
    await act(async () => rootContainer.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const receiver = containerElement.querySelector<HTMLInputElement>("[data-root-local-content-receiver]");
    if (!receiver) throw new Error("expected Root local-content receiver control");
    expect(receiver.checked).toBe(false);

    await act(async () => receiver.click());
    expect(receiver.checked).toBe(true);
    const enabled = await save(onSave);
    expect(enabled.rootDefinitions?.[0]?.localChildTargetIds).toEqual(["root-container"]);
    expect(enabled.rootDefinitions?.[0]?.root).toEqual(source.rootDefinitions?.[0]?.root);

    await undo();
    const undone = await save(onSave);
    expect(undone.rootDefinitions?.[0]).not.toHaveProperty("localChildTargetIds");
    await redo();
    const redone = await save(onSave);
    expect(redone.rootDefinitions?.[0]?.localChildTargetIds).toEqual(["root-container"]);
  });

  it("uses the canonical Inspector checkbox pattern for the Root receiver", async () => {
    render();

    const rootContainer = containerElement.querySelector<HTMLElement>('[data-presentation-id="root-container"]');
    if (!rootContainer) throw new Error("expected Root Container in Canvas");
    await act(async () => rootContainer.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    const checkbox = containerElement.querySelector<HTMLInputElement>("[data-root-local-content-receiver]");
    if (!checkbox) throw new Error("expected receiver checkbox");
    expect(checkbox.parentElement?.className).toContain("checkboxRow");
    expect(checkbox.closest("[class*='field']")).toBeNull();
    expect(checkbox.parentElement?.textContent).toContain("Allow local Slide content");
    expect(containerElement.textContent).toContain("Slides using this Root Definition may place local content inside this Container.");
  });

  it("scopes blocked receiver feedback to the attempted Container", async () => {
    const source = PresentationSchema.parse({
      ...presentation(),
      defaultRootDefinitionId: "root-1",
      rootDefinitions: [{
        id: "root-1",
        name: "Teaching master",
        localChildTargetIds: ["root-container"],
        root: container("root-container", [container("root-child")]),
      }],
      slides: [{
        id: "slide-1",
        title: "Retained",
        elements: [],
        localRootChildren: [{ targetContainerId: "root-container", children: [text("local-child")] }],
      }],
    });
    const before = structuredClone(source);
    render(source);

    const receiver = containerElement.querySelector<HTMLElement>('[data-presentation-id="root-container"]');
    const otherContainer = containerElement.querySelector<HTMLElement>('[data-presentation-id="root-child"]');
    if (!receiver || !otherContainer) throw new Error("expected both Root Containers in Canvas");

    await act(async () => receiver.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const checkbox = containerElement.querySelector<HTMLInputElement>("[data-root-local-content-receiver]");
    if (!checkbox) throw new Error("expected receiver checkbox");
    expect(checkbox.checked).toBe(true);
    await act(async () => checkbox.click());
    expect(containerElement.textContent).toContain("already receives local Slide content");
    expect(checkbox.checked).toBe(true);

    await act(async () => otherContainer.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(containerElement.textContent).not.toContain("already receives local Slide content");
    expect(containerElement.querySelector<HTMLInputElement>("[data-root-local-content-receiver]")?.checked).toBe(false);
    expect(source).toEqual(before);
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

  it("authors local content through the effective Slide tree without writing slide.elements", async () => {
    const source = PresentationSchema.parse({
      ...presentation(),
      slides: [{ id: "slide-1", title: "Root slide", elements: [], rootDefinitionId: "root-1" }, ...presentation().slides.slice(1)],
      rootDefinitions: [{
        id: "root-1",
        name: "Teaching master",
        localChildTargetIds: ["root-container"],
        root: container("root-container", [text("root-text")]),
      }],
    });
    const onSave = vi.fn(async (_saved: Presentation) => {});
    render(source, onSave, undefined, undefined, { kind: "slide", slideIndex: 0 });

    const add = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "+ Add");
    if (!add) throw new Error("expected Add action");
    expect(add.disabled).toBe(true);

    const rootContainer = Array.from(containerElement.querySelectorAll<HTMLElement>('[data-presentation-id="root-container"]')).at(-1);
    if (!rootContainer) throw new Error("expected projected root container");
    await act(async () => rootContainer.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const enabledAdd = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "+ Add");
    if (!enabledAdd) throw new Error("expected Add action after selecting receiver");
    expect(enabledAdd.disabled).toBe(false);
    await act(async () => enabledAdd.click());

    const saveButton = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Save");
    if (!saveButton) throw new Error("expected Save action");
    await act(async () => saveButton.click());
    const saved = onSave.mock.calls.at(-1)?.[0] as Presentation | undefined;
    if (!saved) throw new Error("expected saved Presentation");
    expect(saved.slides[0]!.elements).toEqual([]);
    expect(saved.slides[0]!.localRootChildren?.[0]?.targetContainerId).toBe("root-container");
    expect(saved.slides[0]!.localRootChildren?.[0]?.children).toHaveLength(1);

    const localId = saved.slides[0]!.localRootChildren?.[0]?.children[0]?.id;
    if (!localId) throw new Error("expected saved local element");
    const localNode = containerElement.querySelector<HTMLElement>(`[data-presentation-id="${localId}"]`);
    if (!localNode) throw new Error("expected local element in Canvas");
    await act(async () => localNode.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const textarea = containerElement.querySelector<HTMLTextAreaElement>("#text-content");
    if (!textarea) throw new Error("expected local Text inspector");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(textarea, "Edited local content");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.blur();
    });
    const edited = await save(onSave);
    expect(edited.slides[0]!.elements).toEqual([]);
    expect(edited.slides[0]!.localRootChildren?.[0]?.children[0]).toMatchObject({ content: "Edited local content" });

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    expect(onSave).toHaveBeenCalled();
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
    expect(containerElement.querySelector('[data-presentation-id="root-container"]')).not.toBeNull();

    await act(async () => root.unmount());
    root = createRoot(containerElement);
    render(edited, vi.fn(async () => {}), undefined, undefined, { kind: "slide", slideIndex: 0 });
    expect(containerElement.querySelector('[data-presentation-id="root-container"]')).not.toBeNull();
    expect(containerElement.textContent).toContain("Edited local content");
    expect(edited.slides[0]!.elements).toEqual([]);
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
    expect(newSlide?.disabled).toBe(false);
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

  it("keeps Notes unavailable but allows Resources without touching the notes repository", () => {
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
    expect(resources?.disabled).toBe(false);

    act(() => {
      notes?.click();
      resources?.click();
    });
    expect(containerElement.textContent).not.toContain("Speaker notes");
    expect(containerElement.querySelector('[aria-label="Custom Resources"]')).not.toBeNull();
    expect(containerElement.querySelector('[aria-label="Custom Resources"] button[disabled]'))
      .not.toBeNull();
    expect(getNotes.mock.calls.flat()).not.toContain(
      "root-definition-workspace:root-1",
    );
    expect(setSlideNote).not.toHaveBeenCalled();
  });

  it("commits a Root Presentation palette mutation with exact Undo/Redo", async () => {
    const source = presentation();
    const onSave = vi.fn(async (_saved: Presentation) => {});
    render(source, onSave);

    const resources = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Custom Resources");
    if (!resources) throw new Error("expected Custom Resources action");
    await act(async () => resources.click());

    const addColor = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "+ Add to Presentation");
    if (!addColor) throw new Error("expected Presentation palette add action");
    await act(async () => addColor.click());

    const name = containerElement.querySelector<HTMLInputElement>("[data-presentation-color-name-input]");
    if (!name) throw new Error("expected Presentation palette name input");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("expected HTMLInputElement.value setter");
    await act(async () => {
      setter.call(name, "Root Accent");
      name.dispatchEvent(new Event("input", { bubbles: true }));
      name.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const add = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Add");
    if (!add) throw new Error("expected Presentation palette commit action");
    await act(async () => add.click());

    const changed = await save(onSave);
    expect(changed.palette?.colors.map(({ name: colorName }) => colorName)).toContain("Root Accent");
    expect(changed.slides).toEqual(source.slides);
    expect(changed.rootDefinitions).toEqual(source.rootDefinitions);

    await undo();
    expect(await save(onSave)).toEqual(source);
    await redo();
    expect(await save(onSave)).toEqual(changed);
  });

  it("imports a Root Custom Library Palette without mutating the retained Slide", async () => {
    const source = presentation();
    const onSave = vi.fn(async (_saved: Presentation) => {});
    render(source, onSave, undefined, { paletteRepository: paletteRepository() });

    const resources = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Custom Resources");
    if (!resources) throw new Error("expected Custom Resources action");
    await act(async () => resources.click());
    const addPalette = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "+ Add palette");
    if (!addPalette) throw new Error("expected Custom Library palette action");
    await act(async () => addPalette.click());
    await flushResources();

    const importPalette = containerElement.querySelector<HTMLButtonElement>("[aria-label='Add Warm palette']");
    if (!importPalette) throw new Error("expected Custom Library palette import action");
    await act(async () => importPalette.click());

    const changed = await save(onSave);
    expect(changed.palette?.colors).toHaveLength(1);
    expect(changed.palette?.colors[0]?.name).toBe("Accent");
    expect(changed.slides).toEqual(source.slides);
    expect(changed.rootDefinitions).toEqual(source.rootDefinitions);

    await undo();
    expect(await save(onSave)).toEqual(source);
    await redo();
    expect(await save(onSave)).toEqual(changed);
  });

  it("imports a Root Custom Library Font with exact Undo/Redo and retained Slide safety", async () => {
    const source = presentation();
    const onSave = vi.fn(async (_saved: Presentation) => {});
    render(source, onSave, undefined, { fontRepository: fontRepository() });

    const resources = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Custom Resources");
    if (!resources) throw new Error("expected Custom Resources action");
    await act(async () => resources.click());
    const addFont = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "+ Add font");
    if (!addFont) throw new Error("expected Custom Library font action");
    await act(async () => addFont.click());
    await flushResources();

    const importFont = containerElement.querySelector<HTMLButtonElement>("[aria-label='Add Inter']");
    if (!importFont) throw new Error("expected Custom Library font import action");
    await act(async () => importFont.click());

    const changed = await save(onSave);
    expect(changed.resources?.fonts?.map(({ family }) => family)).toEqual(["Inter"]);
    expect(changed.slides).toEqual(source.slides);
    expect(changed.rootDefinitions).toEqual(source.rootDefinitions);

    await undo();
    expect(await save(onSave)).toEqual(source);
    await redo();
    expect(await save(onSave)).toEqual(changed);
  });

  it("blocks the Root Element Style workflow at its actual Resources control", async () => {
    const repository = elementStyleRepository();
    render(presentation(), vi.fn(), undefined, { elementStyleRepository: repository });

    const resources = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Custom Resources");
    if (!resources) throw new Error("expected Custom Resources action");
    await act(async () => resources.click());

    const browse = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "+ Add saved element");
    if (!browse) throw new Error("expected Element Style browse control");
    expect(browse.disabled).toBe(true);
    await act(async () => browse.click());
    expect(repository.listItems).not.toHaveBeenCalled();
    expect(containerElement.querySelector("[data-custom-library-apply]")).toBeNull();
  });

  it("allows descendant Cut/Paste while keeping the canonical Root boundary protected", async () => {
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

    expect(save.disabled).toBe(false);
    expect(containerElement.querySelector(".studio-editor-pending-cut")).toBeNull();
    expect(containerElement.querySelector('[data-presentation-id="root-text"]')).toBeNull();
    expect(containerElement.querySelector('[data-presentation-id="root-text-copy"]')).not.toBeNull();
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

  it("selects Root Definition descendants with Canvas drag and resize affordances", () => {
    render();

    const rootImage = containerElement.querySelector<HTMLElement>('[data-presentation-id="root-image"]');
    if (!rootImage) throw new Error("expected absolutely positioned Root Definition image");
    act(() => rootImage.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    expect(rootImage.classList.contains("studio-editor-draggable")).toBe(true);
    expect(containerElement.querySelector("[class*='canvasResizeOverlay']")).not.toBeNull();
    expect(containerElement.textContent).toContain("root-image");
    expect(containerElement.textContent).not.toContain("Master content is read-only in this workspace.");
    expect(containerElement.querySelector("#image-src")).not.toBeNull();
  });

  it("mounts the normal Root Container Inspector while preserving structural guards", () => {
    render();

    const rootContainer = containerElement.querySelector<HTMLElement>('[data-presentation-id="root-container"]');
    if (!rootContainer) throw new Error("expected Root Definition Container in Canvas");
    act(() => rootContainer.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    expect(containerElement.textContent).not.toContain("Master content is read-only in this workspace.");
    expect(containerElement.querySelector("#container-direction")).not.toBeNull();
    expect(containerElement.querySelector('button[aria-label="Move up"]')).toBeNull();
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
