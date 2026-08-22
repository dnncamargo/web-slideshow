import { describe, expect, it } from "vitest";

import type {
  BlockItem,
  BlocksElement,
  PowerShowElement,
  Slide,
  StructuredTableElement,
  TopicItem,
} from "@powershow/document-schema";

import { duplicateElement } from "../src/features/editor/element-operations";
import { duplicateSlideWithUniqueIds } from "../src/features/editor/slide-operations";

const text = (id: string, content = id): PowerShowElement => ({ id, type: "text", hidden: false, variant: "body", content });

function value(id = "value"): BlockItem {
  return { id, categoryId: "cat", shape: "value", parts: [{ id: `${id}-part`, type: "text", text: "value" }], children: [] };
}

function blocks(id = "blocks"): BlocksElement {
  return {
    id,
    type: "blocks",
    hidden: false,
    categories: [{ id: "cat", name: "Category", color: "#123456" }],
    items: [{
      id: "scope",
      categoryId: "cat",
      shape: "scope",
      parts: [
        { id: "scope-part", type: "text", text: "repeat" },
        { id: "scope-socket", type: "socket", content: { type: "block", block: value() } },
      ],
      children: [{ id: "statement", categoryId: "cat", shape: "statement", parts: [{ id: "statement-part", type: "text", text: "move" }], children: [] }],
    }],
  };
}

function topicItem(id: string, children: PowerShowElement[] = [], nested: TopicItem[] = []): TopicItem {
  return { id, content: { id: `${id}-slot`, children }, children: nested };
}

function table(id: string, header: PowerShowElement[] = [], cell: PowerShowElement[] = []): StructuredTableElement {
  return {
    id,
    type: "table",
    mode: "structured",
    hidden: false,
    showHeader: true,
    columns: [{ id: `${id}-column`, header: { id: `${id}-header`, children: header } }],
    rows: [{ id: `${id}-row`, cells: [{ id: `${id}-cell`, children: cell }] }],
  };
}

function slide(elements: PowerShowElement[]): Slide {
  return { id: "slide", title: "Slide", summary: "", speakerNotes: "", elements };
}

function blockFrom(elements: readonly PowerShowElement[]): BlocksElement {
  const found = elements.find((element) => element.type === "blocks");
  if (!found || found.type !== "blocks") throw new Error("Blocks element not found");
  return found;
}

describe("Blocks B1/B2 slide duplication", () => {
  it("renews the complete root Blocks graph and leaves source untouched", () => {
    const source = slide([blocks()]);
    const before = structuredClone(source);
    const copy = duplicateSlideWithUniqueIds(source, [source]);
    const copied = blockFrom(copy.elements);
    expect(copied.id).toBe("blocks-copy");
    expect(copied.items[0]?.id).toBe("scope-copy");
    expect(copied.items[0]?.parts[0]?.id).toBe("scope-part-copy");
    const socket = copied.items[0]?.parts[1];
    if (socket?.type === "socket" && socket.content.type === "block") {
      expect(socket.content.block.id).toBe("value-copy");
      expect(socket.content.block.parts[0]?.id).toBe("value-part-copy");
    }
    expect(source).toEqual(before);
  });

  it.each([
    ["root Container", () => ({ id: "container", type: "container" as const, hidden: false, direction: "column" as const, children: [blocks()] })],
    ["Topic ContentSlot", () => ({ id: "topics", type: "topics" as const, hidden: false, kind: "unordered" as const, items: [topicItem("topic", [blocks()])] })],
    ["nested TopicItem ContentSlot", () => ({ id: "topics", type: "topics" as const, hidden: false, kind: "unordered" as const, items: [topicItem("topic", [], [topicItem("nested", [blocks()])])] })],
    ["Table header ContentSlot", () => table("header-table", [blocks()])],
    ["Table cell ContentSlot", () => table("cell-table", [], [blocks()])],
  ])("renews Blocks graph in %s while preserving B2 structure", (_name, makeElement) => {
    const element = makeElement();
    const source = slide([element]);
    const copy = duplicateSlideWithUniqueIds(source, [source]);
    const copiedJson = JSON.stringify(copy);
    expect(copiedJson).toContain("scope-copy");
    expect(copiedJson).toContain("value-copy");
    expect(source).toEqual(slide([element]));
    if (element.type === "topics") {
      expect(copy.elements[0]?.id).toBe("topics-copy");
      expect(copy.elements[0]?.type === "topics" && copy.elements[0].items[0]?.id).toBe("topic");
      expect(copy.elements[0]?.type === "topics" && copy.elements[0].items[0]?.content.id).toBe("topic-slot");
    }
    if (element.type === "table" && element.mode === "structured") {
      expect(copy.elements[0]?.id).toBe(`${element.id}-copy`);
      const copiedTable = copy.elements[0];
      expect(copiedTable?.type === "table" && copiedTable.mode === "structured" && copiedTable.columns[0]?.id).toBe(`${element.id}-column`);
    }
  });

  it("preserves unrelated ContentSlot elements and nested Container/Topics/Table ids while renewing Blocks", () => {
    const nestedTopics = { id: "nested-topics", type: "topics" as const, hidden: false, kind: "unordered" as const, items: [topicItem("nested-topic", [blocks()])] };
    const nestedTable = table("nested-table", [blocks()]);
    const container = { id: "slot-container", type: "container" as const, hidden: false, direction: "column" as const, children: [text("unrelated"), blocks(), nestedTopics, nestedTable] };
    const topic = { id: "topics", type: "topics" as const, hidden: false, kind: "unordered" as const, items: [topicItem("topic", [container])] };
    const source = slide([topic]);
    const copy = duplicateSlideWithUniqueIds(source, [source]);
    const json = JSON.stringify(copy);
    expect(json).toContain('"id":"unrelated"');
    expect(json).toContain('"id":"slot-container"');
    expect(json).toContain('"id":"nested-topics"');
    expect(json).toContain('"id":"nested-table"');
    expect((copy.elements[0] as typeof topic).id).toBe("topics-copy");
    expect(json.match(/scope-copy/g)?.length).toBe(3);
    expect(json.match(/value-copy/g)?.length).toBe(3);
  });

  it("uses collision-safe -copy-2 IDs for BlockItems and parts", () => {
    const source = slide([blocks(), text("scope-copy", "collision"), text("scope-part-copy", "collision"), text("value-copy", "collision"), text("value-part-copy", "collision")]);
    const copy = duplicateSlideWithUniqueIds(source, [source]);
    const copied = blockFrom(copy.elements);
    expect(copied.items[0]?.id).toBe("scope-copy-2");
    expect(copied.items[0]?.parts[0]?.id).toBe("scope-part-copy-2");
    const socket = copied.items[0]?.parts[1];
    if (socket?.type === "socket" && socket.content.type === "block") {
      expect(socket.content.block.id).toBe("value-copy-2");
      expect(socket.content.block.parts[0]?.id).toBe("value-part-copy-2");
    }
  });

  it("duplicates ordinary Blocks elements without changing category identity", () => {
    const source = blocks();
    const copy = duplicateElement(source, [slide([source])]);
    expect(copy.type).toBe("blocks");
    if (copy.type === "blocks") expect(copy.categories).toEqual(source.categories);
  });
});
