// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertBracket } from "@codemirror/autocomplete";
import { indentWithTab, insertNewlineAndIndent, isolateHistory, redo, undo } from "@codemirror/commands";
import { syntaxTree } from "@codemirror/language";
import { Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import type { CustomLibraryFileRecord } from "../src/features/custom-library/custom-library-file";
import type { CustomLibraryFileRepository } from "../src/features/custom-library/custom-library-file-repository";
import type { CustomLibraryFontRepository } from "../src/features/custom-library/custom-library-font-repository";
import type { CustomLibraryPaletteRepository } from "../src/features/custom-library/custom-library-palette-repository";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];
  callback: ResizeObserverCallback;
  element: Element | null = null;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverMock.instances.push(this);
  }

  observe(element: Element): void {
    this.element = element;
  }

  disconnect(): void {
    this.element = null;
  }

  notify(): void {
    if (this.element) this.callback([], this as unknown as ResizeObserver);
  }
}

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

const jsonLibraryFile: CustomLibraryFileRecord = {
  id: "library-json-record",
  file: {
    name: "data.json",
    kind: "structured-data",
    representation: "text",
    source: {
      assetId: "json-asset-id",
      storagePath: "private/text/data.json",
      downloadUrl: "https://example.com/data.json",
      contentType: "application/json",
      sizeBytes: 13,
    },
  },
};

const xmlLibraryFile: CustomLibraryFileRecord = {
  id: "library-xml-record",
  file: {
    name: "data.xml",
    kind: "structured-data",
    representation: "text",
    source: {
      assetId: "xml-asset-id",
      storagePath: "private/text/data.xml",
      downloadUrl: "https://example.com/data.xml",
      contentType: "application/xml",
      sizeBytes: 28,
    },
  },
};

const svgLibraryFile: CustomLibraryFileRecord = {
  id: "library-svg-record",
  file: {
    name: "icon.svg",
    kind: "image",
    representation: "text",
    source: {
      assetId: "svg-asset-id",
      storagePath: "private/text/icon.svg",
      downloadUrl: "https://example.com/icon.svg",
      contentType: "image/svg+xml",
      sizeBytes: 11,
    },
  },
};

const fileRepository: CustomLibraryFileRepository = {
  saveFile: async () => "unused", updateFile: async () => undefined,
  listFiles: async () => [libraryFile, jsonLibraryFile, xmlLibraryFile, svgLibraryFile], getFile: async () => null, deleteFile: async () => undefined,
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
        {
          id: "json-text-file",
          name: "data.json",
          kind: "structured-data",
          representation: "text",
          contentType: "application/json",
          source: { type: "text", content: '{"answer": 42}' },
        },
        {
          id: "xml-text-file",
          name: "data.xml",
          kind: "structured-data",
          representation: "text",
          contentType: "application/xml",
          source: { type: "text", content: "<root><item id=\"1\" /></root>" },
        },
        {
          id: "svg-text-file",
          name: "icon.svg",
          kind: "image",
          representation: "text",
          contentType: "image/svg+xml",
          source: { type: "text", content: "<svg></svg>" },
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
  const originalResizeObserver = globalThis.ResizeObserver;
  const originalRangeGetClientRects = (Range.prototype as Range & { getClientRects?: () => DOMRectList }).getClientRects;

  beforeEach(async () => {
    ResizeObserverMock.instances = [];
    globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      value: () => [] as unknown as DOMRectList,
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
    globalThis.ResizeObserver = originalResizeObserver;
    if (originalRangeGetClientRects) {
      Object.defineProperty(Range.prototype, "getClientRects", {
        configurable: true,
        value: originalRangeGetClientRects,
      });
    } else {
      Reflect.deleteProperty(Range.prototype, "getClientRects");
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

  function editorHost(): HTMLDivElement {
    const result = host.querySelector<HTMLDivElement>("[data-text-file-editor]");
    if (!result) throw new Error("Text editor not found");
    return result;
  }

  function editorView(): EditorView {
    const editorDom = editorHost().querySelector<HTMLElement>(".cm-editor");
    if (!editorDom) throw new Error("CodeMirror DOM not found");
    const result = EditorView.findFromDOM(editorDom);
    if (!result) throw new Error("CodeMirror view not found");
    return result;
  }

  function editorText(): string {
    return editorView().state.doc.toString();
  }

  function selectionStart(): number {
    return editorView().state.selection.main.from;
  }

  function selectionEnd(): number {
    return editorView().state.selection.main.to;
  }

  function setText(value: string): void {
    const view = editorView();
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }

  function insertText(value: string): boolean {
    const view = editorView();
    const { from, to } = view.state.selection.main;
    const insert = () => view.state.update({
      changes: { from, to, insert: value },
      selection: { anchor: from + value.length },
      userEvent: "input.type",
    });
    const handled = view.state.facet(EditorView.inputHandler).some((handler) => handler(view, from, to, value, insert));
    if (!handled) view.dispatch(insert());
    return handled;
  }

  function setSelection(start: number, end = start): void {
    const view = editorView();
    view.focus();
    view.dispatch({ selection: { anchor: start, head: end } });
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

  async function pressKey(key: string, options: KeyboardEventInit = {}): Promise<KeyboardEvent> {
    const view = editorView();
    view.focus();
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    });
    const isModified = event.altKey || event.ctrlKey || event.metaKey || event.isComposing;
    const isBracket = ["(", "[", "{", "'", "\"", "`", ")", "]", "}"].includes(key);
    if (!isModified && isBracket) {
      const transaction = insertBracket(view.state, key);
      if (transaction) {
        event.preventDefault();
        await act(async () => view.dispatch(transaction));
      }
      return event;
    }

    const target = view.contentDOM;
    await act(async () => {
      target.dispatchEvent(event);
    });
    return event;
  }

  async function pressTab(shiftKey = false): Promise<void> {
    const view = editorView();
    view.focus();
    const command = shiftKey ? indentWithTab.shift : indentWithTab.run;
    await act(async () => command?.(view));
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

  function fileEditButton(name: string): HTMLButtonElement {
    const row = Array.from(host.querySelectorAll<HTMLElement>("[data-presentation-file-row]"))
      .find((candidate) => candidate.querySelector("strong")?.textContent === name);
    const edit = row?.querySelector<HTMLButtonElement>("[data-resource-action='edit']");
    if (!edit) throw new Error(`Text file Edit action not found for ${name}`);
    return edit;
  }

  it("keeps draft editing local, protects dirty exit, and discards without history", async () => {
    await enterTextEditing();

    expect(host.querySelector("[data-text-file-context]")).not.toBeNull();
    expect(host.querySelector("[data-text-file-editor-region]")).not.toBeNull();
    expect(host.querySelector("[data-authoring-target]")).toBeNull();
    expect(host.querySelector("[data-presentation-files]")).not.toBeNull();
    expect(editorText()).toBe("before");

    await act(async () => setText("locally changed"));
    expect(editorText()).toBe("locally changed");
    expect(host.querySelector("[data-text-file-status]")?.textContent).toContain("Modified");
    expect(saved).toHaveLength(0);

    expect(host.querySelector<HTMLButtonElement>("[data-text-file-action='exit']")?.disabled).toBe(true);
    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    expect(editorText()).toBe("before");
    expect(host.querySelector("[data-text-file-status]")?.textContent).toContain("Saved");
    expect(saved).toHaveLength(0);

    await act(async () => undo(editorView()));
    expect(editorText()).toBe("before");
    expect(saved).toHaveLength(0);

    await exitTextEditing();
    expect(host.querySelector("[data-text-file-editor]")).toBeNull();
    expect(host.querySelector("[data-authoring-target='slide']")).not.toBeNull();

    await enterTextEditing();
    await saveText();
    expect(saved).toHaveLength(0);
  });

  it("rebinds canvas measurement after leaving text editing mode", async () => {
    const initialViewport = host.querySelector<HTMLElement>("[class*='canvasViewport']");
    const initialObserver = ResizeObserverMock.instances[0];
    if (!initialViewport || !initialObserver) throw new Error("Initial canvas measurement was not installed");
    expect(initialObserver.element).toBe(initialViewport);

    Object.defineProperty(initialViewport, "clientWidth", { configurable: true, value: 544 });
    Object.defineProperty(initialViewport, "clientHeight", { configurable: true, value: 334 });
    await act(async () => initialObserver.notify());
    expect(host.querySelector<HTMLElement>("[class*='canvasStage']")?.style.width).toBe("480px");

    await enterTextEditing();
    expect(host.querySelector("[class*='canvasViewport']")).toBeNull();
    expect(initialObserver.element).toBeNull();

    await exitTextEditing();
    const remountedViewport = host.querySelector<HTMLElement>("[class*='canvasViewport']");
    const remountedObserver = ResizeObserverMock.instances.find((observer) => observer.element === remountedViewport);
    if (!remountedViewport || !remountedObserver) throw new Error("Canvas measurement was not rebound");
    expect(remountedViewport).not.toBe(initialViewport);
    expect(remountedObserver.element).toBe(remountedViewport);

    Object.defineProperty(remountedViewport, "clientWidth", { configurable: true, value: 544 });
    Object.defineProperty(remountedViewport, "clientHeight", { configurable: true, value: 334 });
    await act(async () => remountedObserver.notify());
    expect(host.querySelector<HTMLElement>("[class*='canvasStage']")?.style.width).toBe("480px");
    expect(host.querySelector<HTMLElement>("[class*='canvasStage']")?.style.height).toBe("270px");
  });

  it("destroys and recreates the transient editor across exit and re-entry", async () => {
    await enterTextEditing();
    const firstView = editorView();

    await exitTextEditing();
    expect(firstView.dom.isConnected).toBe(false);

    await enterTextEditing();
    expect(editorView()).not.toBe(firstView);
    expect(editorText()).toBe("before");
  });

  it("saves one canonical file-content history action and preserves identity through undo/redo", async () => {
    await enterTextEditing();
    await act(async () => setText("after"));
    await saveText();
    expect(host.querySelector("[data-text-file-status]")?.textContent).toContain("Saved");
    expect(fileEditButton("other.txt").disabled).toBe(false);

    await act(async () => fileEditButton("other.txt").click());
    expect(editorText()).toBe("second canonical");
    expect(fileEditButton("notes.txt").disabled).toBe(false);
    await act(async () => fileEditButton("notes.txt").click());
    expect(editorText()).toBe("after");

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
    expect(editorText()).toBe("  before");
    expect(saved).toHaveLength(0);

    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    await setIndentationMode("4");
    setSelection(0);
    await pressTab();
    expect(editorText()).toBe("    before");

    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    await setIndentationMode("tab");
    setSelection(0);
    await pressTab();
    expect(editorText()).toBe("\tbefore");

    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    await setIndentationMode("2");
    await act(async () => setText("    before"));
    setSelection(4);
    await pressTab(true);
    expect(editorText()).toBe("  before");
    expect(selectionStart()).toBe(2);
    expect(selectionEnd()).toBe(2);

    await act(async () => setText("before"));
    setSelection(0);
    await pressTab(true);
    expect(editorText()).toBe("before");
    expect(saved).toHaveLength(0);

    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    await exitTextEditing();
    await act(async () => button(host, "Custom Resources").click());
    await act(async () => button(host, "History").click());
    expect(host.querySelectorAll("[class*='historyEntry']")).toHaveLength(0);
  });

  it("keeps CodeMirror edits local without canonical writes", async () => {
    await enterTextEditing();
    setSelection(0);
    await pressTab();

    expect(editorText()).toBe("  before");
    expect(saved).toHaveLength(0);
  });

  it("keeps CodeMirror undo and redo local to the transient draft", async () => {
    await enterTextEditing();
    const view = editorView();
    await act(async () => view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: "one" },
      annotations: [
        Transaction.userEvent.of("input.type"),
        isolateHistory.of("full"),
      ],
    }));
    await act(async () => view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: "two" },
      annotations: [
        Transaction.userEvent.of("input.type"),
        isolateHistory.of("full"),
      ],
    }));

    await act(async () => undo(view));
    expect(editorText()).toBe("one");
    await act(async () => redo(view));
    expect(editorText()).toBe("two");
    expect(saved).toHaveLength(0);
  });

  it("adds paired delimiters and wraps selected text in the local draft", async () => {
    await enterTextEditing();

    const cases = [
      ["(", "()"],
      ["[", "[]"],
      ["{", "{}"],
    ] as const;
    for (const [opening, expected] of cases) {
      await act(async () => setText(""));
      setSelection(0);
      await pressKey(opening);
      expect(editorText()).toBe(expected);
      expect(selectionStart()).toBe(1);
      expect(selectionEnd()).toBe(1);
      await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    }

    const wrappingCases = [
      ["(", "(selected)"],
      ["[", "[selected]"],
      ["{", "{selected}"],
    ] as const;
    for (const [opening, expected] of wrappingCases) {
      await act(async () => setText("selected"));
      setSelection(0, 8);
      await pressKey(opening);
      expect(editorText()).toBe(expected);
      expect(selectionStart()).toBe(1);
      expect(selectionEnd()).toBe(9);
      await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    }

    expect(saved).toHaveLength(0);

    await exitTextEditing();
    await act(async () => button(host, "Custom Resources").click());
    await act(async () => button(host, "History").click());
    expect(host.querySelectorAll("[class*='historyEntry']")).toHaveLength(0);
  });

  it("nests asymmetric opening delimiters instead of skipping their closers", async () => {
    await enterTextEditing();

    const cases = [
      ["()", 1, "(())"],
      ["[]", 1, "[[]]"],
      ["{}", 1, "{{}}"],
    ] as const;
    for (const [initial, caret, expected] of cases) {
      await act(async () => setText(initial));
      setSelection(caret);
      await pressKey(initial[caret - 1] ?? "(");
      expect(editorText()).toBe(expected);
      expect(selectionStart()).toBe(caret + 1);
      expect(selectionEnd()).toBe(caret + 1);
      await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    }

  });

  it("skips existing closers without editing and leaves unmatched closers native", async () => {
    await enterTextEditing();

    const cases = [
      ["(", ")"],
      ["[", "]"],
      ["{", "}"],
    ] as const;
    for (const [opening, closer] of cases) {
      await act(async () => setText(""));
      setSelection(0);
      await pressKey(opening);
      setSelection(1);
      const event = await pressKey(closer);
      expect(event.defaultPrevented).toBe(true);
      expect(editorText()).toBe(`${opening}${closer}`);
      expect(selectionStart()).toBe(2);
      expect(selectionEnd()).toBe(2);
    }

    await act(async () => setText("value"));
    setSelection(5);
    const unmatched = await pressKey(")");
    expect(unmatched.defaultPrevented).toBe(false);
    expect(editorText()).toBe("value");
    expect(saved).toHaveLength(0);
  });

  it("pairs and wraps quotes without lexical interpretation", async () => {
    await enterTextEditing();

    for (const quote of ["\"", "'", "`"] as const) {
      await act(async () => setText(""));
      setSelection(0);
      await pressKey(quote);
      expect(editorText()).toBe(`${quote}${quote}`);
      expect(selectionStart()).toBe(1);
      expect(selectionEnd()).toBe(1);
      await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    }

    await act(async () => setText(""));
    setSelection(0);
    await pressKey("\"");
    await act(async () => editorView().dispatch({ changes: { from: 1, to: 1, insert: "value" } }));
    setSelection(6);
    const skipQuote = await pressKey("\"");
    expect(skipQuote.defaultPrevented).toBe(true);
    expect(editorText()).toBe("\"value\"");
    expect(selectionStart()).toBe(7);
    expect(selectionEnd()).toBe(7);

    for (const quote of ["\"", "'", "`"] as const) {
      await act(async () => setText("value"));
      setSelection(0, 5);
      await pressKey(quote);
      expect(editorText()).toBe(`${quote}value${quote}`);
      expect(selectionStart()).toBe(1);
      expect(selectionEnd()).toBe(6);
      await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    }

    expect(saved).toHaveLength(0);
  });

  it("does not pair modified or composing keystrokes", async () => {
    await enterTextEditing();
    await act(async () => setText("value"));
    setSelection(0);

    const ctrlModified = await pressKey("(", { ctrlKey: true });
    expect(ctrlModified.defaultPrevented).toBe(false);
    const composing = await pressKey("[", { isComposing: true });
    expect(composing.defaultPrevented).toBe(false);
    expect(saved).toHaveLength(0);
  });

  it("activates JSON syntax interpretation without blocking invalid drafts", async () => {
    await enterTextFileEditing("data.json");

    const nodeNames: string[] = [];
    syntaxTree(editorView().state).iterate({
      enter: (node) => {
        nodeNames.push(node.name);
      },
    });
    expect(nodeNames).toContain("JsonText");
    expect(nodeNames).toContain("Object");
    expect(nodeNames).toContain("PropertyName");

    await act(async () => setText('{"answer": }'));
    expect(host.querySelector("[data-text-file-status]")?.textContent).toContain("Modified");
    await saveText();
    expect(host.querySelector("[data-text-file-status]")?.textContent).toContain("Saved");
  });

  it("activates native XML syntax, auto-closing, and non-blocking invalid editing", async () => {
    await enterTextFileEditing("data.xml");

    const nodeNames: string[] = [];
    syntaxTree(editorView().state).iterate({
      enter: (node) => {
        nodeNames.push(node.name);
      },
    });
    expect(nodeNames).toContain("Document");
    expect(nodeNames).toContain("Element");
    expect(nodeNames).toContain("OpenTag");
    expect(nodeNames).toContain("AttributeName");

    await act(async () => setText(""));
    setSelection(0);
    let handled = false;
    await act(async () => {
      insertText("<");
      insertText("tag");
      handled = insertText(">");
    });
    expect(handled).toBe(true);
    expect(editorText()).toBe("<tag></tag>");
    expect(selectionStart()).toBe(5);
    expect(selectionEnd()).toBe(5);

    await act(async () => setText(""));
    setSelection(0);
    await act(async () => {
      insertText("<");
      insertText("tag id=\"1\"");
      handled = insertText(">");
    });
    expect(handled).toBe(true);
    expect(editorText()).toBe("<tag id=\"1\"></tag>");
    expect(selectionStart()).toBe(12);

    await act(async () => setText(""));
    setSelection(0);
    await act(async () => {
      insertText("<");
      insertText("item ");
      insertText("/");
      handled = insertText(">");
    });
    expect(handled).toBe(false);
    expect(editorText()).toBe("<item />");

    await act(async () => setText("<root></root>"));
    setSelection(6);
    await act(async () => {
      insertText("<");
      insertText("/");
      insertText("item");
      insertText(">");
    });
    expect(editorText()).toBe("<root></item></root>");

    await act(async () => setText("<root><item>"));
    expect(host.querySelector("[data-text-file-status]")?.textContent).toContain("Modified");
    await saveText();
    expect(host.querySelector("[data-text-file-status]")?.textContent).toContain("Saved");
  });

  it("uses native XML indentation for 2 spaces, 4 spaces, and tabs", async () => {
    await enterTextFileEditing("data.xml");

    await act(async () => setText("<root></root>"));
    setSelection(6);
    await act(async () => insertNewlineAndIndent(editorView()));
    expect(editorText()).toBe("<root>\n  \n</root>");

    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    await setIndentationMode("4");
    await act(async () => setText("<root></root>"));
    setSelection(6);
    await act(async () => insertNewlineAndIndent(editorView()));
    expect(editorText()).toBe("<root>\n    \n</root>");

    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    await setIndentationMode("tab");
    await act(async () => setText("<root></root>"));
    setSelection(6);
    await act(async () => insertNewlineAndIndent(editorView()));
    expect(editorText()).toBe("<root>\n\t\n</root>");
  });

  it("uses the XML profile for SVG text files", async () => {
    await enterTextFileEditing("icon.svg");

    const nodeNames: string[] = [];
    syntaxTree(editorView().state).iterate({
      enter: (node) => {
        nodeNames.push(node.name);
      },
    });
    expect(nodeNames).toContain("Document");
    expect(nodeNames).toContain("Element");
    expect(nodeNames).toContain("TagName");
  });

  it("uses a plain-text profile for non-JSON text files", async () => {
    await enterTextEditing();

    const nodeNames: string[] = [];
    syntaxTree(editorView().state).iterate({
      enter: (node) => {
        nodeNames.push(node.name);
      },
    });

    expect(nodeNames).not.toContain("JsonText");
    expect(nodeNames).not.toContain("PropertyName");
    expect(editorText()).toBe("before");
  });

  it("switches clean text files without canonical writes or history", async () => {
    await enterTextEditing();
    const firstView = editorView();

    expect(fileEditButton("notes.txt").disabled).toBe(true);
    expect(fileEditButton("other.txt").disabled).toBe(false);

    await act(async () => fileEditButton("other.txt").click());

    expect(firstView.dom.isConnected).toBe(false);
    expect(editorView()).not.toBe(firstView);
    expect(editorText()).toBe("second canonical");
    expect(saved).toHaveLength(0);
    expect(fileEditButton("notes.txt").disabled).toBe(false);

    await act(async () => fileEditButton("notes.txt").click());
    expect(editorText()).toBe("before");
    expect(saved).toHaveLength(0);

    await exitTextEditing();
    await act(async () => button(host, "Custom Resources").click());
    await act(async () => button(host, "History").click());
    expect(host.querySelectorAll("[class*='historyEntry']")).toHaveLength(0);
  });

  it("isolates one active File draft from every other File", async () => {
    await enterTextEditing();
    await act(async () => setText("A draft"));

    const firstView = editorView();
    const secondEdit = fileEditButton("other.txt");
    expect(secondEdit.disabled).toBe(true);
    await act(async () => secondEdit.click());
    expect(editorView()).toBe(firstView);
    expect(editorText()).toBe("A draft");
    expect(saved).toHaveLength(0);

    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    expect(secondEdit.disabled).toBe(false);

    await act(async () => secondEdit.click());
    expect(editorText()).toBe("second canonical");
    await act(async () => setText("B changed"));
    await saveText();

    const snapshot = await saveCanonicalSnapshot();
    expect(snapshot.resources?.files?.find((file) => file.id === "file-library-text-record")?.source).toEqual({ type: "text", content: "before" });
    expect(snapshot.resources?.files?.find((file) => file.id === "second-text-file")?.source).toEqual({ type: "text", content: "B changed" });
  });
});
