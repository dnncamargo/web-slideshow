import { describe, expect, it } from "vitest";
import type {
  ContentSlot,
  ImageElement,
  PowerShowElement,
  TopicItem,
  TopicsElement,
} from "@powershow/document-schema";

import {
  findElementById,
  someElement,
  updateElementById,
} from "../src/features/editor/element-tree";

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

function topics(
  id: string,
  items: TopicItem[],
): TopicsElement {
  return {
    type: "topics",
    id,
    hidden: false,
    kind: "unordered",
    items,
  };
}

describe("element tree traversal", () => {
  const nestedTopics = topics("nested-topics", [
    topicItem("nested-topic", contentSlot("nested-topic-slot", [image("nested-topic-image")])),
  ]);

  const tree = [
    text("root-text"),
    container("outer-container", [
      topics("top-topics", [
        topicItem(
          "topic-a",
          contentSlot("topic-a-slot", [
            text("topic-a-text"),
            container("slot-container", [text("slot-container-text")]),
          ]),
          [
            topicItem(
              "topic-a-child",
              contentSlot("topic-a-child-slot", [image("nested-image")]),
            ),
          ],
        ),
        topicItem(
          "topic-b",
          contentSlot("topic-b-slot", [nestedTopics]),
        ),
      ]),
    ]),
  ];

  it("finds root and nested autonomous power show elements", () => {
    expect(findElementById(tree, "root-text")?.id).toBe("root-text");
    expect(findElementById(tree, "slot-container")?.type).toBe("container");
    expect(findElementById(tree, "topic-a-text")?.id).toBe("topic-a-text");
    expect(findElementById(tree, "nested-image")?.id).toBe("nested-image");
    expect(findElementById(tree, "nested-topics")?.type).toBe("topics");
  });

  it("updates nested content slot descendants immutably", () => {
    const updated = updateElementById(tree, "topic-a-text", (element) => ({
      ...element,
      content: "updated",
    }));

    expect(updated).not.toBe(tree);
    expect(updated[0]).toBe(tree[0]);
    expect(updated[1]).not.toBe(tree[1]);

    const updatedText = findElementById(updated, "topic-a-text");
    expect(updatedText?.type).toBe("text");
    expect(updatedText && "content" in updatedText ? updatedText.content : null).toBe("updated");
  });

  it("does not return TopicItem or ContentSlot ids as power show elements", () => {
    expect(findElementById(tree, "topic-a")).toBeNull();
    expect(findElementById(tree, "topic-a-slot")).toBeNull();
    expect(findElementById(tree, "nested-topic-slot")).toBeNull();
  });

  it("sees autonomous topics nested inside content slots", () => {
    expect(
      someElement(tree, (element) => element.type === "topics" && element.id === "nested-topics"),
    ).toBe(true);
    expect(someElement(tree, (element) => element.id === "nested-topic-image")).toBe(true);
  });
});
