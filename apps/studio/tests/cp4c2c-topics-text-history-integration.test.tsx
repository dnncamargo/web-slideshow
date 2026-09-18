// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type PowerShowElement,
  type Presentation,
  type TopicItem,
  type TopicsElement,
  type TextRun,
} from "@powershow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { TopicsInspector } from "../src/features/editor/inspector/topics-inspector";
import type { TopicsAuthoringControls } from "../src/features/editor/inspector/inspector-types";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const TOPICS_ID = "cp4c2c-topics";

function text(id: string, content: string): PowerShowElement {
  return {
    type: "text",
    id,
    hidden: false,
    variant: "body",
    content,
  };
}

function richText(id: string, runs: TextRun[]): PowerShowElement {
  return {
    type: "text",
    id,
    hidden: false,
    variant: "body",
    content: { type: "rich-text", runs },
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

function table(id: string): PowerShowElement {
  return {
    type: "table",
    id,
    hidden: false,
    columns: [{ key: "value", label: "Value" }],
    rows: [{ value: id }],
  };
}

function topicItem(
  id: string,
  children: PowerShowElement[],
  nested: TopicItem[] = [],
): TopicItem {
  return {
    id,
    content: { id: `slot-${id}`, children },
    children: nested,
  };
}

function topicsElement(items: TopicItem[]): TopicsElement {
  return {
    type: "topics",
    id: TOPICS_ID,
    hidden: false,
    kind: "unordered",
    items,
  };
}

function presentation(items: TopicItem[]): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4c2c-topics-text-history",
    title: "CP4C2C topics text history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [topicsElement(items)],
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

function setTextValue(control: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(control, value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

function findTopicItem(items: readonly TopicItem[], id: string): TopicItem | undefined {
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

describe("CP4C2C Topics text history", () => {
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

  async function mount(
    initial: Presentation,
    saved: Presentation[] = [],
  ): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={initial}
          onSave={async (snapshot) => {
            saved.push(snapshot);
          }}
        />
      </StudioI18nProvider>,
    ));
  }

  async function selectTopics(): Promise<void> {
    const element = host.querySelector<HTMLElement>(
      `[data-powershow-id="${TOPICS_ID}"]`,
    );
    if (!element) throw new Error("Topics element was not rendered");
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  function topicInput(id: string): HTMLInputElement {
    const row = host.querySelector<HTMLElement>(
      `[data-powershow-topic-item-id="${id}"]`,
    );
    const input = row?.querySelector<HTMLInputElement>(
      'input[data-powershow-topic-input="true"]',
    );
    if (!input) throw new Error(`Topic input was not rendered: ${id}`);
    return input;
  }

  async function editTopic(id: string, values: readonly string[]): Promise<void> {
    await act(async () => {
      const input = topicInput(id);
      input.focus();
      for (const value of values) setTextValue(input, value);
      input.blur();
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

  async function save(): Promise<void> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Save");
    if (!button) throw new Error("Save button was not rendered");
    await act(async () => button.click());
  }

  it("coalesces one top-level TopicItem focus session", async () => {
    await mount(presentation([
      topicItem("topic-a", [text("topic-a-text", "First topic")]),
    ]));
    await selectTopics();

    await editTopic("topic-a", ["First edit", "Final topic"]);
    expect(topicInput("topic-a").value).toBe("Final topic");

    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(true);
    expect(topicInput("topic-a").value).toBe("First topic");

    const redoEvent = await redo();
    expect(redoEvent.defaultPrevented).toBe(true);
    expect(topicInput("topic-a").value).toBe("Final topic");
  });

  it("does not create history for a same-value TopicItem input", async () => {
    await mount(presentation([
      topicItem("topic-a", [text("topic-a-text", "First topic")]),
    ]));
    await selectTopics();

    await editTopic("topic-a", ["First topic"]);
    const undoEvent = await undo();

    expect(undoEvent.defaultPrevented).toBe(false);
    expect(topicInput("topic-a").value).toBe("First topic");
  });

  it("keeps different TopicItems in separate history transactions", async () => {
    await mount(presentation([
      topicItem("topic-a", [text("topic-a-text", "First topic")]),
      topicItem("topic-b", [text("topic-b-text", "Second topic")]),
    ]));
    await selectTopics();

    await editTopic("topic-a", ["Edited topic"]);
    await editTopic("topic-b", ["Edited sibling"]);

    await undo();
    expect(topicInput("topic-a").value).toBe("Edited topic");
    expect(topicInput("topic-b").value).toBe("Second topic");
    await undo();
    expect(topicInput("topic-a").value).toBe("First topic");
  });

  it("coalesces and replays a nested TopicItem without changing parent or sibling", async () => {
    await mount(presentation([
      topicItem(
        "topic-a",
        [text("topic-a-text", "Parent")],
        [topicItem("topic-a-child", [text("topic-a-child-text", "Child")])],
      ),
      topicItem("topic-b", [text("topic-b-text", "Sibling")]),
    ]));
    await selectTopics();

    await editTopic("topic-a-child", ["Child edit", "Final child"]);
    await undo();

    expect(topicInput("topic-a").value).toBe("Parent");
    expect(topicInput("topic-a-child").value).toBe("Child");
    expect(topicInput("topic-b").value).toBe("Sibling");

    await redo();
    expect(topicInput("topic-a-child").value).toBe("Final child");
    expect(topicInput("topic-a").value).toBe("Parent");
    expect(topicInput("topic-b").value).toBe("Sibling");
  });

  it("preserves the exact reconciled rich-text representation through save, undo, and redo", async () => {
    const originalRuns: TextRun[] = [
      { text: "Dar " },
      { text: "instruções", marks: { bold: true } },
      { text: " para um computador" },
    ];
    const saved: Presentation[] = [];
    await mount(presentation([
      topicItem("topic-a", [richText("topic-a-text", originalRuns)]),
    ]), saved);
    await selectTopics();

    await editTopic("topic-a", ["Dar ótimas instruções para um computador"]);
    await save();
    const editedRuns = findTopicItem(topicsFrom(saved.at(-1)!).items, "topic-a")
      ?.content.children[0];
    expect(editedRuns).toMatchObject({
      type: "text",
      content: {
        type: "rich-text",
        runs: [
          { text: "Dar ótimas " },
          { text: "instruções", marks: { bold: true } },
          { text: " para um computador" },
        ],
      },
    });

    await undo();
    await save();
    expect(findTopicItem(topicsFrom(saved.at(-1)!).items, "topic-a")
      ?.content.children[0]).toMatchObject({
        type: "text",
        content: { type: "rich-text", runs: originalRuns },
      });

    await redo();
    await save();
    expect(findTopicItem(topicsFrom(saved.at(-1)!).items, "topic-a")
      ?.content.children[0]).toMatchObject({
        type: "text",
        content: {
          type: "rich-text",
          runs: [
            { text: "Dar ótimas " },
            { text: "instruções", marks: { bold: true } },
            { text: " para um computador" },
          ],
        },
      });
  });

  it("preserves mixed non-text content and order through text history", async () => {
    const mixed = topicItem("topic-a", [
      text("topic-a-text", "Before"),
      image("topic-a-image"),
      table("topic-a-table"),
    ]);
    const saved: Presentation[] = [];
    await mount(presentation([mixed]), saved);
    await selectTopics();
    await editTopic("topic-a", ["After"]);
    await save();

    const after = findTopicItem(topicsFrom(saved.at(-1)!).items, "topic-a");
    expect(after?.content.children.map((child) => child.id)).toEqual([
      "topic-a-text",
      "topic-a-image",
      "topic-a-table",
    ]);
    expect(after?.content.children.slice(1)).toEqual(mixed.content.children.slice(1));

    await undo();
    await save();
    expect(findTopicItem(topicsFrom(saved.at(-1)!).items, "topic-a")?.content.children.slice(1))
      .toEqual(mixed.content.children.slice(1));
    await redo();
    await save();
    expect(findTopicItem(topicsFrom(saved.at(-1)!).items, "topic-a")?.content.children.slice(1))
      .toEqual(mixed.content.children.slice(1));
  });

  it("keeps a TopicItem without a direct Text child read-only", async () => {
    await mount(presentation([
      topicItem("topic-image", [image("topic-image-image")]),
    ]));
    await selectTopics();

    const row = host.querySelector<HTMLElement>(
      '[data-powershow-topic-item-id="topic-image"]',
    );
    expect(row?.querySelector('input[data-powershow-topic-input="true"]')).toBeNull();
    expect(row?.textContent).toContain("Image");
  });

  it("updates a TopicItem without a History provider", async () => {
    let element = topicsElement([
      topicItem("topic-a", [text("topic-a-text", "Before")]),
    ]);
    const controls: TopicsAuthoringControls = {
      onAddTopLevelTopic: () => null,
      onAddChildTopic: () => null,
    };

    await act(async () => root.render(
      <StudioI18nProvider>
        <TopicsInspector
          element={element}
          onUpdate={(update) => {
            const next = update(element);
            if (next.type === "topics") element = next;
          }}
          topicsAuthoringControls={controls}
          fontResources={[]}
        />
      </StudioI18nProvider>,
    ));

    const input = host.querySelector<HTMLInputElement>(
      'input[data-powershow-topic-input="true"]',
    );
    if (!input) throw new Error("standalone TopicItem input was not rendered");
    await act(async () => setTextValue(input, "After"));

    expect(findTopicItem(element.items, "topic-a")?.content.children[0]).toMatchObject({
      type: "text",
      content: "After",
    });
  });
});
