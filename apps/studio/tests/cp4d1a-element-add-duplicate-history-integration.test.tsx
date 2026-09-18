// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  POWERSHOW_TABLE_CELL_TEXT_STYLE_ID,
  POWERSHOW_TABLE_COLUMN_HEADER_TEXT_STYLE_ID,
  POWERSHOW_TOPICS_TEXT_STYLE_ID,
  PresentationSchema,
  type Presentation,
} from "@powershow/document-schema";

vi.mock("../src/features/editor/editor-history-state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/features/editor/editor-history-state")>();
  return { ...actual, commitHistory: vi.fn(actual.commitHistory) };
});

import * as historyState from "../src/features/editor/editor-history-state";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...options });
}

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4d1a-element-history",
    title: "CP4D1A element history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [
        {
          type: "image",
          id: "image-1",
          hidden: false,
          src: "/image.png",
          alt: "Image",
        },
        {
          type: "container",
          id: "container-1",
          hidden: false,
          children: [{
            type: "text",
            id: "container-text-1",
            hidden: false,
            variant: "body",
            content: "Container child",
          }],
        },
        {
          type: "topics",
          id: "topics-1",
          hidden: false,
          kind: "unordered",
          items: [{
            id: "topic-item-1",
            content: {
              id: "topic-slot-1",
              children: [{
                type: "text",
                id: "topic-label-1",
                hidden: false,
                variant: "body",
                content: "Topic",
              }],
            },
            children: [],
          }],
        },
        {
          type: "table",
          id: "table-1",
          mode: "structured",
          showHeader: true,
          hidden: false,
          columns: [{
            id: "column-1",
            header: {
              id: "header-slot-1",
              children: [{
                type: "text",
                id: "header-text-1",
                hidden: false,
                variant: "body",
                content: "Header",
              }],
            },
          }],
          rows: [{
            id: "row-1",
            cells: [{
              id: "cell-slot-1",
              children: [{
                type: "text",
                id: "cell-text-1",
                hidden: false,
                variant: "body",
                content: "Cell",
              }],
            }],
          }],
        },
      ],
    }],
  });
}

function emptyPresentation(): Presentation {
  const value = presentation();
  return { ...value, slides: [{ ...value.slides[0]!, elements: [] }] };
}

describe("CP4D1A element Add and Duplicate history", () => {
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

  async function mount(next = presentation()): Promise<void> {
    await act(async () => {
      root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={next} /></StudioI18nProvider>);
    });
  }

  async function selectElement(id: string): Promise<void> {
    const element = container.querySelector<HTMLElement>(`[data-powershow-id="${id}"]`);
    if (!element) throw new Error(`element ${id} was not rendered`);
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  function crudSelect(): HTMLSelectElement {
    const select = container.querySelector<HTMLSelectElement>("form[class*='elementCrud'] select");
    if (!select) throw new Error("element CRUD select was not rendered");
    return select;
  }

  function addButton(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>("form[class*='elementCrud'] button");
    if (!button) throw new Error("element Add button was not rendered");
    return button;
  }

  function duplicateButton(): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("form[class*='elementCrud'] button"))
      .find((candidate) => candidate.textContent?.includes("Duplicate"));
    if (!button) throw new Error("element Duplicate button was not rendered");
    return button;
  }

  async function chooseAddType(type: string): Promise<void> {
    const select = crudSelect();
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (!setter) throw new Error("expected HTMLSelectElement.value setter");
    await act(async () => {
      setter.call(select, type);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  async function add(type: string): Promise<void> {
    await chooseAddType(type);
    await act(async () => addButton().click());
  }

  function ids(): string[] {
    return Array.from(
      container.querySelectorAll<HTMLElement>("[class*='slideCanvas'] [data-powershow-id]"),
      (element) => element.dataset.powershowId ?? "",
    );
  }

  it("tracks root, sibling, container, and ContentSlot Add with exact Add redo IDs", async () => {
    await mount();

    await add("image");
    expect(container.querySelector('[data-powershow-id="image-element"]')).not.toBeNull();
    expect(historyState.commitHistory).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      { kind: "element.add", labelKey: "history.element.add", labelParams: { elementType: "image" } },
    );

    const addedImageId = "image-element";
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector(`[data-powershow-id="${addedImageId}"]`)).toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector(`[data-powershow-id="${addedImageId}"]`)).not.toBeNull();

    await selectElement(addedImageId);
    await add("divider");
    expect(ids().indexOf("divider-element")).toBe(ids().indexOf(addedImageId) + 1);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector('[data-powershow-id="divider-element"]')).toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector('[data-powershow-id="divider-element"]')).not.toBeNull();

    await selectElement("container-1");
    await add("text");
    expect(container.querySelector('[data-powershow-id="text-element"]')).not.toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector('[data-powershow-id="text-element"]')).toBeNull();
    expect(container.querySelector('[data-powershow-id="container-1"]')).not.toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector('[data-powershow-id="text-element"]')).not.toBeNull();

    const slot = container.querySelector<HTMLElement>('[data-powershow-content-slot-id="topic-slot-1"]');
    if (!slot) throw new Error("topic ContentSlot was not rendered");
    await act(async () => slot.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await add("image");
    expect(container.querySelector('[data-powershow-id="image-element-2"]')).not.toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector('[data-powershow-id="image-element-2"]')).toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector('[data-powershow-id="image-element-2"]')).not.toBeNull();
  });

  it("duplicates ordinary elements with one action and restores the exact ID on redo", async () => {
    await mount();
    await selectElement("image-1");

    await act(async () => duplicateButton().click());
    expect(container.querySelector('[data-powershow-id="image-1-copy"]')).not.toBeNull();
    expect(historyState.commitHistory).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      { kind: "element.duplicate", labelKey: "history.element.duplicate", labelParams: { elementType: "image" } },
    );

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector('[data-powershow-id="image-1-copy"]')).toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector('[data-powershow-id="image-1-copy"]')).not.toBeNull();
  });

  it("keeps Add and Duplicate as separate actions", async () => {
    await mount(emptyPresentation());
    await add("container");
    expect(container.querySelector('[data-powershow-id="container-element"]')).not.toBeNull();
    await act(async () => duplicateButton().click());
    expect(container.querySelector('[data-powershow-id="container-element-copy"]')).not.toBeNull();

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector('[data-powershow-id="container-element-copy"]')).toBeNull();
    expect(container.querySelector('[data-powershow-id="container-element"]')).not.toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector('[data-powershow-id="container-element"]')).toBeNull();

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector('[data-powershow-id="container-element"]')).not.toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector('[data-powershow-id="container-element-copy"]')).not.toBeNull();
  });

  it("makes Table and Topics resource preparation atomic with Add", async () => {
    await mount(emptyPresentation());

    await add("table");
    expect(container.querySelector('[data-powershow-type="table"]')).not.toBeNull();
    const tableCommit = vi.mocked(historyState.commitHistory).mock.lastCall;
    expect(tableCommit?.[1].textStyles?.map((style) => style.id)).toEqual([
      POWERSHOW_TABLE_COLUMN_HEADER_TEXT_STYLE_ID,
      POWERSHOW_TABLE_CELL_TEXT_STYLE_ID,
    ]);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector('[data-powershow-type="table"]')).toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector('[data-powershow-type="table"]')).not.toBeNull();

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    await add("topics");
    expect(container.querySelector('[data-powershow-type="topics"]')).not.toBeNull();
    const topicsCommit = vi.mocked(historyState.commitHistory).mock.lastCall;
    expect(topicsCommit?.[1].textStyles?.map((style) => style.id)).toEqual([
      POWERSHOW_TOPICS_TEXT_STYLE_ID,
    ]);
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector('[data-powershow-type="topics"]')).toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector('[data-powershow-type="topics"]')).not.toBeNull();
  });

  it("does not duplicate pre-existing Table or Topics styles", async () => {
    const initial = emptyPresentation();
    const textStyles = [
      { id: POWERSHOW_TABLE_COLUMN_HEADER_TEXT_STYLE_ID, name: "Existing header", role: "body" as const },
      { id: POWERSHOW_TABLE_CELL_TEXT_STYLE_ID, name: "Existing cell", role: "body" as const },
      { id: POWERSHOW_TOPICS_TEXT_STYLE_ID, name: "Existing topics", role: "body" as const },
    ];
    await mount({ ...initial, textStyles });

    await add("table");
    const tableCommit = vi.mocked(historyState.commitHistory).mock.lastCall;
    expect(tableCommit?.[1].textStyles).toEqual(textStyles);
    expect(tableCommit?.[1].textStyles?.filter((style) => style.id === POWERSHOW_TABLE_CELL_TEXT_STYLE_ID)).toHaveLength(1);
    expect(tableCommit?.[1].textStyles?.filter((style) => style.id === POWERSHOW_TABLE_COLUMN_HEADER_TEXT_STYLE_ID)).toHaveLength(1);

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.querySelector('[data-powershow-type="table"]')).not.toBeNull();
  });

  it("duplicates a container subtree with collision-free recursive IDs and exact redo IDs", async () => {
    await mount();
    await selectElement("container-1");
    await act(async () => duplicateButton().click());

    expect(container.querySelector('[data-powershow-id="container-1-copy"]')).not.toBeNull();
    expect(container.querySelector('[data-powershow-id="container-1-copy"] [data-powershow-id="container-text-1"]')).toBeNull();
    const duplicateDescendant = container.querySelector<HTMLElement>('[data-powershow-id="container-1-copy"] [data-powershow-id]');
    expect(duplicateDescendant).not.toBeNull();
    expect(duplicateDescendant?.dataset.powershowId).not.toBe("container-text-1");

    const duplicatedIds = Array.from(
      container.querySelectorAll<HTMLElement>('[data-powershow-id="container-1-copy"], [data-powershow-id="container-1-copy"] [data-powershow-id]'),
      (element) => element.dataset.powershowId,
    );
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.querySelector('[data-powershow-id="container-1-copy"]')).toBeNull();
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    for (const id of duplicatedIds) {
      expect(container.querySelector(`[data-powershow-id="${id}"]`)).not.toBeNull();
    }
  });
});
