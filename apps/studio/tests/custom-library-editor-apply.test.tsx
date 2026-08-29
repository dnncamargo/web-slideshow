// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PresentationSchema,
  type FontFaceResource,
  type PowerShowElement,
  type Presentation,
} from "@powershow/document-schema";
import { paletteColorCssVariableName } from "@powershow/renderer";

import type {
  CustomLibraryItemRecord,
  CustomLibraryRepository,
} from "../src/features/custom-library/custom-library-repository";
import type {
  CustomLibraryPaletteRecord,
  CustomLibraryPaletteRepository,
} from "../src/features/custom-library/custom-library-palette-repository";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function text(id: string, content: string): PowerShowElement {
  return { type: "text", id, hidden: false, variant: "body", content };
}

function image(id: string): PowerShowElement {
  return {
    type: "image",
    id,
    hidden: false,
    src: `/assets/${id}.png`,
    alt: id,
    fit: "contain",
  };
}

function setInputValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
}

function container(id: string, children: PowerShowElement[]): PowerShowElement {
  return { type: "container", id, hidden: false, children };
}

const textRecipe = {
  type: "text" as const,
  properties: [{ path: "content", value: "Applied text" }],
};
const imageRecipe = { type: "image" as const, properties: [] };
const containerRecipe = {
  type: "container" as const,
  properties: [],
  children: [{ type: "text" as const, properties: [{ path: "content", value: "Library child" }] }],
};
const chartRecipe = { type: "chart" as const, properties: [] };

const firaFace: FontFaceResource = {
  weight: 400,
  style: "normal",
  subset: "latin",
  source: { type: "url", url: "https://example.com/fira-code.woff2", format: "woff2" },
};

const firaStyleItem: CustomLibraryItemRecord = {
  id: "fira-style-item",
  item: {
    name: "Fira Code style",
    root: {
      type: "text",
      properties: [
        { path: "content", value: "Fira Code applied" },
        { path: "typography.fontFamily", value: "Fira Code" },
      ],
    },
    dependencies: { fonts: [{ family: "Fira Code", faces: [firaFace] }] },
  },
};

const items: CustomLibraryItemRecord[] = [
  { id: "text-item", item: { name: "Text preset", root: textRecipe } },
  { id: "image-item", item: { name: "Image preset", root: imageRecipe } },
  { id: "container-item", item: { name: "Container composition", root: containerRecipe } },
  { id: "chart-item", item: { name: "Chart preset", root: chartRecipe } },
];

function topicsElement(): PowerShowElement {
  return {
    type: "topics",
    id: "topics-1",
    hidden: false,
    kind: "unordered",
    items: [{
      id: "topic-1",
      content: { id: "slot-1", children: [text("topic-text", "Topic content")] },
      children: [],
    }],
  };
}

function makePresentation(
  elements: PowerShowElement[],
  secondSlide = false,
  fonts?: NonNullable<Presentation["resources"]>["fonts"],
): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "custom-library-editor-apply",
    title: "Custom Library integration",
    description: "",
    aspectRatio: "16:9",
    slides: [
      {
        id: "slide-1",
        title: "First",
        summary: "",
        speakerNotes: "",
        elements,
      },
      ...(secondSlide
        ? [{ id: "slide-2", title: "Second", summary: "", speakerNotes: "", elements: [text("second-root", "Untouched")] }]
        : []),
    ],
    ...(fonts ? { resources: { fonts } } : {}),
  });
}

function fakeRepository(listItems: () => Promise<CustomLibraryItemRecord[]>): CustomLibraryRepository {
  return {
    saveItem: async () => "saved",
    listItems,
    getItem: async () => null,
    deleteItem: async () => undefined,
  };
}

function fakePaletteRepository(
  listPalettes: () => Promise<CustomLibraryPaletteRecord[]>,
): CustomLibraryPaletteRepository {
  return {
    savePalette: async () => "saved-palette",
    updatePalette: async () => undefined,
    listPalettes,
    getPalette: async () => null,
    deletePalette: async () => undefined,
  };
}

describe("Custom Library Editor integration", () => {
  let containerElement: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    containerElement = document.createElement("div");
    document.body.appendChild(containerElement);
    root = createRoot(containerElement);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  async function mount(
    value: Presentation,
    saved: Presentation[],
    customLibraryPaletteRepository?: CustomLibraryPaletteRepository,
    libraryItems: CustomLibraryItemRecord[] = items,
  ): Promise<{ onSave: ReturnType<typeof vi.fn>; listItems: ReturnType<typeof vi.fn> }> {
    const listItems = vi.fn(async () => libraryItems);
    const onSave = vi.fn(async (next: Presentation) => {
      saved.push(structuredClone(next));
    });

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            initialPresentation={value}
            customLibraryRepository={fakeRepository(listItems)}
            customLibraryPaletteRepository={customLibraryPaletteRepository}
            onSave={onSave}
          />
        </StudioI18nProvider>,
      );
    });

    return { onSave, listItems };
  }

  async function openElements(): Promise<void> {
    const button = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Elements");
    if (!button) throw new Error("Elements tab not found");
    await act(async () => button.click());
  }

  async function clickToolbarMode(label: string): Promise<void> {
    const button = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim().includes(label));
    if (!button) throw new Error(`Toolbar button not found: ${label}`);
    await act(async () => button.click());
  }

  async function clickResourcePaletteToggle(): Promise<void> {
    const button = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => ["+ Add palette", "Close"].includes(candidate.textContent?.trim() ?? ""));
    if (!button) throw new Error("Resource palette toggle not found");
    await act(async () => button.click());
  }

  async function openPicker(): Promise<void> {
    const button = containerElement.querySelector<HTMLButtonElement>("[data-custom-library-apply]");
    if (!button) throw new Error("Custom Library Apply opener not found");
    await act(async () => button.click());
    await act(async () => undefined);
  }

  async function applyItem(name: string): Promise<void> {
    const itemButton = Array.from(
      containerElement.querySelectorAll<HTMLButtonElement>("[class*='customLibraryApplyItem']"),
    ).find((candidate) => candidate.textContent?.includes(name));
    if (!itemButton) throw new Error(`Custom Library item not found: ${name}`);
    await act(async () => itemButton.click());
    const applyButton = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Apply");
    if (!applyButton) throw new Error("Apply button not found");
    await act(async () => applyButton.click());
  }

  async function saveAfterApply(saved: Presentation[]): Promise<Presentation> {
    await act(async () => {
      vi.advanceTimersByTime(1600);
      await Promise.resolve();
    });
    const next = saved.at(-1);
    if (!next) throw new Error("Expected autosave snapshot");
    return next;
  }

  async function selectElement(label: string): Promise<void> {
    const button = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("[class*='elementTreeSelect']"))
      .find((candidate) => candidate.textContent?.includes(label));
    if (!button) throw new Error(`Tree element not found: ${label}`);
    await act(async () => button.click());
  }

  function dispatchKey(target: EventTarget, key: string): void {
    act(() => {
      target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    });
  }

  it("confirms element deletion through the shared dialog and preserves the container warning", async () => {
    const saved: Presentation[] = [];
    const confirmSpy = vi.spyOn(window, "confirm");
    await mount(makePresentation([container("container-a", [text("child-a", "Existing child")])]), saved);
    await openElements();
    await selectElement("Container");
    const inspectorButton = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Inspector");
    if (!inspectorButton) throw new Error("Inspector tab not found");
    await act(async () => inspectorButton.click());

    const deleteButton = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Delete" && !button.disabled);
    if (!deleteButton) throw new Error("Delete button not found");
    await act(async () => deleteButton.click());

    const dialog = containerElement.querySelector('[data-studio-danger-confirm-dialog]');
    expect(dialog?.textContent).toContain("Delete container \"container-a\" and all its children?");
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(containerElement.textContent).toContain("Container · container-a");

    const cancelButton = Array.from(containerElement.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'))
      .find((button) => button.textContent?.trim() === "Cancel");
    if (!cancelButton) throw new Error("Cancel button not found");
    await act(async () => cancelButton.click());
    expect(containerElement.querySelector('[data-studio-danger-confirm-dialog]')).toBeNull();
    expect(containerElement.textContent).toContain("Container · container-a");

    await act(async () => deleteButton.click());
    const confirmButton = Array.from(containerElement.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'))
      .find((button) => button.textContent?.trim() === "Delete");
    if (!confirmButton) throw new Error("confirm button not found");
    await act(async () => confirmButton.click());

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(containerElement.querySelector('[data-studio-danger-confirm-dialog]')).toBeNull();
    expect(containerElement.textContent).not.toContain("Container · container-a");
    expect(deleteButton.disabled).toBe(true);
    confirmSpy.mockRestore();
  });

  it("uses the same confirmation flow for Delete and protects editable controls", async () => {
    const saved: Presentation[] = [];
    await mount(makePresentation([text("target-text", "Before")]), saved);
    await openElements();
    await selectElement("Text — Before");

    dispatchKey(window, "Backspace");
    expect(containerElement.querySelector('[data-studio-danger-confirm-dialog]')).toBeNull();

    dispatchKey(window, "Delete");
    expect(containerElement.querySelectorAll('[data-studio-danger-confirm-dialog]')).toHaveLength(1);
    expect(containerElement.textContent).toContain("Delete Text \"target-text\"?");

    dispatchKey(window, "Delete");
    expect(containerElement.querySelectorAll('[data-studio-danger-confirm-dialog]')).toHaveLength(1);
    expect(containerElement.textContent).toContain("Text · target-text");

    const escapeTarget = containerElement.querySelector('[role="dialog"]');
    if (!escapeTarget) throw new Error("dialog not found");
    dispatchKey(escapeTarget, "Escape");
    expect(containerElement.querySelector('[data-studio-danger-confirm-dialog]')).toBeNull();
    expect(containerElement.textContent).toContain("Text · target-text");

    const input = containerElement.querySelector<HTMLInputElement>("input");
    const select = containerElement.querySelector<HTMLSelectElement>("select");
    const textarea = document.createElement("textarea");
    const contentEditable = document.createElement("div");
    contentEditable.setAttribute("contenteditable", "true");
    containerElement.append(textarea, contentEditable);
    if (!input || !select) throw new Error("expected editor controls");

    for (const target of [input, textarea, select, contentEditable]) {
      dispatchKey(target, "Delete");
      expect(containerElement.querySelector('[data-studio-danger-confirm-dialog]')).toBeNull();
    }

    dispatchKey(window, "Delete");
    const confirmButton = Array.from(containerElement.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'))
      .find((button) => button.textContent?.trim() === "Delete");
    if (!confirmButton) throw new Error("confirm button not found");
    await act(async () => confirmButton.click());
    expect(containerElement.textContent).not.toContain("Text · target-text");
  });

  it("lazily creates a root Text and selects the applied element", async () => {
    const saved: Presentation[] = [];
    const mounted = await mount(makePresentation([text("existing", "Existing")]), saved);
    expect(mounted.listItems).not.toHaveBeenCalled();
    await openElements();
    await openPicker();
    expect(mounted.listItems).toHaveBeenCalledOnce();
    await applyItem("Text preset");

    const next = await saveAfterApply(saved);
    const slide = next.slides[0];
    expect(slide?.elements.map((element) => element.type)).toEqual(["text", "text"]);
    expect(slide?.elements[0]?.id).toBe("existing");
    expect(slide?.elements[1]?.type === "text" && slide.elements[1].content).toBe("Applied text");
    expect(slide?.elements[1]?.id).not.toBe("existing");
    expect(containerElement.querySelectorAll('[role="treeitem"][aria-selected="true"]')).toHaveLength(1);
    expect(containerElement.textContent).toContain(`Text · ${slide?.elements[1]?.id}`);
  });

  it("materializes a missing FontResource through the real apply UI path", async () => {
    const initial = makePresentation([]);
    const initialBefore = structuredClone(initial);
    const saved: Presentation[] = [];
    await mount(initial, saved, undefined, [firaStyleItem]);
    await openElements();
    await openPicker();
    await applyItem("Fira Code style");

    const next = await saveAfterApply(saved);
    expect(next.resources?.fonts).toHaveLength(1);
    expect(next.resources?.fonts?.[0]).toMatchObject({
      family: "Fira Code",
      faces: [firaFace],
    });
    const applied = next.slides[0]?.elements[0];
    expect(applied).toMatchObject({
      type: "text",
      content: "Fira Code applied",
      typography: { fontFamily: "Fira Code" },
    });
    expect(initial).toEqual(initialBefore);
  });

  it("keeps a conflicting FontResource application atomic through the real UI path", async () => {
    const conflictingFace: FontFaceResource = {
      ...firaFace,
      source: { type: "url", url: "https://example.com/conflicting.woff2", format: "woff2" },
    };
    const initial = makePresentation([], false, [{
      id: "local-fira",
      family: "Fira Code",
      faces: [conflictingFace],
    }]);
    const initialBefore = structuredClone(initial);
    const saved: Presentation[] = [];
    await mount(initial, saved, undefined, [firaStyleItem]);
    await openElements();
    await openPicker();
    await applyItem("Fira Code style");

    expect(containerElement.textContent).toContain("Could not apply Custom Library item.");
    expect(containerElement.textContent).toContain("No element selected.");
    await act(async () => {
      vi.advanceTimersByTime(1600);
      await Promise.resolve();
    });
    expect(saved).toHaveLength(0);
    expect(initial).toEqual(initialBefore);
  });

  it("wires Add from Library through Editor state and autosave", async () => {
    const source = PresentationSchema.parse({
      schemaVersion: 1,
      id: "palette-editor-integration",
      title: "Palette editor integration",
      palette: { colors: [{ id: "accent", name: "Accent", value: "#ff0000" }] },
      slides: [{
        id: "slide-1",
        title: "First",
        elements: [{
          id: "linked-text",
          type: "text",
          content: "Existing",
          style: { color: { kind: "palette", colorId: "accent" } },
        }],
      }],
    });
    const saved: Presentation[] = [];
    const listPalettes = vi.fn(async () => [{
      id: "firestore-palette-id",
      palette: {
        name: "Brand",
        description: "Not presentation metadata",
        colors: [{ name: "Accent", value: "#facc15" }, { name: "Border", value: "#ffffff" }],
      },
    }]);
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={source}
          customLibraryPaletteRepository={fakePaletteRepository(listPalettes)}
          onSave={vi.fn(async (next: Presentation) => { saved.push(structuredClone(next)); })}
        />
      </StudioI18nProvider>,
    ));

    expect(listPalettes).not.toHaveBeenCalled();
    await clickToolbarMode("Custom Resources");
    const openButton = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "+ Add palette");
    expect(openButton).toBeDefined();
    await act(async () => openButton?.click());
    await act(async () => undefined);
    expect(listPalettes).toHaveBeenCalledOnce();
    await act(async () => containerElement.querySelector<HTMLButtonElement>("button[aria-label='Add Brand']")?.click());
    await act(async () => { vi.advanceTimersByTime(1600); await Promise.resolve(); });

    const next = saved.at(-1);
    expect(next?.palette?.colors).toEqual([
      { id: "accent", name: "Accent", value: "#ff0000" },
      { id: "accent-2", name: "Accent", value: "#facc15" },
      { id: "border", name: "Border", value: "#ffffff" },
    ]);
    expect(next?.slides[0]?.elements[0]).toMatchObject({ style: { color: { kind: "palette", colorId: "accent" } } });
    expect(JSON.stringify(next)).not.toContain("firestore-palette-id");
    expect(JSON.stringify(next)).not.toContain("Not presentation metadata");
  });

  it("provides live Presentation palette variables to the standalone slide canvas", async () => {
    const source = PresentationSchema.parse({
      schemaVersion: 1,
      id: "palette-canvas-resolution",
      title: "Palette canvas resolution",
      palette: {
        colors: [
          { id: "accent", name: "Accent", value: "#facc15" },
          { id: "secondary", name: "Secondary", value: "#2563eb" },
        ],
      },
      slides: [{
        id: "slide-1",
        title: "First",
        elements: [
          { id: "linked-text", type: "text", content: "Palette color", style: { color: { kind: "palette", colorId: "accent" } } },
          { id: "literal-text", type: "text", content: "Literal color", style: { color: "#22c55e" } },
        ],
      }],
    });
    const saved: Presentation[] = [];
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={source} onSave={async (next) => { saved.push(next); }} />
      </StudioI18nProvider>,
    ));
    await clickToolbarMode("Custom Resources");

    const canvas = containerElement.querySelector<HTMLElement>("[class*='slideCanvas']");
    expect(canvas).toBeTruthy();
    const accentVariable = paletteColorCssVariableName("accent");
    const secondaryVariable = paletteColorCssVariableName("secondary");
    expect(canvas?.innerHTML).toContain(`var(${accentVariable})`);
    expect(canvas?.style.getPropertyValue(accentVariable)).toBe("#facc15");
    expect(canvas?.style.getPropertyValue(secondaryVariable)).toBe("#2563eb");
    expect(canvas?.innerHTML).toContain("#22c55e");

    const accentInput = containerElement.querySelector<HTMLInputElement>("[data-presentation-color-row] input[type='text']");
    expect(accentInput).toBeTruthy();
    await act(async () => {
      if (accentInput) {
        setInputValue(accentInput, "#2563eb");
        accentInput.dispatchEvent(new Event("input", { bubbles: true }));
        accentInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(canvas?.style.getPropertyValue(accentVariable)).toBe("#2563eb");
    await act(async () => { vi.advanceTimersByTime(1600); await Promise.resolve(); });
    expect(saved.at(-1)?.palette?.colors[0]?.value).toBe("#2563eb");
    expect(saved.at(-1)?.slides[0]?.elements[0]).toMatchObject({ style: { color: { kind: "palette", colorId: "accent" } } });
  });

  it("keeps resource, notes, and editor modes mutually exclusive while preserving the editor sub-view", async () => {
    const saved: Presentation[] = [];
    const listPalettes = vi.fn(async () => [{
      id: "brand",
      palette: {
        name: "Brand",
        colors: [{ name: "Accent", value: "#facc15" }, { name: "Secondary", value: "#2563eb" }],
      },
    }]);
    await mount(makePresentation([text("selected-text", "Selected")]), saved, fakePaletteRepository(listPalettes));

    const toolbarButtons = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .filter((button) => ["Custom Resources", "Notes"].includes(button.textContent?.trim() ?? ""));
    expect(toolbarButtons.map((button) => button.textContent?.trim())).toEqual(["Custom Resources", "Notes"]);
    expect(toolbarButtons[0]?.getAttribute("aria-pressed")).toBe("false");
    expect(toolbarButtons[1]?.getAttribute("aria-pressed")).toBe("false");

    await openElements();
    await selectElement("Text — Selected");
    expect(containerElement.querySelector('[aria-pressed="true"]')?.textContent?.trim()).toBe("Elements");

    await clickToolbarMode("Custom Resources");
    expect(containerElement.textContent).toContain("Custom Resources");
    expect(Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim().includes("Custom Resources") && button.getAttribute("aria-pressed") === "true")
      ?.textContent?.trim()).toBe("Custom Resources");
    expect(listPalettes).toHaveBeenCalledOnce();
    expect(containerElement.textContent).not.toContain("Inspector");
    await clickResourcePaletteToggle();
    expect(containerElement.textContent).toContain("Brand");

    await clickToolbarMode("Custom Resources");
    expect(containerElement.textContent).toContain("Elements");
    expect(containerElement.querySelector<HTMLButtonElement>("button[aria-pressed='true']")?.textContent?.trim()).toBe("Elements");
    expect(containerElement.textContent).toContain("Text · selected-text");

    await clickToolbarMode("Notes");
    expect(containerElement.textContent).toContain("Notes");
    expect(Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => ["Custom Resources", "Notes"].includes(button.textContent?.trim() ?? "") && button.getAttribute("aria-pressed") === "true")
      ?.textContent?.trim()).toBe("Notes");

    await clickToolbarMode("Custom Resources");
    await clickResourcePaletteToggle();
    expect(containerElement.textContent).toContain("Brand");
    expect(Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => ["Custom Resources", "Notes"].includes(button.textContent?.trim() ?? "") && button.getAttribute("aria-pressed") === "true")
      ?.textContent?.trim()).toBe("Custom Resources");
    expect(containerElement.textContent).not.toContain("Write private notes");
  });

  it("loads Custom Library palettes lazily and handles pending, empty, failure, and retry states without writes", async () => {
    let resolvePalettes: ((records: CustomLibraryPaletteRecord[]) => void) | undefined;
    let rejectPalettes: ((reason?: unknown) => void) | undefined;
    const listPalettes = vi.fn(() => new Promise<CustomLibraryPaletteRecord[]>((resolve, reject) => {
      resolvePalettes = resolve;
      rejectPalettes = reject;
    }));
    const savePalette = vi.fn(async () => "saved");
    const getPalette = vi.fn(async () => null);
    const deletePalette = vi.fn(async () => undefined);
    const repository: CustomLibraryPaletteRepository = { listPalettes, savePalette, updatePalette: vi.fn(async () => undefined), getPalette, deletePalette };
    const saved: Presentation[] = [];

    await mount(makePresentation([]), saved, repository);
    expect(listPalettes).not.toHaveBeenCalled();
    await clickToolbarMode("Custom Resources");
    expect(listPalettes).toHaveBeenCalledOnce();
    expect(containerElement.textContent).not.toContain("Loading palettes…");
    await clickResourcePaletteToggle();
    expect(containerElement.textContent).toContain("Loading palettes…");

    resolvePalettes?.([{
      id: "brand",
      palette: { name: "Brand", colors: [{ name: "Accent", value: "#facc15" }, { name: "Secondary", value: "#2563eb" }] },
    }]);
    await act(async () => { await Promise.resolve(); });
    expect(containerElement.textContent).toContain("Brand");
    expect(containerElement.textContent).toContain("2 colors");
    expect(containerElement.querySelectorAll("[data-custom-resource-palette='brand'] [data-palette-swatch]")).toHaveLength(2);
    expect(savePalette).not.toHaveBeenCalled();
    expect(getPalette).not.toHaveBeenCalled();
    expect(deletePalette).not.toHaveBeenCalled();

    await clickToolbarMode("Custom Resources");
    await clickToolbarMode("Custom Resources");
    await clickResourcePaletteToggle();
    expect(listPalettes).toHaveBeenCalledTimes(2);
    rejectPalettes?.(new Error("offline"));
    await act(async () => { await Promise.resolve(); });
    expect(containerElement.textContent).toContain("Could not load Custom Library palettes.");
    const retryButton = Array.from(containerElement.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Retry");
    expect(retryButton).toBeDefined();
    await act(async () => retryButton?.click());
    expect(listPalettes).toHaveBeenCalledTimes(3);
    resolvePalettes?.([]);
    await act(async () => { await Promise.resolve(); });
    expect(containerElement.textContent).toContain("No Custom Library palettes yet.");
  });

  it("renders Presentation-local palette colors separately, including the empty state", async () => {
    const repository = fakePaletteRepository(vi.fn(async () => []));
    const source = PresentationSchema.parse({
      ...makePresentation([]),
      palette: { colors: [
        { id: "accent", name: "Accent", value: "#facc15" },
        { id: "surface", name: "Surface", value: "#0f172a" },
      ] },
    });
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={source} customLibraryPaletteRepository={repository} />
      </StudioI18nProvider>,
    ));
    await clickToolbarMode("Custom Resources");
    expect(containerElement.querySelector("[data-presentation-palette]")).toBeTruthy();
    expect(containerElement.querySelector<HTMLInputElement>("[aria-label='Name for Accent']")?.value).toBe("Accent");
    expect(containerElement.querySelector<HTMLInputElement>("[data-presentation-color-row] input[type='text']")?.value).toBe("#facc15");
    expect(containerElement.querySelector<HTMLInputElement>("[aria-label='Name for Surface']")?.value).toBe("Surface");
    expect(Array.from(containerElement.querySelectorAll<HTMLInputElement>("[data-presentation-color-row] input[type='text']")).map((input) => input.value)).toEqual(["#facc15", "#0f172a"]);

    await act(async () => root.unmount());
    root = createRoot(containerElement);
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={makePresentation([])} customLibraryPaletteRepository={repository} />
      </StudioI18nProvider>,
    ));
    await clickToolbarMode("Custom Resources");
    expect(containerElement.textContent).toContain("This Presentation has no palette colors.");
  });

  it("removes a local palette color through Resources and materializes linked element colors", async () => {
    const saved: Presentation[] = [];
    const listPalettes = vi.fn(async () => [] as CustomLibraryPaletteRecord[]);
    const savePalette = vi.fn(async () => "unused");
    const updatePalette = vi.fn(async () => undefined);
    const deletePalette = vi.fn(async () => undefined);
    const repository: CustomLibraryPaletteRepository = {
      listPalettes,
      savePalette,
      updatePalette,
      getPalette: vi.fn(async () => null),
      deletePalette,
    };
    const source = PresentationSchema.parse({
      schemaVersion: 1,
      id: "palette-removal-integration",
      title: "Palette removal integration",
      description: "",
      aspectRatio: "16:9",
      slides: [
        {
          id: "slide-1",
          title: "First",
          summary: "",
          speakerNotes: "",
          elements: [
            {
              id: "linked-text",
              type: "text",
              hidden: false,
              variant: "body",
              content: "Linked text",
              style: { color: { kind: "palette", colorId: "accent" } },
            },
          ],
        },
      ],
      palette: {
        colors: [
          { id: "accent", name: "Accent", value: "#facc15" },
          { id: "other", name: "Other", value: "#2563eb" },
        ],
      },
    });
    await mount(source, saved, repository);
    await clickToolbarMode("Custom Resources");
    const removeButton = containerElement.querySelector<HTMLButtonElement>(
      "button[aria-label='Remove Accent']",
    );
    if (!removeButton) throw new Error("Accent remove button not found");
    await act(async () => removeButton.click());
    const next = await saveAfterApply(saved);
    expect(next.palette?.colors).toEqual([
      { id: "other", name: "Other", value: "#2563eb" },
    ]);
    const linked = next.slides[0]?.elements[0];
    expect(linked?.type === "text" && linked.style?.color).toBe("#facc15");
    expect(JSON.stringify(next)).not.toContain('"colorId":"accent"');
    expect(savePalette).not.toHaveBeenCalled();
    expect(updatePalette).not.toHaveBeenCalled();
    expect(deletePalette).not.toHaveBeenCalled();
  });

  it("edits a linked local palette color through Resources and preserves its binding", async () => {
    const saved: Presentation[] = [];
    const repository: CustomLibraryPaletteRepository = {
      savePalette: vi.fn(async () => "unused"),
      updatePalette: vi.fn(async () => undefined),
      listPalettes: vi.fn(async () => []),
      getPalette: vi.fn(async () => null),
      deletePalette: vi.fn(async () => undefined),
    };
    const source = PresentationSchema.parse({
      schemaVersion: 1,
      id: "palette-edit-integration",
      title: "Palette edit integration",
      description: "",
      aspectRatio: "16:9",
      slides: [{
        id: "slide-1",
        title: "First",
        summary: "",
        speakerNotes: "",
        elements: [{
          id: "linked-text",
          type: "text",
          hidden: false,
          variant: "body",
          content: "Linked text",
          style: { color: { kind: "palette", colorId: "accent" } },
        }],
      }],
      palette: { colors: [{ id: "accent", name: "Accent", value: "#facc15" }] },
    });
    await mount(source, saved, repository);
    await clickToolbarMode("Custom Resources");
    const nameInput = containerElement.querySelector<HTMLInputElement>("[aria-label='Name for Accent']");
    const valueInput = containerElement.querySelector<HTMLInputElement>("[data-presentation-color-row] input[type='text']");
    if (!nameInput || !valueInput) throw new Error("local color editor inputs not found");
    await act(async () => {
      setInputValue(nameInput, "Primary");
      nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      nameInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      nameInput.focus();
      nameInput.blur();
    });
    await act(async () => {
      setInputValue(valueInput, "#2563eb");
      valueInput.dispatchEvent(new Event("input", { bubbles: true }));
      valueInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const next = await saveAfterApply(saved);
    expect(next.palette?.colors).toEqual([{ id: "accent", name: "Primary", value: "#2563eb" }]);
    const linked = next.slides[0]?.elements[0];
    expect(linked?.type === "text" && linked.style?.color).toEqual({ kind: "palette", colorId: "accent" });
    const canvas = containerElement.querySelector<HTMLElement>("[class*='slideCanvas']");
    expect(canvas?.style.getPropertyValue(paletteColorCssVariableName("accent"))).toBe("#2563eb");
    expect(repository.savePalette).not.toHaveBeenCalled();
    expect(repository.updatePalette).not.toHaveBeenCalled();
    expect(repository.deletePalette).not.toHaveBeenCalled();
  });

  it("merges Text into the selected Text without creating a sibling", async () => {
    const saved: Presentation[] = [];
    await mount(makePresentation([text("target-text", "Before")]), saved);
    await openElements();
    await selectElement("Text — Before");
    await openPicker();
    await applyItem("Text preset");

    const slide = (await saveAfterApply(saved)).slides[0];
    expect(slide?.elements).toHaveLength(1);
    expect(slide?.elements[0]?.id).toBe("target-text");
    expect(slide?.elements[0]?.type === "text" && slide.elements[0].content).toBe("Applied text");
    expect(containerElement.textContent).toContain("Text · target-text");
  });

  it("creates a different-type Image immediately after selected Text", async () => {
    const saved: Presentation[] = [];
    await mount(makePresentation([text("target-text", "Before")]), saved);
    await openElements();
    await selectElement("Text — Before");
    await openPicker();
    await applyItem("Image preset");

    const slide = (await saveAfterApply(saved)).slides[0];
    expect(slide?.elements.map((element) => element.type)).toEqual(["text", "image"]);
    expect(slide?.elements[0]?.id).toBe("target-text");
    expect(slide?.elements[1]?.id).not.toBe("target-text");
    expect(containerElement.textContent).toContain(`Image · ${slide?.elements[1]?.id}`);
  });

  it("keeps Text sibling placement for a selected Container", async () => {
    const saved: Presentation[] = [];
    await mount(makePresentation([container("container-a", [text("child-a", "Existing child")])]), saved);
    await openElements();
    await selectElement("Container");
    await openPicker();
    await applyItem("Text preset");

    const slide = (await saveAfterApply(saved)).slides[0];
    const rootContainer = slide?.elements[0];
    expect(slide?.elements).toHaveLength(2);
    expect(rootContainer?.type).toBe("container");
    expect(rootContainer?.type === "container" && rootContainer.children.map((child) => child.id)).toEqual(["child-a"]);
    expect(slide?.elements[1]?.type).toBe("text");
  });

  it("merges Container composition into the selected Container", async () => {
    const saved: Presentation[] = [];
    await mount(makePresentation([container("container-a", [text("child-a", "Existing child")])]), saved);
    await openElements();
    await selectElement("Container");
    await openPicker();
    await applyItem("Container composition");

    const slide = (await saveAfterApply(saved)).slides[0];
    expect(slide?.elements).toHaveLength(1);
    const rootContainer = slide?.elements[0];
    expect(rootContainer?.id).toBe("container-a");
    expect(rootContainer?.type === "container" && rootContainer.children.map((child) => child.type)).toEqual(["text", "text"]);
    expect(rootContainer?.type === "container" && rootContainer.children[1]?.type === "text" && rootContainer.children[1].content).toBe("Library child");
    expect(containerElement.textContent).toContain("Container · container-a");
  });

  it("treats structural Topic ContentSlot selection as root creation", async () => {
    const saved: Presentation[] = [];
    await mount(makePresentation([topicsElement()]), saved);
    await openElements();
    await selectElement("Topic content");
    await openPicker();
    await applyItem("Text preset");

    const slide = (await saveAfterApply(saved)).slides[0];
    expect(slide?.elements.map((element) => element.type)).toEqual(["topics", "text"]);
    const topics = slide?.elements[0];
    expect(topics?.type === "topics" && topics.items[0]?.content.children.map((child) => child.id)).toEqual(["topic-text"]);
    expect(containerElement.textContent).toContain(`Text · ${slide?.elements[1]?.id}`);
    expect(containerElement.textContent).not.toContain("Content slot");
  });

  it("keeps Presentation and selection unchanged for unsupported Chart create", async () => {
    const saved: Presentation[] = [];
    await mount(makePresentation([text("existing", "Existing")]), saved);
    await openElements();
    await openPicker();
    await applyItem("Chart preset");

    expect(containerElement.textContent).toContain("This item cannot be created in the Editor yet.");
    expect(saved).toHaveLength(0);
    expect(containerElement.textContent).toContain("No element selected.");
  });

  it("autosaves only the selected slide after Apply", async () => {
    const saved: Presentation[] = [];
    const initial = makePresentation([text("first-root", "First")], true);
    await mount(initial, saved);
    await openElements();
    await openPicker();
    await applyItem("Text preset");

    const next = await saveAfterApply(saved);
    expect(next.slides[0]?.elements).toHaveLength(2);
    expect(next.slides[1]).toEqual(initial.slides[1]);
  });
});
