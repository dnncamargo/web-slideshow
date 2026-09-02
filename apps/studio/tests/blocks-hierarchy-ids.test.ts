import { describe, expect, it } from "vitest";
import type { BlocksElement, BlockItem, PowerShowElement, Slide } from "@powershow/document-schema";
import { createElement, duplicateElement } from "../src/features/editor/element-operations";
import { collectAuthoringIds } from "../src/features/editor/element-hierarchy";
import { duplicateSlideWithUniqueIds } from "../src/features/editor/slide-operations";

const makeValue = (id: string): BlockItem => ({ id, color: "#123456", shape: "value", parts: [{ id: id + "-p", type: "text", text: "value" }], children: [] });
const makeBlocks = (id = "blocks"): BlocksElement => ({ id, type: "blocks", hidden: false, items: [{ id: "scope", color: "#123456", shape: "scope", parts: [{ id: "scope-p", type: "text", text: "repeat" }, { id: "scope-s", type: "socket", content: { type: "block", block: makeValue("value") } }], children: [{ id: "child", color: "#123456", shape: "statement", parts: [{ id: "child-p", type: "text", text: "move" }], children: [] }] }] });
const slide = (element: PowerShowElement): Slide => ({ id: "slide", title: "Slide", summary: "", speakerNotes: "", elements: [element] });

describe("composable Blocks Studio contract", () => {
  it("creates the exact valid default shape", () => {
    const created = createElement("blocks", []);
    expect(created.type).toBe("blocks");
    if (created.type !== "blocks") return;
    expect(created.items[0]).toMatchObject({ color: "#6366f1", shape: "statement", children: [] });
    expect(created.items[0]?.parts[0]).toEqual({ id: "block-part", type: "text", text: "New block" });
    expect(created.style).toBeUndefined();
  });

  it("collects ids across scope, parts, socket values, and nested value parts", () => {
    const ids = new Set<string>();
    collectAuthoringIds(makeBlocks(), ids);
    for (const id of ["blocks", "scope", "scope-p", "scope-s", "value", "value-p", "child", "child-p"]) expect(ids.has(id)).toBe(true);
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
    if (socket?.type === "socket" && socket.content.type === "block") expect(socket.content.block.id).not.toBe("value");
  });

  it("renews nested block ids during slide duplication", () => {
    const source = slide(makeBlocks());
    const copy = duplicateSlideWithUniqueIds(source, [source]);
    expect(copy.elements[0]?.type).toBe("blocks");
    if (copy.elements[0]?.type === "blocks") expect(copy.elements[0].items[0]?.id).not.toBe("scope");
  });
});
