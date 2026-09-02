import { describe, expect, it } from "vitest";

import { BlocksElementSchema } from "@powershow/document-schema";

import type {
  BlockItem,
  BlocksElement,
  BlockTextPart,
  PowerShowElement,
  Slide,
} from "@powershow/document-schema";

import {
  MAX_BLOCK_AUTHORING_DEPTH,
  addRootBlockToPresentation,
  addScopeChildToPresentation,
  addSocketPartToPresentation,
  addTextPartToPresentation,
  createSocketValueInPresentation,
} from "../src/features/editor/element-operations";
import { collectAuthoringIds } from "../src/features/editor/element-hierarchy";
import type {
  BlocksAuthoringControls,
  ElementInspectorUpdate,
} from "../src/features/editor/inspector/inspector-types";

// ============================================================
// FIXTURES
// ============================================================

const category = (id: string): string => id;

const colorFor = (key: string): string =>
  key === "cat-b" ? "#654321" : "#123456";

const textPart = (id: string): BlockTextPart => ({
  id,
  type: "text",
  text: id,
});

const socketEmpty = (id: string): BlockTextPart | { id: string; type: "socket"; content: { type: "empty" } } => ({
  id,
  type: "socket",
  content: { type: "empty" },
});

const stack = (
  id: string,
  color: string,
  parts: readonly { id: string }[],
  children: BlockItem[] = [],
): BlockItem => ({
  id,
  color: colorFor(color),
  shape: "statement",
  parts: parts as BlockItem["parts"],
  children,
});

const scope = (
  id: string,
  color: string,
  parts: readonly { id: string }[],
  children: BlockItem[] = [],
): BlockItem => ({
  id,
  color: colorFor(color),
  shape: "scope",
  parts: parts as BlockItem["parts"],
  children,
});

const blocks = (
  _colorKeys: readonly string[],
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

function allAuthoringIds(slides: readonly Slide[]): Set<string> {
  const ids = new Set<string>();

  for (const slide of slides) {
    for (const element of slide.elements) {
      collectAuthoringIds(element, ids);
    }
  }

  return ids;
}

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

// ============================================================
// BlocksAuthoringControls CONTRACT
// ============================================================

describe("BlocksAuthoringControls contract", () => {
  it("exposes exactly the five creation-only handlers", () => {
    const controls: BlocksAuthoringControls = {
      onAddRootBlock: () => null,
      onAddScopeChild: () => null,
      onAddTextPart: () => null,
      onAddSocketPart: () => null,
      onCreateSocketValue: () => null,
    };

    expect(Object.keys(controls).sort()).toEqual([
      "onAddRootBlock",
      "onAddScopeChild",
      "onAddSocketPart",
      "onAddTextPart",
      "onCreateSocketValue",
    ]);
  });

  it("type-checks as a full ElementInspectorUpdate control surface", () => {
    // The controls sit beside the element update flow; text/literal/
    // color/shape/remove/reorder deliberately stay on onUpdate.
    const controls = (): BlocksAuthoringControls => ({
      onAddRootBlock: () => null,
      onAddScopeChild: () => null,
      onAddTextPart: () => null,
      onAddSocketPart: () => null,
      onCreateSocketValue: () => null,
    });
    const update: ElementInspectorUpdate = () => {};
    const surface = { controls: controls(), update };

    expect(surface.controls.onAddRootBlock("blocks")).toBeNull();
    expect(update).toBeDefined();
  });

  it("allocates collision-safe BlockItem ids presentation-wide", () => {
    // Seed the presentation with ids that collide with the default
    // block-item vocabulary so the next allocation must skip them.
    const seed = blocks(
      [colorKey("cat")],
      [
        stack("block-item", "cat", [textPart("block-part")]),
        stack("block-item-2", "cat", [textPart("block-part-2")]),
      ],
    );
    const slides = [slide(seed)];

    const outcome = addRootBlockToPresentation(slides, "blocks");

    expect(outcome).not.toBeNull();
    expect(outcome?.createdId).toBe("block-item-3");

    const nextSlides = outcome?.slides ?? [];
    const ids = allAuthoringIds(nextSlides);
    expect(ids).toHaveLength(ids.size);

    const nextElement = nextSlides[0]?.elements[0];
    expect(BlocksElementSchema.parse(nextElement)).toBeTruthy();
  });

  it("exposes a presentation-wide collision-safe BlockPart allocation", () => {
    const seed = blocks([colorKey("cat")], [
      stack("root", "cat", [
        textPart("block-part"),
        textPart("block-part-2"),
      ]),
    ]);
    const outcome = addTextPartToPresentation([slide(seed)], "blocks", "root");

    expect(outcome).not.toBeNull();
    expect(outcome?.createdId).toBe("block-part-3");

    const nextSlides = outcome?.slides ?? [];
    const ids = allAuthoringIds(nextSlides);
    // blocks, root, block-part, block-part-2, block-part-3
    expect(ids).toHaveLength(5);
  });

  it("returns the created id for a new root block", () => {
    const seed = blocks([colorKey("cat")], []);
    const outcome = addRootBlockToPresentation([slide(seed)], "blocks");

    expect(outcome).not.toBeNull();
    expect(outcome?.createdId).toBe("block-item");

    const next = outcome?.slides[0]?.elements[0];
    if (next?.type === "blocks") {
      expect(next.items[0]?.id).toBe("block-item");
      expect(next.items[0]?.shape).toBe("statement");
      expect(next.items[0]?.parts[0]).toMatchObject({
        type: "text",
        text: "New block",
      });
    }
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("returns the created id for a new scope child", () => {
    const seed = blocks(
      [colorKey("cat")],
      [scope("scope-a", "cat", [textPart("sp")])],
    );
    const outcome = addScopeChildToPresentation(
      [slide(seed)],
      "blocks",
      "scope-a",
    );

    expect(outcome).not.toBeNull();
    expect(outcome?.createdId).toBe("block-item");

    const next = outcome?.slides[0]?.elements[0];
    if (next?.type === "blocks") {
      expect(next.items[0]?.children[0]?.id).toBe("block-item");
      expect(next.items[0]?.children[0]?.color).toBe(colorFor("cat"));
    }
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("returns the created id for a new text part", () => {
    const seed = blocks(
      [colorKey("cat")],
      [stack("root", "cat", [textPart("p")])],
    );
    const outcome = addTextPartToPresentation([slide(seed)], "blocks", "root");

    expect(outcome).not.toBeNull();
    expect(outcome?.createdId).toBe("block-part");

    const next = outcome?.slides[0]?.elements[0];
    if (next?.type === "blocks") {
      const part = next.items[0]?.parts[1];
      expect(part).toMatchObject({ id: "block-part", type: "text", text: "Text" });
    }
  });

  it("returns the created id for a new socket part", () => {
    const seed = blocks(
      [colorKey("cat")],
      [stack("root", "cat", [textPart("p")])],
    );
    const outcome = addSocketPartToPresentation([slide(seed)], "blocks", "root");

    expect(outcome).not.toBeNull();
    expect(outcome?.createdId).toBe("block-part");

    const next = outcome?.slides[0]?.elements[0];
    if (next?.type === "blocks") {
      const part = next.items[0]?.parts[1];
      expect(part).toMatchObject({
        id: "block-part",
        type: "socket",
        content: { type: "empty" },
      });
    }
  });

  it("returns the created id for a new socket value", () => {
    const seed = blocks(
      [colorKey("cat")],
      [stack("root", "cat", [socketEmpty("s") as BlockItem["parts"][number]])],
    );
    const outcome = createSocketValueInPresentation(
      [slide(seed)],
      "blocks",
      "root",
      "s",
    );

    expect(outcome).not.toBeNull();
    expect(outcome?.createdId).toBe("block-item");

    const next = outcome?.slides[0]?.elements[0];
    if (next?.type === "blocks") {
      const socket = next.items[0]?.parts[0];
      if (socket?.type === "socket" && socket.content.type === "block") {
        expect(socket.content.block.id).toBe("block-item");
        expect(socket.content.block.shape).toBe("value");
        expect(socket.content.block.parts[0]).toMatchObject({
          type: "text",
          text: "Value",
        });
      }
    }
    expect(BlocksElementSchema.parse(next)).toBeTruthy();
  });

  it("returns null with no write for a stale blocks owner", () => {
    const seed = blocks([colorKey("cat")], [stack("root", "cat", [])]);
    const slides = [slide(seed)];

    expect(addRootBlockToPresentation(slides, "missing")).toBeNull();
    expect(addTextPartToPresentation(slides, "missing", "root")).toBeNull();
    expect(createSocketValueInPresentation(slides, "missing", "root", "s")).toBeNull();
    expect(slides[0]?.elements[0]).toBe(seed);
  });

  it("returns null with no write for a stale block item target", () => {
    const seed = blocks([colorKey("cat")], [stack("root", "cat", [])]);
    const slides = [slide(seed)];

    expect(addTextPartToPresentation(slides, "blocks", "missing")).toBeNull();
    expect(addSocketPartToPresentation(slides, "blocks", "missing")).toBeNull();
    expect(addScopeChildToPresentation(slides, "blocks", "missing")).toBeNull();
    expect(slides[0]?.elements[0]).toBe(seed);
  });

  it("creates a root with the default color without category setup", () => {
    const seed = blocks([], []);
    const slides = [slide(seed)];

    const outcome = addRootBlockToPresentation(slides, "blocks");
    expect(outcome?.slides[0]?.elements[0]?.type === "blocks" && outcome.slides[0].elements[0].items[0]?.color).toBe("#6366f1");
    expect(slides[0]?.elements[0]).toBe(seed);
  });

  it("refuses scope child creation at depth MAX_BLOCK_AUTHORING_DEPTH", () => {
    const seed = blocks([colorKey("cat")], stackChain(MAX_BLOCK_AUTHORING_DEPTH));
    const slides = [slide(seed)];

    const outcome = addScopeChildToPresentation(slides, "blocks", "scope-5");
    expect(outcome).toBeNull();
    expect(slides[0]?.elements[0]).toBe(seed);
  });

  it("refuses socket value creation when the owner is deep", () => {
    let deep: BlockItem[] = [
      scope("scope-5", "cat", [socketEmpty("sock-5")] as BlockItem["parts"]),
    ];
    for (let level = MAX_BLOCK_AUTHORING_DEPTH - 1; level >= 1; level -= 1) {
      deep = [
        scope(`scope-${level}`, "cat", [textPart(`p-${level}`)] as BlockItem["parts"], deep),
      ];
    }
    const seed = blocks([colorKey("cat")], deep);
    const slides = [slide(seed)];

    const outcome = createSocketValueInPresentation(
      slides,
      "blocks",
      "scope-5",
      "sock-5",
    );
    expect(outcome).toBeNull();
    expect(slides[0]?.elements[0]).toBe(seed);
  });
});
