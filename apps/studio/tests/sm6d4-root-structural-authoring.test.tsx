// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  PresentationSchema,
  SYSTEM_TOPICS_TEXT_STYLE_ID,
  type PresentationElement,
  type TopicItem,
  type Presentation,
} from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import type { AuthoringTarget } from "../src/features/editor/authoring-target";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type SaveCallback = (value: Presentation) => Promise<void>;
type SaveMock = Mock<SaveCallback>;
type StructuredTable = Extract<PresentationElement, { type: "table"; mode: "structured" }>;

function topicItem(id: string, content = id, children: TopicItem[] = []): TopicItem {
  return {
    id,
    content: {
      id: `topic-slot-${id}`,
      children: [{ id: `topic-text-${id}`, type: "text", hidden: false, variant: "body", content }],
    },
    children,
  };
}

function rootElement(snapshot: Presentation, id: string): PresentationElement {
  const root = snapshot.rootDefinitions?.[0]?.root;
  const element = root?.children.find((candidate) => candidate.id === id);
  if (!element) throw new Error(`Expected Root element ${id}`);
  return element;
}

function rootContainer(snapshot: Presentation): Extract<PresentationElement, { type: "container" }> {
  const root = snapshot.rootDefinitions?.[0]?.root;
  if (!root) throw new Error("Expected canonical Root Container");
  return root;
}

function topicsPresentation(): Presentation {
  const source = presentation();
  const topics = rootElement(source, "topics-root");
  if (topics.type !== "topics") throw new Error("Expected Topics element");
  const rootDefinition = source.rootDefinitions?.[0];
  if (!rootDefinition) throw new Error("Expected Root Definition");
  return {
    ...source,
    linkedStyles: [{
      target: "topics",
      id: "root-topics-style",
      name: "Root Topics style",
      kind: "unordered",
      layout: { margin: 12 },
      rootMarkerStyle: "circle",
      markerColor: "#112233",
      itemGap: 8,
    }],
    rootDefinitions: [{
      ...rootDefinition,
      root: {
        ...rootDefinition.root,
        children: rootDefinition.root.children.map((element) => element.id === topics.id
          ? { ...topics, linkedStyleId: "root-topics-style", items: [topicItem("topic-a", "A"), topicItem("topic-b", "B"), topicItem("topic-c", "C")] }
          : element),
      },
    }],
  };
}

function rootBackedTopicsPresentation(withLinkedStyle: boolean): Presentation {
  const flow: PresentationElement = {
    id: "flow-container",
    type: "container",
    hidden: false,
    ...(withLinkedStyle ? { linkedStyleId: "flow-style" } : {}),
    children: [
      { id: "flow-image", type: "image", hidden: false, src: "/flow-image.png", alt: "Image", fit: "contain" },
      { id: "flow-text", type: "text", hidden: false, variant: "body", content: "Text" },
      {
        id: "flow-topics",
        type: "topics",
        hidden: false,
        kind: "unordered",
        items: [topicItem("topic-a", "A"), topicItem("topic-b", "B"), topicItem("topic-c", "C")],
      },
    ],
  };

  return PresentationSchema.parse({
    schemaVersion: 1,
    id: `root-backed-topics-${withLinkedStyle ? "linked" : "plain"}`,
    title: "Root-backed Topics",
    slides: [{ id: "root-backed-slide", title: "Root-backed", elements: [], rootDefinitionId: "root-1" }],
    ...(withLinkedStyle ? {
      linkedStyles: [{
        id: "flow-style",
        name: "Flow style",
        layout: { children: { gap: 8 } },
      }],
    } : {}),
    rootDefinitions: [{
      id: "root-1",
      name: "Teaching root",
      root: { id: "root-container", type: "container", hidden: false, children: [flow] },
    }],
  });
}

function rootBackedLocalContentPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "root-backed-local-content",
    title: "Root-backed local content",
    slides: [{
      id: "local-slide",
      title: "Local",
      elements: [],
      rootDefinitionId: "root-1",
      localRootChildren: [{
        targetContainerId: "receiver-container",
        children: [
          { id: "local-a", type: "text", hidden: false, variant: "body", content: "Local A" },
          { id: "local-b", type: "text", hidden: false, variant: "body", content: "Local B" },
        ],
      }],
    }],
    rootDefinitions: [{
      id: "root-1",
      name: "Teaching root",
      localChildTargetIds: ["receiver-container"],
      root: {
        id: "root-container",
        type: "container",
        hidden: false,
        children: [{
          id: "flow-container",
          type: "container",
          hidden: false,
          children: [{
            id: "receiver-container",
            type: "container",
            hidden: false,
            children: [{ id: "master-a", type: "text", hidden: false, variant: "body", content: "Master A" }],
          }],
        }],
      },
    }],
  });
}

function ordinaryTopicsPresentation(withLinkedStyle: boolean): Presentation {
  const source = rootBackedTopicsPresentation(withLinkedStyle);
  const root = source.rootDefinitions?.[0]?.root;
  if (!root) throw new Error("Expected Topics root");
  return PresentationSchema.parse({
    ...source,
    rootDefinitions: undefined,
    defaultRootDefinitionId: undefined,
    slides: [{ ...source.slides[0]!, rootDefinitionId: undefined, localRootChildren: undefined, elements: root.children }],
  });
}

function rootBackedMoveToPresentation(): Presentation {
  const source = rootBackedTopicsPresentation(false);
  const root = source.rootDefinitions?.[0]?.root;
  if (!root) throw new Error("Expected Topics root");
  return PresentationSchema.parse({
    ...source,
    rootDefinitions: [{
      ...source.rootDefinitions?.[0],
      root: {
        ...root,
        children: [...root.children, { id: "destination-container", type: "container", hidden: false, children: [] }],
      },
    }],
  });
}

function tablePresentation(): Presentation {
  const source = presentation();
  const table = rootElement(source, "table-root");
  if (table.type !== "table" || table.mode !== "structured") throw new Error("Expected Structured Table");
  const column = table.columns[0];
  const row = table.rows[0];
  if (!column || !row) throw new Error("Expected initial table structure");
  const makeColumn = (id: string, label: string) => ({
    ...column,
    id,
    header: {
      ...column.header,
      id: `header-${id}`,
      children: [{ id: `header-text-${id}`, type: "text" as const, hidden: false, variant: "body" as const, content: label }],
    },
  });
  const makeRow = (id: string, values: string[]) => ({
    ...row,
    id,
    cells: values.map((value, index) => ({
      id: `cell-${id}-${index}`,
      children: [{ id: `cell-text-${id}-${index}`, type: "text" as const, hidden: false, variant: "body" as const, content: value }],
    })),
  });
  const richTable: StructuredTable = {
    ...table,
    columns: [makeColumn("table-column-a", "A"), makeColumn("table-column-b", "B"), makeColumn("table-column-c", "C")],
    rows: [makeRow("table-row-1", ["1A", "1B", "1C"]), makeRow("table-row-2", ["2A", "2B", "2C"])],
  };
  const rootDefinition = source.rootDefinitions?.[0];
  if (!rootDefinition) throw new Error("Expected Root Definition");
  const rootChildren = rootDefinition.root.children.map((element) => element.id === table.id ? richTable : element);
  return {
    ...source,
    slides: [{
      ...source.slides[0]!,
      elements: [richTable],
    }],
    rootDefinitions: [{ ...rootDefinition, root: { ...rootDefinition.root, children: rootChildren } }],
  };
}

function galleryPresentation(): Presentation {
  const source = presentation();
  const rootDefinition = source.rootDefinitions?.[0];
  if (!rootDefinition) throw new Error("Expected Root Definition");
  const gallery = rootElement(source, "gallery-root");
  if (gallery.type !== "gallery") throw new Error("Expected Gallery element");
  const image: PresentationElement = {
    id: "root-image",
    type: "image",
    hidden: false,
    src: "/root-image.png",
    alt: "root-image",
    fit: "contain",
  };
  const rootChildren = rootDefinition.root.children.flatMap((element) => element.id === gallery.id ? [image, element] : [element]);
  return {
    ...source,
    slides: [{
      ...source.slides[0]!,
      elements: [
        { ...image, id: "retained-image" },
        { ...image, id: "image-element" },
      ],
    }],
    rootDefinitions: [{ ...rootDefinition, root: { ...rootDefinition.root, children: rootChildren } }],
  };
}

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

  async function mount(
    initialPresentation: Presentation = presentation(),
    onSave: SaveMock = vi.fn<SaveCallback>(async (_value: Presentation) => {}),
    initialTarget: AuthoringTarget = { kind: "root-definition", rootDefinitionId: "root-1" },
  ): Promise<SaveMock> {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            initialPresentation={initialPresentation}
            initialAuthoringTarget={initialTarget}
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

  function treeAction(label: string): HTMLButtonElement {
    const action = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (!action) throw new Error(`Expected Tree action ${label}`);
    return action;
  }

  function elementTreeRow(label: string): HTMLElement {
    const select = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tree"] li[role="treeitem"] > div > button'))
      .find((candidate) => candidate.textContent?.trim() === label);
    const row = select?.parentElement;
    if (!row) throw new Error(`Expected element Tree row ${label}`);
    return row;
  }

  async function saveSnapshot(onSave: SaveMock): Promise<Presentation> {
    await act(async () => saveButton().click());
    const saved = onSave.mock.calls.at(-1)?.[0];
    if (!saved) throw new Error("Expected saved presentation");
    return saved;
  }

  async function selectTopicRow(label: string): Promise<void> {
    const row = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tree"] [role="treeitem"] button'))
      .find((candidate) => candidate.textContent?.trim() === label);
    if (!row) throw new Error(`Expected Topic row ${label}`);
    await act(async () => row.click());
  }

  async function selectTreeElement(label: string): Promise<void> {
    const row = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tree"] [role="treeitem"] button'))
      .find((candidate) => candidate.textContent?.trim() === label);
    if (!row) throw new Error(`Expected element row ${label}`);
    await act(async () => row.click());
  }

  function treeElementRow(label: string): HTMLElement {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tree"] [role="treeitem"] button'))
      .find((candidate) => candidate.textContent?.trim() === label);
    const row = button?.closest<HTMLElement>("[draggable]");
    if (!row) throw new Error(`Expected draggable element row ${label}`);
    return row;
  }

  function dragEvent(type: string, clientY = 0): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clientY", { configurable: true, value: clientY });
    Object.defineProperty(event, "dataTransfer", {
      configurable: true,
      value: { effectAllowed: "move", setData: vi.fn() },
    });
    return event;
  }

  async function drag(source: HTMLElement, target: HTMLElement, clientY = 0): Promise<void> {
    await act(async () => source.dispatchEvent(dragEvent("dragstart", clientY)));
    await act(async () => target.dispatchEvent(dragEvent("dragover", clientY)));
    await act(async () => target.dispatchEvent(dragEvent("drop", clientY)));
  }

  function rootTreeRow(): HTMLElement {
    const row = host.querySelector<HTMLElement>('[role="tree"] > li[role="treeitem"] > div');
    if (!row) throw new Error("Expected canonical Root Container tree row");
    return row;
  }

  function tableStructuralSelection(id: "table-column-a" | "table-column-b" | "table-column-c" | "table-row-1" | "table-row-2"): HTMLButtonElement {
    const label = id === "table-column-a" ? "(A)"
      : id === "table-column-b" ? "(B)"
        : id === "table-column-c" ? "(C)"
          : id === "table-row-1" ? "1A" : "2A";
    const selected = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.getAttribute("aria-label")?.includes(label));
    if (!selected) throw new Error(`Expected Table structural selection ${id}`);
    return selected;
  }

  async function removeTableStructural(kind: "column" | "row", id: "table-column-a" | "table-column-b" | "table-column-c" | "table-row-1" | "table-row-2"): Promise<void> {
    await act(async () => tableStructuralSelection(id).click());
    const remove = host.querySelector<HTMLButtonElement>(`[data-presentation-table-remove-${kind}]`);
    if (!remove) throw new Error(`Expected Table remove ${kind} control`);
    await act(async () => remove.click());
    const confirm = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim().startsWith(`Remove ${kind}`));
    if (!confirm) throw new Error(`Expected Table remove ${kind} confirmation`);
    await act(async () => confirm.click());
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

    const moved = await saveSnapshot(onSave);
    const movedRoot = rootContainer(moved);
    const movedChild = movedRoot.children.find((element) => element.id === "child-container");
    expect(movedRoot.id).toBe("root-container");
    expect(movedRoot.children.map((element) => element.id)).toContain("nested-a");
    expect(movedChild?.type).toBe("container");
    if (movedChild?.type === "container") {
      expect(movedChild.children.map((element) => element.id)).not.toContain("nested-a");
    }
    expect(moved.slides).toEqual(source.slides);

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    const undone = await saveSnapshot(onSave);
    const undoneRoot = rootContainer(undone);
    const undoneChild = undoneRoot.children.find((element) => element.id === "child-container");
    expect(undoneRoot.children.map((element) => element.id)).not.toContain("nested-a");
    expect(undoneChild?.type).toBe("container");
    if (undoneChild?.type === "container") {
      expect(undoneChild.children.map((element) => element.id)).toContain("nested-a");
    }
    expect(undone.slides).toEqual(source.slides);
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
    const redone = await saveSnapshot(onSave);
    const redoneRoot = rootContainer(redone);
    const redoneChild = redoneRoot.children.find((element) => element.id === "child-container");
    expect(redoneRoot.children.map((element) => element.id)).toContain("nested-a");
    expect(redoneChild?.type).toBe("container");
    if (redoneChild?.type === "container") {
      expect(redoneChild.children.map((element) => element.id)).not.toContain("nested-a");
    }
    expect(redone.slides).toEqual(source.slides);
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

  it.each([false, true])("restores Root-backed Slide Topics element reordering controls (linkedStyle=%s)", async (withLinkedStyle) => {
    const source = rootBackedTopicsPresentation(withLinkedStyle);
    const onSave = await mount(source, vi.fn<SaveCallback>(async (_value: Presentation) => {}), { kind: "slide", slideIndex: 0 });
    await selectCanvasElement("flow-topics");
    await openTree();

    await selectTopicRow("B");
    await selectTreeElement("Topics");

    const moveUp = host.querySelector<HTMLButtonElement>('button[aria-label="Move up"]');
    const moveDown = host.querySelector<HTMLButtonElement>('button[aria-label="Move down"]');
    const moveTo = host.querySelector<HTMLSelectElement>('select[aria-label="Move to"]');
    const topicsRow = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tree"] [role="treeitem"] button'))
      .find((candidate) => candidate.textContent?.trim() === "Topics")
      ?.closest<HTMLElement>("[draggable]");

    expect(moveUp?.disabled).toBe(false);
    expect(moveDown?.disabled).toBe(true);
    expect(moveTo?.disabled).toBe(false);
    expect(topicsRow?.getAttribute("draggable")).toBe("true");

    await act(async () => moveUp?.click());
    let saved = await saveSnapshot(onSave);
    let flow = rootContainer(saved).children[0];
    expect(flow?.type).toBe("container");
    if (flow?.type !== "container") throw new Error("Expected Flow Container");
    expect(flow.children.map((element) => element.id)).toEqual(["flow-image", "flow-topics", "flow-text"]);
    expect(saved.slides[0]?.elements).toEqual([]);
    expect(saved.slides[0]?.rootDefinitionId).toBe("root-1");

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    saved = await saveSnapshot(onSave);
    flow = rootContainer(saved).children[0];
    if (flow?.type !== "container") throw new Error("Expected Flow Container");
    expect(flow.children.map((element) => element.id)).toEqual(["flow-image", "flow-text", "flow-topics"]);

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
    saved = await saveSnapshot(onSave);
    flow = rootContainer(saved).children[0];
    if (flow?.type !== "container") throw new Error("Expected Flow Container");
    expect(flow.children.map((element) => element.id)).toEqual(["flow-image", "flow-topics", "flow-text"]);
  });

  it.each([false, true])("keeps Topics element reordering controls in ordinary Slides (linkedStyle=%s)", async (withLinkedStyle) => {
    await mount(ordinaryTopicsPresentation(withLinkedStyle), vi.fn<SaveCallback>(async (_value: Presentation) => {}), { kind: "slide", slideIndex: 0 });
    await openTree();
    await selectTreeElement("Topics");

    expect(treeAction("Move up").disabled).toBe(false);
    expect(treeAction("Move down").disabled).toBe(true);
    expect(host.querySelector<HTMLSelectElement>('select[aria-label="Move to"]')?.disabled).toBe(false);
    expect(treeElementRow("Topics").getAttribute("draggable")).toBe("true");
  });

  it.each([false, true])("keeps Topics element reordering controls in direct Root Definition workspaces (linkedStyle=%s)", async (withLinkedStyle) => {
    await mount(rootBackedTopicsPresentation(withLinkedStyle));
    await openTree();
    await selectTreeElement("Topics");

    expect(treeAction("Move up").disabled).toBe(false);
    expect(treeAction("Move down").disabled).toBe(true);
    expect(host.querySelector<HTMLSelectElement>('select[aria-label="Move to"]')?.disabled).toBe(false);
    expect(treeElementRow("Topics").getAttribute("draggable")).toBe("true");
  });

  it("reorders localRootChildren in the local persisted owner without mutating Root master content", async () => {
    const source = rootBackedLocalContentPresentation();
    const onSave = await mount(source, vi.fn<SaveCallback>(async (_value: Presentation) => {}), { kind: "slide", slideIndex: 0 });
    await openTree();
    await selectTreeElement("Text — Local B");

    const moveUp = treeAction("Move up");
    const moveDown = treeAction("Move down");
    const moveTo = host.querySelector<HTMLSelectElement>('select[aria-label="Move to"]');
    expect(moveUp.disabled).toBe(false);
    expect(moveDown.disabled).toBe(true);
    expect(Array.from(moveTo?.options ?? []).map((option) => option.value)).toEqual([""]);
    expect(treeElementRow("Text — Local B").getAttribute("draggable")).toBe("true");

    await act(async () => moveUp.click());
    let saved = await saveSnapshot(onSave);
    expect(saved.slides[0]?.localRootChildren?.[0]?.children.map((element) => element.id)).toEqual(["local-b", "local-a"]);
    expect(saved.rootDefinitions?.[0]?.root.children[0]).toEqual(source.rootDefinitions?.[0]?.root.children[0]);
    expect(saved.slides[0]?.elements).toEqual([]);

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    saved = await saveSnapshot(onSave);
    expect(saved.slides[0]?.localRootChildren?.[0]?.children.map((element) => element.id)).toEqual(["local-a", "local-b"]);
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
    saved = await saveSnapshot(onSave);
    expect(saved.slides[0]?.localRootChildren?.[0]?.children.map((element) => element.id)).toEqual(["local-b", "local-a"]);

    await drag(treeElementRow("Text — Local B"), treeElementRow("Text — Master A"), -1);
    saved = await saveSnapshot(onSave);
    expect(saved.slides[0]?.localRootChildren?.[0]?.children.map((element) => element.id)).toEqual(["local-b", "local-a"]);
  });

  it("supports Root-backed master drag/drop and Topics item movement in the canonical Root owner", async () => {
    const source = rootBackedTopicsPresentation(false);
    const onSave = await mount(source, vi.fn<SaveCallback>(async (_value: Presentation) => {}), { kind: "slide", slideIndex: 0 });
    await openTree();
    await drag(treeElementRow("Topics"), treeElementRow("Text — Text"), -1);

    let saved = await saveSnapshot(onSave);
    const flow = rootContainer(saved).children[0];
    if (flow?.type !== "container") throw new Error("Expected Flow Container");
    expect(flow.children.map((element) => element.id)).toEqual(["flow-image", "flow-topics", "flow-text"]);

    await selectTopicRow("B");
    await act(async () => treeAction("Move up").click());
    saved = await saveSnapshot(onSave);
    const movedFlow = rootContainer(saved).children[0];
    const topics = movedFlow?.type === "container"
      ? movedFlow.children.find((element) => element.id === "flow-topics")
      : undefined;
    expect(topics?.type).toBe("topics");
    if (topics?.type === "topics") {
      expect(topics.items.map((item) => item.id)).toEqual(["topic-b", "topic-a", "topic-c"]);
    }
  });

  it("keeps Root-backed Move To within the Root Definition owner", async () => {
    const onSave = await mount(rootBackedMoveToPresentation(), vi.fn<SaveCallback>(async (_value: Presentation) => {}), { kind: "slide", slideIndex: 0 });
    await openTree();
    await selectTreeElement("Text — Text");

    const moveTo = host.querySelector<HTMLSelectElement>('select[aria-label="Move to"]');
    if (!moveTo) throw new Error("Expected Move to control");
    expect(Array.from(moveTo.options).map((option) => option.value)).toEqual(["", "root-container", "flow-container", "destination-container"]);
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (!setter) throw new Error("Expected select setter");
    await act(async () => {
      setter.call(moveTo, "destination-container");
      moveTo.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const saved = await saveSnapshot(onSave);
    const root = rootContainer(saved);
    const flow = root.children.find((element) => element.id === "flow-container");
    const destination = root.children.find((element) => element.id === "destination-container");
    expect(flow?.type === "container" ? flow.children.map((element) => element.id) : []).toEqual(["flow-image", "flow-topics"]);
    expect(destination?.type === "container" ? destination.children.map((element) => element.id) : []).toEqual(["flow-text"]);
    expect(saved.slides[0]?.elements).toEqual([]);
  });

  it("produces the same canonical Presentation when moving through Root Definition or Root-backed Slide", async () => {
    const source = rootBackedTopicsPresentation(false);
    const throughSlide = vi.fn<SaveCallback>(async (_value: Presentation) => {});
    await mount(source, throughSlide, { kind: "slide", slideIndex: 0 });
    await openTree();
    await selectTreeElement("Topics");
    await act(async () => treeAction("Move up").click());
    const slideResult = await saveSnapshot(throughSlide);

    await act(async () => root.unmount());
    host.innerHTML = "";
    root = createRoot(host);

    const throughRoot = vi.fn<SaveCallback>(async (_value: Presentation) => {});
    await mount(source, throughRoot);
    await openTree();
    await selectTreeElement("Topics");
    await act(async () => treeAction("Move up").click());
    const rootResult = await saveSnapshot(throughRoot);

    expect(rootResult).toEqual(slideResult);
  });

  it("enables Root Topics structural authoring and linked-style relationship writes", async () => {
    const onSave = await mount(topicsPresentation());
    await selectCanvasElement("topics-root");
    await openInspector();

    const linkedStyle = host.querySelector<HTMLSelectElement>("#topics-linked-style");
    expect(linkedStyle?.disabled).toBe(false);
    const detachStyle = host.querySelector<HTMLButtonElement>('[data-presentation-topics-detach-linked-style="true"]');
    if (detachStyle) expect(detachStyle.disabled).toBe(false);
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
      expect(topics.items).toHaveLength(4);
      expect(topics.items.some((item) => item.children.length === 1)).toBe(true);
      expect(saved.textStyles?.some((style) => style.id === SYSTEM_TOPICS_TEXT_STYLE_ID)).toBe(true);
    }
  });

  it("routes Root Topics move, indent, outdent, and remove through the canonical tree", async () => {
    const source = topicsPresentation();
    const onSave = await mount(source);
    await selectCanvasElement("topics-root");
    await openTree();

    await selectTopicRow("B");
    await act(async () => treeAction("Move up").click());
    let saved = await saveSnapshot(onSave);
    let topics = rootElement(saved, "topics-root");
    expect(topics.type).toBe("topics");
    if (topics.type !== "topics") throw new Error("Expected Topics element");
    expect(topics.items.map((item) => item.id)).toEqual(["topic-b", "topic-a", "topic-c"]);
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    saved = await saveSnapshot(onSave);
    topics = rootElement(saved, "topics-root");
    expect(topics.type === "topics" ? topics.items.map((item) => item.id) : []).toEqual(["topic-a", "topic-b", "topic-c"]);
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
    saved = await saveSnapshot(onSave);
    topics = rootElement(saved, "topics-root");
    expect(topics.type === "topics" ? topics.items.map((item) => item.id) : []).toEqual(["topic-b", "topic-a", "topic-c"]);

    await selectTopicRow("C");
    await act(async () => treeAction("Demote topic").click());
    saved = await saveSnapshot(onSave);
    topics = rootElement(saved, "topics-root");
    if (topics.type !== "topics") throw new Error("Expected Topics element");
    expect(topics.items.map((item) => item.id)).toEqual(["topic-b", "topic-a"]);
    expect(topics.items[1]?.children.map((item) => item.id)).toEqual(["topic-c"]);

    await selectTopicRow("C");
    await act(async () => treeAction("Promote topic").click());
    saved = await saveSnapshot(onSave);
    topics = rootElement(saved, "topics-root");
    if (topics.type !== "topics") throw new Error("Expected Topics element");
    expect(topics.items.map((item) => item.id)).toEqual(["topic-b", "topic-a", "topic-c"]);
    expect(topics.items.every((item) => item.children.length === 0)).toBe(true);

    await selectCanvasElement("topics-root");
    await openTree();
    await selectTopicRow("B");
    await openInspector();
    const remove = host.querySelector<HTMLButtonElement>('[data-presentation-topic-remove="true"]');
    if (!remove) throw new Error("Expected Topic remove control");
    await act(async () => remove.click());
    saved = await saveSnapshot(onSave);
    topics = rootElement(saved, "topics-root");
    if (topics.type !== "topics") throw new Error("Expected Topics element");
    expect(topics.items.map((item) => item.id)).toEqual(["topic-a", "topic-c"]);
    expect(saved.slides).toEqual(source.slides);
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

  it("routes Root Structured Table remove and movement operations without crossing owners", async () => {
    const source = tablePresentation();
    const onSave = await mount(source);
    await selectCanvasElement("table-root");
    await openInspector();

    await act(async () => tableStructuralSelection("table-column-b").click());
    await openTree();
    await act(async () => treeAction("Move right").click());
    let saved = await saveSnapshot(onSave);
    let table = rootElement(saved, "table-root");
    if (table.type !== "table" || table.mode !== "structured") throw new Error("Expected Structured Table");
    expect(table.columns.map((column) => column.id)).toEqual(["table-column-a", "table-column-c", "table-column-b"]);
    expect(table.rows[0]?.cells.map((cell) => cell.id)).toEqual(["cell-table-row-1-0", "cell-table-row-1-2", "cell-table-row-1-1"]);

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    saved = await saveSnapshot(onSave);
    table = rootElement(saved, "table-root");
    if (table.type !== "table" || table.mode !== "structured") throw new Error("Expected Structured Table");
    expect(table.columns.map((column) => column.id)).toEqual(["table-column-a", "table-column-b", "table-column-c"]);
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
    saved = await saveSnapshot(onSave);
    table = rootElement(saved, "table-root");
    if (table.type !== "table" || table.mode !== "structured") throw new Error("Expected Structured Table");
    expect(table.columns.map((column) => column.id)).toEqual(["table-column-a", "table-column-c", "table-column-b"]);

    await openInspector();
    await act(async () => tableStructuralSelection("table-row-1").click());
    await openTree();
    await act(async () => treeAction("Move down").click());
    saved = await saveSnapshot(onSave);
    table = rootElement(saved, "table-root");
    if (table.type !== "table" || table.mode !== "structured") throw new Error("Expected Structured Table");
    expect(table.rows.map((row) => row.id)).toEqual(["table-row-2", "table-row-1"]);

    await openInspector();
    await removeTableStructural("column", "table-column-b");
    saved = await saveSnapshot(onSave);
    table = rootElement(saved, "table-root");
    if (table.type !== "table" || table.mode !== "structured") throw new Error("Expected Structured Table");
    expect(table.columns.map((column) => column.id)).toEqual(["table-column-a", "table-column-c"]);
    expect(table.rows.every((row) => row.cells.length === 2)).toBe(true);

    await removeTableStructural("row", "table-row-1");
    saved = await saveSnapshot(onSave);
    table = rootElement(saved, "table-root");
    if (table.type !== "table" || table.mode !== "structured") throw new Error("Expected Structured Table");
    expect(table.rows.map((row) => row.id)).toEqual(["table-row-2"]);
    expect(rootContainer(saved).id).toBe("root-container");
    expect(saved.slides).toEqual(source.slides);
  });

  it("keeps Root Gallery structural reorder available with the editable Gallery Inspector", async () => {
    const source = presentation();
    const onSave = await mount();
    await selectCanvasElement("gallery-root");
    await openInspector();
    expect(host.querySelector('[data-presentation-gallery-add="true"]')).not.toBeNull();

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

  it("routes Root Gallery attach and detach through the canonical tree with structural history", async () => {
    const source = galleryPresentation();
    const onSave = await mount(source);
    await selectCanvasElement("root-image");
    await openTree();

    const imageButton = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tree"] li[role="treeitem"] > div > button'))
      .find((candidate) => candidate.textContent?.trim() === "Image");
    const imageRow = imageButton?.parentElement;
    const galleryRow = elementTreeRow("Gallery");
    const galleryExpand = galleryRow.querySelector<HTMLButtonElement>('button[aria-label="Expand"]');
    if (galleryExpand) await act(async () => galleryExpand.click());
    const galleryItemButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "2. B")
    const galleryItemRow = galleryItemButton?.parentElement;
    if (!imageRow || !galleryItemRow) throw new Error("Expected Root Image and Gallery item rows");
    await drag(imageRow, galleryItemRow, -1);

    let saved = await saveSnapshot(onSave);
    let gallery = rootElement(saved, "gallery-root");
    if (gallery.type !== "gallery") throw new Error("Expected Gallery element");
    expect(rootContainer(saved).children.map((element) => element.id)).not.toContain("root-image");
    expect(gallery.items.map((item) => item.alt)).toEqual(["A", "root-image", "B"]);

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    saved = await saveSnapshot(onSave);
    gallery = rootElement(saved, "gallery-root");
    if (gallery.type !== "gallery") throw new Error("Expected Gallery element");
    expect(rootContainer(saved).children.map((element) => element.id)).toContain("root-image");
    expect(gallery.items.map((item) => item.alt)).toEqual(["A", "B"]);
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })));
    saved = await saveSnapshot(onSave);
    gallery = rootElement(saved, "gallery-root");
    if (gallery.type !== "gallery") throw new Error("Expected Gallery element");
    expect(rootContainer(saved).children.map((element) => element.id)).not.toContain("root-image");
    expect(gallery.items.map((item) => item.alt)).toEqual(["A", "root-image", "B"]);

    const attachedItemRow = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "2. root-image")
      ?.closest<HTMLElement>('li[role="treeitem"]')
      ?.querySelector<HTMLElement>(":scope > div");
    if (!attachedItemRow) throw new Error("Expected attached Gallery item row");
    const rootRow = rootTreeRow();
    rootRow.getBoundingClientRect = () => ({
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    await drag(attachedItemRow, rootRow, 50);

    saved = await saveSnapshot(onSave);
    gallery = rootElement(saved, "gallery-root");
    if (gallery.type !== "gallery") throw new Error("Expected Gallery element");
    const detachedImages = rootContainer(saved).children.filter((element) => element.type === "image");
    expect(gallery.items.map((item) => item.alt)).toEqual(["A", "B"]);
    expect(detachedImages).toHaveLength(1);
    const detachedImage = detachedImages[0];
    if (!detachedImage || detachedImage.type !== "image") throw new Error("Expected detached Image");
    expect(detachedImage.id).not.toBe("image-element");
    expect(detachedImage.id).not.toBe("retained-image");
    expect(host.querySelector(`[data-presentation-id="${detachedImage.id}"]`)).not.toBeNull();
    expect(saved.rootDefinitions).toHaveLength(1);
    expect(saved.rootDefinitions?.[0]?.root.id).toBe("root-container");
    expect(saved.slides).toEqual(source.slides);
  });
});
