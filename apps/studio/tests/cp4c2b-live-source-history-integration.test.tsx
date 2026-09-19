// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type BlocksElement,
  type CodeElement,
  type PlotElement,
  type Presentation,
} from "@powershow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { CodeInspector } from "../src/features/editor/inspector/code-inspector";
import { PlotInspector } from "../src/features/editor/inspector/plot-inspector";
import { BlocksContentSection } from "../src/features/editor/inspector/sections/blocks-content-section";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const CODE_ID = "cp4c2b-code";
const PLOT_ID = "cp4c2b-plot";
const BLOCKS_ID = "cp4c2b-blocks";
const INITIAL_CODE = "const value = 1;";
const INITIAL_LANGUAGE = "typescript";
const INITIAL_PLOT_SOURCE = "y = x^2";
const INITIAL_BLOCKS_SOURCE = "\\statement(move)";

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4c2b-live-source-history",
    title: "CP4C2B live source history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [
        {
          id: CODE_ID,
          type: "code",
          hidden: false,
          code: INITIAL_CODE,
          language: INITIAL_LANGUAGE,
          showLineNumbers: true,
          highlightedLines: [],
        },
        {
          id: PLOT_ID,
          type: "plot",
          hidden: false,
          source: INITIAL_PLOT_SOURCE,
        },
        {
          id: BLOCKS_ID,
          type: "blocks",
          hidden: false,
          source: INITIAL_BLOCKS_SOURCE,
        },
      ],
    }],
  });
}

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: value,
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

function setTextValue(control: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = control instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) throw new Error("expected text control value setter");
  setter.call(control, value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("CP4C2B live source history", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function mount(initial = presentation()): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={initial} />
      </StudioI18nProvider>,
    ));
  }

  async function selectElement(id: string): Promise<void> {
    const element = host.querySelector<HTMLElement>(`[data-powershow-id="${id}"]`);
    if (!element) throw new Error(`element ${id} was not rendered`);
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  function input(id: string): HTMLInputElement {
    const control = host.querySelector<HTMLInputElement>(`#${id}`);
    if (!control) throw new Error(`input ${id} was not rendered`);
    return control;
  }

  function textarea(id: string): HTMLTextAreaElement {
    const control = host.querySelector<HTMLTextAreaElement>(`#${id}`);
    if (!control) throw new Error(`textarea ${id} was not rendered`);
    return control;
  }

  async function edit(
    control: HTMLInputElement | HTMLTextAreaElement,
    values: readonly string[],
    blur = true,
  ): Promise<void> {
    await act(async () => {
      control.focus();
      for (const value of values) setTextValue(control, value);
      if (blur) control.blur();
    });
  }

  async function undo(): Promise<KeyboardEvent> {
    const event = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(event));
    return event;
  }

  async function redo(): Promise<KeyboardEvent> {
    const event = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(event));
    return event;
  }

  function blocksToolbarButton(label: string): HTMLButtonElement {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>(
      '[data-powershow-blocks-toolbar="true"] button',
    )).find((candidate) => candidate.textContent?.trim() === label);
    if (!button) throw new Error(`Blocks toolbar button ${label} was not rendered`);
    return button;
  }

  it("coalesces Code language and preserves raw datalist authoring", async () => {
    await mount();
    await selectElement(CODE_ID);
    const language = input("code-language");

    await edit(language, ["javascript", "python"]);
    expect(language.value).toBe("python");

    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(true);
    expect(input("code-language").value).toBe(INITIAL_LANGUAGE);

    const redoEvent = await redo();
    expect(redoEvent.defaultPrevented).toBe(true);
    expect(input("code-language").value).toBe("python");
    expect(input("code-language").getAttribute("list")).toBe("powershow-code-languages");
  });

  it("does not create Code language history for a same-value input", async () => {
    await mount();
    await selectElement(CODE_ID);
    await edit(input("code-language"), [INITIAL_LANGUAGE]);

    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(false);
    const externalUndo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(externalUndo));
    expect(externalUndo.defaultPrevented).toBe(false);
  });

  it("keeps Code language separate from the existing RichText source transaction", async () => {
    await mount();
    await selectElement(CODE_ID);

    await edit(input("code-language"), ["python"]);
    await edit(textarea("code-source"), ["const value = 2;"]);

    await undo();
    expect(textarea("code-source").value).toBe(INITIAL_CODE);
    expect(input("code-language").value).toBe("python");
    await undo();
    expect(input("code-language").value).toBe(INITIAL_LANGUAGE);
  });

  it("coalesces Plot source, keeps raw multiline input, and ignores same values", async () => {
    await mount();
    await selectElement(PLOT_ID);
    const source = textarea("plot-source");

    await edit(source, ["y = sin(x)", "y = sin(x)\ny = x^2"]);
    expect(source.value).toBe("y = sin(x)\ny = x^2");
    expect(source.getAttribute("spellcheck")).toBe("false");
    expect(source.maxLength).toBe(4096);

    await undo();
    expect(textarea("plot-source").value).toBe(INITIAL_PLOT_SOURCE);
    await redo();
    expect(textarea("plot-source").value).toBe("y = sin(x)\ny = x^2");

    await act(async () => root.unmount());
    root = createRoot(host);
    await mount();
    await selectElement(PLOT_ID);
    await edit(textarea("plot-source"), [INITIAL_PLOT_SOURCE]);
    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(false);
  });

  it("coalesces Blocks source and follows canonical parser status through undo", async () => {
    await mount();
    await selectElement(BLOCKS_ID);
    const source = host.querySelector<HTMLTextAreaElement>("[data-powershow-blocks-source]");
    if (!source) throw new Error("Blocks source textarea was not rendered");

    await edit(source, ["\\scope(Repeat", "\\statement(one)\n\\statement(two)"]);
    expect(source.value).toBe("\\statement(one)\n\\statement(two)");
    expect(host.querySelector('[data-powershow-blocks-syntax="valid"]')).not.toBeNull();

    await undo();
    expect(host.querySelector<HTMLTextAreaElement>("[data-powershow-blocks-source]")?.value)
      .toBe(INITIAL_BLOCKS_SOURCE);
    expect(host.querySelector('[data-powershow-blocks-syntax="valid"]')).not.toBeNull();
    await redo();
    expect(host.querySelector<HTMLTextAreaElement>("[data-powershow-blocks-source]")?.value)
      .toBe("\\statement(one)\n\\statement(two)");
  });

  it("does not create Blocks source history for a same-value input", async () => {
    await mount();
    await selectElement(BLOCKS_ID);
    const source = host.querySelector<HTMLTextAreaElement>("[data-powershow-blocks-source]");
    if (!source) throw new Error("Blocks source textarea was not rendered");

    await edit(source, [INITIAL_BLOCKS_SOURCE]);
    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(false);
  });

  it("separates Blocks typing before and after a discrete toolbar insertion", async () => {
    await mount();
    await selectElement(BLOCKS_ID);
    const source = host.querySelector<HTMLTextAreaElement>("[data-powershow-blocks-source]");
    if (!source) throw new Error("Blocks source textarea was not rendered");
    await act(async () => {
      source.focus();
      source.setSelectionRange(source.value.length, source.value.length);
    });

    await act(async () => setTextValue(source, `${INITIAL_BLOCKS_SOURCE} pre`));
    const beforeToolbar = `${INITIAL_BLOCKS_SOURCE} pre`;
    await act(async () => blocksToolbarButton("EV").click());
    const afterToolbar = `${beforeToolbar}\\start()`;
    expect(host.querySelector<HTMLTextAreaElement>("[data-powershow-blocks-source]")?.value)
      .toBe(afterToolbar);

    const postToolbar = `${afterToolbar} post`;
    await act(async () => setTextValue(source, postToolbar));
    await act(async () => source.blur());

    await undo();
    expect(host.querySelector<HTMLTextAreaElement>("[data-powershow-blocks-source]")?.value)
      .toBe(afterToolbar);
    await undo();
    expect(host.querySelector<HTMLTextAreaElement>("[data-powershow-blocks-source]")?.value)
      .toBe(beforeToolbar);
    await undo();
    expect(host.querySelector<HTMLTextAreaElement>("[data-powershow-blocks-source]")?.value)
      .toBe(INITIAL_BLOCKS_SOURCE);
  });

  it("keeps Code, Plot, and Blocks source transactions separate", async () => {
    await mount();

    await selectElement(CODE_ID);
    await edit(input("code-language"), ["python"]);
    await selectElement(PLOT_ID);
    await edit(textarea("plot-source"), ["y = sin(x)"]);
    await selectElement(BLOCKS_ID);
    const blocksSource = host.querySelector<HTMLTextAreaElement>("[data-powershow-blocks-source]");
    if (!blocksSource) throw new Error("Blocks source textarea was not rendered");
    await edit(blocksSource, ["\\statement(changed)"]);

    await undo();
    expect(host.querySelector<HTMLTextAreaElement>("[data-powershow-blocks-source]")?.value)
      .toBe(INITIAL_BLOCKS_SOURCE);
    await selectElement(PLOT_ID);
    expect(textarea("plot-source").value).toBe("y = sin(x)");
    await selectElement(CODE_ID);
    expect(input("code-language").value).toBe("python");
    await undo();
    await selectElement(PLOT_ID);
    expect(textarea("plot-source").value).toBe(INITIAL_PLOT_SOURCE);
    await selectElement(CODE_ID);
    expect(input("code-language").value).toBe("python");
    await undo();
    expect(input("code-language").value).toBe(INITIAL_LANGUAGE);
  });

  it("keeps the three direct owners functional without a History provider", async () => {
    let code: CodeElement = {
      id: CODE_ID,
      type: "code",
      hidden: false,
      code: INITIAL_CODE,
      language: INITIAL_LANGUAGE,
      showLineNumbers: true,
      highlightedLines: [],
    };
    let plot: PlotElement = { id: PLOT_ID, type: "plot", hidden: false, source: INITIAL_PLOT_SOURCE };
    let blocks: BlocksElement = { id: BLOCKS_ID, type: "blocks", hidden: false, source: INITIAL_BLOCKS_SOURCE };

    await act(async () => root.render(
      <StudioI18nProvider>
        <CodeInspector element={code} onUpdate={(update) => { code = update(code) as CodeElement; }} />
        <PlotInspector element={plot} onUpdate={(update) => { plot = update(plot) as PlotElement; }} />
        <BlocksContentSection element={blocks} onUpdate={(update) => { blocks = update(blocks) as BlocksElement; }} />
      </StudioI18nProvider>,
    ));

    await act(async () => setTextValue(input("code-language"), "python"));
    await act(async () => setTextValue(textarea("plot-source"), "y = x"));
    const blocksSource = host.querySelector<HTMLTextAreaElement>("[data-powershow-blocks-source]");
    if (!blocksSource) throw new Error("Blocks source textarea was not rendered");
    await act(async () => setTextValue(blocksSource, "\\statement(fallback)"));

    expect(code.language).toBe("python");
    expect(plot.source).toBe("y = x");
    expect(blocks.source).toBe("\\statement(fallback)");
  });
});
