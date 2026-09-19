// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  POWERSHOW_TOPICS_TEXT_STYLE_ID,
  PresentationSchema,
  type PowerShowElement,
  type Presentation,
  type TopicItem,
  type TopicsElement,
} from "@powershow/document-schema";

vi.mock("../src/features/editor/editor-history-state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/features/editor/editor-history-state")>();
  return { ...actual, commitHistory: vi.fn(actual.commitHistory) };
});

import * as historyState from "../src/features/editor/editor-history-state";
import {
  indentTopicItem,
  moveTopicItemToSiblingIndex,
  outdentTopicItem,
} from "../src/features/editor/element-operations";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const TOPICS_ID = "cp4d2c-topics";

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: value,
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

function text(id: string, content: string): PowerShowElement {
  return {
    type: "text",
    id,
    hidden: false,
    variant: "body",
    content,
  };
}

function image(id: string): PowerShowElement {
  return {
    type: "image",
    id,
    hidden: false,
    src: `/assets/${id}.png`,
    alt: id,
    fit: "contain",
  };
}

function topicItem(
  id: string,
  content = id,
  children: TopicItem[] = [],
  contentChildren: PowerShowElement[] = [text(`text-${id}`, content)],
): TopicItem {
  return {
    id,
    content: {
      id: `slot-${id}`,
      children: contentChildren,
    },
    children,
  };
}

function topicsElement(
  items: TopicItem[],
  overrides: Partial<Omit<TopicsElement, "type" | "id" | "items">> = {},
): TopicsElement {
  return {
    type: "topics",
    id: TOPICS_ID,
    hidden: false,
    kind: "unordered",
    items,
    ...overrides,
  };
}

function presentation(
  items: TopicItem[],
  overrides: Partial<Omit<TopicsElement, "type" | "id" | "items">> = {},
  textStyles: Presentation["textStyles"] = [
    { id: "custom-style", name: "Custom", role: "body" },
    { id: POWERSHOW_TOPICS_TEXT_STYLE_ID, name: "Topics", role: "body" },
  ],
  linkedStyles: Presentation["linkedStyles"] = [{
    target: "topics",
    id: "linked-topics",
    name: "Linked Topics",
    kind: "unordered",
    layout: { margin: 12 },
    rootMarkerStyle: "circle",
    markerColor: "#112233",
    itemGap: 8,
  }],
): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4d2c-topics-move-history",
    title: "CP4D2C topics move history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [topicsElement(items, { linkedStyleId: "linked-topics", ...overrides })],
    }],
    textStyles,
    linkedStyles,
  });
}

function structuralChain(depth: number): TopicItem[] {
  let items: TopicItem[] = [];

  for (let level = depth; level >= 1; level -= 1) {
    items = [topicItem(`depth-${level}`, `Depth ${level}`, items)];
  }

  return items;
}

function findTopicItem(
  items: readonly TopicItem[],
  id: string,
): TopicItem | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    const nested = findTopicItem(item.children, id);
    if (nested) return nested;
  }

  return undefined;
}

function topicsFrom(snapshot: Presentation): TopicsElement {
  const element = snapshot.slides[0]?.elements[0];
  if (!element || element.type !== "topics") {
    throw new Error("Topics element was not found in snapshot");
  }

  return element;
}

describe("CP4D2C Topics move history", () => {
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
    vi.clearAllMocks();
  });

  async function mount(
    initial: Presentation,
    saved: Presentation[] = [],
  ): Promise<void> {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            initialPresentation={initial}
            onSave={async (snapshot) => {
              saved.push(snapshot);
            }}
          />
        </StudioI18nProvider>,
      );
    });
  }

  async function selectTopicsOnCanvas(): Promise<void> {
    const element = container.querySelector<HTMLElement>(
      `[data-powershow-id="${TOPICS_ID}"]`,
    );
    if (!element) throw new Error("Topics element was not rendered");
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function selectElementsTab(): Promise<void> {
    const tab = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Elements");
    if (!tab) throw new Error("Elements tab was not rendered");
    await act(async () => tab.click());
  }

  async function selectTopicRow(label: string): Promise<void> {
    const button = Array.from(container.querySelectorAll<HTMLElement>(
      '[role="tree"] [role="treeitem"] button',
    )).find((candidate) => candidate.textContent?.trim() === label);
    if (!button) throw new Error(`Topic row was not rendered: ${label}`);
    await act(async () => (button as HTMLButtonElement).click());
  }

  async function clickTreeAction(ariaLabel: string): Promise<void> {
    const button = container.querySelector<HTMLButtonElement>(
      `button[aria-label="${ariaLabel}"]`,
    );
    if (!button) throw new Error(`Tree action was not rendered: ${ariaLabel}`);
    await act(async () => button.click());
  }

  async function editTopicText(id: string, value: string): Promise<void> {
    const row = container.querySelector<HTMLElement>(
      `[data-powershow-topic-item-id="${id}"]`,
    );
    const input = row?.querySelector<HTMLInputElement>(
      'input[data-powershow-topic-input="true"]',
    );
    if (!input) throw new Error(`Topic input was not rendered: ${id}`);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("expected HTMLInputElement.value setter");
    await act(async () => {
      input.focus();
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.blur();
    });
  }

  async function addTopLevelTopic(): Promise<void> {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.includes("Add topic"));
    if (!button) throw new Error("Add topic button was not rendered");
    await act(async () => button.click());
  }

  async function removeTopic(id: string): Promise<void> {
    const row = container.querySelector<HTMLElement>(
      `[data-powershow-topic-item-id="${id}"]`,
    );
    const button = row?.querySelector<HTMLButtonElement>(
      'button[data-powershow-topic-remove="true"]',
    );
    if (!button) throw new Error(`Topic Remove button was not rendered: ${id}`);
    await act(async () => button.click());
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

  async function save(saved: Presentation[]): Promise<Presentation> {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Save");
    if (!button) throw new Error("Save button was not rendered");
    await act(async () => button.click());
    const snapshot = saved.at(-1);
    if (!snapshot) throw new Error("Save did not produce a snapshot");
    return snapshot;
  }

  it("tracks top-level sibling move with exact metadata, IDs, undo, and redo", async () => {
    const mixed = topicItem("B", "B", [topicItem("B1", "B1")], [text("b-text", "B"), image("b-image")]);
    const initial = presentation([
      topicItem("A", "A"),
      mixed,
      topicItem("C", "C"),
    ], {
      kind: "ordered",
      rootMarkerStyle: "decimal",
      style: { color: "#445566" },
      typography: { fontFamily: "Inter", fontSize: 20, textDecorationLine: "underline" },
      layout: { position: "absolute", top: 8, margin: 12 },
      markerColor: "#112233",
      itemGap: 8,
    });
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectElementsTab();
    await selectTopicRow("B");
    await clickTreeAction("Move up");

    expect(historyState.commitHistory).toHaveBeenCalledTimes(1);
    expect(historyState.commitHistory).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      {
        kind: "topics.move",
        labelKey: "history.element.setting",
        labelParams: { setting: "topics.move" },
      },
    );

    const after = vi.mocked(historyState.commitHistory).mock.lastCall?.[1];
    if (!after) throw new Error("missing sibling move snapshot");
    const afterTopics = topicsFrom(after);
    expect(afterTopics.items.map((item) => item.id)).toEqual(["B", "A", "C"]);
    expect(afterTopics).toEqual({ ...topicsFrom(initial), items: [mixed, topicsFrom(initial).items[0], topicsFrom(initial).items[2]] });
    expect(findTopicItem(afterTopics.items, "B")?.content.children).toEqual(mixed.content.children);
    expect(after.textStyles).toEqual(initial.textStyles);
    expect(after.linkedStyles).toEqual(initial.linkedStyles);

    expect(await save(saved)).toEqual(after);
    expect(await save(saved)).toEqual(after);
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(after);
  });

  it("moves only a nested sibling array and leaves parent branches exact", async () => {
    const childA = topicItem("child-a", "A");
    const childB = topicItem("child-b", "B", [topicItem("grandchild", "Grandchild")]);
    const childC = topicItem("child-c", "C");
    const parent = topicItem("parent", "Parent", [childA, childB, childC]);
    const other = topicItem("other", "Other", [topicItem("other-child", "Other child")]);
    const initial = presentation([parent, other]);
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectElementsTab();
    await selectTopicRow("B");
    await clickTreeAction("Move up");

    const after = vi.mocked(historyState.commitHistory).mock.lastCall?.[1];
    if (!after) throw new Error("missing nested sibling move snapshot");
    const afterTopics = topicsFrom(after);
    expect(afterTopics.items[0]).toEqual({ ...parent, children: [childB, childA, childC] });
    expect(findTopicItem(afterTopics.items, "parent")?.children.map((item) => item.id)).toEqual([
      "child-b",
      "child-a",
      "child-c",
    ]);
    expect(findTopicItem(afterTopics.items, "other")).toEqual(other);
    expect(findTopicItem(afterTopics.items, "grandchild")).toEqual(findTopicItem(initial.slides[0]!.elements[0]!.type === "topics" ? initial.slides[0]!.elements[0]!.items : [], "grandchild"));
    expect(await save(saved)).toEqual(after);
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(after);
  });

  it("keeps same-index and invalid sibling moves as helper identity no-ops", async () => {
    const items = [topicItem("A"), topicItem("B"), topicItem("C")];
    const initial = presentation(items);
    const elements = initial.slides[0]!.elements;

    expect(moveTopicItemToSiblingIndex(elements, TOPICS_ID, "B", 1)).toBe(elements);
    expect(moveTopicItemToSiblingIndex(elements, TOPICS_ID, "B", -1)).toBe(elements);
    expect(moveTopicItemToSiblingIndex(elements, TOPICS_ID, "B", 3)).toBe(elements);
    expect(moveTopicItemToSiblingIndex(elements, TOPICS_ID, "missing", 0)).toBe(elements);
    expect(moveTopicItemToSiblingIndex(elements, "wrong-topics", "B", 0)).toBe(elements);

    await mount(initial);
    await selectElementsTab();
    await selectTopicRow("A");
    const moveUp = container.querySelector<HTMLButtonElement>('button[aria-label="Move up"]');
    if (!moveUp) throw new Error("Move up button was not rendered");
    expect(moveUp.disabled).toBe(true);
    await act(async () => moveUp.click());
    expect(historyState.commitHistory).not.toHaveBeenCalled();
  });

  it("indents after existing children, preserves the source subtree, and replays exactly", async () => {
    const a1 = topicItem("A1", "A1");
    const b1a = topicItem("B1a", "B1a");
    const b = topicItem("B", "B", [topicItem("B1", "B1", [b1a])], [text("b-text", "B"), image("b-image")]);
    const initial = presentation([
      topicItem("A", "A", [a1]),
      b,
      topicItem("C", "C"),
    ]);
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectElementsTab();
    await selectTopicRow("B");
    await clickTreeAction("Demote topic");

    expect(historyState.commitHistory).toHaveBeenCalledTimes(1);
    expect(historyState.commitHistory).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      {
        kind: "topics.indent",
        labelKey: "history.element.setting",
        labelParams: { setting: "topics.indent" },
      },
    );
    const after = vi.mocked(historyState.commitHistory).mock.lastCall?.[1];
    if (!after) throw new Error("missing indent snapshot");
    const afterTopics = topicsFrom(after);
    expect(afterTopics.items.map((item) => item.id)).toEqual(["A", "C"]);
    expect(findTopicItem(afterTopics.items, "A")?.children.map((item) => item.id)).toEqual(["A1", "B"]);
    expect(findTopicItem(afterTopics.items, "B")).toEqual(b);
    expect(after.textStyles).toEqual(initial.textStyles);
    expect(after.linkedStyles).toEqual(initial.linkedStyles);
    expect(await save(saved)).toEqual(after);
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(after);
  });

  it("rejects first-sibling indent without history", async () => {
    const initial = presentation([topicItem("A"), topicItem("B")]);
    const elements = initial.slides[0]!.elements;
    expect(indentTopicItem(elements, TOPICS_ID, "A")).toBe(elements);

    await mount(initial);
    await selectElementsTab();
    await selectTopicRow("A");
    const demote = container.querySelector<HTMLButtonElement>('button[aria-label="Demote topic"]');
    if (!demote) throw new Error("Demote topic button was not rendered");
    expect(demote.disabled).toBe(true);
    await act(async () => demote.click());
    expect(historyState.commitHistory).not.toHaveBeenCalled();
  });

  it("rejects max-depth indent using the full source subtree height", async () => {
    const source = structuralChain(5)[0]!;
    const initial = presentation([topicItem("previous", "Previous"), source]);
    const elements = initial.slides[0]!.elements;
    expect(indentTopicItem(elements, TOPICS_ID, source.id)).toBe(elements);

    await mount(initial);
    await selectElementsTab();
    await selectTopicRow("Depth 1");
    const demote = container.querySelector<HTMLButtonElement>('button[aria-label="Demote topic"]');
    if (!demote) throw new Error("Demote topic button was not rendered");
    expect(demote.disabled).toBe(true);
    await act(async () => demote.click());
    expect(historyState.commitHistory).not.toHaveBeenCalled();
  });

  it("outdents immediately after the former parent and preserves the remaining siblings", async () => {
    const a1 = topicItem("A1", "A1");
    const b = topicItem("B", "B");
    const c = topicItem("C", "C");
    const parent = topicItem("A", "A", [a1, b, c]);
    const sibling = topicItem("D", "D");
    const initial = presentation([parent, sibling]);
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectElementsTab();
    await selectTopicRow("B");
    await clickTreeAction("Promote topic");

    expect(historyState.commitHistory).toHaveBeenCalledTimes(1);
    expect(historyState.commitHistory).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      {
        kind: "topics.outdent",
        labelKey: "history.element.setting",
        labelParams: { setting: "topics.outdent" },
      },
    );
    const after = vi.mocked(historyState.commitHistory).mock.lastCall?.[1];
    if (!after) throw new Error("missing outdent snapshot");
    expect(topicsFrom(after).items.map((item) => item.id)).toEqual(["A", "B", "D"]);
    expect(findTopicItem(topicsFrom(after).items, "A")?.children.map((item) => item.id)).toEqual(["A1", "C"]);
    expect(await save(saved)).toEqual(after);
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(after);
  });

  it("outdents a deep item by exactly one structural level", async () => {
    const c = topicItem("C", "C");
    const b = topicItem("B", "B", [c]);
    const a = topicItem("A", "A", [b]);
    const initial = presentation([a]);
    const elements = initial.slides[0]!.elements;
    const direct = outdentTopicItem(elements, TOPICS_ID, "C");
    const directTopics = direct[0];
    if (directTopics?.type !== "topics") throw new Error("Topics element was not found");
    expect(directTopics.items.map((item) => item.id)).toEqual(["A"]);
    expect(directTopics.items[0]?.children.map((item) => item.id)).toEqual(["B", "C"]);

    const saved: Presentation[] = [];
    await mount(initial, saved);
    await selectElementsTab();
    await selectTopicRow("C");
    await clickTreeAction("Promote topic");
    const after = vi.mocked(historyState.commitHistory).mock.lastCall?.[1];
    if (!after) throw new Error("missing deep outdent snapshot");
    expect(findTopicItem(topicsFrom(after).items, "A")?.children.map((item) => item.id)).toEqual(["B", "C"]);
    expect(topicsFrom(after).items.map((item) => item.id)).toEqual(["A"]);
  });

  it("rejects top-level outdent without history", async () => {
    const initial = presentation([topicItem("A"), topicItem("B")]);
    const elements = initial.slides[0]!.elements;
    expect(outdentTopicItem(elements, TOPICS_ID, "A")).toBe(elements);

    await mount(initial);
    await selectElementsTab();
    await selectTopicRow("A");
    const promote = container.querySelector<HTMLButtonElement>('button[aria-label="Promote topic"]');
    if (!promote) throw new Error("Promote topic button was not rendered");
    expect(promote.disabled).toBe(true);
    await act(async () => promote.click());
    expect(historyState.commitHistory).not.toHaveBeenCalled();
  });

  it("finishes continuous text editing before structural move", async () => {
    const initial = presentation([topicItem("A", "Before"), topicItem("B", "B")]);
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectTopicsOnCanvas();
    await editTopicText("A", "Edited");
    await selectElementsTab();
    await selectTopicRow("B");
    await clickTreeAction("Move up");

    expect(historyState.commitHistory).toHaveBeenCalledTimes(1);
    const after = vi.mocked(historyState.commitHistory).mock.lastCall?.[1];
    if (!after) throw new Error("missing move-after-text snapshot");
    expect(topicsFrom(after).items.map((item) => item.id)).toEqual(["B", "A"]);
    expect(findTopicItem(topicsFrom(after).items, "A")?.content.children[0]).toMatchObject({ content: "Edited" });

    await undo();
    const afterStructureUndo = await save(saved);
    expect(topicsFrom(afterStructureUndo).items.map((item) => item.id)).toEqual(["A", "B"]);
    expect(findTopicItem(topicsFrom(afterStructureUndo).items, "A")?.content.children[0]).toMatchObject({ content: "Edited" });
    await undo();
    expect(await save(saved)).toEqual(initial);
  });

  it("keeps Add separate from a following structural move", async () => {
    const initial = presentation([topicItem("A", "A"), topicItem("B", "B")]);
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectTopicsOnCanvas();
    await addTopLevelTopic();
    const afterAdd = vi.mocked(historyState.commitHistory).mock.lastCall?.[1];
    if (!afterAdd) throw new Error("missing Add snapshot");
    const created = topicsFrom(afterAdd).items.at(-1);
    if (!created) throw new Error("missing added TopicItem");

    await selectElementsTab();
    await selectTopicRow("New topic");
    await clickTreeAction("Move up");
    expect(historyState.commitHistory).toHaveBeenCalledTimes(2);
    expect(vi.mocked(historyState.commitHistory).mock.calls.map((call) => call[2])).toEqual([
      {
        kind: "topics.add",
        labelKey: "history.element.setting",
        labelParams: { setting: "topics.add" },
      },
      {
        kind: "topics.move",
        labelKey: "history.element.setting",
        labelParams: { setting: "topics.move" },
      },
    ]);
    const afterMove = vi.mocked(historyState.commitHistory).mock.lastCall?.[1];
    if (!afterMove) throw new Error("missing move-after-Add snapshot");
    expect(topicsFrom(afterMove).items.map((item) => item.id)).toEqual(["A", created.id, "B"]);

    await undo();
    expect(await save(saved)).toEqual(afterAdd);
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(afterAdd);
    await redo();
    expect(await save(saved)).toEqual(afterMove);
  });

  it("keeps Remove separate after a structural move", async () => {
    const initial = presentation([topicItem("A"), topicItem("B"), topicItem("C")]);
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectElementsTab();
    await selectTopicRow("B");
    await clickTreeAction("Move up");
    const afterMove = vi.mocked(historyState.commitHistory).mock.lastCall?.[1];
    if (!afterMove) throw new Error("missing move snapshot");

    await selectTopicsOnCanvas();
    const inspectorTab = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Inspector");
    if (!inspectorTab) throw new Error("Inspector tab was not rendered");
    await act(async () => inspectorTab.click());
    await removeTopic("B");
    expect(historyState.commitHistory).toHaveBeenCalledTimes(2);
    expect(vi.mocked(historyState.commitHistory).mock.calls[1]?.[2]).toEqual({
      kind: "topics.remove",
      labelKey: "history.element.setting",
      labelParams: { setting: "topics.remove" },
    });
    const afterRemove = vi.mocked(historyState.commitHistory).mock.lastCall?.[1];
    if (!afterRemove) throw new Error("missing remove-after-move snapshot");
    expect(topicsFrom(afterRemove).items.map((item) => item.id)).toEqual(["A", "C"]);

    await undo();
    expect(await save(saved)).toEqual(afterMove);
    await undo();
    expect(await save(saved)).toEqual(initial);
  });

  it("records consecutive moves separately and keeps indent/outdent separate", async () => {
    const initial = presentation([topicItem("A"), topicItem("B"), topicItem("C")]);
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectElementsTab();
    await selectTopicRow("B");
    await clickTreeAction("Move up");
    await clickTreeAction("Move down");
    expect(historyState.commitHistory).toHaveBeenCalledTimes(2);
    const afterSecondMove = vi.mocked(historyState.commitHistory).mock.lastCall?.[1];
    if (!afterSecondMove) throw new Error("missing consecutive move snapshot");
    expect(topicsFrom(afterSecondMove).items.map((item) => item.id)).toEqual(["A", "B", "C"]);
    await undo();
    const afterFirstMove = await save(saved);
    expect(topicsFrom(afterFirstMove).items.map((item) => item.id)).toEqual(["B", "A", "C"]);
    await undo();
    expect(await save(saved)).toEqual(initial);

    await redo();
    expect(topicsFrom(await save(saved)).items.map((item) => item.id)).toEqual(["B", "A", "C"]);
    await redo();
    expect(topicsFrom(await save(saved)).items.map((item) => item.id)).toEqual(["A", "B", "C"]);

    await selectTopicRow("B");
    await clickTreeAction("Demote topic");
    await clickTreeAction("Promote topic");
    expect(historyState.commitHistory).toHaveBeenCalledTimes(4);
    const afterIndent = vi.mocked(historyState.commitHistory).mock.calls[2]?.[1];
    const afterOutdent = vi.mocked(historyState.commitHistory).mock.calls[3]?.[1];
    if (!afterIndent || !afterOutdent) throw new Error("missing indent/outdent snapshots");
    expect(topicsFrom(afterIndent).items[0]?.children.map((item) => item.id)).toEqual(["B"]);
    expect(topicsFrom(afterOutdent).items.map((item) => item.id)).toEqual(["A", "B", "C"]);

    await undo();
    expect(topicsFrom(await save(saved)).items[0]?.children.map((item) => item.id)).toEqual(["B"]);
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(topicsFrom(await save(saved)).items[0]?.children.map((item) => item.id)).toEqual(["B"]);
    await redo();
    expect(topicsFrom(await save(saved)).items.map((item) => item.id)).toEqual(["A", "B", "C"]);
  });
});
