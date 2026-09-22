import { describe, expect, it } from "vitest";
import {
  PresentationSchema,
  type ContentSlot,
  type PresentationElement,
  type Slide,
  type TextElement,
  type TopicItem,
  type TopicsElement,
} from "@web-slideshow/document-schema";

import {
  MAX_TOPIC_STRUCTURAL_DEPTH,
  appendTopicItemToTopics,
  appendChildTopicItemToTopics,
  createDefaultTopicItem,
  createElement,
  findTopicItemStructuralDepthInItems,
  getTopicItemHierarchyActionState,
  indentTopicItem,
  moveTopicItemToSiblingIndex,
  outdentTopicItem,
  removeTopicItemFromTopicItems,
  updateTopicsTextColor,
  updateTopicItemTextContent,
} from "../src/features/editor/element-operations";
import { SYSTEM_TOPICS_TEXT_STYLE_ID } from "@web-slideshow/document-schema";

import {
  collectAuthoringIds,
  findTopicItemById,
} from "../src/features/editor/element-hierarchy";
import { collectPresentationAuthoringIds } from "../src/features/editor/presentation-authoring-trees";

function slide(elements: PresentationElement[]): Slide {
  return {
    id: "slide",
    title: "",
    summary: "",
    speakerNotes: "",
    elements,
  };
}

function text(id: string, content = id): TextElement {
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
  children: PresentationElement[] = [],
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

function collectIds(elements: readonly PresentationElement[]): Set<string> {
  const ids = new Set<string>();
  for (const element of elements) {
    collectAuthoringIds(element, ids);
  }
  return ids;
}

function usedIds(elements: readonly PresentationElement[] = []): Set<string> {
  const ids = new Set<string>(["slide"]);
  for (const element of elements) {
    collectAuthoringIds(element, ids);
  }
  return ids;
}

describe("topics element creation", () => {
  it("creates a canonical TopicsElement with a single default topic", () => {
    const created = createElement("topics", usedIds()) as TopicsElement;

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
    const created = createElement("topics", usedIds()) as TopicsElement;

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

    const created = createElement("topics", usedIds(slides[0]?.elements)) as TopicsElement;

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

describe("canonical TopicItem ContentSlot metadata", () => {
  it("survives text editing", () => {
    const metadata = {
      layout: { padding: "12px" },
      style: { color: "#fff", background: { color: "#111827" }, borderRadius: "4px", className: "slot" },
      typography: { fontSize: "1rem", fontWeight: 600 },
    } as const;
    const item = topicItem("item-1", { id: "slot-1", ...metadata, children: [text("text-1", "Before")] });
    const result = updateTopicItemTextContent([item], "item-1", "After")[0];
    expect(result?.content).toMatchObject(metadata);
    expect(result?.content.children[0]).toMatchObject({ type: "text", content: "After" });
  });
});

describe("Topics block color bulk editing", () => {
  it("updates direct Text blocks while preserving rich-text marks", () => {
    const initial = {
      ...topics("topics", [
      topicItem("item", contentSlot("slot", [{
        ...text("text", "Text"),
        style: { color: "#ff0000" },
        content: {
          type: "rich-text",
          runs: [
            { text: "Text" },
            { text: " marked", marks: { color: "#ffff00" } },
          ],
        },
      }])),
      ]),
      style: { color: "#0000ff" },
    };

    const applied = updateTopicsTextColor(initial, "#800080");
    const textChild = applied.items[0]?.content.children[0];

    expect(applied.style?.color).toBe("#800080");
    expect(textChild).toMatchObject({ style: { color: "#800080" } });
    expect(textChild?.type === "text" && textChild.content).toEqual({
      type: "rich-text",
      runs: [
        { text: "Text" },
        { text: " marked", marks: { color: "#ffff00" } },
      ],
    });
  });

  it("removes only unchanged bulk colors on reset", () => {
    const initial = {
      ...topics("topics", [
        topicItem("unchanged", contentSlot("slot-a", [text("text-a")])),
        topicItem("changed", contentSlot("slot-b", [text("text-b")])),
      ]),
      style: { color: "#800080" },
    };
    const applied = updateTopicsTextColor(initial, "#800080");
    const changedAfter = {
      ...applied,
      items: applied.items.map((item) => item.id === "changed"
        ? {
            ...item,
            content: {
              ...item.content,
              children: item.content.children.map((child) => child.type === "text"
                ? { ...child, style: { ...child.style, color: "#008000" } }
                : child),
            },
          }
        : item),
    };
    const reset = updateTopicsTextColor(changedAfter, undefined);

    expect(reset.style).toBeUndefined();
    expect(reset.items[0]?.content.children[0]).not.toHaveProperty("style");
    expect(reset.items[1]?.content.children[0]).toMatchObject({ style: { color: "#008000" } });
  });

  it("preserves divergent overrides when only literal format changes", () => {
    const initial = {
      ...topics("topics", [
        topicItem("same", contentSlot("slot-a", [{ ...text("text-a"), style: { color: "#0000ff" } }])),
        topicItem("different", contentSlot("slot-b", [{ ...text("text-b"), style: { color: "#008000" } }])),
      ]),
      style: { color: "#0000ff" },
    };

    const formatted = updateTopicsTextColor(
      initial,
      "rgba(0, 0, 255, 1)",
      "preserve-overrides",
    );

    expect(formatted.style?.color).toBe("rgba(0, 0, 255, 1)");
    expect(formatted.items[0]?.content.children[0]).toMatchObject({
      style: { color: "rgba(0, 0, 255, 1)" },
    });
    expect(formatted.items[1]?.content.children[0]).toMatchObject({
      style: { color: "#008000" },
    });

    const reset = updateTopicsTextColor(formatted, undefined, "preserve-overrides");
    expect(reset.items[0]?.content.children[0]).not.toHaveProperty("style");
    expect(reset.items[1]?.content.children[0]).toMatchObject({
      style: { color: "#008000" },
    });
  });

  it("matches palette references by color id without equating them to literals", () => {
    const initial = {
      ...topics("topics", [
        topicItem("same", contentSlot("slot-a", [{
          ...text("text-a"),
          style: { color: { kind: "palette", colorId: "accent" } },
        }])),
        topicItem("different", contentSlot("slot-b", [{
          ...text("text-b"),
          style: { color: "#ffffff" },
        }])),
      ]),
      style: { color: { kind: "palette" as const, colorId: "accent" } },
    };

    const updated = updateTopicsTextColor(
      initial,
      { kind: "palette", colorId: "accent" },
      "preserve-overrides",
    );

    expect(updated.items[0]?.content.children[0]).toMatchObject({
      style: { color: { kind: "palette", colorId: "accent" } },
    });
    expect(updated.items[1]?.content.children[0]).toMatchObject({
      style: { color: "#ffffff" },
    });
  });

  it("keeps a Text Style definition intact while creating a local override", () => {
    const textStyle = { id: "body-style", name: "Body", role: "body" as const, style: { color: "#ff0000" } };
    const initial = {
      ...topics("topics", [topicItem("item", contentSlot("slot", [{ ...text("text"), variant: "body-style" }]))]),
      style: { color: "#0000ff" },
    };
    const document = PresentationSchema.parse({
      schemaVersion: 1,
      id: "presentation",
      title: "Presentation",
      slides: [slide([initial])],
      textStyles: [textStyle],
    });
    const element = document.slides[0]?.elements[0];
    if (element?.type !== "topics") throw new Error("Expected Topics element.");

    const updated = updateTopicsTextColor(element, "#0000ff");

    expect(document.textStyles).toEqual([textStyle]);
    expect(updated.items[0]?.content.children[0]).toMatchObject({
      variant: "body-style",
      style: { color: "#0000ff" },
    });
  });

  it("updates structural TopicItem children but not autonomous Topics", () => {
    const autonomous = topics("inner", [
      topicItem("inner-item", contentSlot("inner-slot", [text("inner-text", "Inner")])),
    ]);
    const initial = {
      ...topics("outer", [
        topicItem(
          "outer-item",
          contentSlot("outer-slot", [text("outer-text"), autonomous]),
          [topicItem("child-item", contentSlot("child-slot", [text("child-text")]))],
        ),
      ]),
      style: { color: "#0000ff" },
    };
    const result = updateTopicsTextColor(initial, "#0000ff");

    expect(result.items[0]?.content.children[0]).toMatchObject({ style: { color: "#0000ff" } });
    expect(result.items[0]?.children[0]?.content.children[0]).toMatchObject({ style: { color: "#0000ff" } });
    expect(result.items[0]?.content.children[1]).toEqual(autonomous);
  });

  it("applies the active Topics block color to new items", () => {
    const source = {
      ...topics("topics", []),
      style: { color: "#0000ff" },
    };
    const created = topicItem("new-item", contentSlot("new-slot", [text("new-text")]));
    const result = appendTopicItemToTopics([source], "topics", created)[0];

    expect(result?.type === "topics" && result.items[0]?.content.children[0]).toMatchObject({
      style: { color: "#0000ff" },
    });
  });
});

describe("TopicItem sibling reorder", () => {
  it("reorders top-level siblings forward and backward", () => {
    const items = [
      topicItem("a", contentSlot("slot-a", [text("text-a")])),
      topicItem("b", contentSlot("slot-b", [text("text-b")])),
      topicItem("c", contentSlot("slot-c", [text("text-c")])),
    ];
    const otherTopics = topics("other-topics", [
      topicItem("other", contentSlot("other-slot", [text("other-text")])),
    ]);
    const elements: PresentationElement[] = [topics("topics", items), otherTopics];

    const forward = moveTopicItemToSiblingIndex(elements, "topics", "a", 2);
    const backward = moveTopicItemToSiblingIndex(forward, "topics", "a", 0);

    expect((forward[0] as TopicsElement).items.map((item) => item.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect((backward[0] as TopicsElement).items.map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(backward[1]).toBe(otherTopics);
    expect((backward[1] as TopicsElement).items[0]).toBe(otherTopics.items[0]);
  });

  it("reorders nested siblings and preserves the complete subtree", () => {
    const moved = topicItem(
      "moved",
      contentSlot("moved-slot", [text("moved-text")]),
      [topicItem("grandchild", contentSlot("grandchild-slot", [text("grandchild-text")]))],
    );
    const parent = topicItem(
      "parent",
      contentSlot("parent-slot", [text("parent-text")]),
      [moved, topicItem("sibling", contentSlot("sibling-slot", [text("sibling-text")]))],
    );
    const elements: PresentationElement[] = [topics("topics", [parent])];

    const result = moveTopicItemToSiblingIndex(elements, "topics", "moved", 1);
    const updatedParent = (result[0] as TopicsElement).items[0]!;

    expect(updatedParent.children.map((item) => item.id)).toEqual([
      "sibling",
      "moved",
    ]);
    expect(updatedParent.children[1]).toBe(moved);
    expect(updatedParent.children[1]?.content).toBe(moved.content);
    expect(updatedParent.children[1]?.content.children).toBe(moved.content.children);
    expect(updatedParent.children[1]?.children).toBe(moved.children);
    expect(updatedParent.children[1]?.children[0]?.id).toBe("grandchild");
  });

  it("leaves invalid requests, same index, and other TopicsElements unchanged", () => {
    const first = topics("first", [
      topicItem("a", contentSlot("slot-a", [text("text-a")])),
      topicItem("b", contentSlot("slot-b", [text("text-b")])),
    ]);
    const second = topics("second", [
      topicItem("other", contentSlot("slot-other", [text("text-other")])),
    ]);
    const elements: PresentationElement[] = [first, second];

    for (const [topicsId, itemId, index] of [
      ["first", "missing", 0],
      ["second", "a", 0],
      ["first", "a", -1],
      ["first", "a", 2],
      ["first", "a", 0],
      ["first", "a", 1.5],
    ] as const) {
      expect(moveTopicItemToSiblingIndex(elements, topicsId, itemId, index)).toBe(
        elements,
      );
    }

    expect(second.items[0]?.id).toBe("other");
  });

  it("reorders imported TopicItems deeper than the authoring limit", () => {
    const items = structuralChain(6);
    const deepParent = findTopicItemDepthItem(items, "topic-level-6")!;
    const deepFirst = topicItem(
      "deep-first",
      contentSlot("deep-first-slot", [text("deep-first-text")]),
      [topicItem("deep-first-child", contentSlot("deep-first-child-slot", [text("deep-first-child-text")]))],
    );
    const deepSibling = topicItem(
      "deep-sibling",
      contentSlot("deep-sibling-slot", [text("deep-sibling-text")]),
      [topicItem("deep-sibling-child", contentSlot("deep-sibling-child-slot", [text("deep-sibling-child-text")]))],
    );
    deepParent.children.push(deepFirst, deepSibling);
    const elements: PresentationElement[] = [topics("topics", items)];

    const result = moveTopicItemToSiblingIndex(
      elements,
      "topics",
      "deep-sibling",
      0,
    );
    const updated = (result[0] as TopicsElement).items[0]!;
    const updatedDeepParent = findTopicItemDepthItem(
      (result[0] as TopicsElement).items,
      "topic-level-6",
    )!;

    expect(updated.id).toBe("topic-level-1");
    expect(updatedDeepParent.children.map((item) => item.id)).toEqual([
      "deep-sibling",
      "deep-first",
    ]);
    expect(updatedDeepParent.children[0]).toBe(deepSibling);
    expect(updatedDeepParent.children[1]).toBe(deepFirst);
    expect(updatedDeepParent.children[0]?.content).toBe(deepSibling.content);
    expect(updatedDeepParent.children[0]?.children).toBe(deepSibling.children);
    expect(updatedDeepParent.children[1]?.content).toBe(deepFirst.content);
    expect(updatedDeepParent.children[1]?.children).toBe(deepFirst.children);
    expect(
      findTopicItemStructuralDepthInItems(
        (result[0] as TopicsElement).items,
        "topic-level-6",
      ),
    ).toBe(6);
    expect(updatedDeepParent.children[0]?.content.children[0]?.id).toBe(
      "deep-sibling-text",
    );
    expect(updatedDeepParent.children[1]?.content.children[0]?.id).toBe(
      "deep-first-text",
    );
  });
});

describe("TopicItem hierarchy operations", () => {
  it("reports hierarchy action availability from the same subtree depth rules", () => {
    const items = structuralChain(4);
    const parent = findTopicItemDepthItem(items, "topic-level-4")!;
    const source = topicItem("source", contentSlot("source-slot"));
    parent.children.push(
      topicItem("previous", contentSlot("previous-slot")),
      source,
    );
    const elements: PresentationElement[] = [topics("topics", items)];

    expect(getTopicItemHierarchyActionState(elements, "topics", "source")).toEqual({
      canIndent: false,
      canOutdent: true,
    });
    expect(getTopicItemHierarchyActionState(elements, "topics", "topic-level-1")).toEqual({
      canIndent: false,
      canOutdent: false,
    });
  });

  it("allows outdent for imported TopicItems deeper than the authoring limit", () => {
    const items = structuralChain(7);
    const elements: PresentationElement[] = [topics("topics", items)];

    expect(getTopicItemHierarchyActionState(elements, "topics", "topic-level-7")).toEqual({
      canIndent: false,
      canOutdent: true,
    });
  });

  it("indents a top-level sibling under its immediate predecessor", () => {
    const a = topicItem("a", contentSlot("slot-a", [text("text-a")]));
    const b = topicItem("b", contentSlot("slot-b", [text("text-b")]));
    const c = topicItem("c", contentSlot("slot-c", [text("text-c")]));
    const elements: PresentationElement[] = [topics("topics", [a, b, c])];

    const result = indentTopicItem(elements, "topics", "b");
    const updated = result[0] as TopicsElement;

    expect(updated.items.map((item) => item.id)).toEqual(["a", "c"]);
    expect(updated.items[0]?.children).toEqual([b]);
    expect(updated.items[0]?.children[0]).toBe(b);
  });

  it("indents nested siblings and preserves the complete subtree by identity", () => {
    const moved = topicItem(
      "moved",
      contentSlot("moved-slot", [text("moved-text")]),
      [topicItem("grandchild", contentSlot("grandchild-slot", [text("grandchild-text")]))],
    );
    const previous = topicItem("previous", contentSlot("previous-slot", [text("previous-text")]));
    const parent = topicItem("parent", contentSlot("parent-slot", [text("parent-text")]), [previous, moved]);
    const elements: PresentationElement[] = [topics("topics", [parent])];

    const result = indentTopicItem(elements, "topics", "moved");
    const updatedParent = (result[0] as TopicsElement).items[0]!;

    expect(updatedParent.children.map((item) => item.id)).toEqual(["previous"]);
    expect(updatedParent.children[0]?.children[0]).toBe(moved);
    expect(updatedParent.children[0]?.children[0]?.content).toBe(moved.content);
    expect(updatedParent.children[0]?.children[0]?.children).toBe(moved.children);
  });

  it("makes indent a no-op for the first or invalid item and the wrong owner", () => {
    const first = topics("first", [
      topicItem("a", contentSlot("slot-a", [text("text-a")])),
      topicItem("b", contentSlot("slot-b", [text("text-b")])),
    ]);
    const second = topics("second", [
      topicItem("other", contentSlot("slot-other", [text("text-other")])),
    ]);
    const elements: PresentationElement[] = [first, second];

    expect(indentTopicItem(elements, "first", "a")).toBe(elements);
    expect(indentTopicItem(elements, "first", "missing")).toBe(elements);
    expect(indentTopicItem(elements, "second", "b")).toBe(elements);
  });

  it("allows legal depth 5 indent and refuses a root or descendant overflow", () => {
    const legalItems = structuralChain(3);
    const legalParent = findTopicItemDepthItem(legalItems, "topic-level-3")!;
    const legalSource = topicItem("legal-source", contentSlot("legal-slot", [text("legal-text")]));
    legalParent.children.push(
      topicItem("legal-previous", contentSlot("legal-previous-slot", [text("legal-previous-text")])),
      legalSource,
    );
    const legalElements: PresentationElement[] = [topics("topics", legalItems)];
    const legalResult = indentTopicItem(legalElements, "topics", "legal-source");
    expect(findTopicItemStructuralDepthInItems((legalResult[0] as TopicsElement).items, "legal-source")).toBe(5);

    const rootOverflowItems = structuralChain(4);
    const rootParent = findTopicItemDepthItem(rootOverflowItems, "topic-level-4")!;
    rootParent.children.push(
      topicItem("root-previous", contentSlot("root-previous-slot", [text("root-previous-text")])),
      topicItem("root-overflow", contentSlot("root-slot", [text("root-text")])),
    );
    const rootOverflow: PresentationElement[] = [topics("topics", rootOverflowItems)];
    expect(indentTopicItem(rootOverflow, "topics", "root-overflow")).toBe(rootOverflow);

    const descendantItems = structuralChain(3);
    const descendantParent = findTopicItemDepthItem(descendantItems, "topic-level-3")!;
    const descendantSource = topicItem(
      "descendant-overflow",
      contentSlot("descendant-slot", [text("descendant-text")]),
      [topicItem("too-deep", contentSlot("too-deep-slot", [text("too-deep-text")]))],
    );
    descendantParent.children.push(
      topicItem("descendant-previous", contentSlot("descendant-previous-slot", [text("descendant-previous-text")])),
      descendantSource,
    );
    const descendantOverflow: PresentationElement[] = [topics("topics", descendantItems)];
    expect(indentTopicItem(descendantOverflow, "topics", "descendant-overflow")).toBe(descendantOverflow);
  });

  it("outdents a nested item immediately after its old parent", () => {
    const source = topicItem(
      "source",
      contentSlot("source-slot", [text("source-text")]),
      [topicItem("child", contentSlot("child-slot", [text("child-text")]))],
    );
    const parent = topicItem("parent", contentSlot("parent-slot", [text("parent-text")]), [source]);
    const after = topicItem("after", contentSlot("after-slot", [text("after-text")]));
    const elements: PresentationElement[] = [topics("topics", [parent, after])];

    const result = outdentTopicItem(elements, "topics", "source");
    const updated = (result[0] as TopicsElement).items;

    expect(updated.map((item) => item.id)).toEqual(["parent", "source", "after"]);
    expect(updated[1]).toBe(source);
    expect(updated[1]?.children[0]).toBe(source.children[0]);
  });

  it("outdents nested siblings, preserving the complete subtree and unrelated Topics", () => {
    const source = topicItem(
      "source",
      contentSlot("source-slot", [text("source-text")]),
      [topicItem("grandchild", contentSlot("grandchild-slot", [text("grandchild-text")]))],
    );
    const parent = topicItem("parent", contentSlot("parent-slot", [text("parent-text")]), [source]);
    const otherTopics = topics("other-topics", [topicItem("other", contentSlot("other-slot", [text("other-text")] ))]);
    const elements: PresentationElement[] = [topics("topics", [parent]), otherTopics];

    const result = outdentTopicItem(elements, "topics", "source");
    expect((result[0] as TopicsElement).items[1]).toBe(source);
    expect((result[0] as TopicsElement).items[1]?.content).toBe(source.content);
    expect((result[0] as TopicsElement).items[1]?.children).toBe(source.children);
    expect(result[1]).toBe(otherTopics);
  });

  it("makes outdent a no-op for top-level or invalid items and the wrong owner", () => {
    const first = topics("first", [
      topicItem("a", contentSlot("slot-a", [text("text-a")])),
      topicItem("b", contentSlot("slot-b", [text("text-b")])),
    ]);
    const second = topics("second", [topicItem("other", contentSlot("slot-other", [text("text-other")]))]);
    const elements: PresentationElement[] = [first, second];

    expect(outdentTopicItem(elements, "first", "a")).toBe(elements);
    expect(outdentTopicItem(elements, "first", "missing")).toBe(elements);
    expect(outdentTopicItem(elements, "second", "b")).toBe(elements);
  });

  it("outdents imported structures deeper than the authoring limit without data loss", () => {
    const items = structuralChain(7);
    const source = findTopicItemDepthItem(items, "topic-level-7")!;
    const elements: PresentationElement[] = [topics("topics", items)];

    const result = outdentTopicItem(elements, "topics", source.id);
    const updated = (result[0] as TopicsElement).items;

    const promoted = findTopicItemDepthItem(updated, source.id);
    expect(promoted).toBe(source);
    expect(promoted?.content).toBe(source.content);
    expect(promoted?.children).toBe(source.children);
    expect(findTopicItemStructuralDepthInItems(updated, source.id)).toBe(6);
  });
});

describe("default topic item creation", () => {
  it("avoids TopicItem, ContentSlot, and Text ids reserved by Root/local content", () => {
    const presentation = PresentationSchema.parse({
      schemaVersion: 1,
      id: "topic-presentation",
      title: "Topics",
      rootDefinitions: [{
        id: "root-definition",
        name: "Root Definition",
        localChildTargetIds: ["root-container"],
        root: {
          id: "root-container",
          type: "container",
          hidden: false,
          children: [
            "topic-item",
            "topic-slot",
            "topic-text",
          ].map((id) => text(id)),
        },
      }],
      slides: [slide([])],
    });
    const before = structuredClone(presentation);
    const created = createDefaultTopicItem(collectPresentationAuthoringIds(presentation));

    expect(created.item.id).not.toBe("topic-item");
    expect(created.item.content.id).not.toBe("topic-slot");
    expect(created.textId).not.toBe("topic-text");
    expect(presentation).toEqual(before);
  });

  it("creates a fresh TopicItem with one Text child and exposes the Text ID", () => {
    const { item, textId } = createDefaultTopicItem(usedIds());

    expect(item.children).toEqual([]);
    expect(item.content.children).toHaveLength(1);
    expect(item.content.children[0]?.id).toBe(textId);
    const textChild = item.content.children[0];
    expect(textChild?.type).toBe("text");
    if (textChild?.type === "text") {
      expect(textChild.variant).toBe(SYSTEM_TOPICS_TEXT_STYLE_ID);
    }
  });

  it("generates distinct fresh structural IDs", () => {
    const { item } = createDefaultTopicItem(usedIds());

    const ids = [item.id, item.content.id, item.content.children[0]?.id];
    expect(new Set(ids).size).toBe(3);
  });

  it("appends a top-level item without mutating existing items", () => {
    const existingItem = topicItem(
      "topic-a",
      contentSlot("slot-a", [text("topic-a-text")]),
    );

    const existing = topics("topics", [existingItem]);

    const elements: PresentationElement[] = [existing];

    const created = createDefaultTopicItem(usedIds(elements));

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

    const elements: PresentationElement[] = [
      topics("outer-topics", [
        topicItem("outer-topic", contentSlot("outer-slot", [nested])),
      ]),
    ];

    const created = createDefaultTopicItem(usedIds(elements));

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

    const elements: PresentationElement[] = [topics("topics", [parent, sibling])];
    const created = createDefaultTopicItem(usedIds(elements));

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

    const elements: PresentationElement[] = [topics("topics", [grandchildParent])];
    const created = createDefaultTopicItem(usedIds(elements));

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

    const elements: PresentationElement[] = [
      topics("topics", [
        topicItem("topic-parent", contentSlot("slot-parent", [nestedTopics])),
      ]),
    ];

    const created = createDefaultTopicItem(usedIds(elements));

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
    const elements: PresentationElement[] = [text("not-topics")];

    const created = createDefaultTopicItem(usedIds(elements));

    expect(appendTopicItemToTopics(elements, "missing", created.item)).toBe(
      elements,
    );

    expect(appendTopicItemToTopics(elements, "not-topics", created.item)).toBe(
      elements,
    );
  });

  it("returns the original hierarchy for an invalid TopicItem target", () => {
    const elements: PresentationElement[] = [
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [text("topic-a-text")])),
      ]),
    ];

    const created = createDefaultTopicItem(usedIds(elements));

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

    const { item, textId } = createDefaultTopicItem(usedIds([existing]));

    expect(item.id).not.toBe("topic-item");
    expect(item.content.id).not.toBe("topic-slot");
    expect(textId).not.toBe("topic-text");
  });
  it("creates a topic Text child without a local style override", () => {
    const created = createDefaultTopicItem(usedIds());
    const textChild = created.item.content.children[0];

    expect(textChild?.type).toBe("text");

    if (textChild?.type === "text") {
      expect(textChild).not.toHaveProperty("style");
      expect(textChild.content).toBe("New topic");
      expect(textChild.variant).toBe(SYSTEM_TOPICS_TEXT_STYLE_ID);
    }
  });
  it("does not append a child outside the owning TopicsElement", () => {
    const nestedTopics = topics("nested-topics", [
      topicItem(
        "nested-topic",
        contentSlot("nested-slot", [text("nested-text")]),
      ),
    ]);

    const elements: PresentationElement[] = [
      topics("outer-topics", [
        topicItem("outer-topic", contentSlot("outer-slot", [nestedTopics])),
      ]),
    ];

    const created = createDefaultTopicItem(usedIds(elements));

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
    const elements: PresentationElement[] = [
      topics("topics", structuralChain(4)),
    ];

    const created = createDefaultTopicItem(usedIds(elements)).item;

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
    const elements: PresentationElement[] = [
      topics("topics", structuralChain(5)),
    ];

    const created = createDefaultTopicItem(usedIds(elements)).item;

    const result = appendChildTopicItemToTopics(
      elements,
      "topics",
      "topic-level-5",
      created,
    );

    expect(result).toBe(elements);
  });

  it("refuses child creation on a pre-existing deeper-than-5 item", () => {
    const elements: PresentationElement[] = [
      topics("topics", structuralChain(7)),
    ];

    const created = createDefaultTopicItem(usedIds(elements)).item;

    const result = appendChildTopicItemToTopics(
      elements,
      "topics",
      "topic-level-6",
      created,
    );

    expect(result).toBe(elements);
  });

  it("leaves sibling creation unaffected after a depth refusal", () => {
    const elements: PresentationElement[] = [
      topics("topics", structuralChain(5)),
    ];

    const created = createDefaultTopicItem(usedIds(elements)).item;
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
    const elements: PresentationElement[] = [
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
    const elements: PresentationElement[] = [
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
  elements: readonly PresentationElement[],
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
