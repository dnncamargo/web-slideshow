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

function imageElement(id: string): PowerShowElement {
  return {
    type: "image",
    id,
    hidden: false,
    src: "/assets/example.png",
    alt: "Example image",
    fit: "contain",
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
          textElement("slot-text", "Keep me"),
          imageElement("slot-image"),
          blocksElement("topic-blocks", [
            blockItem("t-step-1", "A", [blockItem("t-step-2", "B")]),
          ]),
        ]),
      ]),
    ]);

    const duplicated = duplicateSlideWithUniqueIds(source, [source]);

    const topics = duplicated.elements[0];

    expect(topics?.type).toBe("topics");

    expect(topics?.id).toBe("topics-1-copy");

    const t = topics as TopicsElement;

    const item = t.items[0];

    // TopicItem + ContentSlot structural ids are preserved.
    expect(item?.id).toBe("topic-a");

    expect(item?.content.id).toBe("slot-a");

    const slotChildren = item?.content.children ?? [];

    // Unrelated Text/Image ids and content are preserved.
    const text = slotChildren.find((child) => child.type === "text");

    if (text?.type === "text") {
      expect(text.id).toBe("slot-text");

      expect(text.content).toBe("Keep me");
    }

    const image = slotChildren.find((child) => child.type === "image");

    if (image?.type === "image") {
      expect(image.id).toBe("slot-image");
    }

    const blocks = slotChildren.find((child) => child.type === "blocks");

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
      textElement("nested-slot-text", "Keep"),
      blocksElement("nested-blocks", [blockItem("n-step-1", "N1")]),
    ]);

    const root = topicItem("topic-a", "slot-a", [], [nested]);

    const source = slide("slide-1", [
      topicsElement("topics-1", [root]),
    ]);

    const duplicated = duplicateSlideWithUniqueIds(source, [source]);

    const topics = duplicated.elements[0] as TopicsElement;

    expect(topics.id).toBe("topics-1-copy");

    const nestedItem = topics.items[0]?.children[0];

    // Nested TopicItem + ContentSlot structural ids are preserved.
    expect(nestedItem?.id).toBe("topic-a-child");

    expect(nestedItem?.content.id).toBe("slot-a-child");

    const children = nestedItem?.content.children ?? [];

    // Unrelated Text preserved.
    const text = children.find((child) => child.type === "text");

    if (text?.type === "text") {
      expect(text.id).toBe("nested-slot-text");
    }

    const blocks = children.find((child) => child.type === "blocks");

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
        [
          textElement("header-text", "Header"),
          blocksElement("header-blocks", [blockItem("h-step", "H")]),
        ],
        [],
      ),
    ]);

    const duplicated = duplicateSlideWithUniqueIds(source, [source]);

    const table = duplicated.elements[0];

    expect(table?.type).toBe("table");

    const t = table as StructuredTableElement;

    // Table root renews (normal slide clone path), structural ids preserved.
    expect(t.id).toBe("table-1-copy");

    expect(t.columns[0]?.id).toBe("col-1");

    expect(t.columns[0]?.header.id).toBe("header-slot-1");

    const headerChildren = t.columns[0]?.header.children ?? [];

    // Unrelated Text id preserved.
    const text = headerChildren.find((child) => child.type === "text");

    if (text?.type === "text") {
      expect(text.id).toBe("header-text");

      expect(text.content).toBe("Header");
    }

    const blocks = headerChildren.find((child) => child.type === "blocks");

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
        [
          textElement("cell-text", "Cell"),
          blocksElement("cell-blocks", [blockItem("cell-step", "C")]),
        ],
      ),
    ]);

    const duplicated = duplicateSlideWithUniqueIds(source, [source]);

    const table = duplicated.elements[0];

    expect(table?.type).toBe("table");

    const t = table as StructuredTableElement;

    // Row and cell structural ids are preserved.
    expect(t.rows[0]?.id).toBe("row-1");

    expect(t.rows[0]?.cells[0]?.id).toBe("cell-1");

    const cellChildren = t.rows[0]?.cells[0]?.children ?? [];

    // Unrelated Text id preserved.
    const text = cellChildren.find((child) => child.type === "text");

    if (text?.type === "text") {
      expect(text.id).toBe("cell-text");

      expect(text.content).toBe("Cell");
    }

    const blocks = cellChildren.find((child) => child.type === "blocks");

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
            textElement("container-text", "Keep me"),
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

    expect(topics?.id).toBe("topics-1-copy");

    const container = (topics as TopicsElement).items[0]?.content
      .children[0];

    // The Topics root renews through the normal slide clone path, but a
    // Container inside a ContentSlot keeps its id: the ContentSlot
    // traversal only renews Blocks.
    expect(container?.type).toBe("container");

    expect(container?.id).toBe("topic-container");

    const containerChildren =
      (container as PowerShowElement & { children?: PowerShowElement[] })
        ?.children ?? [];

    // Unrelated Text inside the container is preserved.
    const innerText = containerChildren.find(
      (child) => child.type === "text",
    );

    if (innerText?.type === "text") {
      expect(innerText.id).toBe("container-text");

      expect(innerText.content).toBe("Keep me");
    }

    const blocks = containerChildren.find(
      (child) => child.type === "blocks",
    );

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

  it("renews Blocks below a Topics element nested inside a ContentSlot while preserving the nested Topics id", () => {
    const innerTopics = topicsElement("inner-topics", [
      topicItem("inner-topic-a", "inner-slot-a", [
        textElement("inner-topic-text", "Keep"),
        blocksElement("inner-topic-blocks", [blockItem("it-step", "IT")]),
      ]),
    ]);

    const source = slide("slide-1", [
      topicsElement("topics-1", [
        topicItem("topic-a", "slot-a", [innerTopics as PowerShowElement]),
      ]),
    ]);

    const duplicated = duplicateSlideWithUniqueIds(source, [source]);

    const topics = duplicated.elements[0] as TopicsElement;

    expect(topics.id).toBe("topics-1-copy");

    const inner = topics.items[0]?.content.children.find(
      (child) => child.type === "topics",
    );

    // Nested Topics PowerShowElement id is preserved.
    expect(inner?.type).toBe("topics");

    if (inner?.type === "topics") {
      expect(inner.id).toBe("inner-topics");

      // Inner TopicItem/ContentSlot structural ids preserved.
      expect(inner.items[0]?.id).toBe("inner-topic-a");

      expect(inner.items[0]?.content.id).toBe("inner-slot-a");

      const children = inner.items[0]?.content.children ?? [];

      const text = children.find((child) => child.type === "text");

      if (text?.type === "text") {
        expect(text.id).toBe("inner-topic-text");
      }

      const blocks = children.find((child) => child.type === "blocks");

      expectBlocksRenewed(blocks, "inner-topic-blocks", {
        "it-step": "it-step-copy",
      });
    }
  });

  it("renews Blocks below a Structured Table nested inside a ContentSlot while preserving the nested Table id", () => {
    const source = slide("slide-1", [
      topicsElement("topics-1", [
        topicItem("topic-a", "slot-a", [
          structuredTable(
            [textElement("nested-header-text", "Keep"), blocksElement("nested-table-blocks", [blockItem("nt-step", "NT")])],
            [],
            "nested-table",
          ),
        ]),
      ]),
    ]);

    const duplicated = duplicateSlideWithUniqueIds(source, [source]);

    const topics = duplicated.elements[0] as TopicsElement;

    expect(topics.id).toBe("topics-1-copy");

    const nestedTable = topics.items[0]?.content.children.find(
      (child) => child.type === "table" && child.mode === "structured",
    ) as StructuredTableElement | undefined;

    // Nested Table PowerShowElement id is preserved.
    expect(nestedTable?.id).toBe("nested-table");

    // Column/header structural ids preserved.
    expect(nestedTable?.columns[0]?.id).toBe("col-1");

    expect(nestedTable?.columns[0]?.header.id).toBe("header-slot-1");

    const headerChildren = nestedTable?.columns[0]?.header.children ?? [];

    const text = headerChildren.find((child) => child.type === "text");

    if (text?.type === "text") {
      expect(text.id).toBe("nested-header-text");
    }

    const blocks = headerChildren.find((child) => child.type === "blocks");

    expectBlocksRenewed(blocks, "nested-table-blocks", {
      "nt-step": "nt-step-copy",
    });
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

  it("preserves unrelated non-Blocks slot content ids inside a Topic ContentSlot", () => {
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

    // Topics root id renews (normal slide clone path).
    expect(topics.id).toBe("topics-1-copy");

    const slotChildren = topics.items[0]?.content.children ?? [];

    // TopicItem / ContentSlot structural ids are preserved.
    expect(topics.items[0]?.id).toBe("topic-a");

    expect(topics.items[0]?.content.id).toBe("slot-a");

    const text = slotChildren.find((child) => child.type === "text");

    // Unrelated Text id and content are preserved: the ContentSlot
    // traversal only renews Blocks.
    expect(text?.type).toBe("text");

    if (text?.type === "text") {
      expect(text.id).toBe("slot-text");

      expect(text.content).toBe("Before");
    }

    const blocks = slotChildren.find((child) => child.type === "blocks");

    expectBlocksRenewed(blocks, "topic-blocks", {
      "t-step": "t-step-copy",
    });
  });
});