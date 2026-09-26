// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { materializeSlide, PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

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

function rootBackedLocalPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "root-backed-element-move",
    title: "Root-backed element move",
    defaultRootDefinitionId: "root-1",
    rootDefinitions: [{
      id: "root-1",
      name: "Root",
      localChildTargetIds: ["receiver"],
      root: {
        type: "container",
        id: "root",
        hidden: false,
        children: [{
          type: "container",
          id: "receiver",
          hidden: false,
          children: [text("master-a", "Master A")],
        }],
      },
    }],
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      summary: "",
      speakerNotes: "",
      elements: [],
      localRootChildren: [{
        targetContainerId: "receiver",
        children: [text("local-a", "Local A"), text("local-b", "Local B"), text("local-c", "Local C")],
      }],
    }],
  });
}

function rootBackedTwoReceiverPresentation(): Presentation {
  const initial = rootBackedLocalPresentation();
  const root = initial.rootDefinitions?.[0];
  if (!root) throw new Error("Expected Root Definition");
  return {
    ...initial,
    rootDefinitions: [{
      ...root,
      localChildTargetIds: ["receiver-a", "receiver-b"],
      root: {
        ...root.root,
        children: [
          {
            type: "container",
            id: "receiver-a",
            hidden: false,
            children: [text("master-a", "Master A")],
          },
          {
            type: "container",
            id: "receiver-b",
            hidden: false,
            children: [text("master-b", "Master B")],
          },
        ],
      },
    }],
    slides: [{
      ...initial.slides[0]!,
      localRootChildren: [
        { targetContainerId: "receiver-a", children: [text("local-a1", "Local A1"), text("local-a2", "Local A2")] },
        { targetContainerId: "receiver-b", children: [text("local-b1", "Local B1")] },
      ],
    }],
  };
}

function rootBackedMasterPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "root-backed-master-element-move",
    title: "Root-backed master element move",
    defaultRootDefinitionId: "root-1",
    linkedStyles: [{
      id: "receiver-style",
      name: "Receiver style",
      layout: { position: "absolute" },
    }],
    rootDefinitions: [{
      id: "root-1",
      name: "Root",
      root: {
        type: "container",
        id: "root",
        hidden: false,
        children: [{
          type: "container",
          id: "receiver",
          hidden: false,
          linkedStyleId: "receiver-style",
          children: [
            text("master-a", "Master A"),
            text("master-b", "Master B"),
            text("master-c", "Master C"),
          ],
        }],
      },
    }],
    slides: [
      { id: "slide-1", title: "Slide 1", summary: "", speakerNotes: "", elements: [] },
      { id: "slide-2", title: "Slide 2", summary: "", speakerNotes: "", elements: [] },
    ],
  });
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
      host.querySelectorAll<HTMLElement>("[class*='slideCanvas'] [data-presentation-id]"),
      (element) => element.dataset.presentationId ?? "",
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

  async function mount(
    next: Presentation = siblingPresentation(),
    onSave: (presentation: Presentation) => Promise<void> = async () => {},
    nextAuthoringTarget?: { kind: "slide"; slideIndex: number } | { kind: "root-definition"; rootDefinitionId: string },
  ): Promise<void> {
    await act(async () => {
      root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={next} onSave={onSave} initialAuthoringTarget={nextAuthoringTarget} /></StudioI18nProvider>);
    });
  }

  async function selectCanvasElement(id: string): Promise<void> {
    const element = container.querySelector<HTMLElement>(`[data-presentation-id="${id}"]`);
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
    const canvasElement = container.querySelector<HTMLElement>(`[data-presentation-id="${id}"]`);
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

  async function saveSnapshot(onSave: ReturnType<typeof vi.fn>): Promise<Presentation> {
    const save = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Save");
    if (!save) throw new Error("Save button was not rendered");
    await act(async () => {
      save.click();
      await Promise.resolve();
    });
    const snapshot = onSave.mock.lastCall?.[0] as Presentation | undefined;
    if (!snapshot) throw new Error("Expected saved presentation");
    return snapshot;
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
    expect(container.querySelector('[data-presentation-id="container-b"] [data-presentation-id="text-a"]')).not.toBeNull();
    await act(async () => dispatchRedo());
    expect(container.querySelector('[data-presentation-id="container-b"] [data-presentation-id="text-a"]')).toBeNull();
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
    expect(container.querySelector('[data-presentation-id="cell-text-a"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="cell-text-b"]')).not.toBeNull();
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

  it("reorders Root-backed Slide-local elements in their persisted owner with atomic Undo and Redo", async () => {
    const initial = rootBackedLocalPresentation();
    const onSave = vi.fn(async (_presentation: Presentation) => {});
    await mount(initial, onSave);
    await openElementTree();

    await selectTreeElement("local-a");
    expect(moveButton("up").disabled).toBe(true);

    await selectTreeElement("local-b");
    expect(moveButton("up").disabled).toBe(false);
    await act(async () => moveButton("up").click());

    const moved = lastCommittedPresentation();
    expect(moved.slides[0]?.elements).toEqual([]);
    expect(moved.slides[0]?.localRootChildren?.[0]?.children.map((element) => element.id)).toEqual([
      "local-b",
      "local-a",
      "local-c",
    ]);
    expect(moved.rootDefinitions).toEqual(initial.rootDefinitions);
    expect(materializeSlide(moved, moved.slides[0]!).slide.elements[0]).toMatchObject({
      id: "root",
      children: [{
        id: "receiver",
        children: [
          { id: "master-a" },
          { id: "local-b" },
          { id: "local-a" },
          { id: "local-c" },
        ],
      }],
    });
    expect(historyState.commitHistory).toHaveBeenCalledTimes(1);
    expect(await saveSnapshot(onSave)).toEqual(moved);

    await act(async () => dispatchUndo());
    expect(await saveSnapshot(onSave)).toEqual(initial);
    expect(canvasIds(container).filter((id) => ["master-a", "local-a", "local-b", "local-c"].includes(id))).toEqual([
      "master-a",
      "local-a",
      "local-b",
      "local-c",
    ]);

    await act(async () => dispatchRedo());
    expect(await saveSnapshot(onSave)).toEqual(moved);
    expect(canvasIds(container).filter((id) => ["master-a", "local-a", "local-b", "local-c"].includes(id))).toEqual([
      "master-a",
      "local-b",
      "local-a",
      "local-c",
    ]);

  });

  it("routes Root-backed master movement through the Root Definition and shared Slides", async () => {
    const initial = rootBackedMasterPresentation();
    const onSave = vi.fn(async () => {});
    await mount(initial, onSave);
    await openElementTree();
    await selectTreeElement("master-b");

    expect(moveButton("up").disabled).toBe(false);
    expect(moveButton("down").disabled).toBe(false);
    expect(moveToSelect().disabled).toBe(false);
    expect(treeRowForLabel("Master B").getAttribute("draggable")).toBe("true");

    await dragBefore("Master B", "Master A");

    await act(async () => setSelectValue(moveToSelect(), "receiver"));

    const moved = lastCommittedPresentation();
    expect(moved.slides.map((slide) => slide.elements)).toEqual([[], []]);
    expect(moved.rootDefinitions?.[0]?.root.children.map((element) => element.id)).toEqual(["receiver"]);
    const movedReceiver = moved.rootDefinitions?.[0]?.root.children[0];
    expect(movedReceiver?.type).toBe("container");
    if (movedReceiver?.type !== "container") throw new Error("Expected master receiver");
    expect(movedReceiver.children.map((element) => element.id)).toEqual(["master-a", "master-c", "master-b"]);
    expect(moved.linkedStyles).toEqual(initial.linkedStyles);
    expect(materializeSlide(moved, moved.slides[1]!).slide.elements[0]).toMatchObject({
      id: "root",
      children: [{ id: "receiver", children: [{ id: "master-a" }, { id: "master-c" }, { id: "master-b" }] }],
    });
    expect(historyState.commitHistory).toHaveBeenCalledTimes(2);
    expect(await saveSnapshot(onSave)).toEqual(moved);

    await act(async () => dispatchUndo());
    await act(async () => dispatchUndo());
    expect(await saveSnapshot(onSave)).toEqual(initial);
    await act(async () => dispatchRedo());
    await act(async () => dispatchRedo());
    expect(await saveSnapshot(onSave)).toEqual(moved);
  });

  it("uses the same Root Definition owner when editing directly", async () => {
    const initial = rootBackedMasterPresentation();
    await mount(initial, async () => {}, { kind: "root-definition", rootDefinitionId: "root-1" });
    await openElementTree();
    await selectTreeElement("master-b");

    await act(async () => moveButton("up").click());

    const moved = lastCommittedPresentation();
    const receiver = moved.rootDefinitions?.[0]?.root.children[0];
    expect(receiver?.type).toBe("container");
    if (receiver?.type !== "container") throw new Error("Expected direct Root receiver");
    expect(receiver.children.map((element) => element.id)).toEqual(["master-b", "master-a", "master-c"]);
    expect(moved.slides).toEqual(initial.slides);
  });

  it("rejects Root-backed drops across master and local owners", async () => {
    await mount(rootBackedLocalPresentation());
    await openElementTree();
    vi.mocked(historyState.commitHistory).mockClear();

    await dragBefore("Master A", "Local A");
    await dragBefore("Local A", "Master A");

    expect(historyState.commitHistory).not.toHaveBeenCalled();
    expect(canvasIds(container).filter((id) => ["master-a", "local-a", "local-b", "local-c"].includes(id))).toEqual([
      "master-a",
      "local-a",
      "local-b",
      "local-c",
    ]);
  });

  it("rejects a Root-backed cross-receiver drag without mutation or History", async () => {
    await mount(rootBackedTwoReceiverPresentation());
    await openElementTree();
    vi.mocked(historyState.commitHistory).mockClear();

    await dragBefore("Local A2", "Local B1");

    expect(historyState.commitHistory).not.toHaveBeenCalled();
    expect(canvasIds(container)).toEqual(expect.arrayContaining([
      "local-a1",
      "local-a2",
      "local-b1",
    ]));
  });
});
