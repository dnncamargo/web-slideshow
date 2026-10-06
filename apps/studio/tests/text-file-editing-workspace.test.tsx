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

const libraryFile: CustomLibraryFileRecord = {
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

const fileRepository: CustomLibraryFileRepository = {
  saveFile: async () => "unused", updateFile: async () => undefined,
  listFiles: async () => [libraryFile], getFile: async () => null, deleteFile: async () => undefined,
};

function presentation(content = "before"): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "text-file-editor",
    title: "Text file editor",
    slides: [{
      id: "slide",
      title: "Slide",
      elements: [{
        id: "scripted",
        type: "scripted",
        hidden: false,
        resourceIds: ["file-library-text-record"],
      }],
    }],
    resources: {
      files: [
        {
          id: "file-library-text-record",
          name: "notes.txt",
          kind: "text",
          representation: "text",
          contentType: "text/plain",
          source: { type: "text", content },
        },
        {
          id: "binary-file",
          name: "diagram.png",
          kind: "image",
          representation: "binary",
          contentType: "image/png",
          source: { type: "url", url: "https://example.com/diagram.png" },
        },
        {
          id: "second-text-file",
          name: "other.txt",
          kind: "text",
          representation: "text",
          contentType: "text/plain",
          source: { type: "text", content: "second canonical" },
        },
      ],
    },
  });
}

function button(host: HTMLElement, label: string): HTMLButtonElement {
  const result = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent?.trim() === label);
  if (!result) throw new Error(`Button not found: ${label}`);
  return result;
}

describe("Presentation text file editing workspace", () => {
  let host: HTMLDivElement;
  let root: Root;
  let saved: Presentation[];
  let nativeExecCommand: ReturnType<typeof vi.fn>;
  let execCommandDescriptor: PropertyDescriptor | undefined;

  beforeEach(async () => {
    execCommandDescriptor = Object.getOwnPropertyDescriptor(document, "execCommand");
    nativeExecCommand = vi.fn((command: string, showUI = false, value?: string) => {
      void showUI;
      if (command !== "insertText") return false;
      const target = document.activeElement;
      if (!(target instanceof HTMLTextAreaElement)) return false;
      target.setRangeText(value ?? "", target.selectionStart, target.selectionEnd, "end");
      target.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: nativeExecCommand,
    });

    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    saved = [];
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={presentation()}
          onSave={async (snapshot) => { saved.push(structuredClone(snapshot)); }}
          customLibraryPaletteRepository={paletteRepository}
          customLibraryFontRepository={fontRepository}
          customLibraryFileRepository={fileRepository}
        />
      </StudioI18nProvider>,
    ));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    if (execCommandDescriptor) {
      Object.defineProperty(document, "execCommand", execCommandDescriptor);
    } else {
      Reflect.deleteProperty(document, "execCommand");
    }
  });

  async function openPresentationFiles(): Promise<void> {
    if (!host.querySelector("[data-presentation-files]")) {
      await act(async () => button(host, "Custom Resources").click());
    }
    const filesDetails = Array.from(host.querySelectorAll<HTMLDetailsElement>("details"))
      .find((details) => details.querySelector("[data-presentation-files]"));
    const summary = filesDetails?.querySelector<HTMLElement>("summary");
    if (!summary) throw new Error("Presentation Files section not found");
    await act(async () => summary.click());
  }

  async function enterTextEditing(): Promise<void> {
    await enterTextFileEditing("notes.txt");
  }

  async function enterTextFileEditing(name: string): Promise<void> {
    await openPresentationFiles();
    const row = Array.from(host.querySelectorAll<HTMLElement>("[data-presentation-file-row]"))
      .find((candidate) => candidate.querySelector("strong")?.textContent === name);
    const edit = row?.querySelector<HTMLButtonElement>("[data-resource-action='edit']");
    if (!edit) throw new Error("Text file Edit action not found");
    await act(async () => edit.click());
  }

  function textarea(): HTMLTextAreaElement {
    const result = host.querySelector<HTMLTextAreaElement>("[data-text-file-editor]");
    if (!result) throw new Error("Text editor not found");
    return result;
  }

  function setText(value: string): void {
    const target = textarea();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(target, value);
    target.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function setSelection(start: number, end = start): void {
    textarea().focus();
    textarea().setSelectionRange(start, end);
  }

  async function setIndentationMode(value: "2" | "4" | "tab"): Promise<void> {
    const select = host.querySelector<HTMLSelectElement>("[data-text-file-indent]");
    if (!select) throw new Error("Indentation control not found");
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      setter?.call(select, value);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  async function pressTab(shiftKey = false): Promise<void> {
    const target = textarea();
    target.focus();
    await act(async () => {
      target.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey,
        bubbles: true,
        cancelable: true,
      }));
    });
  }

  async function saveText(): Promise<void> {
    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='save']")?.click());
  }

  async function exitTextEditing(): Promise<void> {
    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='exit']")?.click());
  }

  async function saveCanonicalSnapshot(): Promise<Presentation> {
    await act(async () => button(host, "Save").click());
    const snapshot = saved[saved.length - 1];
    if (!snapshot) throw new Error("Canonical Save did not produce a snapshot");
    return snapshot;
  }

  it("keeps draft editing local, protects dirty exit, and discards without history", async () => {
    await enterTextEditing();

    expect(host.querySelector("[data-text-file-context]")).not.toBeNull();
    expect(host.querySelector("[data-text-file-editor-region]")).not.toBeNull();
    expect(host.querySelector("[data-authoring-target]")).toBeNull();
    expect(host.querySelector("[data-presentation-files]")).not.toBeNull();
    expect(textarea().value).toBe("before");

    await act(async () => setText("locally changed"));
    expect(textarea().value).toBe("locally changed");
    expect(host.querySelector("[data-text-file-status]")?.textContent).toContain("Modified");
    expect(saved).toHaveLength(0);

    expect(host.querySelector<HTMLButtonElement>("[data-text-file-action='exit']")?.disabled).toBe(true);
    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    expect(textarea().value).toBe("before");
    expect(host.querySelector("[data-text-file-status]")?.textContent).toContain("Saved");
    expect(saved).toHaveLength(0);

    await exitTextEditing();
    expect(host.querySelector("[data-text-file-editor]")).toBeNull();
    expect(host.querySelector("[data-authoring-target='slide']")).not.toBeNull();

    await enterTextEditing();
    await saveText();
    expect(saved).toHaveLength(0);
  });

  it("saves one canonical file-content history action and preserves identity through undo/redo", async () => {
    await enterTextEditing();
    await act(async () => setText("after"));
    await saveText();
    expect(host.querySelector("[data-text-file-status]")?.textContent).toContain("Saved");

    const changed = await saveCanonicalSnapshot();
    const changedFile = changed.resources?.files?.find((file) => file.id === "file-library-text-record");
    expect(changedFile).toEqual({
      id: "file-library-text-record",
      name: "notes.txt",
      kind: "text",
      representation: "text",
      contentType: "text/plain",
      source: { type: "text", content: "after" },
    });
    expect(changed.slides[0]?.elements[0]?.type).toBe("scripted");
    const scripted = changed.slides[0]?.elements[0];
    expect(scripted?.type === "scripted" ? scripted.resourceIds : undefined).toEqual(["file-library-text-record"]);

    await exitTextEditing();
    await act(async () => button(host, "Custom Resources").click());
    await act(async () => button(host, "History").click());
    expect(host.querySelectorAll("[class*='historyEntry']")).toHaveLength(1);
    expect(host.textContent).toContain("Change: File content");

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })));
    const undone = await saveCanonicalSnapshot();
    expect(undone.resources?.files?.find((file) => file.id === "file-library-text-record")?.source).toEqual({ type: "text", content: "before" });
    expect(undone.slides[0]?.elements[0]?.type === "scripted" ? undone.slides[0]?.elements[0]?.resourceIds : undefined).toEqual(["file-library-text-record"]);

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })));
    const redone = await saveCanonicalSnapshot();
    expect(redone.resources?.files?.find((file) => file.id === "file-library-text-record")?.source).toEqual({ type: "text", content: "after" });
    expect(redone.slides[0]?.elements[0]?.type === "scripted" ? redone.slides[0]?.elements[0]?.resourceIds : undefined).toEqual(["file-library-text-record"]);
  });

  it("handles configurable local indentation without canonical writes", async () => {
    await enterTextEditing();

    setSelection(0);
    await pressTab();
    expect(textarea().value).toBe("  before");
    expect(saved).toHaveLength(0);

    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    await setIndentationMode("4");
    setSelection(0);
    await pressTab();
    expect(textarea().value).toBe("    before");

    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    await setIndentationMode("tab");
    setSelection(0);
    await pressTab();
    expect(textarea().value).toBe("\tbefore");

    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    await setIndentationMode("2");
    await act(async () => setText("before"));
    setSelection(0, 3);
    await pressTab();
    expect(textarea().value).toBe("  ore");
    expect(textarea().selectionStart).toBe(2);
    expect(textarea().selectionEnd).toBe(2);

    await act(async () => setText("    before"));
    setSelection(4);
    await pressTab(true);
    expect(textarea().value).toBe("  before");
    expect(textarea().selectionStart).toBe(2);
    expect(textarea().selectionEnd).toBe(2);

    await act(async () => setText("before"));
    setSelection(0);
    await pressTab(true);
    expect(textarea().value).toBe("before");
    expect(saved).toHaveLength(0);

    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    await exitTextEditing();
    await act(async () => button(host, "Custom Resources").click());
    await act(async () => button(host, "History").click());
    expect(host.querySelectorAll("[class*='historyEntry']")).toHaveLength(0);
    expect(nativeExecCommand.mock.calls.map((call) => call[2])).toEqual(["  ", "    ", "\t", "  ", ""]);
  });

  it("keeps the unavailable-command fallback local", async () => {
    await enterTextEditing();
    nativeExecCommand.mockImplementationOnce(() => false);
    setSelection(0);
    await pressTab();

    expect(textarea().value).toBe("  before");
    expect(saved).toHaveLength(0);
  });

  it("isolates one active File draft from every other File", async () => {
    await enterTextEditing();
    await act(async () => setText("A draft"));

    const secondFileRow = Array.from(host.querySelectorAll<HTMLElement>("[data-presentation-file-row]"))
      .find((candidate) => candidate.querySelector("strong")?.textContent === "other.txt");
    const secondEdit = secondFileRow?.querySelector<HTMLButtonElement>("[data-resource-action='edit']");
    expect(secondEdit?.disabled).toBe(true);
    await act(async () => secondEdit?.click());
    expect(textarea().value).toBe("A draft");
    expect(saved).toHaveLength(0);

    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    await exitTextEditing();
    expect(secondFileRow?.querySelector<HTMLButtonElement>("[data-resource-action='edit']")?.disabled).toBe(false);

    await enterTextFileEditing("other.txt");
    expect(textarea().value).toBe("second canonical");
    await act(async () => setText("B changed"));
    await saveText();

    const snapshot = await saveCanonicalSnapshot();
    expect(snapshot.resources?.files?.find((file) => file.id === "file-library-text-record")?.source).toEqual({ type: "text", content: "before" });
    expect(snapshot.resources?.files?.find((file) => file.id === "second-text-file")?.source).toEqual({ type: "text", content: "B changed" });
  });
});
