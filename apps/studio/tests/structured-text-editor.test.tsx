// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditorView } from "@codemirror/view";

import { StructuredTextEditor } from "../src/features/editor/structured-text-editor";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

Object.defineProperty(Range.prototype, "getClientRects", { value: () => [] });
Object.defineProperty(Range.prototype, "getBoundingClientRect", { value: () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }) });
Object.defineProperty(Element.prototype, "getClientRects", { value: () => [] });

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...options });
}

function setNativeValue(control: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected an input value setter");
  setter.call(control, value);
  control.dispatchEvent(new Event("keyup", { bubbles: true }));
}

describe("StructuredTextEditor CodeMirror ergonomics", () => {
  let host: HTMLDivElement;
  let root: Root;
  let saved: string[];
  let dirtyValues: boolean[];

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    saved = [];
    dirtyValues = [];
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function mount(baseline = "alpha\nbeta\nalpha"): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <StructuredTextEditor
          title="Test source"
          baseline={baseline}
          profile="plain"
          ariaLabel="Test source editor"
          onSave={(content) => saved.push(content)}
          onDirtyChange={(dirty) => dirtyValues.push(dirty)}
          onExit={() => {}}
        />
      </StudioI18nProvider>,
    ));
  }

  function editorView(): EditorView {
    const editor = host.querySelector<HTMLElement>(".cm-editor");
    if (!editor) throw new Error("CodeMirror editor was not rendered");
    const view = EditorView.findFromDOM(editor);
    if (!view) throw new Error("CodeMirror view was not found");
    return view;
  }

  function searchPanel(): HTMLElement {
    const panel = host.querySelector<HTMLElement>(".cm-panel.cm-search");
    if (!panel) throw new Error("native CodeMirror search panel was not rendered");
    return panel;
  }

  it("renders native line numbers and active line/gutter highlighting", async () => {
    await mount();
    const view = editorView();

    expect(host.querySelector(".cm-lineNumbers")).not.toBeNull();
    view.focus();
    view.dispatch({ selection: { anchor: 6 } });

    expect(host.querySelector(".cm-activeLine")).not.toBeNull();
    expect(host.querySelector(".cm-activeLineGutter")).not.toBeNull();
  });

  it("opens the same native search panel from the toolbar and Ctrl+F", async () => {
    await mount();
    const view = editorView();
    const searchButton = host.querySelector<HTMLButtonElement>("[data-text-file-action='search']");
    if (!searchButton) throw new Error("Search toolbar action was not rendered");

    await act(async () => searchButton.click());
    const toolbarPanel = searchPanel();
    expect(toolbarPanel.querySelector<HTMLInputElement>("input[name='search']")).not.toBeNull();

    await act(async () => {
      view.focus();
      view.contentDOM.dispatchEvent(key("f", { ctrlKey: true }));
    });
    expect(host.querySelectorAll(".cm-panel.cm-search")).toHaveLength(1);
  });

  it("uses native search navigation and replacement as transient editor changes", async () => {
    await mount();
    const view = editorView();
    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='search']")?.click());

    const panel = searchPanel();
    const searchInput = panel.querySelector<HTMLInputElement>("input[name='search']");
    const replaceInput = panel.querySelector<HTMLInputElement>("input[name='replace']");
    const nextButton = panel.querySelector<HTMLButtonElement>("button[name='next']");
    const previousButton = panel.querySelector<HTMLButtonElement>("button[name='prev']");
    const replaceButton = panel.querySelector<HTMLButtonElement>("button[name='replace']");
    if (!searchInput || !replaceInput || !nextButton || !previousButton || !replaceButton) {
      throw new Error("native search controls were not rendered");
    }

    await act(async () => {
      setNativeValue(searchInput, "alpha");
      setNativeValue(replaceInput, "omega");
    });
    expect(host.querySelectorAll(".cm-searchMatch").length).toBeGreaterThan(0);

    const initialHead = view.state.selection.main.head;
    await act(async () => nextButton.click());
    expect(view.state.selection.main.head).not.toBe(initialHead);
    await act(async () => previousButton.click());

    await act(async () => replaceButton.click());
    expect(view.state.doc.toString()).toContain("omega");
    expect(saved).toEqual([]);
    expect(dirtyValues.at(-1)).toBe(true);

    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='discard']")?.click());
    expect(view.state.doc.toString()).toBe("alpha\nbeta\nalpha");
    expect(saved).toEqual([]);

  });

  it("saves a native replacement only through the existing editor Save boundary", async () => {
    await mount();
    const view = editorView();
    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='search']")?.click());
    const panel = searchPanel();
    const searchInput = panel.querySelector<HTMLInputElement>("input[name='search']");
    const replaceInput = panel.querySelector<HTMLInputElement>("input[name='replace']");
    const nextButton = panel.querySelector<HTMLButtonElement>("button[name='next']");
    const replaceButton = panel.querySelector<HTMLButtonElement>("button[name='replace']");
    if (!searchInput || !replaceInput || !nextButton || !replaceButton) throw new Error("native replace controls were not rendered");

    await act(async () => {
      setNativeValue(searchInput, "alpha");
      setNativeValue(replaceInput, "omega");
      nextButton.click();
      replaceButton.click();
    });
    expect(view.state.doc.toString()).toContain("omega");
    expect(saved).toEqual([]);
    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='save']")?.click());
    expect(saved).toEqual(["omega\nbeta\nalpha"]);
  });
});
