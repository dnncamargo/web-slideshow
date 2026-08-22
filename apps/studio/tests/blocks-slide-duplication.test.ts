import { describe, expect, it } from "vitest";

import type {
  BlockItem,
  BlocksElement,
  PowerShowElement,
  Slide,
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
});