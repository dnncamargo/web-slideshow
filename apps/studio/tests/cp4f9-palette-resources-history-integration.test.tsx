// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type ColorValue,
  type Presentation,
  type PowerShowElement,
} from "@powershow/document-schema";

import type { CustomLibraryPaletteRecord, CustomLibraryPaletteRepository } from "../src/features/custom-library/custom-library-palette-repository";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const paletteLibrary: CustomLibraryPaletteRecord = {
  id: "library-brand",
  palette: {
    name: "Brand Warm",
    description: "Library metadata must not be persisted",
    colors: [
      { name: "Accent", value: "#facc15" },
      { name: "Surface", value: "rgba(15, 23, 42, 1)" },
    ],
  },
};

function repositories(records: CustomLibraryPaletteRecord[] = [paletteLibrary]): CustomLibraryPaletteRepository {
  return {
    savePalette: async () => "unused",
    updatePalette: async () => undefined,
    listPalettes: async () => records,
    getPalette: async () => null,
    deletePalette: async () => undefined,
  };
}

function ref(colorId: string): ColorValue {
  return { kind: "palette", colorId };
}

function initialPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4f9-palette-resources-history",
    title: "CP4F9 Palette resources history",
    palette: {
      colors: [
        { id: "accent", name: "Accent", value: "#336699" },
        { id: "accent-2", name: "Existing suffix", value: "#ff00ff" },
        { id: "other", name: "Other", value: "#111111" },
      ],
    },
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [{
        id: "accent-element",
        type: "text",
        hidden: false,
        variant: "body",
        content: "Palette reference",
        style: {
          color: ref("accent"),
          background: {
            gradient: {
              type: "linear",
              angle: 90,
              stops: [
                { position: 0, color: ref("accent") },
                { position: 100, color: ref("other") },
              ],
            },
          },
        },
        typography: { textStroke: { width: 1, color: ref("accent") } },
      }],
    }],
    textStyles: [{
      id: "quote",
      name: "Quote",
      role: "body",
      style: { color: ref("accent") },
    }],
    linkedStyles: [{
      id: "linked-quote",
      name: "Linked Quote",
      style: { color: ref("accent") },
    }],
  });
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLSelectElement.value setter");
  setter.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function key(options: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: "z", bubbles: true, cancelable: true, ...options });
}

function findElement(elements: readonly PowerShowElement[], id: string): PowerShowElement | undefined {
  for (const element of elements) {
    if (element.id === id) return element;
    if (element.type === "container") {
      const nested = findElement(element.children, id);
      if (nested) return nested;
    }
  }
  return undefined;
}

describe("CP4F9 Presentation Palette resource history", () => {
  let host: HTMLDivElement;
  let root: Root;
  let saved: Presentation[];

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    saved = [];
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function mount(initial = initialPresentation(), repository = repositories()): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={initial}
          onSave={async (snapshot) => { saved.push(structuredClone(snapshot)); }}
          customLibraryPaletteRepository={repository}
          customLibraryFontRepository={repository as never}
        />
      </StudioI18nProvider>,
    ));
  }

  async function openResources(): Promise<void> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Custom Resources");
    if (!button) throw new Error("Custom Resources button was not rendered");
    await act(async () => button.click());
  }

  function rows(): HTMLElement[] {
    return Array.from(host.querySelectorAll<HTMLElement>("[data-presentation-color-row]"));
  }

  function row(id: string): HTMLElement {
    const found = host.querySelector<HTMLElement>(`#custom-resources-literal-color-${id}`)?.closest<HTMLElement>("[data-presentation-color-row]");
    if (!found) throw new Error(`Palette row ${id} was not rendered`);
    return found;
  }

  async function save(): Promise<Presentation> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Save");
    if (!button) throw new Error("Save button was not rendered");
    await act(async () => button.click());
    const snapshot = saved[saved.length - 1];
    if (!snapshot) throw new Error("Save did not produce a snapshot");
    return snapshot;
  }

  async function undo(): Promise<void> {
    await act(async () => window.dispatchEvent(key({ ctrlKey: true })));
  }

  async function redo(): Promise<void> {
    await act(async () => window.dispatchEvent(key({ ctrlKey: true, shiftKey: true })));
  }

  it("tracks transient local add, canonical add, collision replay, and rename separately", async () => {
    await mount();
    await openResources();

    const addButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "+ Add to Presentation");
    if (!addButton) throw new Error("Add to Presentation was not rendered");
    await act(async () => addButton.click());
    const name = host.querySelector<HTMLInputElement>("[data-presentation-color-name-input]");
    const value = host.querySelector<HTMLInputElement>("#custom-resources-literal-color-value");
    const format = host.querySelector<HTMLSelectElement>("#custom-resources-literal-color-format");
    if (!name || !value || !format) throw new Error("transient Palette add form was not rendered");
    await act(async () => {
      setInputValue(name, " Accent ");
      setInputValue(value, "rgba(10, 20, 30, 0.4)");
      setSelectValue(format, "hex");
    });
    expect(rows()).toHaveLength(3);
    await act(async () => Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Close")?.click());
    await undo();
    expect(rows()).toHaveLength(3);

    await act(async () => addButton.click());
    const addName = host.querySelector<HTMLInputElement>("[data-presentation-color-name-input]");
    if (!addName) throw new Error("Palette add form disappeared");
    await act(async () => setInputValue(addName, "Accent"));
    await act(async () => Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Add")?.click());
    expect(rows()).toHaveLength(4);
    expect(host.querySelector("#custom-resources-literal-color-accent-3-value")).not.toBeNull();
    await undo();
    expect(host.querySelector("#custom-resources-literal-color-accent-3-value")).toBeNull();
    await redo();
    expect(host.querySelector("#custom-resources-literal-color-accent-3-value")).not.toBeNull();

    const newName = row("accent-3").querySelector<HTMLInputElement>("input[aria-label^='Name for']");
    if (!newName) throw new Error("new Palette name field was not rendered");
    await act(async () => {
      newName.focus();
      setInputValue(newName, "Renamed Accent");
      newName.blur();
    });
    expect(row("accent-3").querySelector<HTMLInputElement>("input[aria-label='Name for Renamed Accent']")).not.toBeNull();
    await undo();
    expect(row("accent-3").querySelector<HTMLInputElement>("input[aria-label='Name for Accent']")).not.toBeNull();
    await redo();
    expect(row("accent-3").querySelector<HTMLInputElement>("input[aria-label='Name for Renamed Accent']")).not.toBeNull();
  });

  it("coalesces text color edits, preserves references, and treats format as a separate action", async () => {
    await mount();
    await openResources();
    const input = row("accent").querySelector<HTMLInputElement>("#custom-resources-literal-color-accent-value");
    if (!input) throw new Error("Palette literal text input was not rendered");
    await act(async () => {
      input.focus();
      setInputValue(input, "#112233");
      setInputValue(input, "#445566");
      input.blur();
    });
    const edited = await save();
    expect(edited.palette?.colors[0]).toEqual({ id: "accent", name: "Accent", value: "#445566" });
    const element = findElement(edited.slides[0]?.elements ?? [], "accent-element");
    expect(element?.type === "text" ? element.style?.color : undefined).toEqual(ref("accent"));
    expect(edited.textStyles?.[0]?.style?.color).toEqual(ref("accent"));
    expect(edited.linkedStyles?.[0] && "style" in edited.linkedStyles[0] ? edited.linkedStyles[0].style?.color : undefined).toEqual(ref("accent"));
    await undo();
    expect((await save()).palette?.colors[0]?.value).toBe("#336699");
    await redo();
    expect((await save()).palette?.colors[0]?.value).toBe("#445566");

    const format = row("accent").querySelector<HTMLSelectElement>("#custom-resources-literal-color-accent-format");
    if (!format) throw new Error("Palette color format select was not rendered");
    await act(async () => setSelectValue(format, "rgba"));
    const formatted = await save();
    expect(formatted.palette?.colors[0]?.value).toBe("rgba(68, 85, 102, 1)");
    await undo();
    expect((await save()).palette?.colors[0]?.value).toBe("#445566");
  });

  it("keeps no-op names, same values, and invalid drafts outside history", async () => {
    await mount();
    await openResources();
    const name = row("accent").querySelector<HTMLInputElement>("input[aria-label='Name for Accent']");
    const value = row("accent").querySelector<HTMLInputElement>("#custom-resources-literal-color-accent-value");
    if (!name || !value) throw new Error("Palette fields were not rendered");
    await act(async () => {
      name.focus();
      setInputValue(name, " Renamed ");
      name.blur();
    });
    await undo();
    await act(async () => {
      name.focus();
      setInputValue(name, " Accent ");
      name.blur();
    });
    await act(async () => {
      value.focus();
      setInputValue(value, "not-a-color");
      value.blur();
    });
    await redo();
    expect(row("accent").querySelector<HTMLInputElement>("input[aria-label='Name for Renamed']")).not.toBeNull();
    expect(row("accent").querySelector<HTMLInputElement>("#custom-resources-literal-color-accent-value")?.value).toBe("not-a-color");
  });

  it("removes with canonical detachment and restores the atomic snapshot across undo/redo", async () => {
    const initial = initialPresentation();
    await mount(initial);
    await openResources();
    const remove = row("accent").querySelector<HTMLButtonElement>("[data-resource-action='remove']");
    if (!remove) throw new Error("Palette remove button was not rendered");
    await act(async () => remove.click());
    const removed = await save();
    expect(removed.palette?.colors.map(({ id }) => id)).toEqual(["accent-2", "other"]);
    const removedElement = findElement(removed.slides[0]?.elements ?? [], "accent-element");
    expect(removedElement?.type === "text" ? removedElement.style?.color : undefined).toBe("#336699");
    expect(removedElement?.type === "text" ? removedElement.style?.background?.gradient?.stops[0]?.color : undefined).toBe("#336699");
    expect(removed.textStyles?.[0]?.style?.color).toBe("#336699");
    expect(removed.linkedStyles?.[0] && "style" in removed.linkedStyles[0] ? removed.linkedStyles[0].style?.color : undefined).toBe("#336699");
    expect(removedElement?.type === "text" ? removedElement.style?.background?.gradient?.stops[1]?.color : undefined).toEqual(ref("other"));
    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(removed);
  });

  it("uses the edited current literal for removal and keeps value/remove actions separate", async () => {
    await mount();
    await openResources();
    const input = row("accent").querySelector<HTMLInputElement>("#custom-resources-literal-color-accent-value");
    if (!input) throw new Error("Palette literal text input was not rendered");
    await act(async () => {
      input.focus();
      setInputValue(input, "#abcdef");
      input.blur();
    });
    const remove = row("accent").querySelector<HTMLButtonElement>("[data-resource-action='remove']");
    if (!remove) throw new Error("Palette remove button was not rendered");
    await act(async () => remove.click());
    const removed = await save();
    const removedElement = findElement(removed.slides[0]?.elements ?? [], "accent-element");
    expect(removedElement?.type === "text" ? removedElement.style?.color : undefined).toBe("#abcdef");
    await undo();
    expect((await save()).palette?.colors.find(({ id }) => id === "accent")?.value).toBe("#abcdef");
    expect(findElement((await save()).slides[0]?.elements ?? [], "accent-element")).toBeDefined();
    await undo();
    expect((await save()).palette?.colors.find(({ id }) => id === "accent")?.value).toBe("#336699");
  });

  it("imports one complete Library Palette as one atomic current-state action", async () => {
    await mount(initialPresentation(), repositories());
    await openResources();
    const addPalette = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "+ Add palette");
    if (!addPalette) throw new Error("Add palette chooser was not rendered");
    await act(async () => addPalette.click());
    const addLibrary = host.querySelector<HTMLButtonElement>("[aria-label='Add Brand Warm']");
    if (!addLibrary) throw new Error("Library palette action was not rendered");
    await act(async () => addLibrary.click());
    const imported = await save();
    expect(imported.palette?.colors.map(({ id, name, value }) => ({ id, name, value }))).toEqual([
      { id: "accent", name: "Accent", value: "#336699" },
      { id: "accent-2", name: "Existing suffix", value: "#ff00ff" },
      { id: "other", name: "Other", value: "#111111" },
      { id: "accent-3", name: "Accent", value: "#facc15" },
      { id: "surface", name: "Surface", value: "rgba(15, 23, 42, 1)" },
    ]);
    expect(imported.palette).not.toHaveProperty("name");
    expect(JSON.stringify(imported)).not.toContain("Brand Warm");
    expect(JSON.stringify(imported)).not.toContain("Library metadata");
    await undo();
    expect(await save()).toEqual(initialPresentation());
    await redo();
    expect(await save()).toEqual(imported);
  });

  it("rejects an invalid Library Palette without partial mutation or history", async () => {
    const invalid: CustomLibraryPaletteRecord = {
      id: "invalid",
      palette: {
        name: "Invalid",
        colors: [{ name: "", value: "#ffffff" }, { name: "Partial", value: "#000000" }],
      },
    };
    await mount(initialPresentation(), repositories([invalid]));
    await openResources();
    const addPalette = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "+ Add palette");
    if (!addPalette) throw new Error("Add palette chooser was not rendered");
    await act(async () => addPalette.click());
    const addInvalid = host.querySelector<HTMLButtonElement>("[aria-label='Add Invalid']");
    if (!addInvalid) throw new Error("Invalid Library palette action was not rendered");
    await act(async () => addInvalid.click());
    expect(rows()).toHaveLength(3);
    await undo();
    expect(rows()).toHaveLength(3);
  });
});
