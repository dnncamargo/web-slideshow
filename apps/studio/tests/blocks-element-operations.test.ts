import { describe, expect, it } from "vitest";

import { BlocksElementSchema } from "@powershow/document-schema";

import type {
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
  moveBlockItemByOffset,
  moveBlockPartByOffset,
  removeBlockItemById,
  removeBlockPartById,
  setBlockItemColor,
  setBlockItemShape,
  setSocketContentBlock,
  setSocketContentBlockShape,
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

const colorKey = (id: string): string => id;

const colorFor = (key: string): string =>
  key.startsWith("#") ? key : key === "cat-b" || key === "other"
    ? "#654321"
    : "#123456";

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
  color: string,
  parts: BlockPart[],
  children: BlockItem[] = [],
): BlockItem => ({
  id,
  color: colorFor(color),
  shape: "statement",
  parts,
  children,
});

const scope = (
  id: string,
  color: string,
  parts: BlockPart[],
  children: BlockItem[] = [],
): BlockItem => ({
  id,
  color: colorFor(color),
  shape: "scope",
  parts,
  children,
});

const value = (
  id: string,
  color: string,
  parts: BlockPart[] = [],
): BlockItem => ({
  id,
  color: colorFor(color),
  shape: "value",
  parts,
  children: [],
});

const reporter = (id: string, shape: "value" | "logic"): BlockItem => ({
  id,
  color: colorFor("cat"),
  shape,
  parts: [textPart(`${id}-part`, id)],
  children: [],
});

const shapedStack = (id: string, shape: "start" | "statement" | "scope" | "end"): BlockItem => ({
  id,
  color: colorFor("cat"),
  shape,
  parts: [textPart(`${id}-part`)],
  children: [],
});

const blocks = (
  _colorKeys: string[],
  items: BlockItem[],
): BlocksElement => ({
  id: "blocks",
  type: "blocks",
  hidden: false,
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
  color: "#123456",
  shape: "value",
  parts: [{ id: `${id}-p`, type: "text", text: "value" }],
  children: [],
});

const makeBlocks = (id = "blocks"): BlocksElement => ({
  id,
  type: "blocks",
  hidden: false,
  items: [
    {
      id: "scope",
      color: "#123456",
      shape: "scope",
      parts: [
        { id: "scope-p", type: "text", text: "repeat" },
        { id: "scope-s", type: "socket", content: { type: "block", block: makeValue("value") } },
      ],
      children: [
        {
          id: "child",
          color: "#123456",
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
    [colorKey("cat")],
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
    expect(created.items[0]).toMatchObject({
      color: "#6366f1",
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

  it("duplicates all block and part ids while preserving direct colors", () => {
    const copy = duplicateElement(makeBlocks(), [slide(makeBlocks())]);
    expect(copy.type).toBe("blocks");
    if (copy.type !== "blocks") return;
    expect(copy.id).not.toBe("blocks");
    expect(copy.items[0]?.color).toBe(makeBlocks().items[0]?.color);
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
// LOOKUP / DEPTH
// ============================================================

describe("Blocks lookup and depth", () => {
  it("finds and updates a root block", () => {
    const source = blocks(
      [colorKey("cat"), colorKey("other")],
      [stack("root", "cat", [textPart("p")])],
    );
    expect(findBlockItemById(source, "root")?.id).toBe("root");
    const next = updateBlockItemById(source, "root", (item) => ({
      ...item,
      color: colorFor("other"),
    }));
    expect(next).not.toBe(source);
    expect(next.items[0]?.color).toBe(colorFor("other"));
    expect(updateBlockItemById(source, "missing", (item) => item)).toBe(
      source,
    );
  });

  it("finds and updates a scope child", () => {
    const source = blocks(
      [colorKey("cat")],
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
      [colorKey("cat")],
      [stack("root", "cat", [blockSocket("s", value("v", "cat", [textPart("v-p")]))])],
    );
    expect(findBlockItemById(source, "v")?.shape).toBe("value");
    const next = updateBlockItemById(source, "v", (item) => ({
      ...item,
      color: colorFor("cat"),
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
    const source = blocks([colorKey("cat")], stackChain(5));
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
  it("appends a root stack block", () => {
    const source = blocks(
      [colorKey("cat")],
      [stack("a", "cat", [textPart("pa")])],
    );
    const item = createDefaultStackBlockItem(new Set(), colorFor("cat"));
    const next = appendBlockItemToRoot(source, item);
    expect(next).not.toBe(source);
    expect(next.items).toHaveLength(2);
    expect(next.items[1]).toBe(item);
  });

  it("does not require a category vocabulary for root creation", () => {
    const source = blocks([], []);
    const item = createDefaultStackBlockItem(new Set(), "#123456");
    expect(appendBlockItemToRoot(source, item).items).toEqual([item]);
  });

  it("appends a child to a scope", () => {
    const source = blocks(
      [colorKey("cat")],
      [scope("root", "cat", [textPart("p")], [stack("a", "cat", [])])],
    );
    const item = createDefaultStackBlockItem(new Set(), colorFor("cat"));
    const next = appendBlockItemToScope(source, "root", item);
    expect(next.items[0]?.children).toHaveLength(2);
    expect(next.items[0]?.children[1]).toBe(item);
  });

  it("uses the scope color for a new scope child", () => {
    const source = blocks(
      [colorKey("cat-a"), colorKey("cat-b")],
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
      expect(next.items[0]?.children[0]?.color).toBe(colorFor("cat-b"));
    }
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("refuses to append a child to a statement", () => {
    const source = blocks(
      [colorKey("cat")],
      [stack("root", "cat", [textPart("p")])],
    );
    const item = createDefaultStackBlockItem(new Set(), colorFor("cat"));
    expect(appendBlockItemToScope(source, "root", item)).toBe(source);
  });

  it("refuses scope child creation at depth MAX_BLOCK_AUTHORING_DEPTH", () => {
    const source = blocks([colorKey("cat")], stackChain(MAX_BLOCK_AUTHORING_DEPTH));
    const item = createDefaultStackBlockItem(new Set(), colorFor("cat"));
    expect(
      appendBlockItemToScope(source, "scope-5", item),
    ).toBe(source);
  });

  it("removes a root stack block and its entire graph", () => {
    const source = blocks(
      [colorKey("cat")],
      [
        scope("root", "cat", [textPart("p")], [
          stack("child", "cat", [blockSocket("cs", value("v", "cat"))]),
        ]),
      ],
    );
    const next = removeBlockItemById(source, "root");
    expect(next.items).toEqual([]);
  });

  it("removes a scope child subtree", () => {
    const source = blocks(
      [colorKey("cat")],
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
      [colorKey("cat")],
      [stack("a", "cat", []), stack("b", "cat", []), stack("c", "cat", [])],
    );
    const next = moveBlockItemByOffset(source, "a", 1);
    expect(next.items.map((item) => item.id)).toEqual(["b", "a", "c"]);
    expect(next.items[0]).toBe(source.items[1]);
  });

  it("moves scope siblings within the same scope.children", () => {
    const source = blocks(
      [colorKey("cat")],
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
      [colorKey("cat")],
      [stack("a", "cat", []), stack("b", "cat", [])],
    );
    expect(moveBlockItemByOffset(source, "a", -1)).toBe(source);
    expect(moveBlockItemByOffset(source, "b", 1)).toBe(source);
    expect(moveBlockItemByOffset(source, "missing", 1)).toBe(source);
  });

  it("never moves a socket value as a stack sibling", () => {
    const source = blocks(
      [colorKey("cat")],
      [stack("root", "cat", [blockSocket("s", value("v", "cat"))])],
    );
    expect(moveBlockItemByOffset(source, "v", 1)).toBe(source);
    expect(moveBlockItemByOffset(source, "v", -1)).toBe(source);
  });
});

// ============================================================
// DIRECT COLOR
// ============================================================

describe("Blocks direct color", () => {
  it("changes a root block color", () => {
    const source = blocks(
      [colorKey("cat-a"), colorKey("cat-b")],
      [stack("root", "cat-a", [textPart("p")])],
    );
    const next = setBlockItemColor(source, "root", "#abcdef");
    expect(next.items[0]?.color).toBe("#abcdef");
    expect(next.items[0]?.parts).toBe(source.items[0]?.parts);
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("changes a socket-contained value color", () => {
    const source = blocks(
      [colorKey("cat-a"), colorKey("cat-b")],
      [stack("root", "cat-a", [blockSocket("s", value("v", "cat-a"))])],
    );
    const next = setBlockItemColor(source, "v", "#abcdef");
    const socket = next.items[0]?.parts[0];
    if (socket?.type === "socket" && socket.content.type === "block") {
      expect(socket.content.block.color).toBe("#abcdef");
    }
  });

  it("is an exact no-op for a missing target", () => {
    const source = blocks(
      [colorKey("cat")],
      [stack("root", "cat", [textPart("p")])],
    );
    expect(setBlockItemColor(source, "missing", "#abcdef")).toBe(source);
  });
});

// ============================================================
// SHAPE EDITING
// ============================================================

describe("Blocks shape editing", () => {
  it("converts a statement to a scope preserving id/color/parts", () => {
    const source = blocks(
      [colorKey("cat")],
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
      expect(item.color).toBe(colorFor("cat"));
    }
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("converts an empty scope back to a statement", () => {
    const source = blocks(
      [colorKey("cat")],
      [scope("root", "cat", [textPart("p")])],
    );
    const next = setBlockItemShape(source, "root", "statement");
    expect(next.items[0]?.shape).toBe("statement");
    expect(next.items[0]?.children).toEqual([]);
  });

  it("refuses to flatten a populated scope", () => {
    const source = blocks(
      [colorKey("cat")],
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
      [colorKey("cat")],
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
      [colorKey("cat")],
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
      [colorKey("cat")],
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
      [colorKey("cat")],
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
      [colorKey("cat")],
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
      [colorKey("cat")],
      [stack("root", "cat", [textPart("a"), textPart("b")])],
    );
    const next = removeBlockPartById(source, "root", "a");
    expect(next.items[0]?.parts.map((part) => part.id)).toEqual(["b"]);
    expect(removeBlockPartById(source, "root", "missing")).toBe(source);
  });

  it("reorders parts within a BlockItem", () => {
    const source = blocks(
      [colorKey("cat")],
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
      [colorKey("cat")],
      [stack("root", "cat", [textPart("a"), textPart("b")])],
    );
    expect(moveBlockPartByOffset(source, "root", "a", -1)).toBe(source);
    expect(moveBlockPartByOffset(source, "root", "b", 1)).toBe(source);
    expect(moveBlockPartByOffset(source, "root", "missing", 1)).toBe(source);
  });

  it("applies part operations to a socket-contained value", () => {
    const source = blocks(
      [colorKey("cat")],
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
      [colorKey("cat")],
      [stack("root", "cat", [emptySocket("s")])],
    );
    const next = setSocketContentLiteral(source, "root", "s", "10");
    expect(next.items[0]?.parts[0]).toEqual(
      literalSocket("s", "10"),
    );
  });

  it("edits a literal value", () => {
    const source = blocks(
      [colorKey("cat")],
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
      [colorKey("cat")],
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
      [colorKey("cat")],
      [stack("root", "cat", [literalSocket("s", "10")])],
    );
    const next = setSocketContentEmpty(source, "root", "s");
    expect(next.items[0]?.parts[0]).toEqual(emptySocket("s"));
    // already empty: exact no-op
    const emptySource = blocks(
      [colorKey("cat")],
      [stack("root", "cat", [emptySocket("s")])],
    );
    expect(setSocketContentEmpty(emptySource, "root", "s")).toBe(emptySource);
  });

  it("switches empty -> block", () => {
    const source = blocks(
      [colorKey("cat")],
      [stack("root", "cat", [emptySocket("s")])],
    );
    const item = createDefaultValueBlockItem(new Set(), colorFor("cat"));
    const next = setSocketContentBlock(source, "root", "s", item);
    const part = next.items[0]?.parts[0];
    if (part?.type === "socket") {
      expect(part.content).toEqual({ type: "block", block: item });
    }
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("defaults a new socket value to the owner color", () => {
    const source = blocks(
      [colorKey("cat-a"), colorKey("cat-b")],
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
        expect(part.content.block.color).toBe(colorFor("cat-b"));
      }
    }
  });

  it("allocates fresh BlockItem and BlockPart ids for a socket value", () => {
    const source = blocks(
      [colorKey("cat")],
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
    const source = blocks([colorKey("cat")], items);
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
      [colorKey("cat")],
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
      [colorKey("cat")],
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
      [colorKey("cat")],
      [stack("root", "cat", [blockSocket("s", value("v", "cat"))])],
    );
    const fresh = createDefaultValueBlockItem(new Set(), colorFor("cat"));
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
// contextually invalid shapes are exact same-reference no-ops.
// ============================================================

describe("Blocks authoring invariant guards", () => {
  it("accepts exactly the B3 stack family at root and in scope children", () => {
    for (const shape of ["start", "statement", "scope", "end"] as const) {
      const root = appendBlockItemToRoot(blocks([], []), shapedStack(`root-${shape}`, shape));
      expect(root.items[0]?.shape).toBe(shape);
      const child = appendBlockItemToScope(blocks([], [scope("scope", "cat", [])]), "scope", shapedStack(`child-${shape}`, shape));
      expect(child.items[0]?.children[0]?.shape).toBe(shape);
    }
    for (const shape of ["value", "logic"] as const) {
      expect(appendBlockItemToRoot(blocks([], []), reporter(`root-${shape}`, shape))).toBeTypeOf("object");
      expect(appendBlockItemToRoot(blocks([], []), reporter(`root-${shape}`, shape)).items).toHaveLength(0);
      expect(appendBlockItemToScope(blocks([], [scope("scope", "cat", [])]), "scope", reporter(`child-${shape}`, shape)).items[0]?.children).toHaveLength(0);
    }
  });

  it("supports B3 stack shape editing and protects populated scopes", () => {
    let source = blocks([], [shapedStack("root", "statement")]);
    source = setBlockItemShape(source, "root", "start");
    expect(source.items[0]?.shape).toBe("start");
    source = setBlockItemShape(source, "root", "end");
    expect(source.items[0]?.shape).toBe("end");
    source = setBlockItemShape(source, "root", "statement");
    expect(source.items[0]?.shape).toBe("statement");
    const child = shapedStack("child", "statement");
    const populated = blocks([], [{ ...shapedStack("scope", "scope"), children: [child] }]);
    for (const shape of ["start", "statement", "end"] as const) {
      expect(setBlockItemShape(populated, "scope", shape)).toBe(populated);
      expect(populated.items[0]?.children[0]).toBe(child);
    }
  });

  it("accepts only value/logic reporters in sockets and converts them in place", () => {
    const source = blocks([], [stack("root", "cat", [emptySocket("socket")])]);
    for (const shape of ["value", "logic"] as const) {
      const next = setSocketContentBlock(source, "root", "socket", reporter(shape, shape));
      expect(next.items[0]?.parts[0]).toMatchObject({ content: { block: { shape } } });
    }
    for (const shape of ["start", "statement", "scope", "end"] as const) {
      expect(setSocketContentBlock(source, "root", "socket", shapedStack(shape, shape))).toBe(source);
    }
    const original = reporter("reporter", "value");
    const withReporter = setSocketContentBlock(source, "root", "socket", original);
    const logic = setSocketContentBlockShape(withReporter, "root", "socket", "logic");
    expect(logic.items[0]?.parts[0]).toMatchObject({ content: { block: { id: "reporter", color: original.color, shape: "logic", parts: original.parts, children: [] } } });
    const valueAgain = setSocketContentBlockShape(logic, "root", "socket", "value");
    expect(valueAgain.items[0]?.parts[0]).toMatchObject({ content: { block: { id: "reporter", shape: "value" } } });
    expect(setSocketContentBlockShape(source, "root", "missing", "logic")).toBe(source);
  });
  it("appendBlockItemToRoot accepts a statement", () => {
    const source = blocks(
      [colorKey("cat")],
      [stack("a", "cat", [textPart("pa")])],
    );
    const item = stack("b", "cat", [textPart("pb")]);
    const next = appendBlockItemToRoot(source, item);
    expect(next).not.toBe(source);
    expect(next.items[1]).toBe(item);
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("appendBlockItemToRoot accepts a scope", () => {
    const source = blocks([colorKey("cat")], []);
    const item = scope("root-scope", "cat", [textPart("p")]);
    const next = appendBlockItemToRoot(source, item);
    expect(next).not.toBe(source);
    expect(next.items[0]).toBe(item);
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("appendBlockItemToRoot rejects a value with an exact same reference", () => {
    const source = blocks([colorKey("cat")], []);
    const item = value("root-value", "cat");
    expect(appendBlockItemToRoot(source, item)).toBe(source);
    expect(source.items).toEqual([]);
    expect(item.shape).toBe("value");
  });

  it("appendBlockItemToRoot accepts any canonical direct color", () => {
    const source = blocks(
      [colorKey("cat")],
      [stack("a", "cat", [textPart("pa")])],
    );
    const item = stack("b", "#abcdef", [textPart("pb")]);
    expect(appendBlockItemToRoot(source, item).items[1]).toBe(item);
  });

  it("appendBlockItemToScope accepts a statement", () => {
    const source = blocks(
      [colorKey("cat")],
      [scope("root", "cat", [textPart("p")])],
    );
    const item = stack("child", "cat", [textPart("cp")]);
    const next = appendBlockItemToScope(source, "root", item);
    expect(next.items[0]?.children[0]).toBe(item);
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("appendBlockItemToScope accepts a scope when otherwise valid", () => {
    const source = blocks(
      [colorKey("cat")],
      [scope("root", "cat", [textPart("p")])],
    );
    const item = scope("nested", "cat", [textPart("np")]);
    const next = appendBlockItemToScope(source, "root", item);
    expect(next.items[0]?.children[0]).toBe(item);
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("appendBlockItemToScope rejects a value", () => {
    const source = blocks(
      [colorKey("cat")],
      [scope("root", "cat", [textPart("p")])],
    );
    const item = value("scope-value", "cat");
    expect(appendBlockItemToScope(source, "root", item)).toBe(source);
    expect(source.items[0]?.children).toEqual([]);
  });

  it("appendBlockItemToScope accepts a distinct child color", () => {
    const source = blocks(
      [colorKey("cat")],
      [scope("root", "cat", [textPart("p")])],
    );
    const item = stack("child", "#abcdef", [textPart("cp")]);
    expect(appendBlockItemToScope(source, "root", item).items[0]?.children[0]).toBe(item);
  });

  it("setSocketContentBlock accepts a valid value", () => {
    const source = blocks(
      [colorKey("cat")],
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
      [colorKey("cat")],
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
      [colorKey("cat")],
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
      [colorKey("cat")],
      [stack("root", "cat", [emptySocket("s")])],
    );
    const item: BlockItem = {
      id: "bad-value",
      color: colorFor("cat"),
      shape: "value",
      parts: [textPart("bp")],
      children: [stack("bad-child", "cat", [])],
    };
    expect(setSocketContentBlock(source, "root", "s", item)).toBe(source);
    expect(item.children).toHaveLength(1);
  });

  it("setSocketContentBlock accepts a distinct value color", () => {
    const source = blocks(
      [colorKey("cat")],
      [stack("root", "cat", [emptySocket("s")])],
    );
    const item = value("v", "#abcdef");
    const next = setSocketContentBlock(source, "root", "s", item);
    const part = next.items[0]?.parts[0];
    if (part?.type === "socket") {
      expect(part.content).toEqual({ type: "block", block: item });
    }
  });

  it("rejected cases never mutate the source or the supplied BlockItem", () => {
    const base = blocks(
      [colorKey("cat")],
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
      blocks([colorKey("cat")], [stack("root", "cat", [emptySocket("s")])]),
    );
  });
});

// ============================================================
// IMMUTABILITY
// ============================================================

describe("Blocks immutability", () => {
  it("preserves exact references on no-op where specified", () => {
    const source = blocks(
      [colorKey("cat"), colorKey("unused")],
      [stack("root", "cat", [textPart("p")])],
    );

    expect(moveBlockItemByOffset(source, "root", -1)).toBe(source);
    expect(removeBlockItemById(source, "missing")).toBe(source);
    expect(setBlockItemColor(source, "missing", "#abcdef")).toBe(source);
    expect(updateBlockTextPartText(source, "root", "p", "p")).toBe(source);
    expect(appendBlockItemToScope(source, "root", createDefaultStackBlockItem(new Set(), colorFor("cat")))).toBe(source);
  });

  it("never mutates the source across a full operation batch", () => {
    const source = blocks(
      [colorKey("cat")],
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
    current = setBlockItemColor(current, "v", "#abcdef");
    current = removeBlockPartById(current, "child", "cs");
    current = moveBlockItemByOffset(current, "child", 1);

    expect(current).not.toBe(source);
    expect(source).toEqual(snapshot);
  });
});
