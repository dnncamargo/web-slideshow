// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  PresentationSchema,
  SYSTEM_TOPICS_TEXT_STYLE_ID,
  type Presentation,
} from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type SaveCallback = (value: Presentation) => Promise<void>;
type SaveMock = Mock<SaveCallback>;

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "sm6d4-presentation",
    title: "SM6D4",
    slides: [{
      id: "retained-slide",
      title: "Retained",
      summary: "",
      speakerNotes: "",
      elements: [{ id: "slide-text", type: "text", hidden: false, variant: "body", content: "Slide" }],
    }],
    rootDefinitions: [{
      id: "root-1",
      name: "Teaching root",
      root: {
        id: "root-container",
        type: "container",
        hidden: false,
        children: [
          {
            id: "child-container",
            type: "container",
            hidden: false,
            children: [
              { id: "nested-a", type: "text", hidden: false, variant: "body", content: "A" },
              { id: "nested-b", type: "text", hidden: false, variant: "body", content: "B" },
            ],
          },
          { id: "root-a", type: "text", hidden: false, variant: "body", content: "Root A" },
          { id: "root-b", type: "text", hidden: false, variant: "body", content: "Root B" },
          {
            id: "topics-root",
            type: "topics",
            hidden: false,
            kind: "unordered",
            items: [],
          },
          {
            id: "table-root",
            type: "table",
            mode: "structured",
            showHeader: true,
            hidden: false,
            columns: [{
              id: "table-column-1",
              header: {
                id: "table-header-1",
                children: [{ id: "table-header-text-1", type: "text", hidden: false, variant: "body", content: "Column" }],
              },
            }],
            rows: [{
              id: "table-row-1",
              cells: [{
                id: "table-cell-1",
                children: [{ id: "table-cell-text-1", type: "text", hidden: false, variant: "body", content: "Value" }],
              }],
            }],
          },
          {
            id: "gallery-root",
            type: "gallery",
            hidden: false,
            fit: "contain",
            items: [
              { src: "/gallery-a.png", alt: "A" },
              { src: "/gallery-b.png", alt: "B" },
            ],
          },
        ],
      },
    }],
  });
}

describe("SM6D4 Root structural authoring", () => {
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
    vi.restoreAllMocks();
  });

  async function mount(onSave: SaveMock = vi.fn<SaveCallback>(async (_value: Presentation) => {})): Promise<SaveMock> {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            initialPresentation={presentation()}
            initialAuthoringTarget={{ kind: "root-definition", rootDefinitionId: "root-1" }}
            onSave={onSave}
          />
        </StudioI18nProvider>,
      );
    });
    return onSave;
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === label);
    if (!found) throw new Error(`Expected button ${label}`);
    return found;
  }

  async function selectCanvasElement(id: string): Promise<void> {
    const element = host.querySelector<HTMLElement>(`[data-presentation-id="${id}"]`);
    if (!element) throw new Error(`Expected canvas element ${id}`);
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function openTree(): Promise<void> {
    await act(async () => button("Elements").click());
  }

  async function openInspector(): Promise<void> {
    await act(async () => button("Inspector").click());
  }

  function saveButton(): HTMLButtonElement {
    return button("Save");
  }

  it("keeps the Root Container selectable, protects its boundary, and moves descendants only inside the canonical root", async () => {
    const source = presentation();
    const onSave = await mount();
    await openTree();

    const rootTreeItem = host.querySelector<HTMLElement>('[role="tree"] > li[role="treeitem"]');
    expect(rootTreeItem?.querySelector(':scope > div[draggable="false"]')).not.toBeNull();

    await selectCanvasElement("nested-a");
    const moveTo = host.querySelector<HTMLSelectElement>('select[aria-label="Move to"]');
    if (!moveTo) throw new Error("Expected Move to control");
    expect(Array.from(moveTo.options).map((option) => option.value)).toContain("root-container");

    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (!setter) throw new Error("Expected select setter");
    await act(async () => {
      setter.call(moveTo, "root-container");
      moveTo.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => saveButton().click());
    const saved = onSave.mock.calls.at(-1)?.[0];
    if (!saved) throw new Error("Expected saved presentation");
    const rootDefinition = saved.rootDefinitions?.[0]?.root;
    expect(rootDefinition?.id).toBe("root-container");
    expect(saved.slides).toEqual(source.slides);
    expect(rootDefinition?.children.some((element) => element.id === "nested-a")).toBe(true);
    expect(rootDefinition?.children.find((element) => element.id === "child-container")?.type).toBe("container");

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    expect(host.querySelector('[data-presentation-id="nested-a"]')).not.toBeNull();
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
    expect(host.querySelector('[data-presentation-id="nested-a"]')).not.toBeNull();
  });

  it("reorders Root children through the Tree and leaves the retained Slide unchanged", async () => {
    const source = presentation();
    const onSave = await mount();
    await openTree();
    await selectCanvasElement("root-b");

    const moveUp = host.querySelector<HTMLButtonElement>('button[aria-label="Move up"]');
    if (!moveUp) throw new Error("Expected Move up control");
    await act(async () => moveUp.click());
    await act(async () => saveButton().click());

    const saved = onSave.mock.calls.at(-1)?.[0];
    if (!saved) throw new Error("Expected saved presentation");
    const children = saved.rootDefinitions?.[0]?.root.children ?? [];
    expect(children.map((element) => element.id).slice(1, 4)).toEqual(["root-b", "root-a", "topics-root"]);
    expect(saved.slides).toEqual(source.slides);
  });

  it("enables Root Topics structural authoring while keeping linked-style relationship writes unavailable", async () => {
    const onSave = await mount();
    await selectCanvasElement("topics-root");
    await openInspector();

    const linkedStyle = host.querySelector<HTMLSelectElement>("#topics-linked-style");
    expect(linkedStyle?.disabled).toBe(true);
    const addTopic = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.includes("Add topic"));
    if (!addTopic) throw new Error("Expected Add topic control");
    await act(async () => addTopic.click());

    const addChild = host.querySelector<HTMLButtonElement>('button[data-presentation-topic-add-child="true"]');
    expect(addChild).not.toBeNull();
    await act(async () => addChild?.click());
    await act(async () => saveButton().click());

    const saved = onSave.mock.calls.at(-1)?.[0];
    if (!saved) throw new Error("Expected saved presentation");
    const topics = saved.rootDefinitions?.[0]?.root.children.find((element) => element.id === "topics-root");
    expect(topics?.type).toBe("topics");
    if (topics?.type === "topics") {
      expect(topics.items).toHaveLength(1);
      expect(topics.items[0]?.children).toHaveLength(1);
      expect(saved.textStyles?.some((style) => style.id === SYSTEM_TOPICS_TEXT_STYLE_ID)).toBe(true);
    }
  });

  it("enables Root Structured Table structural controls without changing the retained Slide", async () => {
    const source = presentation();
    const onSave = await mount();
    await selectCanvasElement("table-root");
    await openInspector();

    await act(async () => host.querySelector<HTMLButtonElement>('[data-presentation-table-add-column="true"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-presentation-table-add-row="true"]')?.click());
    const showHeader = host.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(showHeader).not.toBeNull();
    await act(async () => showHeader?.click());
    await act(async () => saveButton().click());

    const saved = onSave.mock.calls.at(-1)?.[0];
    if (!saved) throw new Error("Expected saved presentation");
    const table = saved.rootDefinitions?.[0]?.root.children.find((element) => element.id === "table-root");
    expect(table?.type).toBe("table");
    if (table?.type === "table" && table.mode === "structured") {
      expect(table.columns).toHaveLength(2);
      expect(table.rows).toHaveLength(2);
      expect(table.showHeader).toBe(false);
    }
    expect(saved.slides).toEqual(source.slides);
  });

  it("keeps Root Gallery structural reorder available while leaving Gallery Inspector read-only", async () => {
    const source = presentation();
    const onSave = await mount();
    await selectCanvasElement("gallery-root");
    await openInspector();
    expect(host.querySelector('[data-presentation-gallery-add="true"]')).toBeNull();

    await openTree();
    const secondItem = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "2. B");
    expect(secondItem).not.toBeNull();
    await act(async () => secondItem?.click());
    const moveUp = host.querySelector<HTMLButtonElement>('button[aria-label="Move up"]');
    expect(moveUp).not.toBeNull();
    await act(async () => moveUp?.click());
    await act(async () => saveButton().click());

    const saved = onSave.mock.calls.at(-1)?.[0];
    if (!saved) throw new Error("Expected saved presentation");
    const gallery = saved.rootDefinitions?.[0]?.root.children.find((element) => element.id === "gallery-root");
    expect(gallery?.type).toBe("gallery");
    if (gallery?.type === "gallery") {
      expect(gallery.items.map((item) => item.alt)).toEqual(["B", "A"]);
    }
    expect(saved.slides).toEqual(source.slides);
  });
});
