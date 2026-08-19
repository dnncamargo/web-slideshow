import { describe, expect, it } from "vitest";
import type {
  ContentSlot,
  PowerShowElement,
  Slide,
  TopicItem,
  TopicsElement,
} from "@powershow/document-schema";

import {
  appendTopicItemToTopics,
  createDefaultTopicItem,
  createElement,
} from "../src/features/editor/element-operations";

import { collectAuthoringIds } from "../src/features/editor/element-hierarchy";

function slide(elements: PowerShowElement[]): Slide {
  return {
    id: "slide",
    title: "",
    summary: "",
    speakerNotes: "",
    elements,
  };
}

function text(id: string, content = id): PowerShowElement {
  return {
    type: "text",
    id,
    hidden: false,
    variant: "body",
    content,
  };
}

function contentSlot(
  id: string,
  children: PowerShowElement[] = [],
): ContentSlot {
  return {
    id,
    children,
  };
}

function topicItem(
  id: string,
  slot: ContentSlot,
  children: TopicItem[] = [],
): TopicItem {
  return {
    id,
    content: slot,
    children,
  };
}

function topics(id: string, items: TopicItem[]): TopicsElement {
  return {
    type: "topics",
    id,
    hidden: false,
    kind: "unordered",
    items,
  };
}

function collectIds(elements: readonly PowerShowElement[]): Set<string> {
  const ids = new Set<string>();
  for (const element of elements) {
    collectAuthoringIds(element, ids);
  }
  return ids;
}

describe("topics element creation", () => {
  it("creates a canonical TopicsElement with a single default topic", () => {
    const created = createElement("topics", [slide([])]) as TopicsElement;

    expect(created.type).toBe("topics");
    expect(created.hidden).toBe(false);
    expect(created.kind).toBe("unordered");
    expect(created.items).toHaveLength(1);

    const item = created.items[0];
    expect(item?.content.children).toHaveLength(1);

    const textChild = item?.content.children[0];
    expect(textChild?.type).toBe("text");
    if (textChild?.type === "text") {
      expect(textChild.content).toBe("New topic");
    }
  });

  it("generates distinct IDs for Topics, TopicItem, ContentSlot and Text", () => {
    const created = createElement("topics", [slide([])]) as TopicsElement;

    const ids = [
      created.id,
      created.items[0]?.id,
      created.items[0]?.content.id,
      created.items[0]?.content.children[0]?.id,
    ];

    expect(new Set(ids).size).toBe(4);
    expect(ids.every((id) => id !== undefined)).toBe(true);
  });

  it("avoids collisions with existing presentation IDs", () => {
    const slides: Slide[] = [
      slide([
        text("topic-text"),
        text("topic-slot"),
        text("topic-item"),
        text("topics-element"),
      ]),
    ];

    const created = createElement("topics", slides) as TopicsElement;

    const used = collectIds(slides[0]?.elements ?? []);
    const createdIds = [
      created.id,
      created.items[0]?.id,
      created.items[0]?.content.id,
      created.items[0]?.content.children[0]?.id,
    ];

    for (const id of createdIds) {
      expect(used.has(id)).toBe(false);
    }
  });
});

describe("default topic item creation", () => {
  it("creates a fresh TopicItem with one Text child and exposes the Text ID", () => {
    const { item, textId } = createDefaultTopicItem([slide([])]);

    expect(item.children).toEqual([]);
    expect(item.content.children).toHaveLength(1);
    expect(item.content.children[0]?.id).toBe(textId);
    expect(item.content.children[0]?.type).toBe("text");
  });

  it("generates distinct fresh structural IDs", () => {
    const { item } = createDefaultTopicItem([slide([])]);

    const ids = [item.id, item.content.id, item.content.children[0]?.id];
    expect(new Set(ids).size).toBe(3);
  });

  it("appends a top-level item without mutating existing items", () => {
    const existingItem = topicItem(
      "topic-a",
      contentSlot("slot-a", [text("topic-a-text")]),
    );

    const existing = topics("topics", [existingItem]);

    const elements: PowerShowElement[] = [existing];

    const created = createDefaultTopicItem([slide(elements)]);

    const result = appendTopicItemToTopics(elements, "topics", created.item);

    expect(result).not.toBe(elements);

    const updated = result[0];

    expect(updated?.type).toBe("topics");

    if (updated?.type === "topics") {
      expect(updated).not.toBe(existing);
      expect(updated.items).not.toBe(existing.items);

      expect(updated.items).toHaveLength(2);

      expect(updated.items[0]).toBe(existingItem);
      expect(updated.items[1]).toBe(created.item);
    }

    expect(existing.items).toHaveLength(1);
    expect(existing.items[0]).toBe(existingItem);
  });

  it("appends to Topics nested inside a content slot", () => {
    const nested = topics("nested-topics", [
      topicItem(
        "existing-topic",
        contentSlot("existing-slot", [text("existing-text")]),
      ),
    ]);

    const elements: PowerShowElement[] = [
      topics("outer-topics", [
        topicItem("outer-topic", contentSlot("outer-slot", [nested])),
      ]),
    ];

    const created = createDefaultTopicItem([slide(elements)]);

    const result = appendTopicItemToTopics(
      elements,
      "nested-topics",
      created.item,
    );

    const outer = result[0];

    if (outer?.type !== "topics") {
      throw new Error("Expected outer Topics");
    }

    const nestedResult = outer.items[0]?.content.children[0];

    expect(nestedResult?.type).toBe("topics");

    if (nestedResult?.type === "topics") {
      expect(nestedResult.items).toHaveLength(2);
      expect(nestedResult.items[1]).toBe(created.item);
    }
  });

  it("returns the original hierarchy for an invalid Topics target", () => {
    const elements: PowerShowElement[] = [text("not-topics")];

    const created = createDefaultTopicItem([slide(elements)]);

    expect(appendTopicItemToTopics(elements, "missing", created.item)).toBe(
      elements,
    );

    expect(appendTopicItemToTopics(elements, "not-topics", created.item)).toBe(
      elements,
    );
  });

  it("avoids collisions with existing TopicItem, ContentSlot and Text ids", () => {
    const existing = topics("existing-topics", [
      topicItem("topic-item", contentSlot("topic-slot", [text("topic-text")])),
    ]);

    const { item, textId } = createDefaultTopicItem([slide([existing])]);

    expect(item.id).not.toBe("topic-item");
    expect(item.content.id).not.toBe("topic-slot");
    expect(textId).not.toBe("topic-text");
  });
});
