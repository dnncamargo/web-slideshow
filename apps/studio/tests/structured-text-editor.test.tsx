// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSearchQuery } from "@codemirror/search";
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
  control.dispatchEvent(new Event("input", { bubbles: true }));
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
    const panel = host.querySelector<HTMLElement>(".cm-panel.cm-structuredSearch");
    if (!panel) throw new Error("custom CodeMirror search panel was not rendered");
    return panel;
  }

  function searchToggle(content: string): HTMLButtonElement {
    const toggle = host.querySelector<HTMLButtonElement>(`[data-search-toggle='${content}']`);
    if (!toggle) throw new Error(`search toggle ${content} was not rendered`);
    return toggle;
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

  it("highlights other occurrences of the selected text with native selection-match decoration", async () => {
    await mount();
    const view = editorView();

    view.dispatch({ selection: { anchor: 0, head: 5 } });

    expect(host.querySelectorAll(".cm-selectionMatch").length).toBeGreaterThan(0);
  });

  it("toggles the custom search panel from the toolbar and reopens it with Ctrl+F", async () => {
    await mount();
    const view = editorView();
    const searchButton = host.querySelector<HTMLButtonElement>("[data-text-file-action='search']");
    if (!searchButton) throw new Error("Search toolbar action was not rendered");

    await act(async () => searchButton.click());
    const toolbarPanel = searchPanel();
    expect(toolbarPanel.querySelector<HTMLInputElement>("input[name='search']")).not.toBeNull();

    await act(async () => searchButton.click());
    expect(host.querySelector(".cm-panel.cm-structuredSearch")).toBeNull();

    await act(async () => {
      view.focus();
      view.contentDOM.dispatchEvent(key("f", { ctrlKey: true }));
    });
    expect(host.querySelectorAll(".cm-panel.cm-structuredSearch")).toHaveLength(1);
    expect(host.querySelector<HTMLInputElement>("input[name='search']")).toBe(document.activeElement);
  });

  it("renders a compact custom panel with a local replace disclosure and query toggles", async () => {
    await mount();
    const view = editorView();
    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='search']")?.click());

    const panel = searchPanel();
    const searchInput = panel.querySelector<HTMLInputElement>("input[name='search']");
    const findRow = panel.querySelector<HTMLElement>(".cm-structuredSearchFindRow");
    const replaceRow = panel.querySelector<HTMLElement>(".cm-structuredSearchReplaceRow");
    const findField = panel.querySelector<HTMLElement>(".cm-structuredSearchFindField");
    const replaceField = panel.querySelector<HTMLElement>(".cm-structuredSearchReplaceRow .cm-structuredSearchField");
    const status = panel.querySelector<HTMLElement>("[data-search-status]");
    const disclosure = panel.querySelector<HTMLButtonElement>(".cm-structuredSearchDisclosure");
    const previousButton = panel.querySelector<HTMLButtonElement>("button[name='prev']");
    const nextButton = panel.querySelector<HTMLButtonElement>("button[name='next']");
    const replaceButton = panel.querySelector<HTMLButtonElement>("button[name='replace']");
    const replaceAllButton = panel.querySelector<HTMLButtonElement>("button[name='replaceAll']");
    if (!searchInput || !findRow || !replaceRow || !findField || !replaceField || !status || !disclosure || !previousButton || !nextButton || !replaceButton || !replaceAllButton) {
      throw new Error("custom search controls were not rendered");
    }

    expect(searchInput.getAttribute("main-field")).toBe("true");
    expect(panel.querySelector("button[name='close']")).toBeNull();
    expect(findField.querySelectorAll(".cm-structuredSearchToggle")).toHaveLength(3);
    expect(findField.contains(status)).toBe(false);
    expect(findRow.contains(status)).toBe(true);
    expect(replaceField.querySelector("input[name='replace']")).not.toBeNull();
    expect(replaceField.querySelector(".cm-structuredSearchToggle")).toBeNull();
    expect(findRow.contains(previousButton)).toBe(true);
    expect(findRow.contains(nextButton)).toBe(true);
    expect(replaceRow.contains(replaceButton)).toBe(true);
    expect(replaceRow.contains(replaceAllButton)).toBe(true);
    expect(replaceRow.hidden).toBe(false);
    expect(disclosure.getAttribute("aria-expanded")).toBe("true");
    expect(searchToggle("Aa").getAttribute("aria-pressed")).toBe("false");
    expect(searchToggle("ab").getAttribute("aria-pressed")).toBe("false");
    expect(searchToggle(".*").getAttribute("aria-pressed")).toBe("false");

    await act(async () => disclosure.click());
    expect(replaceRow.hidden).toBe(true);
    expect(replaceRow.contains(replaceButton)).toBe(true);
    expect(replaceRow.contains(replaceAllButton)).toBe(true);
    expect(disclosure.getAttribute("aria-expanded")).toBe("false");
    await act(async () => disclosure.click());
    expect(replaceRow.hidden).toBe(false);

    await act(async () => searchToggle("Aa").click());
    await act(async () => searchToggle("ab").click());
    await act(async () => searchToggle(".*").click());
    expect(getSearchQuery(view.state)).toMatchObject({ caseSensitive: true, wholeWord: true, regexp: true });
    expect(searchToggle("Aa").getAttribute("aria-pressed")).toBe("true");
    expect(searchToggle("ab").getAttribute("aria-pressed")).toBe("true");
    expect(searchToggle(".*").getAttribute("aria-pressed")).toBe("true");
  });

  it("shows result status, closes from the toolbar, and closes with Escape", async () => {
    await mount();
    await act(async () => host.querySelector<HTMLButtonElement>("[data-text-file-action='search']")?.click());

    const panel = searchPanel();
    const searchInput = panel.querySelector<HTMLInputElement>("input[name='search']");
    const status = panel.querySelector<HTMLElement>("[data-search-status]");
    const nextButton = panel.querySelector<HTMLButtonElement>("button[name='next']");
    const searchButton = host.querySelector<HTMLButtonElement>("[data-text-file-action='search']");
    if (!searchInput || !status || !nextButton || !searchButton) throw new Error("custom search status controls were not rendered");

    await act(async () => setNativeValue(searchInput, "alpha"));
    expect(status.textContent).toBe("0 / 2");
    await act(async () => nextButton.click());
    expect(status.textContent).toBe("1 / 2");

    await act(async () => setNativeValue(searchInput, "missing"));
    expect(status.textContent).toBe("No results");
    await act(async () => searchButton.click());
    expect(host.querySelector(".cm-panel.cm-structuredSearch")).toBeNull();

    await act(async () => searchButton.click());
    const reopenedInput = searchPanel().querySelector<HTMLInputElement>("input[name='search']");
    if (!reopenedInput) throw new Error("search panel did not reopen");
    await act(async () => reopenedInput.dispatchEvent(key("Escape")));
    expect(host.querySelector(".cm-panel.cm-structuredSearch")).toBeNull();
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
