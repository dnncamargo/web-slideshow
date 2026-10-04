// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import type { CustomLibraryFileRecord } from "../src/features/custom-library/custom-library-file";
import type { CustomLibraryFileRepository } from "../src/features/custom-library/custom-library-file-repository";
import type { CustomLibraryFontRepository } from "../src/features/custom-library/custom-library-font-repository";
import type { CustomLibraryPaletteRepository } from "../src/features/custom-library/custom-library-palette-repository";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const paletteRepository: CustomLibraryPaletteRepository = {
  savePalette: async () => "unused", updatePalette: async () => undefined,
  listPalettes: async () => [], getPalette: async () => null, deletePalette: async () => undefined,
};

const fontRepository: CustomLibraryFontRepository = {
  saveFont: async () => "unused", updateFont: async () => undefined,
  listFonts: async () => [], getFont: async () => null, deleteFont: async () => undefined,
};

const binaryFile: CustomLibraryFileRecord = {
  id: "library-binary-record",
  file: {
    name: "diagram.png",
    kind: "image",
    representation: "binary",
    source: {
      assetId: "binary-asset-id",
      storagePath: "private/binary/path",
      downloadUrl: "https://example.com/diagram.png",
      contentType: "image/png",
      sizeBytes: 12,
    },
  },
};

const textFile: CustomLibraryFileRecord = {
  id: "library-text-record",
  file: {
    name: "notes.txt",
    kind: "text",
    representation: "text",
    source: {
      assetId: "text-asset-id",
      storagePath: "private/text/path",
      downloadUrl: "https://example.com/notes.txt",
      contentType: "text/plain",
      sizeBytes: 5,
    },
  },
};

function repository(record: CustomLibraryFileRecord): CustomLibraryFileRepository {
  return {
    saveFile: async () => "unused", updateFile: async () => undefined,
    listFiles: async () => [record], getFile: async () => null, deleteFile: async () => undefined,
  };
}

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "file-history",
    title: "File history",
    slides: [{ id: "slide", title: "Slide", elements: [] }],
  });
}

describe("Presentation File resource history integration", () => {
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
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  async function mount(file: CustomLibraryFileRecord, initial = presentation()): Promise<void> {
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace
      initialPresentation={initial}
      onSave={async (snapshot) => { saved.push(structuredClone(snapshot)); }}
      customLibraryPaletteRepository={paletteRepository}
      customLibraryFontRepository={fontRepository}
      customLibraryFileRepository={repository(file)}
    /></StudioI18nProvider>));
  }

  async function flush(): Promise<void> {
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  }

  async function openFileChooser(): Promise<void> {
    const resources = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Custom Resources");
    if (resources) await act(async () => resources.click());
    const addFile = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "+ Add file");
    if (!addFile) throw new Error("Add file button was not rendered");
    await act(async () => addFile.click());
    await flush();
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
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })));
  }

  it("materializes binary files without fetching and creates one undoable history action", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await mount(binaryFile);
    await openFileChooser();
    await act(async () => host.querySelector<HTMLButtonElement>("[aria-label='Add diagram.png']")?.click());

    expect(fetchMock).not.toHaveBeenCalled();
    const added = await save();
    expect(added.resources?.files).toEqual([{
      id: "file-diagram-png",
      name: "diagram.png",
      kind: "image",
      representation: "binary",
      contentType: "image/png",
      source: { type: "url", url: binaryFile.file.source.downloadUrl },
    }]);
    expect(JSON.stringify(added)).not.toContain(binaryFile.id);

    await undo();
    expect((await save()).resources).toBeUndefined();
  });

  it("does not commit a text file after a failed download", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("offline", { status: 503 })));
    await mount(textFile);
    await openFileChooser();
    await act(async () => host.querySelector<HTMLButtonElement>("[aria-label='Add notes.txt']")?.click());
    await flush();

    expect(host.textContent).toContain("Could not load file content.");
    expect(host.querySelectorAll("[data-presentation-file-row]")).toHaveLength(0);
    expect(saved).toHaveLength(0);
  });

  it("fetches text before commit and applies the update to the current Presentation", async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })));
    await mount(textFile);
    await openFileChooser();
    await act(async () => host.querySelector<HTMLButtonElement>("[aria-label='Add notes.txt']")?.click());

    const addColor = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "+ Add to Presentation");
    await act(async () => addColor?.click());
    const colorName = host.querySelector<HTMLInputElement>("[data-presentation-color-name-input]");
    if (!colorName) throw new Error("Presentation color form was not rendered");
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setValue?.call(colorName, "Accent");
    await act(async () => colorName.dispatchEvent(new Event("input", { bubbles: true })));
    const add = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Add");
    await act(async () => add?.click());

    resolveFetch?.(new Response("hello", { status: 200 }));
    await flush();
    const result = await save();
    expect(result.palette?.colors).toHaveLength(1);
    expect(result.resources?.files?.[0]).toEqual({
      id: "file-notes-txt",
      name: "notes.txt",
      kind: "text",
      representation: "text",
      contentType: "text/plain",
      source: { type: "text", content: "hello" },
    });
    expect(JSON.stringify(result)).not.toContain(textFile.file.source.downloadUrl);
  });
});
