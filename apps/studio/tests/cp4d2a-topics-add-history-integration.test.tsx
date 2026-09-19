// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  POWERSHOW_TOPICS_TEXT_STYLE_ID,
  PresentationSchema,
  type Presentation,
  type TopicItem,
  type TopicsElement,
} from "@powershow/document-schema";

vi.mock("../src/features/editor/editor-history-state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/features/editor/editor-history-state")>();
  return { ...actual, commitHistory: vi.fn(actual.commitHistory) };
});

import * as historyState from "../src/features/editor/editor-history-state";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const TOPICS_ID = "topics-1";

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: value,
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

function topicItem(
  id: string,
  content = id,
  children: TopicItem[] = [],
): TopicItem {
  return {
    id,
    content: {
      id: `slot-${id}`,
      children: [{
        type: "text",
        id: `text-${id}`,
        hidden: false,
        variant: "body",
        content,
      }],
    },
    children,
  };
}

function topicsElement(
  items: TopicItem[],
  style?: TopicsElement["style"],
): TopicsElement {
  return {
    type: "topics",
    id: TOPICS_ID,
    hidden: false,
    kind: "unordered",
    items,
    ...(style === undefined ? {} : { style }),
  };
}

function presentation(
  items: TopicItem[],
  textStyles?: Presentation["textStyles"],
  style?: TopicsElement["style"],
): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4d2a-topics-add-history",
    title: "CP4D2A topics add history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [topicsElement(items, style)],
    }],
    ...(textStyles === undefined ? {} : { textStyles }),
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

describe("CP4D2A Topics Add history", () => {
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
      `[data-powershow-id="${TOPICS_ID}"]`,
    );
    if (!element) throw new Error("Topics element was not rendered");
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function addTopLevelTopic(): Promise<void> {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.includes("Add topic"));
    if (!button) throw new Error("Add topic button was not rendered");
    await act(async () => button.click());
  }

  async function addChildTopic(topicItemId: string): Promise<void> {
    const row = container.querySelector<HTMLElement>(
      `[data-powershow-topic-item-id="${topicItemId}"]`,
    );
    const button = row?.querySelector<HTMLButtonElement>(
      'button[data-powershow-topic-add-child="true"]',
    );
    if (!button) throw new Error(`Add child button was not rendered: ${topicItemId}`);
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

  it("atomically tracks top-level Add, preserves order, and redoes exact IDs", async () => {
    const initial = presentation([
      topicItem("topic-a", "A"),
      topicItem("topic-b", "B"),
    ]);
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectTopics();
    await addTopLevelTopic();

    expect(historyState.commitHistory).toHaveBeenCalledTimes(1);
    expect(historyState.commitHistory).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      {
        kind: "topics.add",
        labelKey: "history.element.setting",
        labelParams: { setting: "topics.add" },
      },
    );

    const after = vi.mocked(historyState.commitHistory).mock.lastCall?.[1];
    if (!after) throw new Error("missing top-level Add snapshot");
    const afterTopics = topicsFrom(after);
    const created = afterTopics.items.at(-1);
    if (!created) throw new Error("created TopicItem was not appended");
    const createdText = created.content.children[0];

    expect(afterTopics.items.map((item) => item.id)).toEqual([
      "topic-a",
      "topic-b",
      created.id,
    ]);
    expect(created.content.children).toHaveLength(1);
    expect(createdText).toMatchObject({
      type: "text",
      content: "New topic",
      variant: POWERSHOW_TOPICS_TEXT_STYLE_ID,
    });
    expect(createdText).not.toHaveProperty("style");
    expect(new Set([created.id, created.content.id, createdText.id]).size).toBe(3);
    expect(after.textStyles?.filter((style) => style.id === POWERSHOW_TOPICS_TEXT_STYLE_ID)).toHaveLength(1);

    await save();
    expect(saved.at(-1)).toEqual(after);

    await undo();
    await save();
    expect(saved.at(-1)).toEqual(initial);

    await redo();
    await save();
    expect(saved.at(-1)).toEqual(after);
    const redone = topicsFrom(saved.at(-1)!).items.at(-1)!;
    expect([
      redone.id,
      redone.content.id,
      redone.content.children[0]?.id,
    ]).toEqual([created.id, created.content.id, createdText.id]);
  });

  it("atomically tracks child Add and appends nested children with exact IDs", async () => {
    const initial = presentation([
      topicItem("parent", "Parent", [topicItem("existing-child", "Existing child")]),
    ]);
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectTopics();
    await addChildTopic("parent");

    expect(historyState.commitHistory).toHaveBeenCalledTimes(1);
    const after = vi.mocked(historyState.commitHistory).mock.lastCall?.[1];
    if (!after) throw new Error("missing child Add snapshot");
    const parent = findTopicItem(topicsFrom(after).items, "parent");
    if (!parent) throw new Error("parent was not found");
    const created = parent.children.at(-1);
    if (!created) throw new Error("created child was not appended");

    expect(parent.children.map((item) => item.id)).toEqual([
      "existing-child",
      created.id,
    ]);
    expect(created.content.children[0]).toMatchObject({
      type: "text",
      content: "New topic",
      variant: POWERSHOW_TOPICS_TEXT_STYLE_ID,
    });
    const ids = [created.id, created.content.id, created.content.children[0]?.id];

    await save();
    await undo();
    await save();
    expect(saved.at(-1)).toEqual(initial);

    await redo();
    await save();
    const redone = findTopicItem(topicsFrom(saved.at(-1)!).items, "parent")?.children.at(-1);
    expect([redone?.id, redone?.content.id, redone?.content.children[0]?.id]).toEqual(ids);
  });

  it("accepts depth 4 to 5 and refuses depth 5 without history or style side effects", async () => {
    const legal = presentation(structuralChain(4));
    const legalSaved: Presentation[] = [];

    await mount(legal, legalSaved);
    await selectTopics();
    await addChildTopic("depth-4");

    expect(historyState.commitHistory).toHaveBeenCalledTimes(1);
    const legalAfter = vi.mocked(historyState.commitHistory).mock.lastCall?.[1];
    if (!legalAfter) throw new Error("missing depth-4 Add snapshot");
    const legalParent = findTopicItem(topicsFrom(legalAfter).items, "depth-4");
    expect(legalParent?.children).toHaveLength(1);
    expect(legalParent?.children[0]?.content.children[0]).toMatchObject({ content: "New topic" });

    const created = legalParent?.children[0];
    await undo();
    await redo();
    const legalRedone = vi.mocked(historyState.commitHistory).mock.lastCall?.[1];
    expect(created?.id).toBe(legalRedone && findTopicItem(topicsFrom(legalRedone).items, "depth-4")?.children[0]?.id);

    await act(async () => root.unmount());
    container.innerHTML = "";
    root = createRoot(container);
    vi.mocked(historyState.commitHistory).mockClear();

    const tooDeep = presentation(structuralChain(5));
    await mount(tooDeep);
    await selectTopics();
    await addChildTopic("depth-5");

    expect(historyState.commitHistory).not.toHaveBeenCalled();
    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(false);
    expect(container.querySelectorAll('[data-powershow-topic-item-id="depth-5"]')).toHaveLength(1);
  });

  it("preserves pre-existing Topics style order and data without duplication", async () => {
    const textStyles = [
      { id: "custom-style", name: "Custom", role: "body" as const },
      { id: POWERSHOW_TOPICS_TEXT_STYLE_ID, name: "Existing Topics", role: "body" as const },
    ];
    const initial = presentation([topicItem("topic-a", "A")], textStyles);

    await mount(initial);
    await selectTopics();
    await addTopLevelTopic();

    const after = vi.mocked(historyState.commitHistory).mock.lastCall?.[1];
    expect(after?.textStyles).toEqual(textStyles);
    expect(after?.textStyles?.filter((style) => style.id === POWERSHOW_TOPICS_TEXT_STYLE_ID)).toHaveLength(1);
  });

  it("keeps Topic text editing separate from structural Add history", async () => {
    const initial = presentation([topicItem("topic-a", "Before")]);

    await mount(initial);
    await selectTopics();

    const input = container.querySelector<HTMLInputElement>(
      '[data-powershow-topic-item-id="topic-a"] input[data-powershow-topic-input="true"]',
    );
    if (!input) throw new Error("Topic input was not rendered");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("expected HTMLInputElement.value setter");
    await act(async () => {
      input.focus();
      setter.call(input, "Edited");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.blur();
    });

    await addTopLevelTopic();
    expect(historyState.commitHistory).toHaveBeenCalledTimes(1);
    expect(vi.mocked(historyState.commitHistory).mock.calls[0]?.[2]).toEqual({
      kind: "topics.add",
      labelKey: "history.element.setting",
      labelParams: { setting: "topics.add" },
    });

    await undo();
    expect(container.querySelectorAll('[data-powershow-topic-item-id]')).toHaveLength(1);
    expect(container.querySelector<HTMLInputElement>(
      '[data-powershow-topic-item-id="topic-a"] input[data-powershow-topic-input="true"]',
    )?.value).toBe("Edited");

    await undo();
    expect(container.querySelector<HTMLInputElement>(
      '[data-powershow-topic-item-id="topic-a"] input[data-powershow-topic-input="true"]',
    )?.value).toBe("Before");
  });
});
