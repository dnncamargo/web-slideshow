// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SYSTEM_TOPICS_TEXT_STYLE_ID,
  PresentationSchema,
  type PresentationElement,
  type Presentation,
  type TopicItem,
  type TopicsElement,
} from "@web-slideshow/document-schema";

vi.mock("../src/features/editor/editor-history-state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/features/editor/editor-history-state")>();
  return { ...actual, commitHistory: vi.fn(actual.commitHistory) };
});

import * as historyState from "../src/features/editor/editor-history-state";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { removeTopicItemFromTopicItems } from "../src/features/editor/element-operations";
import { TopicsInspector } from "../src/features/editor/inspector/topics-inspector";
import type { TopicsAuthoringControls } from "../src/features/editor/inspector/inspector-types";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const TOPICS_ID = "cp4d2b-topics";

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: value,
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

function text(id: string, content: string): PresentationElement {
  return {
    type: "text",
    id,
    hidden: false,
    variant: "body",
    content,
  };
}

function image(id: string): PresentationElement {
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
  children: PresentationElement[],
  nested: TopicItem[] = [],
): TopicItem {
  return {
    id,
    content: { id: `slot-${id}`, children },
    children: nested,
  };
}

function topicTextItem(id: string, content: string, nested: TopicItem[] = []): TopicItem {
  return topicItem(id, [text(`text-${id}`, content)], nested);
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
    { id: SYSTEM_TOPICS_TEXT_STYLE_ID, name: "Topics", role: "body" },
  ],
  linkedStyles: Presentation["linkedStyles"] = undefined,
): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4d2b-topics-remove-history",
    title: "CP4D2B topics remove history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [topicsElement(items, overrides)],
    }],
    textStyles,
    ...(linkedStyles === undefined ? {} : { linkedStyles }),
  });
}

function topicsFrom(snapshot: Presentation): TopicsElement {
  const element = snapshot.slides[0]?.elements[0];
  if (!element || element.type !== "topics") {
    throw new Error("Topics element was not found in snapshot");
  }

  return element;
}

function findTopicItem(items: readonly TopicItem[], id: string): TopicItem | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    const nested = findTopicItem(item.children, id);
    if (nested) return nested;
  }

  return undefined;
}

describe("CP4D2B Topics Remove history", () => {
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

  async function selectTopics(): Promise<void> {
    const element = container.querySelector<HTMLElement>(
      `[data-presentation-id="${TOPICS_ID}"]`,
    );
    if (!element) throw new Error("Topics element was not rendered");
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function removeTopic(id: string): Promise<void> {
    const row = container.querySelector<HTMLElement>(
      `[data-presentation-topic-item-id="${id}"]`,
    );
    const button = row?.querySelector<HTMLButtonElement>(
      'button[data-presentation-topic-remove="true"]',
    );
    if (!button) throw new Error(`Topic Remove button was not rendered: ${id}`);
    await act(async () => button.click());
  }

  async function addTopLevelTopic(): Promise<void> {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.includes("Add topic"));
    if (!button) throw new Error("Add topic button was not rendered");
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

  async function save(): Promise<void> {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Save");
    if (!button) throw new Error("Save button was not rendered");
    await act(async () => button.click());
  }

  function topicInput(id: string): HTMLInputElement {
    const row = container.querySelector<HTMLElement>(
      `[data-presentation-topic-item-id="${id}"]`,
    );
    const input = row?.querySelector<HTMLInputElement>(
      'input[data-presentation-topic-input="true"]',
    );
    if (!input) throw new Error(`Topic input was not rendered: ${id}`);
    return input;
  }

  function setTextValue(control: HTMLInputElement, value: string): void {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    if (!setter) throw new Error("expected HTMLInputElement.value setter");
    setter.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("tracks a top-level middle Remove with exact metadata, Undo, and Redo", async () => {
    const initial = presentation([
      topicTextItem("topic-a", "A"),
      topicTextItem("topic-b", "B"),
      topicTextItem("topic-c", "C"),
    ], {
      rootMarkerStyle: "square",
      style: { color: "#123456" },
      typography: { fontSize: "1.2rem" },
    });
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectTopics();
    await removeTopic("topic-b");

    expect(historyState.commitHistory).toHaveBeenCalledTimes(1);
    expect(vi.mocked(historyState.commitHistory).mock.calls[0]?.[2]).toEqual({
      kind: "topics.remove",
      labelKey: "history.element.setting",
      labelParams: { setting: "topics.remove" },
    });

    const removed = vi.mocked(historyState.commitHistory).mock.calls[0]?.[1];
    if (!removed) throw new Error("missing Remove snapshot");
    expect(topicsFrom(removed).items.map((item) => item.id)).toEqual([
      "topic-a",
      "topic-c",
    ]);
    expect(topicsFrom(removed)).toEqual({ ...topicsFrom(initial), items: [
      topicsFrom(initial).items[0],
      topicsFrom(initial).items[2],
    ] });
    expect(removed.textStyles).toEqual(initial.textStyles);

    await save();
    expect(saved.at(-1)).toEqual(removed);
    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(true);
    await save();
    expect(saved.at(-1)).toEqual(initial);
    const redoEvent = await redo();
    expect(redoEvent.defaultPrevented).toBe(true);
    await save();
    expect(saved.at(-1)).toEqual(removed);
  });

  it("removes a nested child while preserving its parent and sibling", async () => {
    const childA = topicTextItem("child-a", "Child A");
    const childB = topicTextItem("child-b", "Child B");
    const parent = topicTextItem("parent", "Parent", [childA, childB]);
    const sibling = topicTextItem("sibling", "Sibling");
    const initial = presentation([parent, sibling]);
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectTopics();
    await removeTopic("child-a");
    const removed = vi.mocked(historyState.commitHistory).mock.calls[0]?.[1];
    if (!removed) throw new Error("missing nested Remove snapshot");

    const afterTopics = topicsFrom(removed);
    expect(afterTopics.items[0]).toEqual({ ...parent, children: [childB] });
    expect(afterTopics.items[1]).toEqual(sibling);

    await save();
    await undo();
    await save();
    expect(saved.at(-1)).toEqual(initial);
    await redo();
    await save();
    expect(saved.at(-1)).toEqual(removed);
  });

  it("removes and restores an entire nested subtree with exact canonical IDs", async () => {
    const grandchild = topicTextItem("grandchild", "Grandchild");
    const child = topicTextItem("child", "Child", [grandchild]);
    const parent = topicTextItem("parent", "Parent", [child]);
    const sibling = topicTextItem("sibling", "Sibling");
    const initial = presentation([parent, sibling]);
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectTopics();
    await removeTopic("parent");
    const removed = vi.mocked(historyState.commitHistory).mock.calls[0]?.[1];
    if (!removed) throw new Error("missing subtree Remove snapshot");

    expect(topicsFrom(removed).items).toEqual([sibling]);
    expect(findTopicItem(topicsFrom(removed).items, "parent")).toBeUndefined();
    await save();
    await undo();
    await save();
    expect(saved.at(-1)).toEqual(initial);
    await redo();
    await save();
    expect(saved.at(-1)).toEqual(removed);
    expect(findTopicItem(topicsFrom(saved.at(-1)!).items, "grandchild")).toBeUndefined();
  });

  it("preserves mixed content and the Topics Text Style when removing the last item", async () => {
    const mixed = topicItem("mixed", [
      text("mixed-text", "Mixed"),
      image("mixed-image"),
    ]);
    const textStyles = [
      { id: "custom-style", name: "Custom", role: "body" as const },
      { id: SYSTEM_TOPICS_TEXT_STYLE_ID, name: "Topics", role: "body" as const },
    ];
    const initial = presentation([mixed], {
      rootMarkerStyle: "circle",
      linkedStyleId: "linked-topics",
    }, textStyles, [{
      target: "topics",
      id: "linked-topics",
      name: "Linked Topics",
      kind: "unordered",
    }]);
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectTopics();
    await removeTopic("mixed");
    const removed = vi.mocked(historyState.commitHistory).mock.calls[0]?.[1];
    if (!removed) throw new Error("missing mixed-content Remove snapshot");

    expect(topicsFrom(removed).items).toEqual([]);
    expect(topicsFrom(removed)).toEqual({ ...topicsFrom(initial), items: [] });
    expect(removed.textStyles).toEqual(textStyles);
    await save();
    await undo();
    await save();
    expect(saved.at(-1)).toEqual(initial);
    expect(topicsFrom(saved.at(-1)!).items[0]).toEqual(mixed);
    await redo();
    await save();
    expect(saved.at(-1)).toEqual(removed);
    expect(removed.textStyles).toEqual(initial.textStyles);
  });

  it("finishes Topic text history before Remove and restores edited text before original text", async () => {
    const initial = presentation([
      topicTextItem("topic-a", "Original"),
      topicTextItem("topic-b", "B"),
    ]);
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectTopics();
    await act(async () => {
      const input = topicInput("topic-a");
      input.focus();
      setTextValue(input, "Edited");
    });
    await removeTopic("topic-a");

    expect(historyState.commitHistory).toHaveBeenCalledTimes(1);
    expect(vi.mocked(historyState.commitHistory).mock.calls[0]?.[2]).toEqual({
      kind: "topics.remove",
      labelKey: "history.element.setting",
      labelParams: { setting: "topics.remove" },
    });

    await undo();
    await save();
    const afterRemoveUndo = saved.at(-1);
    expect(afterRemoveUndo).toBeDefined();
    expect(findTopicItem(topicsFrom(afterRemoveUndo!).items, "topic-a")?.content.children[0]).toMatchObject({
      type: "text",
      content: "Edited",
    });

    await undo();
    await save();
    expect(saved.at(-1)).toEqual(initial);
  });

  it("keeps Add and Remove as separate actions with corresponding replay order", async () => {
    const initial = presentation([topicTextItem("topic-a", "A")]);
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectTopics();
    await addTopLevelTopic();
    const afterAdd = vi.mocked(historyState.commitHistory).mock.calls[0]?.[1];
    if (!afterAdd) throw new Error("missing Add snapshot");
    const created = topicsFrom(afterAdd).items.at(-1);
    if (!created) throw new Error("missing added TopicItem");

    await removeTopic(created.id);
    expect(historyState.commitHistory).toHaveBeenCalledTimes(2);
    expect(vi.mocked(historyState.commitHistory).mock.calls[0]?.[2]).toEqual({
      kind: "topics.add",
      labelKey: "history.element.setting",
      labelParams: { setting: "topics.add" },
    });
    expect(vi.mocked(historyState.commitHistory).mock.calls[1]?.[2]).toEqual({
      kind: "topics.remove",
      labelKey: "history.element.setting",
      labelParams: { setting: "topics.remove" },
    });
    const afterRemove = vi.mocked(historyState.commitHistory).mock.calls[1]?.[1];
    if (!afterRemove) throw new Error("missing Remove-after-Add snapshot");

    await undo();
    await save();
    expect(saved.at(-1)).toEqual(afterAdd);
    await undo();
    await save();
    expect(saved.at(-1)).toEqual(initial);
    await redo();
    await save();
    expect(saved.at(-1)).toEqual(afterAdd);
    await redo();
    await save();
    expect(saved.at(-1)).toEqual(afterRemove);
  });

  it("records consecutive Removes separately and undoes them in reverse order", async () => {
    const initial = presentation([
      topicTextItem("topic-a", "A"),
      topicTextItem("topic-b", "B"),
      topicTextItem("topic-c", "C"),
    ]);
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectTopics();
    await removeTopic("topic-b");
    await removeTopic("topic-c");

    expect(historyState.commitHistory).toHaveBeenCalledTimes(2);
    expect(vi.mocked(historyState.commitHistory).mock.calls.map((call) => call[2])).toEqual([
      {
        kind: "topics.remove",
        labelKey: "history.element.setting",
        labelParams: { setting: "topics.remove" },
      },
      {
        kind: "topics.remove",
        labelKey: "history.element.setting",
        labelParams: { setting: "topics.remove" },
      },
    ]);
    const afterFirstRemove = vi.mocked(historyState.commitHistory).mock.calls[0]?.[1];
    const afterSecondRemove = vi.mocked(historyState.commitHistory).mock.calls[1]?.[1];
    if (!afterFirstRemove || !afterSecondRemove) throw new Error("missing consecutive Remove snapshots");

    await undo();
    await save();
    expect(saved.at(-1)).toEqual(afterFirstRemove);
    await undo();
    await save();
    expect(saved.at(-1)).toEqual(initial);
    await redo();
    await save();
    expect(saved.at(-1)).toEqual(afterFirstRemove);
    await redo();
    await save();
    expect(saved.at(-1)).toEqual(afterSecondRemove);
  });

  it("leaves a missing helper target unchanged without manufacturing a mutation", () => {
    const items = [topicTextItem("topic-a", "A")];
    expect(removeTopicItemFromTopicItems(items, "missing")).toBe(items);
  });

  it("removes directly without an AuthoringHistory provider", async () => {
    const initial = topicsElement([
      topicTextItem("topic-a", "A"),
      topicTextItem("topic-b", "B"),
    ]);
    let current = initial;
    let updates = 0;
    const controls: TopicsAuthoringControls = {
      onAddTopLevelTopic: () => null,
      onAddChildTopic: () => null,
    };

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <TopicsInspector
            element={current}
            onUpdate={(update) => {
              const next = update(current);
              if (next.type !== "topics") throw new Error("expected Topics element");
              current = next;
              updates += 1;
              root.render(
                <StudioI18nProvider>
                  <TopicsInspector
                    element={current}
                    onUpdate={(nestedUpdate) => {
                      const nestedNext = nestedUpdate(current);
                      if (nestedNext.type !== "topics") throw new Error("expected Topics element");
                      current = nestedNext;
                      updates += 1;
                    }}
                    topicsAuthoringControls={controls}
                    fontResources={[]}
                  />
                </StudioI18nProvider>,
              );
            }}
            topicsAuthoringControls={controls}
            fontResources={[]}
          />
        </StudioI18nProvider>,
      );
    });

    const button = container.querySelector<HTMLElement>(
      '[data-presentation-topic-item-id="topic-a"] button[data-presentation-topic-remove="true"]',
    );
    if (!button) throw new Error("standalone Remove button was not rendered");
    await act(async () => (button as HTMLButtonElement).click());
    expect(updates).toBe(1);
    expect(current.items.map((item) => item.id)).toEqual(["topic-b"]);
  });
});
