import { describe, expect, it } from "vitest";
import type {
  ContentSlot,
  ImageElement,
  PowerShowElement,
  Slide,
  StructuredTableElement,
  TextElement,
  TextRun,
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
  resolveAddElementDestination,
} from "../src/features/editor/element-operations";
import {
  collectAuthoringIds,
  findElementById,
  findContentSlotById,
  getElementsForParentRef,
  updateElementById,
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

function richText(runs: TextRun[]): TextElement["content"] {
  return {
    type: "rich-text",
    runs,
  };
}

function structuredTable(
  id: string,
  headerText: PowerShowElement,
  cellText: PowerShowElement,
): StructuredTableElement {
  return {
    type: "table",
    id,
    mode: "structured",
    showHeader: true,
    hidden: false,
    columns: [
      {
        id: "column-1",
        header: {
          id: "header-slot-1",
          children: [headerText],
        },
      },
    ],
    rows: [
      {
        id: "row-1",
        cells: [
          {
            id: "cell-slot-1",
            children: [cellText],
          },
        ],
      },
    ],
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

  it("updates nested structured table text content through hierarchy helpers", () => {
    const elements: PowerShowElement[] = [
      structuredTable(
        "table-1",
        {
          type: "text",
          id: "header-text",
          hidden: false,
          variant: "body",
          content: "Header",
        },
        {
          type: "text",
          id: "cell-text",
          hidden: false,
          variant: "body",
          content: "Cell",
        },
      ),
    ];

    const updated = updateElementById(elements, "header-text", (element) => {
      if (element.type !== "text") {
        return element;
      }

      return {
        ...element,
        content: richText([{ text: "Header", marks: { bold: true } }]),
      };
    });

    const found = findElementById(updated, "header-text");

    expect(found).toMatchObject({
      type: "text",
      content: {
        type: "rich-text",
        runs: [{ text: "Header", marks: { bold: true } }],
      },
    });
  });
});

describe("autonomous Topics placement authoring restriction", () => {
  function freshTopics(id: string): TopicsElement {
    return topics(id, [
      topicItem(`${id}-item`, contentSlot(`${id}-slot`, [text(`${id}-text`)])),
    ]);
  }

  it("rejects appending a TopicsElement into a TopicItem ContentSlot", () => {
    const elements: PowerShowElement[] = [
      topics("topics-a", [
        topicItem("topic-a", contentSlot("slot-a", [text("slot-text")])),
      ]),
    ];

    const result = appendElementToContentSlot(
      elements,
      "slot-a",
      freshTopics("added-topics"),
    );

    expect(result).toBe(elements);
  });

  it("still allows non-Topics elements inside the same TopicItem ContentSlot", () => {
    const elements: PowerShowElement[] = [
      topics("topics-a", [
        topicItem("topic-a", contentSlot("slot-a", [text("slot-text")])),
      ]),
    ];

    const withText = appendElementToContentSlot(
      elements,
      "slot-a",
      text("appended-text"),
    );
    expect(withText).not.toBe(elements);

    const withImage = appendElementToContentSlot(
      elements,
      "slot-a",
      image("appended-image"),
    );
    expect(withImage).not.toBe(elements);
  });

  it("rejects inserting a TopicsElement directly after a TopicItem slot child", () => {
    const elements: PowerShowElement[] = [
      topics("topics-a", [
        topicItem("topic-a", contentSlot("slot-a", [text("slot-text")])),
      ]),
    ];

    const result = insertElementAfterId(
      elements,
      "slot-text",
      freshTopics("inserted-topics"),
    );

    expect(result).toBe(elements);
  });

  it("still allows inserting an ordinary element after a TopicItem slot child", () => {
    const elements: PowerShowElement[] = [
      topics("topics-a", [
        topicItem("topic-a", contentSlot("slot-a", [text("slot-text")])),
      ]),
    ];

    const result = insertElementAfterId(
      elements,
      "slot-text",
      text("inserted-text"),
    );

    expect(result).not.toBe(elements);
  });

  it("rejects moving an autonomous TopicsElement into a TopicItem ContentSlot", () => {
    const elements: PowerShowElement[] = [
      freshTopics("topics-b"),
      topics("topics-a", [
        topicItem("topic-a", contentSlot("slot-a", [text("slot-text")])),
      ]),
    ];

    const result = moveElement(elements, {
      elementId: "topics-b",
      targetParentRef: { kind: "content-slot", id: "slot-a" },
    });

    expect(result).toEqual({
      elements,
      moved: false,
      error: "invalid-target-parent",
    });
  });

  it("keeps the original tree unchanged after a rejected Topics move", () => {
    const elements: PowerShowElement[] = [
      freshTopics("topics-b"),
      topics("topics-a", [
        topicItem("topic-a", contentSlot("slot-a", [text("slot-text")])),
      ]),
    ];

    const result = moveElement(elements, {
      elementId: "topics-b",
      targetParentRef: { kind: "content-slot", id: "slot-a" },
    });

    expect(result.elements).toBe(elements);
    expect(countElementOccurrences(result.elements, "topics-b")).toBe(1);
    expect(countElementOccurrences(result.elements, "slot-a-text")).toBe(0);
  });

  it("still allows moving ordinary elements into a TopicItem ContentSlot", () => {
    const elements: PowerShowElement[] = [
      text("source-text"),
      topics("topics-a", [
        topicItem("topic-a", contentSlot("slot-a", [text("slot-text")])),
      ]),
    ];

    const result = moveElement(elements, {
      elementId: "source-text",
      targetParentRef: { kind: "content-slot", id: "slot-a" },
      targetIndex: 1,
    });

    expect(result.moved).toBe(true);
    expect(countElementOccurrences(result.elements, "source-text")).toBe(1);

    const slot = getElementsForParentRef(result.elements, {
      kind: "content-slot",
      id: "slot-a",
    });

    expect(slot?.map((element) => element.id)).toEqual([
      "slot-text",
      "source-text",
    ]);
  });

  it("keeps TopicsElement creatable at slide and container level", () => {
    const containerTarget = container("target", []);
    const elements = [containerTarget, text("root")];

    const inContainer = appendElementToContainer(
      elements,
      "target",
      freshTopics("topics-in-container"),
    );
    expect(inContainer).not.toBe(elements);

    const afterRoot = insertElementAfterId(
      elements,
      "root",
      freshTopics("topics-at-root"),
    );
    expect(afterRoot).not.toBe(elements);
    expect(countElementOccurrences(afterRoot, "topics-at-root")).toBe(1);
  });
});

describe("add element destination resolution", () => {
  it("appends to the slide root without a selection", () => {
    const elements = [text("root-a")];

    expect(
      resolveAddElementDestination(elements, null, image("new-image")),
    ).toEqual({ kind: "slide-root" });
  });

  it("falls back to the slide root for a stale selection", () => {
    const elements = [text("root-a")];

    expect(
      resolveAddElementDestination(elements, "missing", image("new-image")),
    ).toEqual({ kind: "slide-root" });
  });

  it("appends inside a selected container", () => {
    const elements = [container("target", [])];

    expect(
      resolveAddElementDestination(elements, "target", text("new-text")),
    ).toEqual({ kind: "append-container", containerId: "target" });
  });

  it("does not guess a TopicItem when Topics is selected without slot context", () => {
    const elements = [
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [text("topic-a-text")])),
        topicItem("topic-b", contentSlot("slot-b", [text("topic-b-text")])),
      ]),
    ];

    expect(
      resolveAddElementDestination(elements, "topics", image("new-image")),
    ).toEqual({ kind: "insert-after", targetId: "topics" });

    expect(
      resolveAddElementDestination(
        elements,
        "topics",
        container("new-container"),
      ),
    ).toEqual({ kind: "insert-after", targetId: "topics" });
  });

  it("routes ordinary elements into exactly the explicit clicked ContentSlot", () => {
    const elements = [
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [text("topic-a-text")])),
        topicItem("topic-b", contentSlot("slot-b", [text("topic-b-text")])),
      ]),
    ];

    expect(
      resolveAddElementDestination(
        elements,
        "topics",
        image("new-image"),
        "slot-a",
      ),
    ).toEqual({ kind: "append-content-slot", contentSlotId: "slot-a" });

    expect(
      resolveAddElementDestination(
        elements,
        "topics",
        image("new-image"),
        "slot-b",
      ),
    ).toEqual({ kind: "append-content-slot", contentSlotId: "slot-b" });
  });

  it("ignores a ContentSlot context that does not belong to the selected TopicsElement", () => {
    const elements = [
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [text("topic-a-text")])),
      ]),
      topics("other-topics", [
        topicItem("topic-other", contentSlot("slot-other", [text("other")])),
      ]),
    ];

    expect(
      resolveAddElementDestination(
        elements,
        "topics",
        image("new-image"),
        "slot-other",
      ),
    ).toEqual({ kind: "insert-after", targetId: "topics" });
  });

  it("keeps a TopicsElement as a slide-level sibling even with a ContentSlot context", () => {
    const elements = [
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [text("topic-a-text")])),
      ]),
    ];

    expect(
      resolveAddElementDestination(
        elements,
        "topics",
        topics("new-topics", []),
        "slot-a",
      ),
    ).toEqual({ kind: "insert-after", targetId: "topics" });
  });

  it("inserts after the selected ordinary element", () => {
    const elements = [text("root-a"), container("target", [])];

    expect(
      resolveAddElementDestination(elements, "root-a", image("new-image")),
    ).toEqual({ kind: "insert-after", targetId: "root-a" });
  });

  it("inserts after an element selected inside a TopicItem ContentSlot", () => {
    const elements = [
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [text("slot-text")])),
      ]),
    ];

    expect(
      resolveAddElementDestination(elements, "slot-text", image("new-image")),
    ).toEqual({ kind: "insert-after", targetId: "slot-text" });
  });
});

describe("topic content slot authoring", () => {
  it("appends an Image into a TopicItem ContentSlot as a canonical child", () => {
    const elements = [
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [text("slot-text")])),
      ]),
    ];

    const result = appendElementToContentSlot(
      elements,
      "slot-a",
      image("appended-image"),
    );

    expect(result).not.toBe(elements);

    const topicsElement = result[0];

    if (topicsElement.type === "topics") {
      expect(
        topicsElement.items[0]?.content.children.map((child) => child.id),
      ).toEqual(["slot-text", "appended-image"]);
      expect(topicsElement.items[0]?.content.children[1]?.type).toBe("image");
    }

    expect(result.map((element) => element.id)).toEqual(["topics"]);
  });

  it("appends a Container into a TopicItem ContentSlot as a canonical child", () => {
    const elements = [
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [text("slot-text")])),
      ]),
    ];

    const result = appendElementToContentSlot(
      elements,
      "slot-a",
      container("appended-container", [text("appended-container-text")]),
    );

    const topicsElement = result[0];

    if (topicsElement.type === "topics") {
      expect(
        topicsElement.items[0]?.content.children.map((child) => child.id),
      ).toEqual(["slot-text", "appended-container"]);
      expect(topicsElement.items[0]?.content.children[1]?.type).toBe(
        "container",
      );
    }

    expect(result.map((element) => element.id)).toEqual(["topics"]);
  });

  it("keeps an empty ContentSlot valid after removing the default Text", () => {
    const elements = [
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [text("default-text")])),
      ]),
    ];

    const withoutText = removeElementById(elements, "default-text");
    const topicsElement = withoutText[0];

    if (topicsElement.type === "topics") {
      expect(topicsElement.items[0]?.content.children).toEqual([]);
    }

    const result = appendElementToContentSlot(
      withoutText,
      "slot-a",
      image("appended-image"),
    );

    const after = result[0];

    if (after.type === "topics") {
      expect(after.items[0]?.content.children.map((child) => child.id)).toEqual(
        ["appended-image"],
      );
    }
  });

  it("keeps an empty ContentSlot valid through the resolved add destination", () => {
    const elements = [
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [text("default-text")])),
      ]),
    ];

    const withoutText = removeElementById(elements, "default-text");

    const destination = resolveAddElementDestination(
      withoutText,
      "topics",
      image("appended-image"),
      "slot-a",
    );

    expect(destination).toEqual({
      kind: "append-content-slot",
      contentSlotId: "slot-a",
    });
  });

  it("adds an Image into the clicked middle TopicItem ContentSlot without touching siblings", () => {
    const elements: PowerShowElement[] = [
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [text("topic-a-text")])),
        topicItem("topic-b", contentSlot("slot-b", [text("topic-b-text")])),
        topicItem("topic-c", contentSlot("slot-c", [text("topic-c-text")])),
      ]),
    ];

    // Remove Text B so slot-b is empty, then simulate clicking Topic B.
    const withoutTextB = removeElementById(elements, "topic-b-text");

    const destination = resolveAddElementDestination(
      withoutTextB,
      "topics",
      image("added-image"),
      "slot-b",
    );

    expect(destination).toEqual({
      kind: "append-content-slot",
      contentSlotId: "slot-b",
    });

    const result = appendElementToContentSlot(
      withoutTextB,
      "slot-b",
      image("added-image"),
    );

    const topicsElement = result[0];

    if (topicsElement.type === "topics") {
      expect(
        topicsElement.items[0]?.content.children.map((child) => child.id),
      ).toEqual(["topic-a-text"]);
      expect(
        topicsElement.items[1]?.content.children.map((child) => child.id),
      ).toEqual(["added-image"]);
      expect(
        topicsElement.items[2]?.content.children.map((child) => child.id),
      ).toEqual(["topic-c-text"]);
      expect(topicsElement.items[1]?.content.children[0]?.type).toBe("image");
    }

    expect(result.map((element) => element.id)).toEqual(["topics"]);
  });

  it("adds a Container to the clicked middle topic ContentSlot", () => {
    const elements: PowerShowElement[] = [
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [text("topic-a-text")])),
        topicItem("topic-b", contentSlot("slot-b", [text("topic-b-text")])),
        topicItem("topic-c", contentSlot("slot-c", [text("topic-c-text")])),
      ]),
    ];

    const withoutTextB = removeElementById(elements, "topic-b-text");

    const result = appendElementToContentSlot(
      withoutTextB,
      "slot-b",
      container("added-container", []),
    );

    const topicsElement = result[0];

    if (topicsElement.type === "topics") {
      expect(
        topicsElement.items[0]?.content.children.map((child) => child.id),
      ).toEqual(["topic-a-text"]);
      expect(
        topicsElement.items[1]?.content.children.map((child) => child.id),
      ).toEqual(["added-container"]);
      expect(
        topicsElement.items[2]?.content.children.map((child) => child.id),
      ).toEqual(["topic-c-text"]);
    }
  });

  it("routes Topic A and Topic C clicks to their own slots", () => {
    const elements: PowerShowElement[] = [
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [text("topic-a-text")])),
        topicItem("topic-b", contentSlot("slot-b", [text("topic-b-text")])),
        topicItem("topic-c", contentSlot("slot-c", [text("topic-c-text")])),
      ]),
    ];

    expect(
      resolveAddElementDestination(
        elements,
        "topics",
        image("image-a"),
        "slot-a",
      ),
    ).toEqual({ kind: "append-content-slot", contentSlotId: "slot-a" });

    expect(
      resolveAddElementDestination(
        elements,
        "topics",
        image("image-c"),
        "slot-c",
      ),
    ).toEqual({ kind: "append-content-slot", contentSlotId: "slot-c" });
  });

  it("refuses TopicsElement placement into any clicked TopicItem ContentSlot", () => {
    const elements: PowerShowElement[] = [
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [text("topic-a-text")])),
      ]),
    ];

    expect(
      resolveAddElementDestination(
        elements,
        "topics",
        topics("new-topics", []),
        "slot-a",
      ),
    ).toEqual({ kind: "insert-after", targetId: "topics" });

    expect(
      appendElementToContentSlot(
        elements,
        "slot-a",
        topics("new-topics", []),
      ),
    ).toBe(elements);
  });
});
