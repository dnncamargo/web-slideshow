import { describe, expect, it } from "vitest";
import {
  PresentationSchema,
  type ContentSlot,
  type PowerShowElement,
  type Slide,
  type TopicItem,
  type TopicsElement,
} from "@powershow/document-schema";

import {
  MAX_TOPIC_STRUCTURAL_DEPTH,
  appendTopicItemToTopics,
  appendChildTopicItemToTopics,
  createDefaultTopicItem,
  createElement,
  findTopicItemStructuralDepthInItems,
  removeTopicItemFromTopicItems,
  updateTopicItemTextContent,
} from "../src/features/editor/element-operations";

import {
  collectAuthoringIds,
  findTopicItemById,
} from "../src/features/editor/element-hierarchy";

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

  it("appends a child TopicItem recursively without changing siblings", () => {
    const sibling = topicItem(
      "topic-sibling",
      contentSlot("slot-sibling", [text("sibling-text")]),
    );

    const parent = topicItem(
      "topic-parent",
      contentSlot("slot-parent", [text("parent-text")]),
      [
        topicItem(
          "topic-existing-child",
          contentSlot("slot-child", [text("child-text")]),
        ),
      ],
    );

    const elements: PowerShowElement[] = [topics("topics", [parent, sibling])];
    const created = createDefaultTopicItem([slide(elements)]);

    const result = appendChildTopicItemToTopics(
      elements,
      "topics",
      "topic-parent",
      created.item,
    );

    expect(result).not.toBe(elements);

    const updatedTopics = result[0];

    if (updatedTopics?.type !== "topics") {
      throw new Error("Expected Topics element");
    }

    expect(updatedTopics.items[0]).not.toBe(parent);
    expect(updatedTopics.items[0]?.children).toHaveLength(2);
    expect(updatedTopics.items[0]?.children[0]).toBe(parent.children[0]);
    expect(updatedTopics.items[0]?.children[1]).toBe(created.item);
    expect(updatedTopics.items[1]).toBe(sibling);
  });

  it("appends a grandchild TopicItem recursively", () => {
    const grandchildParent = topicItem(
      "topic-grandchild-parent",
      contentSlot("slot-grandchild-parent", [text("grandchild-parent-text")]),
      [
        topicItem(
          "topic-grandchild-child",
          contentSlot("slot-grandchild-child", [text("grandchild-child-text")]),
        ),
      ],
    );

    const elements: PowerShowElement[] = [topics("topics", [grandchildParent])];
    const created = createDefaultTopicItem([slide(elements)]);

    const result = appendChildTopicItemToTopics(
      elements,
      "topics",
      "topic-grandchild-child",
      created.item,
    );

    const updatedTopics = result[0];

    if (updatedTopics?.type !== "topics") {
      throw new Error("Expected Topics element");
    }

    expect(updatedTopics.items[0]?.children[0]?.children).toHaveLength(1);
    expect(updatedTopics.items[0]?.children[0]?.children[0]).toBe(created.item);
  });

  it("appends a TopicItem inside nested autonomous topics in a content slot", () => {
    const nestedTopics = topics("nested-topics", [
      topicItem(
        "nested-topic",
        contentSlot("nested-slot", [text("nested-text")]),
      ),
    ]);

    const elements: PowerShowElement[] = [
      topics("topics", [
        topicItem("topic-parent", contentSlot("slot-parent", [nestedTopics])),
      ]),
    ];

    const created = createDefaultTopicItem([slide(elements)]);

    const result = appendChildTopicItemToTopics(
      elements,
      "nested-topics",
      "nested-topic",
      created.item,
    );

    const outerTopics = result[0];

    if (outerTopics?.type !== "topics") {
      throw new Error("Expected Topics element");
    }

    const nestedTopicsResult = outerTopics.items[0]?.content.children[0];

    expect(nestedTopicsResult?.type).toBe("topics");

    if (nestedTopicsResult?.type === "topics") {
      expect(nestedTopicsResult.items[0]?.children).toHaveLength(1);
      expect(nestedTopicsResult.items[0]?.children[0]).toBe(created.item);
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

  it("returns the original hierarchy for an invalid TopicItem target", () => {
    const elements: PowerShowElement[] = [
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [text("topic-a-text")])),
      ]),
    ];

    const created = createDefaultTopicItem([slide(elements)]);

    expect(
      appendChildTopicItemToTopics(
        elements,
        "topics",
        "missing-topic",
        created.item,
      ),
    ).toBe(elements);
  });

  it("updates only the targeted TopicItem text content", () => {
    const topicA = topicItem(
      "topic-a",
      contentSlot("slot-a", [text("topic-a-text")]),
    );
    const topicB = topicItem(
      "topic-b",
      contentSlot("slot-b", [text("topic-b-text")]),
    );

    const items = [topicA, topicB];
    const updated = updateTopicItemTextContent(items, "topic-a", "Updated");

    expect(updated).not.toBe(items);
    expect(updated[0]).not.toBe(topicA);
    expect(updated[1]).toBe(topicB);
    expect(updated[0]?.content.children[0]).toMatchObject({
      type: "text",
      content: "Updated",
    });
    expect(updated[1]?.content.children[0]).toBe(topicB.content.children[0]);
  });

  it("updates a structural child TopicItem recursively", () => {
    const child = topicItem(
      "topic-child",
      contentSlot("slot-child", [text("child-text")]),
    );

    const parent = topicItem(
      "topic-parent",
      contentSlot("slot-parent", [text("parent-text")]),
      [child],
    );

    const items = [parent];

    const updated = updateTopicItemTextContent(
      items,
      "topic-child",
      "Updated child",
    );

    expect(updated).not.toBe(items);
    expect(updated[0]).not.toBe(parent);

    expect(updated[0]?.children[0]?.content.children[0]).toMatchObject({
      type: "text",
      content: "Updated child",
    });
  });

  it("removes a nested TopicItem recursively without changing siblings", () => {
    const child = topicItem(
      "topic-child",
      contentSlot("slot-child", [text("child-text")]),
    );
    const parent = topicItem(
      "topic-parent",
      contentSlot("slot-parent", [text("parent-text")]),
      [child],
    );
    const sibling = topicItem(
      "topic-sibling",
      contentSlot("slot-sibling", [text("sibling-text")]),
    );

    const items = [parent, sibling];

    const result = removeTopicItemFromTopicItems(items, "topic-child");

    expect(result).not.toBe(items);
    expect(result[0]).not.toBe(parent);
    expect(result[0]?.children).toHaveLength(0);
    expect(result[1]).toBe(sibling);
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
  it("creates a topic Text child without a local style override", () => {
    const created = createDefaultTopicItem([slide([])]);
    const textChild = created.item.content.children[0];

    expect(textChild?.type).toBe("text");

    if (textChild?.type === "text") {
      expect(textChild).not.toHaveProperty("style");
      expect(textChild.content).toBe("New topic");
      expect(textChild.variant).toBe("body");
    }
  });
  it("does not append a child outside the owning TopicsElement", () => {
    const nestedTopics = topics("nested-topics", [
      topicItem(
        "nested-topic",
        contentSlot("nested-slot", [text("nested-text")]),
      ),
    ]);

    const elements: PowerShowElement[] = [
      topics("outer-topics", [
        topicItem("outer-topic", contentSlot("outer-slot", [nestedTopics])),
      ]),
    ];

    const created = createDefaultTopicItem([slide(elements)]);

    const result = appendChildTopicItemToTopics(
      elements,
      "outer-topics",
      "nested-topic",
      created.item,
    );

    expect(result).toBe(elements);
  });
  it("removes a top-level TopicItem with its entire subtree", () => {
    const child = topicItem(
      "topic-child",
      contentSlot("slot-child", [text("child-text")]),
      [
        topicItem(
          "topic-grandchild",
          contentSlot("slot-grandchild", [text("grandchild-text")]),
        ),
      ],
    );

    const parent = topicItem(
      "topic-parent",
      contentSlot("slot-parent", [text("parent-text")]),
      [child],
    );

    const sibling = topicItem(
      "topic-sibling",
      contentSlot("slot-sibling", [text("sibling-text")]),
    );

    const items = [parent, sibling];

    const result = removeTopicItemFromTopicItems(items, "topic-parent");

    expect(result).toEqual([sibling]);
    expect(result[0]).toBe(sibling);
  });
});

// ============================================================
// BEGIN: STRUCTURAL DEPTH AUTHORING LIMIT
// ============================================================

function structuralChain(levels: number): TopicItem[] {
  let items: TopicItem[] = [];

  for (let level = levels; level >= 1; level -= 1) {
    items = [
      topicItem(
        `topic-level-${level}`,
        contentSlot(`slot-level-${level}`, [
          text(`text-level-${level}`),
        ]),
        items,
      ),
    ];
  }

  return items;
}

describe("topics structural depth authoring limit", () => {
  it("measures top-level TopicItems as depth 1", () => {
    const items = structuralChain(1);

    expect(MAX_TOPIC_STRUCTURAL_DEPTH).toBe(5);
    expect(findTopicItemStructuralDepthInItems(items, "topic-level-1")).toBe(1);
    expect(findTopicItemStructuralDepthInItems(items, "missing")).toBeNull();
  });

  it("measures nested structural depth recursively", () => {
    const items = structuralChain(4);

    expect(findTopicItemStructuralDepthInItems(items, "topic-level-1")).toBe(1);
    expect(findTopicItemStructuralDepthInItems(items, "topic-level-2")).toBe(2);
    expect(findTopicItemStructuralDepthInItems(items, "topic-level-3")).toBe(3);
    expect(findTopicItemStructuralDepthInItems(items, "topic-level-4")).toBe(4);
  });

  it("creates a child at every legal structural depth from 1 to 4", () => {
    const elements: PowerShowElement[] = [
      topics("topics", structuralChain(4)),
    ];

    const created = createDefaultTopicItem([slide(elements)]).item;

    for (const targetId of [
      "topic-level-1",
      "topic-level-2",
      "topic-level-3",
      "topic-level-4",
    ]) {
      const result = appendChildTopicItemToTopics(
        elements,
        "topics",
        targetId,
        created,
      );

      expect(result).not.toBe(elements);
    }
  });

  it("refuses child creation from a TopicItem already at depth 5", () => {
    const elements: PowerShowElement[] = [
      topics("topics", structuralChain(5)),
    ];

    const created = createDefaultTopicItem([slide(elements)]).item;

    const result = appendChildTopicItemToTopics(
      elements,
      "topics",
      "topic-level-5",
      created,
    );

    expect(result).toBe(elements);
  });

  it("refuses child creation on a pre-existing deeper-than-5 item", () => {
    const elements: PowerShowElement[] = [
      topics("topics", structuralChain(7)),
    ];

    const created = createDefaultTopicItem([slide(elements)]).item;

    const result = appendChildTopicItemToTopics(
      elements,
      "topics",
      "topic-level-6",
      created,
    );

    expect(result).toBe(elements);
  });

  it("leaves sibling creation unaffected after a depth refusal", () => {
    const elements: PowerShowElement[] = [
      topics("topics", structuralChain(5)),
    ];

    const created = createDefaultTopicItem([slide(elements)]).item;
    const refused = appendChildTopicItemToTopics(
      elements,
      "topics",
      "topic-level-5",
      created,
    );

    expect(refused).toBe(elements);

    const siblingResult = appendChildTopicItemToTopics(
      elements,
      "topics",
      "topic-level-4",
      created,
    );

    expect(siblingResult).not.toBe(elements);

    const updatedTopics = siblingResult[0];

    if (updatedTopics?.type === "topics") {
      const depth4Item = findTopicItemDepthItem(
        updatedTopics.items,
        "topic-level-4",
      );
      expect(depth4Item?.children).toHaveLength(2);
      expect(
        findTopicItemStructuralDepthInItems(
          updatedTopics.items,
          "topic-level-5",
        ),
      ).toBe(5);
    }
  });

  it("still removes a depth-5 item", () => {
    const items = structuralChain(5);

    const result = removeTopicItemFromTopicItems(items, "topic-level-5");

    expect(result[0]?.children[0]?.children[0]?.children[0]?.children).toEqual(
      [],
    );
  });

  it("keeps the depth-5 subtree fully readable after authoring", () => {
    const elements: PowerShowElement[] = [
      topics("topics", structuralChain(5)),
    ];

    const item = findTopicItemById(elements, "topic-level-5");

    expect(item?.id).toBe("topic-level-5");
    expect(item?.content.children[0]).toMatchObject({
      type: "text",
      content: "text-level-5",
    });
  });

  it("does not reject a deeper-than-5 canonical document through the schema", () => {
    const parsed = PresentationSchema.parse({
      schemaVersion: 1,
      id: "pres-deep",
      title: "Deep",
      description: "",
      aspectRatio: "16:9",
      slides: [
        slide([topics("topics", structuralChain(7))]),
      ],
    });

    const elements = parsed.slides[0]?.elements ?? [];
    expect(findTopicItemDepthByElementId(elements, "topic-level-7")).toBe(7);
    expect(
      findTopicItemDepthByElementId(elements, "topic-level-7"),
    ).toBeGreaterThan(MAX_TOPIC_STRUCTURAL_DEPTH);
  });

  it("keeps the deeper-than-5 tree traversable by collectAuthoringIds", () => {
    const elements: PowerShowElement[] = [
      topics("topics", structuralChain(6)),
    ];

    const ids = new Set<string>();
    collectAuthoringIds(elements[0]!, ids);

    expect(ids.has("topic-level-6")).toBe(true);
    expect(ids.has("slot-level-6")).toBe(true);
    expect(ids.has("text-level-6")).toBe(true);
  });
});

function findTopicItemDepthItem(
  items: readonly TopicItem[],
  topicItemId: string,
): TopicItem | null {
  for (const item of items) {
    if (item.id === topicItemId) {
      return item;
    }

    const nested = findTopicItemDepthItem(item.children, topicItemId);

    if (nested) {
      return nested;
    }
  }

  return null;
}

function findTopicItemDepthByElementId(
  elements: readonly PowerShowElement[],
  topicItemId: string,
): number | null {
  for (const element of elements) {
    if (element.type === "topics") {
      const depth = findTopicItemStructuralDepthInItems(
        element.items,
        topicItemId,
      );

      if (depth !== null) {
        return depth;
      }
    }

    if (element.type === "container") {
      const nested = findTopicItemDepthByElementId(
        element.children,
        topicItemId,
      );

      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
}

// ============================================================
// END: STRUCTURAL DEPTH AUTHORING LIMIT
// ============================================================
