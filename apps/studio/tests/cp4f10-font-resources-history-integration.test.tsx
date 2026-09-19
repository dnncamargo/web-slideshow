// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type FontFaceResource,
  type FontResource,
  type Presentation,
} from "@web-slideshow/document-schema";

import type { CustomLibraryFontRecord } from "../src/features/custom-library/custom-library-font";
import type { CustomLibraryFontRepository } from "../src/features/custom-library/custom-library-font-repository";
import type { CustomLibraryPaletteRepository } from "../src/features/custom-library/custom-library-palette-repository";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const regularFace: FontFaceResource = {
  weight: 400,
  style: "normal",
  subset: "latin",
  source: { type: "url", url: "https://example.com/inter-400.woff2" },
};

const boldFace: FontFaceResource = {
  weight: 700,
  style: "normal",
  subset: "latin",
  source: { type: "url", url: "https://example.com/inter-700.woff2" },
};

const libraryFont: CustomLibraryFontRecord = {
  id: "library-inter-record",
  font: { family: "Inter", faces: [regularFace, boldFace] },
};

const paletteRepository: CustomLibraryPaletteRepository = {
  savePalette: async () => "unused",
  updatePalette: async () => undefined,
  listPalettes: async () => [],
  getPalette: async () => null,
  deletePalette: async () => undefined,
};

function fontRepository(records: CustomLibraryFontRecord[] = [libraryFont]): CustomLibraryFontRepository {
  return {
    saveFont: async () => "unused",
    updateFont: async () => undefined,
    listFonts: async () => records,
    getFont: async () => null,
    deleteFont: async () => undefined,
  };
}

function presentation(
  fonts?: FontResource[],
  elementTypography?: { fontFamily: string },
): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4f10-font-resources-history",
    title: "CP4F10 Font resources history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: elementTypography
        ? [{
            id: "font-usage",
            type: "text",
            hidden: false,
            variant: "body",
            content: "Font usage",
            typography: elementTypography,
          }]
        : [],
    }],
    ...(fonts ? { resources: { fonts } } : {}),
  });
}

function key(options: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: "z", bubbles: true, cancelable: true, ...options });
}

describe("CP4F10 Presentation Font resource history", () => {
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

  async function mount(initial = presentation(), repository = fontRepository()): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={initial}
          onSave={async (snapshot) => { saved.push(structuredClone(snapshot)); }}
          customLibraryPaletteRepository={paletteRepository}
          customLibraryFontRepository={repository}
        />
      </StudioI18nProvider>,
    ));
  }

  async function remount(initial: Presentation, repository = fontRepository()): Promise<void> {
    await act(async () => root.unmount());
    root = createRoot(host);
    await mount(initial, repository);
  }

  async function flush(): Promise<void> {
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  }

  async function openFontChooser(): Promise<void> {
    let addFont = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "+ Add font");
    if (!addFont) {
      const resources = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.trim() === "Custom Resources");
      if (!resources) throw new Error("Custom Resources button was not rendered");
      await act(async () => resources.click());
      addFont = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.trim() === "+ Add font");
    }
    if (!addFont) throw new Error("Add font button was not rendered");
    await act(async () => addFont.click());
    await flush();
  }

  async function addLibraryFont(): Promise<void> {
    const add = host.querySelector<HTMLButtonElement>("[aria-label='Add Inter']");
    if (!add) throw new Error("Library Inter action was not rendered");
    await act(async () => add.click());
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

  async function undo(): Promise<KeyboardEvent> {
    const event = key({ ctrlKey: true });
    await act(async () => window.dispatchEvent(event));
    return event;
  }

  async function redo(): Promise<KeyboardEvent> {
    const event = key({ ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(event));
    return event;
  }

  function fontRows(): HTMLElement[] {
    return Array.from(host.querySelectorAll<HTMLElement>("[data-presentation-font-row]"));
  }

  function fontRow(family: string): HTMLElement {
    const row = fontRows().find((candidate) => candidate.querySelector("strong")?.textContent === family);
    if (!row) throw new Error(`Presentation Font row ${family} was not rendered`);
    return row;
  }

  it("imports through the real chooser as one add action and replays the same resource", async () => {
    await mount();
    await openFontChooser();
    await addLibraryFont();

    const imported = await save();
    const importedFont = imported.resources?.fonts?.[0];
    expect(importedFont).toEqual({ id: "inter", family: "Inter", faces: [regularFace, boldFace] });
    expect(JSON.stringify(imported)).not.toContain("library-inter-record");

    await undo();
    expect((await save()).resources).toBeUndefined();
    await redo();
    expect((await save()).resources?.fonts?.[0]).toEqual(importedFont);
  });

  it("allocates a collision-safe current id and preserves it through undo/redo", async () => {
    await mount(presentation([{ id: "inter", family: "Other", faces: [regularFace] }]));
    await openFontChooser();
    await addLibraryFont();

    expect((await save()).resources?.fonts?.map(({ id }) => id)).toEqual(["inter", "inter-2"]);
    await undo();
    expect((await save()).resources?.fonts?.map(({ id }) => id)).toEqual(["inter"]);
    await redo();
    expect((await save()).resources?.fonts?.map(({ id }) => id)).toEqual(["inter", "inter-2"]);
  });

  it("merges one library Font atomically while preserving local identity and order", async () => {
    const localFace = { ...regularFace, source: { ...regularFace.source, url: "https://example.com/local-regular.woff2" } };
    const initial = presentation([
      { id: "first", family: "First", faces: [regularFace] },
      { id: "local", family: "Inter", faces: [localFace] },
      { id: "last", family: "Last", faces: [boldFace] },
    ]);
    const repository = fontRepository([{
      ...libraryFont,
      font: { family: "inter", faces: [localFace, boldFace] },
    }]);
    await mount(initial, repository);
    await openFontChooser();
    const add = host.querySelector<HTMLButtonElement>("[aria-label='Add inter']");
    if (!add) throw new Error("Library merge action was not rendered");
    await act(async () => add.click());

    const merged = await save();
    expect(merged.resources?.fonts).toEqual([
      { id: "first", family: "First", faces: [regularFace] },
      { id: "local", family: "Inter", faces: [localFace, boldFace] },
      { id: "last", family: "Last", faces: [boldFace] },
    ]);
    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(merged);
  });

  it("converts a legacy one-face resource only inside one real merge action", async () => {
    const legacy = presentation([{
      id: "local",
      family: "Inter",
      source: { type: "url", url: "https://example.com/inter-legacy.woff2" },
    }]);
    await mount(legacy, fontRepository([{
      id: "library-inter-bold-record",
      font: { family: "Inter", faces: [boldFace] },
    }]));
    await openFontChooser();
    await addLibraryFont();

    const merged = await save();
    const mergedFont = merged.resources?.fonts?.[0];
    expect(mergedFont?.id).toBe("local");
    expect(mergedFont?.family).toBe("Inter");
    expect(mergedFont && "source" in mergedFont).toBe(false);
    expect(mergedFont && "faces" in mergedFont ? mergedFont.faces : undefined).toHaveLength(2);
    await undo();
    expect(await save()).toEqual(legacy);
    await redo();
    expect(await save()).toEqual(merged);
  });

  it("keeps unchanged and conflicting imports outside history", async () => {
    const complete = presentation([{ id: "local", family: "Inter", faces: [regularFace, boldFace] }]);
    await mount(complete);
    await openFontChooser();
    await addLibraryFont();
    expect(host.textContent).toContain("already in this presentation");
    expect(fontRows()).toHaveLength(1);
    expect(fontRow("Inter").textContent).toContain("2 faces");
    const unchangedUndo = await undo();
    expect(unchangedUndo.defaultPrevented).toBe(false);

    const conflict = presentation([{ id: "local", family: "Inter", faces: [
      { ...regularFace, source: { ...regularFace.source, url: "https://example.com/conflict.woff2" } },
    ] }]);
    await remount(conflict);
    await openFontChooser();
    await addLibraryFont();
    expect(host.textContent).toContain("conflicts with an existing font face");
    expect(fontRows()).toHaveLength(1);
    expect(fontRow("Inter").textContent).toContain("1 face");
    const conflictUndo = await undo();
    expect(conflictUndo.defaultPrevented).toBe(false);
  });

  it("removes only the exact unused resource and replays the atomic snapshot", async () => {
    const initial = presentation([
      { id: "first", family: "First", faces: [regularFace] },
      { id: "local", family: "Inter", faces: [boldFace] },
      { id: "last", family: "Last", faces: [regularFace] },
    ]);
    await mount(initial);
    await openFontChooser();
    const remove = fontRow("Inter").querySelector<HTMLButtonElement>("[data-resource-action='remove']");
    if (!remove) throw new Error("Inter remove action was not rendered");
    await act(async () => remove.click());

    const removed = await save();
    expect(removed.resources?.fonts?.map(({ id }) => id)).toEqual(["first", "last"]);
    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(removed);
  });

  it("removes the last Font and restores the exact resources object shape", async () => {
    const initial = presentation([{ id: "local", family: "Inter", faces: [regularFace] }]);
    await mount(initial);
    await openFontChooser();
    const remove = fontRow("Inter").querySelector<HTMLButtonElement>("[data-resource-action='remove']");
    if (!remove) throw new Error("Inter remove action was not rendered");
    await act(async () => remove.click());
    expect((await save()).resources).toBeUndefined();
    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect((await save()).resources).toBeUndefined();
  });

  it("blocks normalized-family usage in the real UI and preserves the presentation", async () => {
    const initial = presentation([{ id: "local", family: "Inter", faces: [regularFace] }], { fontFamily: " inter " });
    await mount(initial);
    await openFontChooser();
    const row = fontRow("Inter");
    expect(row.textContent).toContain("In use");
    const remove = row.querySelector<HTMLButtonElement>("[data-resource-action='remove']");
    expect(remove?.disabled).toBe(true);
    expect((await undo()).defaultPrevented).toBe(false);
  });

  it("keeps chooser lifecycle and import-to-remove as separate history boundaries", async () => {
    await mount();
    await openFontChooser();
    const close = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Close");
    if (!close) throw new Error("Font chooser close action was not rendered");
    await act(async () => close.click());
    const chooserUndo = await undo();
    expect(chooserUndo.defaultPrevented).toBe(false);

    await openFontChooser();
    await addLibraryFont();
    const imported = await save();
    const importedRemove = fontRow("Inter").querySelector<HTMLButtonElement>("[data-resource-action='remove']");
    if (!importedRemove) throw new Error("Imported Inter remove action was not rendered");
    await act(async () => importedRemove.click());
    expect((await save()).resources).toBeUndefined();

    await undo();
    expect((await save()).resources?.fonts?.[0]).toEqual(imported.resources?.fonts?.[0]);
    await undo();
    expect((await save()).resources).toBeUndefined();
    await redo();
    expect((await save()).resources?.fonts?.[0]).toEqual(imported.resources?.fonts?.[0]);
    await redo();
    expect((await save()).resources).toBeUndefined();
  });
});
