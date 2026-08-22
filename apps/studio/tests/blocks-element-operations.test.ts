import { describe, expect, it } from "vitest";

import { BlocksElementSchema } from "@powershow/document-schema";

import type {
  BlockCategory,
  BlockItem,
  BlockPart,
  BlockSocketPart,
  BlockTextPart,
  BlocksElement,
  PowerShowElement,
  Slide,
} from "@powershow/document-schema";

import {
  MAX_BLOCK_AUTHORING_DEPTH,
  addBlockCategory,
  addScopeChildToPresentation,
  appendBlockItemToRoot,
  appendBlockItemToScope,
  appendBlockPartToItem,
  createDefaultSocketPart,
  createDefaultStackBlockItem,
  createDefaultTextPart,
  createDefaultValueBlockItem,
  createSocketValueInPresentation,
  createElement,
  duplicateElement,
  findBlockItemById,
  findBlockItemDepth,
  isBlockCategoryUsed,
  moveBlockItemByOffset,
  moveBlockPartByOffset,
  removeBlockCategory,
  removeBlockItemById,
  removeBlockPartById,
  renameBlockCategory,
  setBlockCategoryColor,
  setBlockItemCategory,
  setBlockItemShape,
  setSocketContentBlock,
  setSocketContentEmpty,
  setSocketContentLiteral,
  updateBlockItemById,
  updateBlockTextPartText,
} from "../src/features/editor/element-operations";
import { collectAuthoringIds } from "../src/features/editor/element-hierarchy";
import { duplicateSlideWithUniqueIds } from "../src/features/editor/slide-operations";

// ============================================================
// FIXTURES
// ============================================================

const category = (id: string, name = id): BlockCategory => ({
  id,
  name,
  color: "#123456",
});

const textPart = (id: string, text = id): BlockTextPart => ({
  id,
  type: "text",
  text,
});

const emptySocket = (id: string): BlockSocketPart => ({
  id,
  type: "socket",
  content: { type: "empty" },
});

const literalSocket = (id: string, value: string): BlockSocketPart => ({
  id,
  type: "socket",
  content: { type: "literal", value },
});

const blockSocket = (id: string, block: BlockItem): BlockSocketPart => ({
  id,
  type: "socket",
  content: { type: "block", block },
});

const stack = (
  id: string,
  categoryId: string,
  parts: BlockPart[],
  children: BlockItem[] = [],
): BlockItem => ({
  id,
  categoryId,
  shape: "statement",
  parts,
  children,
});

const scope = (
  id: string,
  categoryId: string,
  parts: BlockPart[],
  children: BlockItem[] = [],
): BlockItem => ({
  id,
  categoryId,
  shape: "scope",
  parts,
  children,
});

const value = (
  id: string,
  categoryId: string,
  parts: BlockPart[] = [],
): BlockItem => ({
  id,
  categoryId,
  shape: "value",
  parts,
  children: [],
});

const blocks = (
  categories: BlockCategory[],
  items: BlockItem[],
): BlocksElement => ({
  id: "blocks",
  type: "blocks",
  hidden: false,
  categories,
  items,
});

const slide = (element: PowerShowElement): Slide => ({
  id: "slide",
  title: "Slide",
  summary: "",
  speakerNotes: "",
  elements: [element],
});

const makeValue = (id: string): BlockItem => ({
  id,
  categoryId: "cat",
  shape: "value",
  parts: [{ id: `${id}-p`, type: "text", text: "value" }],
  children: [],
});

const makeBlocks = (id = "blocks"): BlocksElement => ({
  id,
  type: "blocks",
  hidden: false,
  categories: [{ id: "cat", name: "Category", color: "#123456" }],
  items: [
    {
      id: "scope",
      categoryId: "cat",
      shape: "scope",
      parts: [
        { id: "scope-p", type: "text", text: "repeat" },
        { id: "scope-s", type: "socket", content: { type: "block", block: makeValue("value") } },
      ],
      children: [
        {
          id: "child",
          categoryId: "cat",
          shape: "statement",
          parts: [{ id: "child-p", type: "text", text: "move" }],
          children: [],
        },
      ],
    },
  ],
});

/** A chain of nested scopes: scope-1 at depth 1 ... scope-depth at depth <depth>. */
function stackChain(depth: number): BlockItem[] {
  let items: BlockItem[] = [];

  for (let level = depth; level >= 1; level -= 1) {
    items = [
      scope(`scope-${level}`, "cat", [textPart(`scope-${level}-p`)], items),
    ];
  }

  return items;
}

/** Root scope containing a child whose socket holds a value with its own socket value. */
function socketDepthFixture(): BlocksElement {
  return blocks(
    [category("cat")],
    [
      scope(
        "scope",
        "cat",
        [textPart("scope-p")],
        [
          stack("child", "cat", [
            blockSocket(
              "child-s",
              value("v1", "cat", [blockSocket("v1-s", value("v2", "cat"))]),
            ),
          ]),
        ],
      ),
    ],
  );
}

// ============================================================
// R1 CONTRACT — preserved baseline
// ============================================================

describe("composable Blocks Studio contract", () => {
  it("creates the exact valid default shape", () => {
    const created = createElement("blocks", []);
    expect(created.type).toBe("blocks");
    if (created.type !== "blocks") return;
    expect(created.categories).toEqual([
      { id: "block-category", name: "Block", color: "#6366f1" },
    ]);
    expect(created.items[0]).toMatchObject({
      categoryId: "block-category",
      shape: "statement",
      children: [],
    });
    expect(created.items[0]?.parts[0]).toEqual({
      id: "block-part",
      type: "text",
      text: "New block",
    });
    expect(created.style).toBeUndefined();
  });

  it("collects ids across scope, parts, socket values, and nested value parts", () => {
    const ids = new Set<string>();
    collectAuthoringIds(makeBlocks(), ids);
    for (const id of [
      "blocks",
      "scope",
      "scope-p",
      "scope-s",
      "value",
      "value-p",
      "child",
      "child-p",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("duplicates all block and part ids while preserving category vocabulary", () => {
    const copy = duplicateElement(makeBlocks(), [slide(makeBlocks())]);
    expect(copy.type).toBe("blocks");
    if (copy.type !== "blocks") return;
    expect(copy.id).not.toBe("blocks");
    expect(copy.categories).toEqual(makeBlocks().categories);
    expect(copy.items[0]?.id).not.toBe("scope");
    const socket = copy.items[0]?.parts[1];
    expect(socket?.id).not.toBe("scope-s");
    if (socket?.type === "socket" && socket.content.type === "block") {
      expect(socket.content.block.id).not.toBe("value");
    }
  });

  it("renews nested block ids during slide duplication", () => {
    const source = slide(makeBlocks());
    const copy = duplicateSlideWithUniqueIds(source, [source]);
    expect(copy.elements[0]?.type).toBe("blocks");
    if (copy.elements[0]?.type === "blocks") {
      expect(copy.elements[0].items[0]?.id).not.toBe("scope");
    }
  });
});

// ============================================================
// CATEGORY OPERATIONS
// ============================================================

describe("Blocks category operations", () => {
  it("adds categories with a locally unique id (block-category, block-category-2, ...)", () => {
    let current = blocks([category("block-category")], []);
    current = addBlockCategory(current);
    expect(current.categories[1]?.id).toBe("block-category-2");
    current = addBlockCategory(current);
    expect(current.categories[2]?.id).toBe("block-category-3");
    expect(current.categories).toEqual([
      { id: "block-category", name: "block-category", color: "#123456" },
      { id: "block-category-2", name: "Category", color: "#6366f1" },
      { id: "block-category-3", name: "Category", color: "#6366f1" },
    ]);
    expect(BlocksElementSchema.parse(current)).toBeTruthy();
  });

  it("starts from block-category when no category exists", () => {
    const current = addBlockCategory(blocks([], []));
    expect(current.categories).toEqual([
      { id: "block-category", name: "Category", color: "#6366f1" },
    ]);
  });

  it("renames a category and preserves the others", () => {
    const source = blocks(
      [category("a", "Alpha"), category("b", "Beta")],
      [],
    );
    const next = renameBlockCategory(source, "a", "Motion");
    expect(next.categories[0]).toMatchObject({ id: "a", name: "Motion" });
    expect(next.categories[1]).toBe(source.categories[1]);
    // same name: exact no-op
    expect(renameBlockCategory(source, "a", "Alpha")).toBe(source);
    // absent category: exact no-op
    expect(renameBlockCategory(source, "missing", "X")).toBe(source);
  });

  it("changes the category color and keeps the rest of the category", () => {
    const source = blocks([category("a", "Alpha")], []);
    const next = setBlockCategoryColor(source, "a", "#22d3ee");
    expect(next.categories[0]).toEqual({
      id: "a",
      name: "Alpha",
      color: "#22d3ee",
    });
    expect(setBlockCategoryColor(source, "a", "#123456")).toBe(source);
    expect(setBlockCategoryColor(source, "missing", "#22d3ee")).toBe(source);
  });

  it("removes an unused category", () => {
    const source = blocks(
      [category("used"), category("unused")],
      [stack("root-a", "used", [textPart("p-a")])],
    );
    const next = removeBlockCategory(source, "unused");
    expect(next.categories).toEqual([source.categories[0]]);
    expect(next.items).toBe(source.items);
  });

  it("refuses to remove a category used by a root block", () => {
    const source = blocks(
      [category("used"), category("unused")],
      [stack("root-a", "used", [textPart("p-a")])],
    );
    expect(removeBlockCategory(source, "used")).toBe(source);
  });

  it("refuses to remove a category used by a scope child", () => {
    const source = blocks(
      [category("cat"), category("other")],
      [
        scope("root", "other", [textPart("p")], [
          stack("child", "cat", [textPart("cp")]),
        ]),
      ],
    );
    expect(removeBlockCategory(source, "cat")).toBe(source);
  });

  it("refuses to remove a category used by a socket value", () => {
    const source = blocks(
      [category("cat"), category("other")],
      [stack("root", "other", [blockSocket("s", value("v", "cat"))])],
    );
    expect(removeBlockCategory(source, "cat")).toBe(source);
    expect(removeBlockCategory(source, "missing")).toBe(source);
  });

  it("reports category usage through both recursion edges", () => {
    const source = blocks(
      [category("cat"), category("other")],
      [
        scope("root", "other", [textPart("p")], [
          stack("child", "other", [blockSocket("s", value("v", "cat"))]),
        ]),
      ],
    );
    expect(isBlockCategoryUsed(source, "cat")).toBe(true);
    expect(isBlockCategoryUsed(source, "other")).toBe(true);
    expect(isBlockCategoryUsed(source, "missing")).toBe(false);
  });
});

// ============================================================
// LOOKUP / DEPTH
// ============================================================

describe("Blocks lookup and depth", () => {
  it("finds and updates a root block", () => {
    const source = blocks(
      [category("cat"), category("other")],
      [stack("root", "cat", [textPart("p")])],
    );
    expect(findBlockItemById(source, "root")?.id).toBe("root");
    const next = updateBlockItemById(source, "root", (item) => ({
      ...item,
      categoryId: "other",
    }));
    expect(next).not.toBe(source);
    expect(next.items[0]?.categoryId).toBe("other");
    expect(next.categories).toBe(source.categories);
    expect(updateBlockItemById(source, "missing", (item) => item)).toBe(
      source,
    );
  });

  it("finds and updates a scope child", () => {
    const source = blocks(
      [category("cat")],
      [
        scope("root", "cat", [textPart("p")], [
          stack("child", "cat", [textPart("cp")]),
        ]),
      ],
    );
    expect(findBlockItemById(source, "child")?.id).toBe("child");
    const next = updateBlockItemById(source, "child", (item) => ({
      ...item,
      parts: [...item.parts, textPart("extra")],
    }));
    expect(next.items[0]?.children[0]?.parts.map((part) => part.id)).toEqual([
      "cp",
      "extra",
    ]);
    expect(next.items[0]?.parts).toBe(source.items[0]?.parts);
  });

  it("finds and updates a socket value", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [blockSocket("s", value("v", "cat", [textPart("v-p")]))])],
    );
    expect(findBlockItemById(source, "v")?.shape).toBe("value");
    const next = updateBlockItemById(source, "v", (item) => ({
      ...item,
      categoryId: "cat",
      parts: [...item.parts, textPart("vp")],
    }));
    const socket = next.items[0]?.parts[0];
    if (socket?.type === "socket" && socket.content.type === "block") {
      expect(socket.content.block.parts.map((part) => part.id)).toEqual([
        "v-p",
        "vp",
      ]);
    }
  });

  it("finds and updates a nested socket value", () => {
    const source = socketDepthFixture();
    expect(findBlockItemById(source, "v2")?.id).toBe("v2");
    const next = updateBlockItemById(source, "v2", (item) => ({
      ...item,
      parts: [...item.parts, textPart("v2p")],
    }));
    const child = next.items[0]?.children[0];
    const outer = child?.parts[0];
    if (outer?.type === "socket" && outer.content.type === "block") {
      const inner = outer.content.block.parts[0];
      if (inner?.type === "socket" && inner.content.type === "block") {
        expect(inner.content.block.parts.map((part) => part.id)).toEqual([
          "v2p",
        ]);
      }
    }
  });

  it("computes depth across scope children", () => {
    const source = blocks([category("cat")], stackChain(5));
    for (let level = 1; level <= MAX_BLOCK_AUTHORING_DEPTH; level += 1) {
      expect(findBlockItemDepth(source, `scope-${level}`)).toBe(level);
    }
    expect(findBlockItemDepth(source, "missing")).toBeNull();
  });

  it("computes depth across socket nesting", () => {
    // root scope depth 1 -> child statement depth 2 -> socket value depth 3
    // -> nested socket value depth 4
    const source = socketDepthFixture();
    expect(findBlockItemDepth(source, "scope")).toBe(1);
    expect(findBlockItemDepth(source, "child")).toBe(2);
    expect(findBlockItemDepth(source, "v1")).toBe(3);
    expect(findBlockItemDepth(source, "v2")).toBe(4);
  });
});

// ============================================================
// STACK OPERATIONS
// ============================================================

describe("Blocks stack operations", () => {
  it("appends a root stack block when categories exist", () => {
    const source = blocks(
      [category("cat")],
      [stack("a", "cat", [textPart("pa")])],
    );
    const item = createDefaultStackBlockItem(new Set(), "cat");
    const next = appendBlockItemToRoot(source, item);
    expect(next).not.toBe(source);
    expect(next.items).toHaveLength(2);
    expect(next.items[1]).toBe(item);
  });

  it("refuses root add when no category exists", () => {
    const source = blocks([], []);
    const item = createDefaultStackBlockItem(new Set(), "cat");
    expect(appendBlockItemToRoot(source, item)).toBe(source);
  });

  it("appends a child to a scope", () => {
    const source = blocks(
      [category("cat")],
      [scope("root", "cat", [textPart("p")], [stack("a", "cat", [])])],
    );
    const item = createDefaultStackBlockItem(new Set(), "cat");
    const next = appendBlockItemToScope(source, "root", item);
    expect(next.items[0]?.children).toHaveLength(2);
    expect(next.items[0]?.children[1]).toBe(item);
  });

  it("uses the scope category for a new scope child", () => {
    const source = blocks(
      [category("cat-a"), category("cat-b")],
      [scope("root", "cat-b", [textPart("p")])],
    );
    const outcome = addScopeChildToPresentation(
      [slide(source)],
      "blocks",
      "root",
    );
    expect(outcome).not.toBeNull();
    const next = outcome?.slides[0]?.elements[0];
    if (next?.type === "blocks") {
      expect(next.items[0]?.children[0]?.categoryId).toBe("cat-b");
    }
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("refuses to append a child to a statement", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [textPart("p")])],
    );
    const item = createDefaultStackBlockItem(new Set(), "cat");
    expect(appendBlockItemToScope(source, "root", item)).toBe(source);
  });

  it("refuses scope child creation at depth MAX_BLOCK_AUTHORING_DEPTH", () => {
    const source = blocks([category("cat")], stackChain(MAX_BLOCK_AUTHORING_DEPTH));
    const item = createDefaultStackBlockItem(new Set(), "cat");
    expect(
      appendBlockItemToScope(source, "scope-5", item),
    ).toBe(source);
  });

  it("removes a root stack block and its entire graph", () => {
    const source = blocks(
      [category("cat")],
      [
        scope("root", "cat", [textPart("p")], [
          stack("child", "cat", [blockSocket("cs", value("v", "cat"))]),
        ]),
      ],
    );
    const next = removeBlockItemById(source, "root");
    expect(next.items).toEqual([]);
    expect(next.categories).toBe(source.categories);
  });

  it("removes a scope child subtree", () => {
    const source = blocks(
      [category("cat")],
      [
        scope("root", "cat", [textPart("p")], [
          stack("child-a", "cat", [blockSocket("cs", value("v", "cat"))]),
          stack("child-b", "cat", []),
        ]),
      ],
    );
    const next = removeBlockItemById(source, "child-a");
    expect(next.items[0]?.children).toEqual([source.items[0]?.children[1]]);
    expect(removeBlockItemById(source, "missing")).toBe(source);
  });

  it("moves a root sibling within the root stack", () => {
    const source = blocks(
      [category("cat")],
      [stack("a", "cat", []), stack("b", "cat", []), stack("c", "cat", [])],
    );
    const next = moveBlockItemByOffset(source, "a", 1);
    expect(next.items.map((item) => item.id)).toEqual(["b", "a", "c"]);
    expect(next.items[0]).toBe(source.items[1]);
  });

  it("moves scope siblings within the same scope.children", () => {
    const source = blocks(
      [category("cat")],
      [
        scope("root", "cat", [textPart("p")], [
          stack("a", "cat", []),
          stack("b", "cat", []),
          stack("c", "cat", []),
        ]),
      ],
    );
    const next = moveBlockItemByOffset(source, "c", -1);
    expect(next.items[0]?.children.map((item) => item.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
    // other roots untouched
    expect(next.items[0]?.parts).toBe(source.items[0]?.parts);
  });

  it("is an exact same-reference no-op at move boundaries", () => {
    const source = blocks(
      [category("cat")],
      [stack("a", "cat", []), stack("b", "cat", [])],
    );
    expect(moveBlockItemByOffset(source, "a", -1)).toBe(source);
    expect(moveBlockItemByOffset(source, "b", 1)).toBe(source);
    expect(moveBlockItemByOffset(source, "missing", 1)).toBe(source);
  });

  it("never moves a socket value as a stack sibling", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [blockSocket("s", value("v", "cat"))])],
    );
    expect(moveBlockItemByOffset(source, "v", 1)).toBe(source);
    expect(moveBlockItemByOffset(source, "v", -1)).toBe(source);
  });
});

// ============================================================
// CATEGORY ASSIGNMENT
// ============================================================

describe("Blocks category assignment", () => {
  it("reassigns a root block category", () => {
    const source = blocks(
      [category("cat-a"), category("cat-b")],
      [stack("root", "cat-a", [textPart("p")])],
    );
    const next = setBlockItemCategory(source, "root", "cat-b");
    expect(next.items[0]?.categoryId).toBe("cat-b");
    expect(next.items[0]?.parts).toBe(source.items[0]?.parts);
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("reassigns a socket-contained value category", () => {
    const source = blocks(
      [category("cat-a"), category("cat-b")],
      [stack("root", "cat-a", [blockSocket("s", value("v", "cat-a"))])],
    );
    const next = setBlockItemCategory(source, "v", "cat-b");
    const socket = next.items[0]?.parts[0];
    if (socket?.type === "socket" && socket.content.type === "block") {
      expect(socket.content.block.categoryId).toBe("cat-b");
    }
  });

  it("is an exact no-op for an unresolvable category", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [textPart("p")])],
    );
    expect(setBlockItemCategory(source, "root", "missing")).toBe(source);
  });
});

// ============================================================
// SHAPE EDITING
// ============================================================

describe("Blocks shape editing", () => {
  it("converts a statement to a scope preserving id/category/parts", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [textPart("p")])],
    );
    const next = setBlockItemShape(source, "root", "scope");
    const item = next.items[0];
    expect(item).toEqual({
      ...source.items[0],
      shape: "scope",
    });
    if (item) {
      expect(item.id).toBe("root");
      expect(item.parts).toBe(source.items[0]?.parts);
      expect(item.categoryId).toBe("cat");
    }
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("converts an empty scope back to a statement", () => {
    const source = blocks(
      [category("cat")],
      [scope("root", "cat", [textPart("p")])],
    );
    const next = setBlockItemShape(source, "root", "statement");
    expect(next.items[0]?.shape).toBe("statement");
    expect(next.items[0]?.children).toEqual([]);
  });

  it("refuses to flatten a populated scope", () => {
    const source = blocks(
      [category("cat")],
      [
        scope("root", "cat", [textPart("p")], [
          stack("child", "cat", []),
        ]),
      ],
    );
    expect(setBlockItemShape(source, "root", "statement")).toBe(source);
  });

  it("never converts a stack block to value and never reshapes a socket value", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [blockSocket("s", value("v", "cat"))])],
    );
    const next = setBlockItemShape(source, "root", "scope");
    expect(next.items[0]?.shape).toBe("scope");
    // a value stays value: shape editing refuses a value target
    expect(setBlockItemShape(source, "v", "statement")).toBe(source);
  });
});

// ============================================================
// PART OPERATIONS
// ============================================================

describe("Blocks part operations", () => {
  it("appends a Text part", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [textPart("p")])],
    );
    const next = appendBlockPartToItem(
      source,
      "root",
      createDefaultTextPart(new Set()),
    );
    expect(next.items[0]?.parts).toHaveLength(2);
    expect(next.items[0]?.parts[1]).toMatchObject({
      type: "text",
      text: "Text",
    });
  });

  it("appends a Socket part", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [textPart("p")])],
    );
    const next = appendBlockPartToItem(
      source,
      "root",
      createDefaultSocketPart(new Set()),
    );
    expect(next.items[0]?.parts).toHaveLength(2);
    expect(next.items[0]?.parts[1]).toMatchObject({
      type: "socket",
      content: { type: "empty" },
    });
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("edits Text part text immediately", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [textPart("p", "old")])],
    );
    const next = updateBlockTextPartText(source, "root", "p", "new");
    expect(next.items[0]?.parts[0]).toMatchObject({
      type: "text",
      text: "new",
    });
  });

  it("allows empty text", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [textPart("p", "old")])],
    );
    const next = updateBlockTextPartText(source, "root", "p", "");
    const part = next.items[0]?.parts[0];
    if (part?.type === "text") {
      expect(part.text).toBe("");
    }
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("removes a part", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [textPart("a"), textPart("b")])],
    );
    const next = removeBlockPartById(source, "root", "a");
    expect(next.items[0]?.parts.map((part) => part.id)).toEqual(["b"]);
    expect(removeBlockPartById(source, "root", "missing")).toBe(source);
  });

  it("reorders parts within a BlockItem", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [textPart("a"), textPart("b"), textPart("c")])],
    );
    const next = moveBlockPartByOffset(source, "root", "a", 1);
    expect(next.items[0]?.parts.map((part) => part.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("is an exact same-reference no-op at part move boundaries", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [textPart("a"), textPart("b")])],
    );
    expect(moveBlockPartByOffset(source, "root", "a", -1)).toBe(source);
    expect(moveBlockPartByOffset(source, "root", "b", 1)).toBe(source);
    expect(moveBlockPartByOffset(source, "root", "missing", 1)).toBe(source);
  });

  it("applies part operations to a socket-contained value", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [blockSocket("s", value("v", "cat", [textPart("v-p")]))])],
    );
    const next = appendBlockPartToItem(
      source,
      "v",
      createDefaultTextPart(new Set()),
    );
    const socket = next.items[0]?.parts[0];
    if (socket?.type === "socket" && socket.content.type === "block") {
      expect(socket.content.block.parts.map((part) => part.id)).toEqual([
        "v-p",
        "block-part",
      ]);
    }
  });
});

// ============================================================
// SOCKET CONTENT OPERATIONS
// ============================================================

describe("Blocks socket content operations", () => {
  it("switches empty -> literal", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [emptySocket("s")])],
    );
    const next = setSocketContentLiteral(source, "root", "s", "10");
    expect(next.items[0]?.parts[0]).toEqual(
      literalSocket("s", "10"),
    );
  });

  it("edits a literal value", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [literalSocket("s", "10")])],
    );
    const next = setSocketContentLiteral(source, "root", "s", "20");
    expect(next.items[0]?.parts[0]).toEqual(
      literalSocket("s", "20"),
    );
    // same value: exact no-op
    expect(setSocketContentLiteral(source, "root", "s", "10")).toBe(source);
  });

  it("allows an empty literal value", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [emptySocket("s")])],
    );
    const next = setSocketContentLiteral(source, "root", "s", "");
    expect(next.items[0]?.parts[0]).toEqual(
      literalSocket("s", ""),
    );
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("switches literal -> empty", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [literalSocket("s", "10")])],
    );
    const next = setSocketContentEmpty(source, "root", "s");
    expect(next.items[0]?.parts[0]).toEqual(emptySocket("s"));
    // already empty: exact no-op
    const emptySource = blocks(
      [category("cat")],
      [stack("root", "cat", [emptySocket("s")])],
    );
    expect(setSocketContentEmpty(emptySource, "root", "s")).toBe(emptySource);
  });

  it("switches empty -> block", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [emptySocket("s")])],
    );
    const item = createDefaultValueBlockItem(new Set(), "cat");
    const next = setSocketContentBlock(source, "root", "s", item);
    const part = next.items[0]?.parts[0];
    if (part?.type === "socket") {
      expect(part.content).toEqual({ type: "block", block: item });
    }
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("defaults a new socket value to the owner category", () => {
    const source = blocks(
      [category("cat-a"), category("cat-b")],
      [stack("root", "cat-b", [emptySocket("s")])],
    );
    const outcome = createSocketValueInPresentation(
      [slide(source)],
      "blocks",
      "root",
      "s",
    );
    expect(outcome).not.toBeNull();
    const next = outcome?.slides[0]?.elements[0];
    if (next?.type === "blocks") {
      const part = next.items[0]?.parts[0];
      if (part?.type === "socket" && part.content.type === "block") {
        expect(part.content.block.shape).toBe("value");
        expect(part.content.block.categoryId).toBe("cat-b");
      }
    }
  });

  it("allocates fresh BlockItem and BlockPart ids for a socket value", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [emptySocket("s")])],
    );
    const outcome = createSocketValueInPresentation(
      [slide(source)],
      "blocks",
      "root",
      "s",
    );
    expect(outcome).not.toBeNull();
    const existingIds = new Set<string>();
    collectAuthoringIds(source, existingIds);

    const next = outcome?.slides[0]?.elements[0];
    const ids = new Set<string>();
    if (next) {
      collectAuthoringIds(next, ids);
    }
    if (next?.type === "blocks") {
      const part = next.items[0]?.parts[0];
      if (part?.type === "socket" && part.content.type === "block") {
        expect(existingIds.has(part.content.block.id)).toBe(false);
        expect(existingIds.has(part.content.block.parts[0]?.id ?? "")).toBe(false);
        expect(ids.has(part.content.block.id)).toBe(true);
        expect(ids.has(part.content.block.parts[0]?.id ?? "")).toBe(true);
      }
    }
  });

  it("refuses socket block creation when the owner is at depth MAX_BLOCK_AUTHORING_DEPTH", () => {
    let items: BlockItem[] = [
      scope("scope-5", "cat", [emptySocket("sock-5")]),
    ];
    for (let level = MAX_BLOCK_AUTHORING_DEPTH - 1; level >= 1; level -= 1) {
      items = [
        scope(`scope-${level}`, "cat", [textPart(`p-${level}`)], items),
      ];
    }
    const source = blocks([category("cat")], items);
    const outcome = createSocketValueInPresentation(
      [slide(source)],
      "blocks",
      "scope-5",
      "sock-5",
    );
    expect(outcome).toBeNull();
  });

  it("removes the nested value graph when switching block -> empty", () => {
    const source = blocks(
      [category("cat")],
      [
        stack("root", "cat", [
          blockSocket("s", value("v", "cat", [blockSocket("nested", value("w", "cat"))])),
        ]),
      ],
    );
    const next = setSocketContentEmpty(source, "root", "s");
    expect(next.items[0]?.parts[0]).toEqual(emptySocket("s"));
    expect(findBlockItemById(next, "v")).toBeNull();
  });

  it("switches block -> literal dropping the nested graph", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [blockSocket("s", value("v", "cat"))])],
    );
    const next = setSocketContentLiteral(source, "root", "s", "42");
    expect(next.items[0]?.parts[0]).toEqual(
      literalSocket("s", "42"),
    );
    expect(findBlockItemById(next, "v")).toBeNull();
  });

  it("preserves the existing graph on block -> block (exact no-op)", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [blockSocket("s", value("v", "cat"))])],
    );
    const fresh = createDefaultValueBlockItem(new Set(), "cat");
    expect(setSocketContentBlock(source, "root", "s", fresh)).toBe(source);
    const socket = source.items[0]?.parts[0];
    if (socket?.type === "socket" && socket.content.type === "block") {
      expect(socket.content.block.id).toBe("v");
    }
  });
});

// ============================================================
// AUTHORING INVARIANT GUARDS
//
// The exported semantic authoring operations receive arbitrary
// BlockItem arguments. They must never silently produce an invalid
// canonical BlocksElement: contextually invalid shapes and
// unresolvable category references are exact same-reference no-ops.
// ============================================================

describe("Blocks authoring invariant guards", () => {
  it("appendBlockItemToRoot accepts a statement", () => {
    const source = blocks(
      [category("cat")],
      [stack("a", "cat", [textPart("pa")])],
    );
    const item = stack("b", "cat", [textPart("pb")]);
    const next = appendBlockItemToRoot(source, item);
    expect(next).not.toBe(source);
    expect(next.items[1]).toBe(item);
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("appendBlockItemToRoot accepts a scope", () => {
    const source = blocks([category("cat")], []);
    const item = scope("root-scope", "cat", [textPart("p")]);
    const next = appendBlockItemToRoot(source, item);
    expect(next).not.toBe(source);
    expect(next.items[0]).toBe(item);
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("appendBlockItemToRoot rejects a value with an exact same reference", () => {
    const source = blocks([category("cat")], []);
    const item = value("root-value", "cat");
    expect(appendBlockItemToRoot(source, item)).toBe(source);
    expect(source.items).toEqual([]);
    expect(item.shape).toBe("value");
  });

  it("appendBlockItemToRoot rejects an unknown category with an exact same reference", () => {
    const source = blocks(
      [category("cat")],
      [stack("a", "cat", [textPart("pa")])],
    );
    const item = stack("b", "missing", [textPart("pb")]);
    expect(appendBlockItemToRoot(source, item)).toBe(source);
    expect(source.items).toHaveLength(1);
  });

  it("appendBlockItemToScope accepts a statement", () => {
    const source = blocks(
      [category("cat")],
      [scope("root", "cat", [textPart("p")])],
    );
    const item = stack("child", "cat", [textPart("cp")]);
    const next = appendBlockItemToScope(source, "root", item);
    expect(next.items[0]?.children[0]).toBe(item);
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("appendBlockItemToScope accepts a scope when otherwise valid", () => {
    const source = blocks(
      [category("cat")],
      [scope("root", "cat", [textPart("p")])],
    );
    const item = scope("nested", "cat", [textPart("np")]);
    const next = appendBlockItemToScope(source, "root", item);
    expect(next.items[0]?.children[0]).toBe(item);
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("appendBlockItemToScope rejects a value", () => {
    const source = blocks(
      [category("cat")],
      [scope("root", "cat", [textPart("p")])],
    );
    const item = value("scope-value", "cat");
    expect(appendBlockItemToScope(source, "root", item)).toBe(source);
    expect(source.items[0]?.children).toEqual([]);
  });

  it("appendBlockItemToScope rejects an unknown category", () => {
    const source = blocks(
      [category("cat")],
      [scope("root", "cat", [textPart("p")])],
    );
    const item = stack("child", "missing", [textPart("cp")]);
    expect(appendBlockItemToScope(source, "root", item)).toBe(source);
    expect(source.items[0]?.children).toEqual([]);
  });

  it("setSocketContentBlock accepts a valid value", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [emptySocket("s")])],
    );
    const item = value("v", "cat", [textPart("vp")]);
    const next = setSocketContentBlock(source, "root", "s", item);
    const part = next.items[0]?.parts[0];
    if (part?.type === "socket") {
      expect(part.content).toEqual({ type: "block", block: item });
    }
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("setSocketContentBlock rejects a statement", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [emptySocket("s")])],
    );
    const item = stack("st", "cat", [textPart("sp")]);
    expect(setSocketContentBlock(source, "root", "s", item)).toBe(source);
    const part = source.items[0]?.parts[0];
    if (part?.type === "socket") {
      expect(part.content.type).toBe("empty");
    }
  });

  it("setSocketContentBlock rejects a scope", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [emptySocket("s")])],
    );
    const item = scope("sc", "cat", [textPart("scp")]);
    expect(setSocketContentBlock(source, "root", "s", item)).toBe(source);
    const part = source.items[0]?.parts[0];
    if (part?.type === "socket") {
      expect(part.content.type).toBe("empty");
    }
  });

  it("setSocketContentBlock rejects a value with children", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [emptySocket("s")])],
    );
    const item: BlockItem = {
      id: "bad-value",
      categoryId: "cat",
      shape: "value",
      parts: [textPart("bp")],
      children: [stack("bad-child", "cat", [])],
    };
    expect(setSocketContentBlock(source, "root", "s", item)).toBe(source);
    expect(item.children).toHaveLength(1);
  });

  it("setSocketContentBlock rejects an unknown category", () => {
    const source = blocks(
      [category("cat")],
      [stack("root", "cat", [emptySocket("s")])],
    );
    const item = value("v", "missing");
    expect(setSocketContentBlock(source, "root", "s", item)).toBe(source);
    const part = source.items[0]?.parts[0];
    if (part?.type === "socket") {
      expect(part.content.type).toBe("empty");
    }
  });

  it("rejected cases never mutate the source or the supplied BlockItem", () => {
    const base = blocks(
      [category("cat")],
      [stack("root", "cat", [emptySocket("s")])],
    );

    const rootValue = value("rv", "cat");
    const rootSnapshot = structuredClone(rootValue);
    const rootResult = appendBlockItemToRoot(base, rootValue);
    expect(rootResult).toBe(base);
    expect(rootValue).toEqual(rootSnapshot);

    const childValue = value("cv", "cat");
    const childSnapshot = structuredClone(childValue);
    const childResult = appendBlockItemToScope(base, "root", childValue);
    expect(childResult).toBe(base);
    expect(childValue).toEqual(childSnapshot);

    const socketStatement = stack("ss", "cat", [textPart("ssp")]);
    const socketSnapshot = structuredClone(socketStatement);
    const socketResult = setSocketContentBlock(base, "root", "s", socketStatement);
    expect(socketResult).toBe(base);
    expect(socketStatement).toEqual(socketSnapshot);

    expect(base).toEqual(
      blocks([category("cat")], [stack("root", "cat", [emptySocket("s")])]),
    );
  });
});

// ============================================================
// IMMUTABILITY
// ============================================================

describe("Blocks immutability", () => {
  it("preserves exact references on no-op where specified", () => {
    const source = blocks(
      [category("cat"), category("unused")],
      [stack("root", "cat", [textPart("p")])],
    );

    expect(moveBlockItemByOffset(source, "root", -1)).toBe(source);
    expect(removeBlockItemById(source, "missing")).toBe(source);
    expect(setBlockItemCategory(source, "root", "missing")).toBe(source);
    expect(updateBlockTextPartText(source, "root", "p", "p")).toBe(source);
    expect(removeBlockCategory(source, "cat")).toBe(source);
    expect(appendBlockItemToScope(source, "root", createDefaultStackBlockItem(new Set(), "cat"))).toBe(source);
  });

  it("never mutates the source across a full operation batch", () => {
    const source = blocks(
      [category("cat")],
      [
        scope("root", "cat", [textPart("p"), emptySocket("s")], [
          stack("child", "cat", [blockSocket("cs", value("v", "cat"))]),
        ]),
      ],
    );
    const snapshot = structuredClone(source);

    let current = source;
    current = setSocketContentLiteral(current, "root", "s", "10");
    current = setBlockItemShape(current, "root", "scope");
    current = appendBlockPartToItem(
      current,
      "child",
      createDefaultTextPart(new Set()),
    );
    current = setBlockItemCategory(current, "v", "cat");
    current = removeBlockPartById(current, "child", "cs");
    current = moveBlockItemByOffset(current, "child", 1);

    expect(current).not.toBe(source);
    expect(source).toEqual(snapshot);
  });
});