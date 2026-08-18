import { describe, expect, it } from "vitest";
import type {
  ContentSlot,
  ImageElement,
  PowerShowElement,
  Slide,
  TopicItem,
  TopicsElement,
} from "@powershow/document-schema";

import {
  appendElementToContainer,
  appendElementToContentSlot,
  createElement,
  duplicateElement,
  findElementSiblingPosition,
  insertElementAfterId,
  moveElement,
  moveElementOut,
  moveElementToSiblingIndexById,
  removeElementById,
} from "../src/features/editor/element-operations";
import {
  collectAuthoringIds,
  findContentSlotById,
  getElementsForParentRef,
} from "../src/features/editor/element-hierarchy";

function text(id: string, content = id): PowerShowElement {
  return {
    type: "text",
    id,
    hidden: false,
    variant: "body",
    content,
  };
}

function image(id: string): ImageElement {
  return {
    type: "image",
    id,
    hidden: false,
    src: `/assets/${id}.png`,
    alt: id,
    fit: "contain",
  };
}

function container(id: string, children: PowerShowElement[] = []): PowerShowElement {
  return {
    type: "container",
    id,
    hidden: false,
    direction: "column",
    children,
  };
}

function contentSlot(id: string, children: PowerShowElement[] = []): ContentSlot {
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

function collectIds(element: PowerShowElement): string[] {
  const ids = new Set<string>();
  collectAuthoringIds(element, ids);
  return [...ids];
}

function countElementOccurrences(
  elements: readonly PowerShowElement[],
  id: string,
): number {
  let count = 0;

  for (const element of elements) {
    if (element.id === id) {
      count += 1;
    }

    if (element.type === "container") {
      count += countElementOccurrences(element.children, id);
      continue;
    }

    if (element.type === "topics") {
      for (const item of element.items) {
        count += countElementOccurrences(item.content.children, id);
        count += countTopicItemOccurrences(item.children, id);
      }
    }
  }

  return count;
}

function countTopicItemOccurrences(
  items: readonly TopicItem[],
  id: string,
): number {
  let count = 0;

  for (const item of items) {
    count += countElementOccurrences(item.content.children, id);
    count += countTopicItemOccurrences(item.children, id);
  }

  return count;
}

describe("canonical element hierarchy operations", () => {
  it("keeps structural IDs out of generated element IDs", () => {
    const slides: Slide[] = [
      {
        id: "slide",
        title: "Slide",
        summary: "",
        speakerNotes: "",
        elements: [
          topics("topics", [
            topicItem("text-element", contentSlot("container-element", [text("existing-text")])),
          ]),
        ],
      },
    ];

    expect(createElement("text", slides).id).toBe("text-element-2");
    expect(createElement("container", slides).id).toBe("container-element-2");
  });

  it("duplicates Topics trees with fresh IDs for structural and content nodes", () => {
    const source = topics("topics", [
      topicItem(
        "topic-a",
        contentSlot("slot-a", [
          text("slot-text"),
          container("slot-container", [text("slot-container-text")]),
        ]),
        [
          topicItem(
            "topic-a-child",
            contentSlot("slot-a-child", [
              image("slot-child-image"),
            ]),
          ),
        ],
      ),
      topicItem(
        "topic-b",
        contentSlot("slot-b", [
          topics("nested-topics", [
            topicItem("nested-topic", contentSlot("nested-slot", [text("nested-slot-text")])),
          ]),
        ]),
      ),
    ]);

    const slides: Slide[] = [
      {
        id: "slide",
        title: "",
        summary: "",
        speakerNotes: "",
        elements: [source],
      },
    ];

    const duplicate = duplicateElement(source, slides);
    const duplicateIds = collectIds(duplicate);
    const sourceIds = collectIds(source);

    expect(duplicate.type).toBe("topics");
    expect(duplicateIds.some((id) => sourceIds.includes(id))).toBe(false);
    if (duplicate.type === "topics") {
      expect(duplicate.items).toHaveLength(2);
      expect(duplicate.items[0]?.content.children[0]?.type).toBe("text");
      expect(duplicate.items[1]?.content.children[0]?.type).toBe("topics");

      expect(duplicate.items[0]?.content.id).not.toBe("slot-a");
      expect(duplicate.items[0]?.id).not.toBe("topic-a");
      expect(duplicate.items[0]?.children[0]?.id).not.toBe("topic-a-child");
      const nestedTopic = duplicate.items[1]?.content.children[0];
      if (nestedTopic?.type === "topics") {
        expect(nestedTopic.id).not.toBe("nested-topics");
        expect(nestedTopic.items[0]?.id).not.toBe("nested-topic");
      }
    }
  });

  it("preserves existing container duplication behavior", () => {
    const source = container("source", [text("child")]);
    const duplicate = duplicateElement(source, [
      {
        id: "slide",
        title: "",
        summary: "",
        speakerNotes: "",
        elements: [source],
      },
    ]);

    if (duplicate.type === "container") {
      expect(duplicate.id).not.toBe("source");
      expect(duplicate.children[0]?.id).not.toBe("child");
    }
  });

  it("inserts after root, container, and content slot children", () => {
    const elements = [
      text("root-a"),
      container("outer", [
        text("container-a"),
        topics("topics", [
          topicItem("topic-a", contentSlot("slot-a", [text("slot-a-text")])),
          topicItem("topic-b", contentSlot("slot-b", [text("slot-b-text")])),
        ]),
      ]),
    ];

    expect(
      insertElementAfterId(elements, "root-a", text("inserted-root")).map((element) => element.id),
    ).toEqual(["root-a", "inserted-root", "outer"]);

    const afterContainer = insertElementAfterId(elements, "container-a", text("inserted-container"));
    const outer = afterContainer[1];
    expect(outer.type).toBe("container");
    if (outer.type === "container") {
      expect(outer.children.map((element) => element.id)).toEqual(["container-a", "inserted-container", "topics"]);
    }

    const afterSlot = insertElementAfterId(elements, "slot-a-text", text("inserted-slot"));
    const topicTopics = afterSlot[1];
    if (topicTopics.type === "container") {
      const topicsElement = topicTopics.children[1];
      if (topicsElement?.type === "topics") {
        expect(topicsElement.items[0]?.content.children.map((element) => element.id)).toEqual([
          "slot-a-text",
          "inserted-slot",
        ]);
      }
    }
  });

  it("appends to content slots at every nesting level", () => {
    const elements = [
      container("outer", [
        topics("topics", [
          topicItem("topic-a", contentSlot("slot-a", [text("slot-a-text")])),
          topicItem(
            "topic-b",
            contentSlot("slot-b", [
              container("nested-container", []),
              topics("nested-topics", [
                topicItem("nested-topic", contentSlot("nested-slot", [text("nested-slot-text")])),
              ]),
            ]),
          ),
        ]),
      ]),
    ];

    const topLevel = appendElementToContentSlot(elements, "slot-a", text("appended-a"));
    const topTopics = topLevel[0];
    if (topTopics.type === "container") {
      const maybeTopics = topTopics.children[0];
      if (maybeTopics?.type === "topics") {
        const firstItem = maybeTopics.items[0];
        expect(firstItem?.content.children.map((element) => element.id)).toEqual([
          "slot-a-text",
          "appended-a",
        ]);
      }
    }

    const nested = appendElementToContentSlot(elements, "nested-slot", image("appended-image"));
    const nestedContainer = nested[0];
    if (nestedContainer.type === "container") {
      const maybeTopics = nestedContainer.children[0];
      if (maybeTopics?.type === "topics") {
        const nestedTopics = maybeTopics.items[1]?.content.children[1];
        if (nestedTopics?.type === "topics") {
          const nestedItem = nestedTopics.items[0];
          expect(nestedItem?.content.children.map((element) => element.id)).toEqual([
            "nested-slot-text",
            "appended-image",
          ]);
        }
      }
    }
  });

  it("appends to containers nested inside content slots", () => {
    const elements = [
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [container("slot-container", [])])),
      ]),
    ];

    const result = appendElementToContainer(elements, "slot-container", text("appended"));
    const topicsElement = result[0];
    if (topicsElement.type === "topics") {
      const slotContainer = topicsElement.items[0]?.content.children[0];
      if (slotContainer?.type === "container") {
        expect(slotContainer.children.map((element) => element.id)).toEqual(["appended"]);
      }
    }
  });

  it("removes nested power show elements without collapsing empty content slots", () => {
    const elements = [
      topics("topics", [
        topicItem(
          "topic-a",
          contentSlot("slot-a", [
            text("slot-text"),
            container("slot-container", [text("slot-container-text")]),
          ]),
        ),
      ]),
    ];

    const withoutText = removeElementById(elements, "slot-text");
    const topicsElement = withoutText[0];
    if (topicsElement.type === "topics") {
      const firstItem = topicsElement.items[0];
      expect(firstItem?.content.children.map((element) => element.id)).toEqual([
        "slot-container",
      ]);
    }

    const withoutContainer = removeElementById(withoutText, "slot-container");
    const remainingTopics = withoutContainer[0];
    if (remainingTopics?.type === "topics") {
      expect(remainingTopics.items[0]?.content.children).toEqual([]);
    }
  });

  it("finds sibling positions with explicit parent refs", () => {
    const elements = [
      text("root"),
      container("outer", [
        topics("topics", [
          topicItem("topic-a", contentSlot("slot-a", [text("slot-a-text"), text("slot-a-second")])),
        ]),
      ]),
    ];

    expect(findElementSiblingPosition(elements, "root")).toEqual({
      index: 0,
      count: 2,
      parentRef: { kind: "slide" },
    });

    expect(findElementSiblingPosition(elements, "slot-a-second")).toEqual({
      index: 1,
      count: 2,
      parentRef: { kind: "content-slot", id: "slot-a" },
    });

    expect(moveElementToSiblingIndexById(elements, "slot-a-second", 0)).not.toBe(elements);
  });

  it("moves elements across slide, container, and content slot boundaries", () => {
    const elements = [
      text("root-a"),
      container("outer", [
        topics("topics-left", [
          topicItem("left-topic", contentSlot("left-slot", [text("left-text")])),
        ]),
      ]),
      container("target", [
        topics("topics-right", [
          topicItem("right-topic", contentSlot("right-slot", [text("right-text")])),
        ]),
      ]),
    ];

    const toContainer = moveElement(elements, {
      elementId: "left-text",
      targetParentRef: { kind: "container", id: "target" },
      targetIndex: 1,
    });
    expect(toContainer.moved).toBe(true);

    const movedToSlot = moveElement(elements, {
      elementId: "root-a",
      targetParentRef: { kind: "content-slot", id: "right-slot" },
      targetIndex: 1,
    });
    expect(movedToSlot.moved).toBe(true);

    const movedBetweenSlots = moveElement(elements, {
      elementId: "left-text",
      targetParentRef: { kind: "content-slot", id: "right-slot" },
      targetIndex: 0,
    });
    expect(movedBetweenSlots.moved).toBe(true);
  });

  it("rejects move-out from content slot children without changing the document", () => {
    const elements = [
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [text("slot-a-text")])),
      ]),
    ];

    const moved = moveElementOut(elements, "slot-a-text");

    expect(moved.elements).toBe(elements);
    expect(moved).toMatchObject({
      moved: false,
      error: "invalid-target-parent",
    });
  });

  it("moves sources into containers nested through topics without losing the source", () => {
    const cases: Array<{
      name: string;
      elements: PowerShowElement[];
      targetId: string;
      expectedIds: string[];
    }> = [
      {
        name: "top-level topic item content slot",
        elements: [
          text("source"),
          topics("topics-a", [
            topicItem("topic-a", contentSlot("slot-a", [
              container("target-container", [text("existing")]),
            ])),
          ]),
        ],
        targetId: "target-container",
        expectedIds: ["existing", "source"],
      },
      {
        name: "nested topic item content slot",
        elements: [
          text("source"),
          topics("topics-a", [
            topicItem("topic-a", contentSlot("slot-a"), [
              topicItem("topic-a-child", contentSlot("slot-a-child", [
                container("target-container", [text("existing")]),
              ])),
            ]),
          ]),
        ],
        targetId: "target-container",
        expectedIds: ["existing", "source"],
      },
      {
        name: "autonomous topics nested in a content slot",
        elements: [
          text("source"),
          topics("topics-a", [
            topicItem("topic-a", contentSlot("slot-a", [
              topics("nested-topics", [
                topicItem("nested-topic", contentSlot("nested-slot", [
                  container("target-container", [text("existing")]),
                ])),
              ]),
            ])),
          ]),
        ],
        targetId: "target-container",
        expectedIds: ["existing", "source"],
      },
    ];

    for (const testCase of cases) {
      const result = moveElement(testCase.elements, {
        elementId: "source",
        targetParentRef: { kind: "container", id: testCase.targetId },
      });

      expect(result.moved).toBe(true);
      expect(countElementOccurrences(result.elements, "source")).toBe(1);

      const target = getElementsForParentRef(result.elements, {
        kind: "container",
        id: testCase.targetId,
      });

      expect(target?.map((element) => element.id)).toEqual(testCase.expectedIds);
    }
  });

  it("moves sources into content slots nested through topics without losing the source", () => {
    const cases: Array<{
      name: string;
      elements: PowerShowElement[];
      targetId: string;
      expectedIds: string[];
    }> = [
      {
        name: "top-level topic item content slot",
        elements: [
          text("source"),
          topics("topics-a", [
            topicItem("topic-a", contentSlot("target-slot", [text("existing")])),
          ]),
        ],
        targetId: "target-slot",
        expectedIds: ["existing", "source"],
      },
      {
        name: "nested topic item content slot",
        elements: [
          text("source"),
          topics("topics-a", [
            topicItem("topic-a", contentSlot("slot-a"), [
              topicItem("topic-a-child", contentSlot("target-slot", [text("existing")])),
            ]),
          ]),
        ],
        targetId: "target-slot",
        expectedIds: ["existing", "source"],
      },
      {
        name: "autonomous topics nested in another content slot",
        elements: [
          text("source"),
          topics("topics-a", [
            topicItem("topic-a", contentSlot("slot-a", [
              topics("nested-topics", [
                topicItem("nested-topic", contentSlot("target-slot", [text("existing")])),
              ]),
            ])),
          ]),
        ],
        targetId: "target-slot",
        expectedIds: ["existing", "source"],
      },
      {
        name: "autonomous topics nested in a nested topic item content slot",
        elements: [
          text("source"),
          topics("topics-a", [
            topicItem("topic-a", contentSlot("slot-a"), [
              topicItem("topic-a-child", contentSlot("slot-a-child", [
                topics("nested-topics", [
                  topicItem("nested-topic", contentSlot("target-slot", [text("existing")])),
                ]),
              ])),
            ]),
          ]),
        ],
        targetId: "target-slot",
        expectedIds: ["existing", "source"],
      },
    ];

    for (const testCase of cases) {
      const result = moveElement(testCase.elements, {
        elementId: "source",
        targetParentRef: { kind: "content-slot", id: testCase.targetId },
      });

      expect(result.moved).toBe(true);
      expect(countElementOccurrences(result.elements, "source")).toBe(1);

      const target = getElementsForParentRef(result.elements, {
        kind: "content-slot",
        id: testCase.targetId,
      });

      expect(target?.map((element) => element.id)).toEqual(testCase.expectedIds);
    }
  });

  it("finds deeply nested content slots through topic item children and autonomous topics", () => {
    const elements = [
      topics("topics-a", [
        topicItem("topic-a", contentSlot("slot-a", [
          text("slot-a-text"),
        ]), [
          topicItem("topic-a-child", contentSlot("slot-a-child"), [
            topicItem("topic-a-grandchild", contentSlot("slot-a-grandchild", [
              topics("topics-b", [
                topicItem("topic-b", contentSlot("slot-b", [
                  topics("topics-c", [
                    topicItem("topic-c", contentSlot("slot-c", [text("slot-c-text")])),
                  ]),
                ])),
              ]),
            ])),
          ]),
        ]),
      ]),
    ];

    const slot = findContentSlotById(elements, "slot-c");

    expect(slot?.children.map((element) => element.id)).toEqual(["slot-c-text"]);
    expect(
      getElementsForParentRef(elements, { kind: "content-slot", id: "slot-c" })?.map(
        (element) => element.id,
      ),
    ).toEqual(["slot-c-text"]);
  });

  it("rejects cycles when moving into descendant containers or content slots", () => {
    const elements = [
      container("outer", [
        container("inner", []),
      ]),
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [text("slot-a-text")])),
      ]),
    ];

    expect(
      moveElement(elements, {
        elementId: "outer",
        targetParentRef: { kind: "container", id: "inner" },
      }),
    ).toEqual({ elements, moved: false, error: "cycle" });

    expect(
      moveElement(elements, {
        elementId: "topics",
        targetParentRef: { kind: "content-slot", id: "slot-a" },
      }),
    ).toEqual({ elements, moved: false, error: "cycle" });
  });

  it("rejects invalid target indices without removing the source", () => {
    const elements = [text("text"), container("target")];
    const result = moveElement(elements, {
      elementId: "text",
      targetParentRef: { kind: "container", id: "target" },
      targetIndex: 2,
    });

    expect(result).toEqual({ elements, moved: false, error: "invalid-target-index" });
  });
});
