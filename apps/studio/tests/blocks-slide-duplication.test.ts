import { describe, expect, it } from "vitest";

import type {
  BlockItem,
  BlocksElement,
  PowerShowElement,
  Slide,
  StructuredTableElement,
  TopicItem,
  TopicsElement,
} from "@powershow/document-schema";

import { duplicateSlideWithUniqueIds } from "../src/features/editor/slide-operations";

function blockItem(
  id: string,
  text: string,
  children: BlockItem[] = [],
): BlockItem {
  return {
    id,
    text,
    children,
  };
}

function blocksElement(
  id: string,
  items: BlockItem[],
  overrides: Partial<Omit<BlocksElement, "type" | "id" | "items">> = {},
): BlocksElement {
  return {
    id,
    type: "blocks",
    hidden: false,
    items,
    ...overrides,
  };
}

function slide(
  id: string,
  elements: PowerShowElement[] = [],
): Slide {
  return {
    id,
    title: `${id} title`,
    summary: "",
    speakerNotes: "",
    elements,
  };
}

function blockItemIds(items: readonly BlockItem[]): string[] {
  const ids: string[] = [];

  function visit(list: readonly BlockItem[]) {
    for (const item of list) {
      ids.push(item.id);
      visit(item.children);
    }
  }

  visit(items);

  return ids;
}

function textElement(id: string, content: string): PowerShowElement {
  return {
    type: "text",
    id,
    hidden: false,
    variant: "body",
    content,
  };
}

function containerElement(
  id: string,
  children: PowerShowElement[],
): PowerShowElement {
  return {
    type: "container",
    id,
    hidden: false,
    direction: "column",
    children,
  };
}

function topicItem(
  id: string,
  slotId: string,
  slotChildren: PowerShowElement[],
  children: TopicItem[] = [],
): TopicItem {
  return {
    id,
    content: { id: slotId, children: slotChildren },
    children,
  };
}

function topicsElement(
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

function structuredTable(
  headerChildren: PowerShowElement[],
  cellChildren: PowerShowElement[],
  id = "table-1",
): StructuredTableElement {
  return {
    type: "table",
    id,
    hidden: false,
    mode: "structured",
    showHeader: true,
    columns: [
      {
        id: "col-1",
        header: { id: "header-slot-1", children: headerChildren },
      },
    ],
    rows: [
      {
        id: "row-1",
        cells: [{ id: "cell-1", children: cellChildren }],
      },
    ],
  };
}

function expectBlocksRenewed(
  candidate: PowerShowElement | undefined,
  sourceBlocksId: string,
  expectedItemIds: Record<string, string>,
  expectedBlocksId: string = `${sourceBlocksId}-copy`,
): asserts candidate is BlocksElement {
  expect(candidate?.type).toBe("blocks");

  const blocks = candidate as BlocksElement;

  expect(blocks.id).toBe(expectedBlocksId);

  const copiedIds = blockItemIds(blocks.items);

  for (const [sourceItemId, expectedId] of Object.entries(
    expectedItemIds,
  )) {
    expect(copiedIds).toContain(expectedId);

    expect(copiedIds).not.toContain(sourceItemId);
  }
}

describe("duplicateSlideWithUniqueIds with Blocks", () => {
  it("renews the Blocks root id and every nested BlockItem id", () => {
    const source = slide("slide-1", [
      blocksElement("blocks-1", [
        blockItem("root-a", "A", [
          blockItem("child-a", "A1", [blockItem("grand-a", "A1a")]),
        ]),
        blockItem("root-b", "B"),
      ]),
    ]);

    const duplicated = duplicateSlideWithUniqueIds(source, [source]);

    expect(duplicated.id).toBe("slide-1-copy");

    const blocks = duplicated.elements[0];

    expect(blocks?.type).toBe("blocks");

    if (blocks?.type === "blocks") {
      expect(blocks.id).toBe("blocks-1-copy");

      const ids = blockItemIds(blocks.items);

      expect(ids).toContain("root-a-copy");

      expect(ids).toContain("child-a-copy");

      expect(ids).toContain("grand-a-copy");

      expect(ids).toContain("root-b-copy");

      expect(ids).not.toContain("root-a");

      expect(blocks.items[0]?.text).toBe("A");

      expect(blocks.items[0]?.children[0]?.children[0]?.text).toBe("A1a");

      expect(blocks.items.map((item) => item.id)).toEqual([
        "root-a-copy",
        "root-b-copy",
      ]);
    }
  });

  it("keeps the source untouched", () => {
    const source = slide("slide-1", [
      blocksElement("blocks-1", [blockItem("root-a", "A")]),
    ]);

    const duplicated = duplicateSlideWithUniqueIds(source, [source]);

    expect(source.id).toBe("slide-1");

    const sourceBlocks = source.elements[0];

    expect(sourceBlocks?.type).toBe("blocks");

    if (sourceBlocks?.type === "blocks") {
      expect(sourceBlocks.id).toBe("blocks-1");

      expect(sourceBlocks.items[0]?.id).toBe("root-a");
    }

    if (duplicated.elements[0]?.type === "blocks") {
      expect(duplicated.elements[0].id).toBe("blocks-1-copy");
    }
  });

  it("avoids collision with existing authoring ids", () => {
    const source = slide("slide-1", [
      blocksElement("blocks-1", [blockItem("root-a", "A")]),
    ]);

    const otherSlide = slide("slide-2", [
      blocksElement("blocks-1-copy", [blockItem("root-a-copy", "Taken")], {
        hidden: false,
      }),
    ]);

    const duplicated = duplicateSlideWithUniqueIds(source, [
      source,
      otherSlide,
    ]);

    if (duplicated.elements[0]?.type === "blocks") {
      const blocks = duplicated.elements[0];

      expect(blocks.id).toBe("blocks-1-copy-2");

      expect(blocks.items[0]?.id).toBe("root-a-copy-2");
    } else {
      expect.fail("Blocks element missing");
    }
  });

  it("preserves text, tree shape and order", () => {
    const source = slide("slide-1", [
      blocksElement("blocks-1", [
        blockItem("first", "First", [blockItem("first-child", "Child")]),
        blockItem("second", "Second"),
      ]),
    ]);

    const duplicated = duplicateSlideWithUniqueIds(source, [source]);

    if (duplicated.elements[0]?.type === "blocks") {
      const blocks = duplicated.elements[0];

      expect(blocks.items.map((item) => item.text)).toEqual([
        "First",
        "Second",
      ]);

      expect(blocks.items[0]?.children[0]?.text).toBe("Child");

      expect(blocks.items[0]?.children).toHaveLength(1);

      expect(blocks.items[1]?.children).toEqual([]);
    } else {
      expect.fail("Blocks element missing");
    }
  });

  it("renews Blocks ids inside a root Container", () => {
    const source = slide("slide-1", [
      containerElement("container-1", [
        blocksElement("container-blocks", [
          blockItem("c-step-1", "C1", [blockItem("c-step-2", "C2")]),
        ]),
      ]),
    ]);

    const duplicated = duplicateSlideWithUniqueIds(source, [source]);

    const container = duplicated.elements[0];

    expect(container?.type).toBe("container");

    expect(container?.id).toBe("container-1-copy");

    const blocks = (container as PowerShowElement & { children?: PowerShowElement[] })
      ?.children?.[0];

    expectBlocksRenewed(
      blocks,
      "container-blocks",
      {
        "c-step-1": "c-step-1-copy",
        "c-step-2": "c-step-2-copy",
      },
    );

    if (blocks?.type === "blocks") {
      expect(blocks.items[0]?.text).toBe("C1");

      expect(blocks.items[0]?.children[0]?.text).toBe("C2");
    }
  });

  it("renews Blocks ids inside a TopicItem ContentSlot", () => {
    const source = slide("slide-1", [
      topicsElement("topics-1", [
        topicItem("topic-a", "slot-a", [
          blocksElement("topic-blocks", [
            blockItem("t-step-1", "A", [blockItem("t-step-2", "B")]),
          ]),
        ]),
      ]),
    ]);

    const duplicated = duplicateSlideWithUniqueIds(source, [source]);

    const topics = duplicated.elements[0];

    expect(topics?.type).toBe("topics");

    const blocks = (topics as TopicsElement).items[0]?.content.children[0];

    expectBlocksRenewed(
      blocks,
      "topic-blocks",
      {
        "t-step-1": "t-step-1-copy",
        "t-step-2": "t-step-2-copy",
      },
    );

    if (blocks?.type === "blocks") {
      expect(blocks.items[0]?.text).toBe("A");

      expect(blocks.items[0]?.children[0]?.text).toBe("B");

      expect(blocks.items[0]?.children).toHaveLength(1);
    }
  });

  it("renews Blocks ids inside a nested TopicItem ContentSlot", () => {
    const nested = topicItem("topic-a-child", "slot-a-child", [
      blocksElement("nested-blocks", [blockItem("n-step-1", "N1")]),
    ]);

    const root = topicItem("topic-a", "slot-a", [], [nested]);

    const source = slide("slide-1", [
      topicsElement("topics-1", [root]),
    ]);

    const duplicated = duplicateSlideWithUniqueIds(source, [source]);

    const topics = duplicated.elements[0];

    expect(topics?.type).toBe("topics");

    const blocks = (topics as TopicsElement).items[0]?.children[0]?.content
      .children[0];

    expectBlocksRenewed(blocks, "nested-blocks", {
      "n-step-1": "n-step-1-copy",
    });

    if (blocks?.type === "blocks") {
      expect(blocks.items[0]?.text).toBe("N1");
    }
  });

  it("renews Blocks ids inside a Structured Table header ContentSlot", () => {
    const source = slide("slide-1", [
      structuredTable(
        [blocksElement("header-blocks", [blockItem("h-step", "H")])],
        [],
      ),
    ]);

    const duplicated = duplicateSlideWithUniqueIds(source, [source]);

    const table = duplicated.elements[0];

    expect(table?.type).toBe("table");

    const blocks = (table as StructuredTableElement).columns[0]?.header
      .children[0];

    expectBlocksRenewed(blocks, "header-blocks", {
      "h-step": "h-step-copy",
    });

    if (blocks?.type === "blocks") {
      expect(blocks.items[0]?.text).toBe("H");
    }
  });

  it("renews Blocks ids inside a Structured Table cell ContentSlot", () => {
    const source = slide("slide-1", [
      structuredTable(
        [],
        [blocksElement("cell-blocks", [blockItem("cell-step", "C")])],
      ),
    ]);

    const duplicated = duplicateSlideWithUniqueIds(source, [source]);

    const table = duplicated.elements[0];

    expect(table?.type).toBe("table");

    const blocks = (table as StructuredTableElement).rows[0]?.cells[0]
      ?.children[0];

    expectBlocksRenewed(blocks, "cell-blocks", {
      "cell-step": "cell-step-copy",
    });

    if (blocks?.type === "blocks") {
      expect(blocks.items[0]?.text).toBe("C");
    }
  });

  it("renews Blocks ids inside a Container inside a Topic ContentSlot", () => {
    const source = slide("slide-1", [
      topicsElement("topics-1", [
        topicItem("topic-a", "slot-a", [
          containerElement("topic-container", [
            blocksElement("deep-blocks", [
              blockItem("d-step-1", "D1", [blockItem("d-step-2", "D2")]),
            ]),
          ]),
        ]),
      ]),
    ]);

    const duplicated = duplicateSlideWithUniqueIds(source, [source]);

    const topics = duplicated.elements[0];

    expect(topics?.type).toBe("topics");

    const container = (topics as TopicsElement).items[0]?.content
      .children[0];

    expect(container?.type).toBe("container");

    expect(container?.id).toBe("topic-container-copy");

    const blocks = (container as PowerShowElement & { children?: PowerShowElement[] })
      ?.children?.[0];

    expectBlocksRenewed(
      blocks,
      "deep-blocks",
      {
        "d-step-1": "d-step-1-copy",
        "d-step-2": "d-step-2-copy",
      },
    );

    if (blocks?.type === "blocks") {
      expect(blocks.items[0]?.text).toBe("D1");

      expect(blocks.items[0]?.children[0]?.text).toBe("D2");
    }
  });

  it("avoids collisions for nested Blocks `-copy` ids already present elsewhere", () => {
    const source = slide("slide-1", [
      topicsElement("topics-1", [
        topicItem("topic-a", "slot-a", [
          blocksElement("nested-blocks", [blockItem("step", "S")]),
        ]),
      ]),
    ]);

    const otherSlide = slide("slide-2", [
      topicsElement("topics-2", [
        topicItem("topic-b", "slot-b", [
          blocksElement("nested-blocks-copy", [
            blockItem("step-copy", "Taken"),
          ]),
        ]),
      ]),
    ]);

    const duplicated = duplicateSlideWithUniqueIds(source, [
      source,
      otherSlide,
    ]);

    const topics = duplicated.elements[0];

    expect(topics?.type).toBe("topics");

    const blocks = (topics as TopicsElement).items[0]?.content.children[0];

    expectBlocksRenewed(
      blocks,
      "nested-blocks",
      {
        step: "step-copy-2",
      },
      "nested-blocks-copy-2",
    );

    if (blocks?.type === "blocks") {
      expect(blocks.items[0]?.id).toBe("step-copy-2");
    }
  });

  it("keeps the source untouched for nested Blocks", () => {
    const source = slide("slide-1", [
      topicsElement("topics-1", [
        topicItem("topic-a", "slot-a", [
          blocksElement("topic-blocks", [blockItem("t-step", "S")]),
        ]),
      ]),
    ]);

    const duplicated = duplicateSlideWithUniqueIds(source, [source]);

    expect(source.id).toBe("slide-1");

    const sourceTopics = source.elements[0] as TopicsElement;

    const sourceBlocks = sourceTopics.items[0]?.content.children[0];

    expect(sourceBlocks?.type).toBe("blocks");

    if (sourceBlocks?.type === "blocks") {
      expect(sourceBlocks.id).toBe("topic-blocks");

      expect(sourceBlocks.items[0]?.id).toBe("t-step");

      expect(sourceBlocks.items[0]?.text).toBe("S");
    }

    const duplicatedTopics = duplicated.elements[0] as TopicsElement;

    const duplicatedBlocks = duplicatedTopics.items[0]?.content.children[0];

    expectBlocksRenewed(duplicatedBlocks, "topic-blocks", {
      "t-step": "t-step-copy",
    });
  });

  it("keeps unrelated non-Blocks slot content unchanged aside from the element id convention", () => {
    const source = slide("slide-1", [
      topicsElement("topics-1", [
        topicItem("topic-a", "slot-a", [
          textElement("slot-text", "Before"),
          blocksElement("topic-blocks", [blockItem("t-step", "S")]),
        ]),
      ]),
    ]);

    const duplicated = duplicateSlideWithUniqueIds(source, [source]);

    const topics = duplicated.elements[0] as TopicsElement;

    const slotChildren = topics.items[0]?.content.children ?? [];

    // TopicItem / ContentSlot structural ids are preserved by the
    // existing duplicate-slide implementation.
    expect(topics.items[0]?.id).toBe("topic-a");

    expect(topics.items[0]?.content.id).toBe("slot-a");

    const text = slotChildren.find((child) => child.type === "text");

    // Text content is preserved; its element id is renewed under the
    // same `-copy` convention every reachable PowerShowElement receives.
    expect(text?.type).toBe("text");

    if (text?.type === "text") {
      expect(text.id).toBe("slot-text-copy");

      expect(text.content).toBe("Before");
    }

    const blocks = slotChildren.find((child) => child.type === "blocks");

    expectBlocksRenewed(blocks, "topic-blocks", {
      "t-step": "t-step-copy",
    });
  });
});