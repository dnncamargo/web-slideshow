// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PresentationSchema, type Presentation } from "@powershow/document-schema";

vi.mock("../src/features/editor/editor-history-state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/features/editor/editor-history-state")>();
  return { ...actual, commitHistory: vi.fn(actual.commitHistory) };
});

import * as historyState from "../src/features/editor/editor-history-state";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const MOVE_META = { kind: "element.move", labelKey: "history.element.move" } as const;

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...options });
}

function image(id: string, alt = id) {
  return {
    type: "image" as const,
    id,
    hidden: false,
    src: `/${id}.png`,
    alt,
    layout: { position: "absolute" as const },
  };
}

function text(id: string, content: string) {
  return {
    type: "text" as const,
    id,
    hidden: false,
    variant: "body" as const,
    content,
    layout: { position: "absolute" as const },
  };
}

function basePresentation(elements: Presentation["slides"][number]["elements"]): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4d1b-element-move-history",
    title: "CP4D1B element move history",
    slides: [{ id: "slide-1", title: "Slide 1", elements }],
  });
}

function siblingPresentation(): Presentation {
  return basePresentation([text("text-a", "A"), text("text-b", "B"), text("text-c", "C")]);
}

function containerPresentation(): Presentation {
  return basePresentation([
    text("text-a", "A"),
    {
      type: "container",
      id: "container-a",
      hidden: false,
      children: [],
    },
    {
      type: "container",
      id: "container-b",
      hidden: false,
      children: [],
    },
  ]);
}

function structuredTablePresentation(): Presentation {
  return basePresentation([{
    type: "table",
    id: "table-1",
    mode: "structured",
    showHeader: true,
    hidden: false,
    columns: [{
      id: "column-1",
      header: { id: "header-slot-1", children: [] },
    }],
    rows: [{
      id: "row-1",
      cells: [{
        id: "cell-slot-1",
        children: [text("cell-text-a", "Cell A"), text("cell-text-b", "Cell B")],
      }],
    }],
  }]);
}

  function rootIds(presentation: Presentation): string[] {
    return presentation.slides[0]?.elements.map((element) => element.id) ?? [];
  }

  function canvasIds(host: HTMLElement): string[] {
    return Array.from(
      host.querySelectorAll<HTMLElement>("[class*='slideCanvas'] [data-powershow-id]"),
      (element) => element.dataset.powershowId ?? "",
    );
  }

function cellIds(presentation: Presentation): string[] {
  const table = presentation.slides[0]?.elements[0];
  if (table?.type !== "table" || table.mode !== "structured") return [];
  return table.rows[0]?.cells[0]?.children.map((element) => element.id) ?? [];
}

function setSelectValue(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLSelectElement.value setter");
  setter.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("CP4D1B generic element move history", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(historyState.commitHistory).mockClear();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  async function mount(next: Presentation = siblingPresentation()): Promise<void> {
    await act(async () => {
      root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={next} /></StudioI18nProvider>);
    });
  }

  async function selectCanvasElement(id: string): Promise<void> {
    const element = container.querySelector<HTMLElement>(`[data-powershow-id="${id}"]`);
    if (!element) throw new Error(`element ${id} was not rendered`);
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function openElementTree(): Promise<void> {
    const tab = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Elements");
    if (!tab) throw new Error("Elements tab was not rendered");
    await act(async () => tab.click());
  }

  async function selectTreeElement(id: string): Promise<void> {
    const canvasElement = container.querySelector<HTMLElement>(`[data-powershow-id="${id}"]`);
    if (!canvasElement) throw new Error(`element ${id} was not rendered`);
    const label = canvasElement.textContent?.trim() || id;
    const treeButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button[class*='elementTreeSelect']"))
      .find((button) => button.textContent?.includes(label));
    if (!treeButton) throw new Error(`tree element ${id} was not rendered`);
    await act(async () => treeButton.click());
  }

  function moveButton(label: "up" | "down"): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>(`button[aria-label="Move ${label}"]`);
    if (!button) throw new Error(`Move ${label} button was not rendered`);
    return button;
  }

  function moveToSelect(): HTMLSelectElement {
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Move to"]');
    if (!select) throw new Error("Move to select was not rendered");
    return select;
  }

  function lastCommittedPresentation(): Presentation {
    const presentation = vi.mocked(historyState.commitHistory).mock.lastCall?.[1];
    if (!presentation) throw new Error("expected a committed presentation");
    return presentation;
  }

  function dispatchUndo(): void {
    window.dispatchEvent(key("z", { ctrlKey: true }));
  }

  function dispatchRedo(): void {
    window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true }));
  }

  function treeRowForLabel(label: string): HTMLElement {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button[class*='elementTreeSelect']"))
      .find((candidate) => candidate.textContent?.includes(label));
    if (!button) throw new Error(`tree row ${label} was not rendered`);
    const row = button.closest("[draggable='true']");
    if (!(row instanceof HTMLElement)) throw new Error(`tree row ${label} has no draggable row`);
    return row;
  }

  async function dragBefore(sourceLabel: string, targetLabel: string): Promise<void> {
    const source = treeRowForLabel(sourceLabel);
    const target = treeRowForLabel(targetLabel);
    const dataTransfer = { effectAllowed: "", setData: vi.fn() };
    const dragStart = new Event("dragstart", { bubbles: true });
    Object.defineProperty(dragStart, "dataTransfer", { value: dataTransfer });
    const dragOver = new Event("dragover", { bubbles: true, cancelable: true });
    Object.defineProperty(dragOver, "clientY", { value: -1 });
    const drop = new Event("drop", { bubbles: true, cancelable: true });

    await act(async () => source.dispatchEvent(dragStart));
    await act(async () => target.dispatchEvent(dragOver));
    await act(async () => target.dispatchEvent(drop));
  }

  it("tracks Inspector layer movement with exact sibling Undo and Redo", async () => {
    await mount();
    await selectCanvasElement("text-b");

    const bringToFront = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Bring to front"));
    if (!bringToFront) throw new Error("Inspector Bring to front control was not rendered");

    await act(async () => bringToFront.click());
    expect(rootIds(lastCommittedPresentation())).toEqual(["text-a", "text-c", "text-b"]);
    expect(historyState.commitHistory).toHaveBeenCalledTimes(1);
    expect(historyState.commitHistory).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), MOVE_META);

    await act(async () => dispatchUndo());
    expect(canvasIds(container)).toEqual(["text-a", "text-b", "text-c"]);
    await act(async () => dispatchRedo());
    expect(canvasIds(container)).toEqual(["text-a", "text-c", "text-b"]);
  });

  it("tracks Element Tree Move Up and Move Down as separate actions", async () => {
    await mount();
    await openElementTree();
    await selectTreeElement("text-b");

    await act(async () => moveButton("up").click());
    expect(rootIds(lastCommittedPresentation())).toEqual(["text-b", "text-a", "text-c"]);
    await act(async () => moveButton("down").click());
    expect(rootIds(lastCommittedPresentation())).toEqual(["text-a", "text-b", "text-c"]);
    expect(historyState.commitHistory).toHaveBeenCalledTimes(2);
    expect(vi.mocked(historyState.commitHistory).mock.calls[0]?.[2]).toEqual(MOVE_META);
    expect(vi.mocked(historyState.commitHistory).mock.calls[1]?.[2]).toEqual(MOVE_META);

    await act(async () => dispatchUndo());
    expect(canvasIds(container)).toEqual(["text-b", "text-a", "text-c"]);
    await act(async () => dispatchUndo());
    expect(canvasIds(container)).toEqual(["text-a", "text-b", "text-c"]);
  });

  it("moves root elements into and between containers, then back to the slide", async () => {
    await mount(containerPresentation());
    await openElementTree();
    await selectTreeElement("text-a");

    await act(async () => setSelectValue(moveToSelect(), "container-a"));
    expect(lastCommittedPresentation().slides[0]?.elements[0]).toMatchObject({
      type: "container",
      id: "container-a",
      children: [expect.objectContaining({ id: "text-a" })],
    });

    await act(async () => setSelectValue(moveToSelect(), "container-b"));
    expect(lastCommittedPresentation().slides[0]?.elements[1]).toMatchObject({
      type: "container",
      id: "container-b",
      children: [expect.objectContaining({ id: "text-a" })],
    });

    await act(async () => setSelectValue(moveToSelect(), ""));
    expect(rootIds(lastCommittedPresentation())).toEqual(["container-a", "container-b", "text-a"]);
    expect(historyState.commitHistory).toHaveBeenCalledTimes(3);
    expect(vi.mocked(historyState.commitHistory).mock.calls.map((call) => call[2])).toEqual([MOVE_META, MOVE_META, MOVE_META]);

    await act(async () => dispatchUndo());
    expect(container.querySelector('[data-powershow-id="container-b"] [data-powershow-id="text-a"]')).not.toBeNull();
    await act(async () => dispatchRedo());
    expect(container.querySelector('[data-powershow-id="container-b"] [data-powershow-id="text-a"]')).toBeNull();
  });

  it("reorders real children inside a Structured Table ContentSlot", async () => {
    await mount(structuredTablePresentation());
    await openElementTree();
    await selectTreeElement("cell-text-b");

    await act(async () => moveButton("up").click());
    expect(cellIds(lastCommittedPresentation())).toEqual(["cell-text-b", "cell-text-a"]);
    expect(historyState.commitHistory).toHaveBeenCalledTimes(1);

    await act(async () => dispatchUndo());
    expect(canvasIds(container).filter((id) => id.startsWith("cell-text"))).toEqual(["cell-text-a", "cell-text-b"]);
    await act(async () => dispatchRedo());
    expect(canvasIds(container).filter((id) => id.startsWith("cell-text"))).toEqual(["cell-text-b", "cell-text-a"]);
  });

  it("rejects a Structured Table ContentSlot reparent without History", async () => {
    await mount(structuredTablePresentation());
    await openElementTree();
    vi.mocked(historyState.commitHistory).mockClear();

    await dragBefore("Cell B", "Table");
    expect(container.querySelector('[data-powershow-id="cell-text-a"]')).not.toBeNull();
    expect(container.querySelector('[data-powershow-id="cell-text-b"]')).not.toBeNull();
    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
  });

  it("rejects canonical adjacent drag and cycle attempts without History", async () => {
    await mount(basePresentation([
      text("text-a", "A"),
      {
        type: "container",
        id: "container-a",
        hidden: false,
        children: [text("container-text", "Inside")],
      },
      text("text-c", "C"),
    ]));
    await openElementTree();
    vi.mocked(historyState.commitHistory).mockClear();

    await dragBefore("A", "Container");
    expect(canvasIds(container)).toEqual(["text-a", "container-a", "container-text", "text-c"]);
    await dragBefore("Container", "Inside");
    expect(canvasIds(container)).toEqual(["text-a", "container-a", "container-text", "text-c"]);
    expect(historyState.commitHistory).toHaveBeenCalled();
    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
  });

  it("finishes a continuous edit before Move and keeps Move separate", async () => {
    await mount();
    const title = container.querySelector<HTMLInputElement>('input[aria-label="Editor"]');
    if (!title) throw new Error("presentation title input was not rendered");
    await act(async () => {
      title.focus();
      changeInput(title, "Edited before move");
    });

    await openElementTree();
    await selectTreeElement("text-b");
    await act(async () => moveButton("up").click());
    expect(rootIds(lastCommittedPresentation())).toEqual(["text-b", "text-a", "text-c"]);
    expect(historyState.commitHistory).toHaveBeenCalledTimes(1);
    expect(vi.mocked(historyState.commitHistory).mock.calls[0]?.[2]).toEqual(MOVE_META);

    await act(async () => dispatchUndo());
    expect(canvasIds(container)).toEqual(["text-a", "text-b", "text-c"]);
    expect(title.value).toBe("Edited before move");
    await act(async () => dispatchUndo());
    expect(title.value).toBe("CP4D1B element move history");
  });

  it("does not consume Undo for an adjacent drag no-op with no prior action", async () => {
    await mount();
    await openElementTree();
    vi.mocked(historyState.commitHistory).mockClear();

    await dragBefore("A", "B");
    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
  });
});
