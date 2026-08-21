import { describe, expect, it } from "vitest";
import type {
  ContentSlot,
  PowerShowElement,
  Slide,
  TopicItem,
  TopicsElement,
} from "@powershow/document-schema";

import {
  appendElementToContainer,
  appendElementToContentSlot,
  createElement,
  insertElementAfterId,
  resolveAddElementDestination,
} from "../src/features/editor/element-operations";

function divider(id: string): PowerShowElement {
  return {
    type: "divider",
    id,
    hidden: false,
    orientation: "horizontal",
  };
}

function text(id: string): PowerShowElement {
  return {
    type: "text",
    id,
    hidden: false,
    variant: "body",
    content: id,
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
  return { id, children };
}

function topicItem(
  id: string,
  slot: ContentSlot,
  children: TopicItem[] = [],
): TopicItem {
  return { id, content: slot, children };
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

describe("Divider element authoring", () => {
  it("creates a canonical horizontal Divider", () => {
    const created = createElement("divider", []);

    expect(created).toEqual({
      id: "divider-element",

      type: "divider",

      hidden: false,

      orientation: "horizontal",
    });
  });

  it("creates a unique Divider id", () => {
    const slide: Slide = {
      id: "slide",
      title: "",
      summary: "",
      speakerNotes: "",
      elements: [divider("divider-element")],
    };

    expect(createElement("divider", [slide]).id).toBe("divider-element-2");
  });

  it("creates a Divider without persisted style defaults", () => {
    const created = createElement("divider", []);

    if (created.type === "divider") {
      expect(created.style).toBeUndefined();
    }
  });

  it("inserts a Divider after an ordinary element", () => {
    const elements = [text("root-a"), container("target", [])];

    const result = insertElementAfterId(elements, "root-a", divider("new-divider"));

    expect(result.map((element) => element.id)).toEqual([
      "root-a",
      "new-divider",
      "target",
    ]);
  });

  it("inserts a Divider inside a selected Container", () => {
    const elements = [container("target", [text("existing")])];

    const result = appendElementToContainer(
      elements,
      "target",
      divider("new-divider"),
    );

    const target = result[0];

    if (target.type === "container") {
      expect(target.children.map((element) => element.id)).toEqual([
        "existing",
        "new-divider",
      ]);
    }
  });

  it("inserts a Divider into an explicitly selected Topic ContentSlot without creating a TopicItem", () => {
    const elements = [
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [text("slot-text")])),
      ]),
    ];

    const result = appendElementToContentSlot(
      elements,
      "slot-a",
      divider("new-divider"),
    );

    const topicsElement = result[0];

    if (topicsElement.type === "topics") {
      expect(
        topicsElement.items[0]?.content.children.map((child) => child.id),
      ).toEqual(["slot-text", "new-divider"]);

      expect(topicsElement.items[0]?.content.children[1]?.type).toBe("divider");

      expect(topicsElement.items).toHaveLength(1);
    }
  });

  it("routes Divider destination like an ordinary element", () => {
    const elements = [
      container("target", []),
      topics("topics", [
        topicItem("topic-a", contentSlot("slot-a", [text("slot-text")])),
      ]),
    ];

    expect(
      resolveAddElementDestination(elements, "target", divider("d1")),
    ).toEqual({ kind: "append-container", containerId: "target" });

    expect(
      resolveAddElementDestination(elements, "topics", divider("d2"), "slot-a"),
    ).toEqual({ kind: "append-content-slot", contentSlotId: "slot-a" });

    expect(
      resolveAddElementDestination(elements, "topics", divider("d3")),
    ).toEqual({ kind: "insert-after", targetId: "topics" });
  });
});