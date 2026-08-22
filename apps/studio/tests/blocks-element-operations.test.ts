import { describe, expect, it } from "vitest";

import type {
  BlockItem,
  BlocksElement,
  Slide,
} from "@powershow/document-schema";

import {
  appendBlockItemToBlocks,
  appendChildBlockItemToBlocks,
  MAX_BLOCK_STRUCTURAL_DEPTH,
  moveBlockItemWithinSiblings,
  removeBlockItemFromBlockItems,
  updateBlockItemText,
  createDefaultBlockItem,
  createElement,
  findBlockItemStructuralDepthInItems,
  duplicateElement,
} from "../src/features/editor/element-operations";

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
  items: BlockItem[] = [],
  overrides: Partial<Omit<BlocksElement, "type">> = {},
): BlocksElement {
  return {
    id: "blocks-1",
    type: "blocks",
    hidden: false,
    items,
    ...overrides,
  };
}

function slide(elements: Slide["elements"] = []): Slide {
  return {
    id: "slide-1",
    title: "",
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

/**
 * Builds a single chain of depth `depth` starting with id "level-1".
 */
function nestedBlockTree(depth: number): BlockItem {
  let item = blockItem(`level-${depth}`, `level-${depth}`);

  for (let level = depth - 1; level >= 1; level -= 1) {
    item = blockItem(`level-${level}`, `level-${level}`, [item]);
  }

  return item;
}

function findBlockItemById(
  items: readonly BlockItem[],
  id: string,
): BlockItem | undefined {
  for (const item of items) {
    if (item.id === id) {
      return item;
    }

    const found = findBlockItemById(item.children, id);

    if (found) {
      return found;
    }
  }

  return undefined;
}

describe("Blocks element creation", () => {
  it("creates a valid canonical BlocksElement", () => {
    const created = createElement("blocks", []);

    expect(created.type).toBe("blocks");

    if (created.type === "blocks") {
      expect(created.hidden).toBe(false);

      expect(created.style).toBeUndefined();

      expect(created.items).toHaveLength(1);

      expect(created.items[0]).toEqual({
        id: "block-item",
        text: "New block",
        children: [],
      });
    }
  });

  it("defaults the Blocks root id to a unique blocks-element id", () => {
    expect(createElement("blocks", []).id).toBe("blocks-element");
  });

  it("uses blocks-element-2 on root id collision", () => {
    const created = createElement("blocks", [
      slide([blocksElement([], { id: "blocks-element" })]),
    ]);

    expect(created.id).toBe("blocks-element-2");
  });

  it("allocates the initial BlockItem id against the presentation inventory", () => {
    const created = createElement("blocks", [
      slide([
        blocksElement([blockItem("block-item", "taken")], {
          id: "blocks-other",
        }),
      ]),
    ]);

    expect(created.id).toBe("blocks-element");

    if (created.type === "blocks") {
      expect(created.items[0]?.id).toBe("block-item-2");
    }
  });

  it("creates no provider/language/runtime/style fields", () => {
    const created = createElement("blocks", []);

    if (created.type === "blocks") {
      expect(created).not.toHaveProperty("provider");

      expect(created).not.toHaveProperty("language");

      expect(created).not.toHaveProperty("generatedCode");

      expect(created).not.toHaveProperty("workspace");

      expect(created).not.toHaveProperty("toolbox");

      expect(created).not.toHaveProperty("category");

      expect(created).not.toHaveProperty("script");

      expect(created.items[0]).not.toHaveProperty("category");

      expect(created.items[0]).not.toHaveProperty("provider");
    }
  });
});

describe("createDefaultBlockItem", () => {
  it("returns the exact canonical default BlockItem", () => {
    expect(createDefaultBlockItem([])).toEqual({
      id: "block-item",
      text: "New block",
      children: [],
    });
  });

  it("respects existing BlockItem ids in the presentation inventory", () => {
    const item = createDefaultBlockItem([
      slide([blocksElement([blockItem("block-item", "taken")])]),
    ]);

    expect(item.id).toBe("block-item-2");
  });
});

describe("appendBlockItemToBlocks", () => {
  it("appends a root BlockItem", () => {
    const elements = [blocksElement([blockItem("root-1", "first")])];

    const result = appendBlockItemToBlocks(
      elements,
      "blocks-1",
      blockItem("root-2", "second"),
    );

    const updated = result[0];

    expect(updated?.type).toBe("blocks");

    if (updated?.type === "blocks") {
      expect(updated.items.map((item) => item.id)).toEqual([
        "root-1",
        "root-2",
      ]);
    }
  });

  it("returns the original array when the target is absent", () => {
    const elements = [blocksElement()];

    expect(
      appendBlockItemToBlocks(elements, "missing", blockItem("x", "y")),
    ).toBe(elements);
  });

  it("returns the original array when the target is not Blocks", () => {
    const elements: Slide["elements"] = [
      {
        type: "text",
        id: "text-1",
        hidden: false,
        variant: "body",
        content: "hi",
      },
    ];

    expect(
      appendBlockItemToBlocks(elements, "text-1", blockItem("x", "y")),
    ).toBe(elements);
  });
});

describe("BlockItem nesting", () => {
  it("appends a child BlockItem below a root item", () => {
    const elements = [blocksElement([blockItem("a", "A")])];

    const result = appendChildBlockItemToBlocks(
      elements,
      "blocks-1",
      "a",
      blockItem("a-1", "A child"),
    );

    const updated = result[0];

    if (updated?.type === "blocks") {
      expect(updated.items[0]?.children.map((child) => child.id)).toEqual([
        "a-1",
      ]);
    } else {
      expect.fail("Blocks element missing");
    }
  });

  it("respects MAX_BLOCK_STRUCTURAL_DEPTH on creation", () => {
    const deepTree = nestedBlockTree(MAX_BLOCK_STRUCTURAL_DEPTH);
    const elements = [blocksElement([deepTree])];

    const result = appendChildBlockItemToBlocks(
      elements,
      "blocks-1",
      "level-5",
      blockItem("too-deep", "never"),
    );

    expect(result).toBe(elements);
  });

  it("allows adding a child at the last allowed depth", () => {
    const deepTree = nestedBlockTree(4);
    const elements = [blocksElement([deepTree])];

    const result = appendChildBlockItemToBlocks(
      elements,
      "blocks-1",
      "level-4",
      blockItem("child-of-4", "child"),
    );

    expect(result).not.toBe(elements);

    const updated = result[0];
    if (updated?.type === "blocks") {
      expect(updated.items[0]?.children[0]?.children[0]?.children[0]?.children[0]?.id).toBe(
        "child-of-4",
      );
    } else {
      expect.fail("Blocks element missing");
    }
  });

  it("does not truncate documents deeper than the authoring limit", () => {
    const deepTree = nestedBlockTree(7);
    const elements = [blocksElement([deepTree])];

    expect(elements[0]?.type).toBe("blocks");

    if (elements[0]?.type === "blocks") {
      expect(findBlockItemById(elements[0].items, "level-7")).toBeDefined();
    }
  });

  it("returns the original element array when the child target is missing", () => {
    const elements = [blocksElement([blockItem("a", "A")])];

    expect(
      appendChildBlockItemToBlocks(
        elements,
        "blocks-1",
        "missing",
        blockItem("x", "y"),
      ),
    ).toBe(elements);
  });

  it("returns the original element array when the blocks target is missing", () => {
    const elements = [blocksElement([blockItem("a", "A")])];

    expect(
      appendChildBlockItemToBlocks(
        elements,
        "no-blocks",
        "a",
        blockItem("x", "y"),
      ),
    ).toBe(elements);
  });
});

describe("findBlockItemStructuralDepthInItems", () => {
  it("returns 1 for root blocks", () => {
    expect(
      findBlockItemStructuralDepthInItems(
        [blockItem("root", "R"), blockItem("other", "O")],
        "root",
      ),
    ).toBe(1);
  });

  it("returns nested depth", () => {
    const items = [
      blockItem("root", "R", [
        blockItem("child", "C", [blockItem("deep", "D")]),
      ]),
    ];

    expect(findBlockItemStructuralDepthInItems(items, "deep")).toBe(3);
  });

  it("returns null for absent", () => {
    expect(
      findBlockItemStructuralDepthInItems([blockItem("root", "R")], "nope"),
    ).toBeNull();
  });
});

describe("updateBlockItemText", () => {
  it("updates a nested BlockItem text", () => {
    const items = [blockItem("root", "R", [blockItem("child", "C")])];

    const result = updateBlockItemText(items, "child", "New text");

    expect(result[0]?.children[0]?.text).toBe("New text");

    expect(result[0]?.text).toBe("R");
  });

  it("accepts empty text", () => {
    const items = [blockItem("root", "R")];

    const result = updateBlockItemText(items, "root", "");

    expect(result[0]?.text).toBe("");
  });

  it("returns the same array reference when text is unchanged", () => {
    const items = [blockItem("root", "R")];

    expect(updateBlockItemText(items, "root", "R")).toBe(items);
  });

  it("returns the same array reference when the id is missing", () => {
    const items = [blockItem("root", "R")];

    expect(updateBlockItemText(items, "nope", "x")).toBe(items);
  });
});

describe("removeBlockItemFromBlockItems", () => {
  it("removes a leaf", () => {
    const items = [
      blockItem("root-1", "One"),
      blockItem("root-2", "Two"),
    ];

    const result = removeBlockItemFromBlockItems(items, "root-1");

    expect(result.map((item) => item.id)).toEqual(["root-2"]);
  });

  it("removes a node and its whole subtree", () => {
    const items = [
      blockItem("parent", "Parent", [
        blockItem("child", "Child", [blockItem("grandchild", "Grand")]),
      ]),
    ];

    const result = removeBlockItemFromBlockItems(items, "parent");

    expect(result).toEqual([]);
  });

  it("removes a nested subtree inside an unrelated parent", () => {
    const items = [
      blockItem("parent", "Parent", [
        blockItem("victim", "Victim", [blockItem("grand", "Grand")]),
        blockItem("survivor", "Survivor"),
      ]),
    ];

    const result = removeBlockItemFromBlockItems(items, "victim");

    expect(result[0]?.children.map((child) => child.id)).toEqual([
      "survivor",
    ]);
  });

  it("returns the same array reference when the id is missing", () => {
    const items = [blockItem("root", "R")];

    expect(removeBlockItemFromBlockItems(items, "nope")).toBe(items);
  });
});

describe("moveBlockItemWithinSiblings", () => {
  function itemsRow(): BlockItem[] {
    return [
      blockItem("a", "A"),
      blockItem("b", "B", [blockItem("b1", "B1"), blockItem("b2", "B2")]),
      blockItem("c", "C"),
    ];
  }

  it("moves a root item down", () => {
    const result = moveBlockItemWithinSiblings(itemsRow(), "a", 1);

    expect(result.map((item) => item.id)).toEqual(["b", "a", "c"]);
  });

  it("moves a root item up", () => {
    const result = moveBlockItemWithinSiblings(itemsRow(), "c", -1);

    expect(result.map((item) => item.id)).toEqual(["a", "c", "b"]);
  });

  it("moves a nested sibling within its own sibling list", () => {
    const result = moveBlockItemWithinSiblings(itemsRow(), "b1", 1);

    expect(result[1]?.children.map((child) => child.id)).toEqual([
      "b2",
      "b1",
    ]);
  });

  it("keeps the subtree intact during a sibling move", () => {
    const result = moveBlockItemWithinSiblings(itemsRow(), "b", -1);

    expect(result[0]?.children.map((child) => child.id)).toEqual([
      "b1",
      "b2",
    ]);
  });

  it("does a no-op on the first-sibling up boundary (same reference)", () => {
    const original = itemsRow();

    const result = moveBlockItemWithinSiblings(original, "a", -1);

    expect(result).toBe(original);

    expect(result.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("does a no-op on the last-sibling down boundary", () => {
    const original = itemsRow();

    expect(moveBlockItemWithinSiblings(original, "c", 1)).toBe(original);
  });

  it("is a no-op for a missing id (same reference)", () => {
    const original = itemsRow();

    expect(moveBlockItemWithinSiblings(original, "nope", 1)).toBe(original);
  });
});

describe("duplicateElement with Blocks", () => {
  it("renews the Blocks root id and every BlockItem id", () => {
    const source = blocksElement([
      blockItem("root-a", "A", [
        blockItem("child-a", "A child", [blockItem("grand-a", "Grand")]),
      ]),
      blockItem("root-b", "B"),
    ]);

    const duplicated = duplicateElement(source, []);

    expect(duplicated.id).toBe("blocks-1-copy");

    if (duplicated.type === "blocks") {
      const ids = blockItemIds(duplicated.items);

      expect(ids).toContain("root-a-copy");

      expect(ids).toContain("child-a-copy");

      expect(ids).toContain("grand-a-copy");

      expect(ids).toContain("root-b-copy");

      expect(ids).not.toContain("root-a");

      expect(duplicated.items[0]?.text).toBe("A");

      expect(duplicated.items[0]?.children[0]?.children[0]?.text).toBe(
        "Grand",
      );
    }
  });

  it("keeps the source untouched", () => {
    const source = blocksElement([blockItem("root-a", "A")]);

    const duplicated = duplicateElement(source, []);

    expect(source.id).toBe("blocks-1");

    if (source.type === "blocks") {
      expect(source.items[0]?.id).toBe("root-a");
    }

    if (duplicated.type === "blocks") {
      expect(duplicated.items[0]?.id).toBe("root-a-copy");
    }
  });

  it("collision-safe against existing authoring ids", () => {
    const existing = [
      blocksElement([blockItem("root-a-copy", "Taken")], {
        id: "other",
      }),
    ];

    const source = blocksElement([blockItem("root-a", "A")]);

    const duplicated = duplicateElement(source, [slide(existing)]);

    if (duplicated.type === "blocks") {
      expect(duplicated.items[0]?.id).toBe("root-a-copy-2");
    }
  });
});