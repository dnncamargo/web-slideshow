import { describe, expect, it } from "vitest";

import type { PresentationElement, Slide } from "@web-slideshow/document-schema";

import { allocateDuplicateId } from "../src/features/editor/duplicate-id";
import { duplicateElement } from "../src/features/editor/element-operations";
import { duplicateSlideWithUniqueIds } from "../src/features/editor/slide-operations";

function text(id: string): PresentationElement {
  return { id, type: "text", hidden: false, variant: "body", content: id };
}

describe("duplicate ID genealogy", () => {
  it("allocates the next stable family ID from an existing duplicate", () => {
    const usedIds = new Set([
      "slide",
      "slide-copy",
      "slide-copy-3",
    ]);

    expect(allocateDuplicateId("slide", usedIds)).toBe("slide-copy-2");
    expect(allocateDuplicateId("slide-copy", usedIds)).toBe("slide-copy-4");
    expect(allocateDuplicateId("slide-copy-2", usedIds)).toBe("slide-copy-5");
  });

  it("normalizes malformed trailing duplicate genealogy only for the new ID", () => {
    const usedIds = new Set([
      "slide",
      "slide-copy",
      "slide-copy-2",
      "slide-copy-3",
    ]);

    expect(allocateDuplicateId("slide-copy-2-copy-copy-3", usedIds)).toBe("slide-copy-4");
    expect(allocateDuplicateId("copy-machine", new Set())).toBe("copy-machine-copy");
    expect(allocateDuplicateId("my-copycat", new Set())).toBe("my-copycat-copy");
    expect(allocateDuplicateId("topic-copy-value", new Set())).toBe("topic-copy-value-copy");
  });

  it("normalizes repeated element duplicates without mutating the source", () => {
    const source: PresentationElement = {
      id: "image-1",
      type: "image",
      hidden: false,
      src: "/image.png",
      alt: "Image",
      fit: "cover",
    };
    const usedIds = new Set([source.id]);

    const first = duplicateElement(source, usedIds);
    const second = duplicateElement(first, usedIds);

    expect(first.id).toBe("image-1-copy");
    expect(second.id).toBe("image-1-copy-2");
    expect(source.id).toBe("image-1");
  });

  it("renews recursive container, Topics, and Structured Table IDs", () => {
    const source: PresentationElement = {
      id: "container-copy-2-copy-copy-3",
      type: "container",
      hidden: false,
      children: [
        {
          id: "nested-copy-2",
          type: "container",
          hidden: false,
          children: [text("nested-text-copy-2")],
        },
        {
          id: "topics-copy-2",
          type: "topics",
          hidden: false,
          kind: "unordered",
          items: [{
            id: "topic-item-copy-2",
            content: {
              id: "topic-slot-copy-2",
              children: [text("topic-text-copy-2")],
            },
            children: [],
          }],
        },
        {
          id: "table-copy-2",
          type: "table",
          mode: "structured",
          hidden: false,
          showHeader: true,
          columns: [{
            id: "column-copy-2",
            header: { id: "header-slot-copy-2", children: [text("header-text-copy-2")] },
          }],
          rows: [{
            id: "row-copy-2",
            cells: [{ id: "cell-slot-copy-2", children: [text("cell-text-copy-2")] }],
          }],
        },
      ],
    };
    const duplicate = duplicateElement(source, new Set());

    expect(duplicate.id).toBe("container-copy");
    expect(duplicate.type).toBe("container");
    if (duplicate.type !== "container") return;

    const nested = duplicate.children[0];
    const topics = duplicate.children[1];
    const table = duplicate.children[2];
    expect(nested?.id).toBe("nested-copy");
    expect(nested?.type === "container" && nested.children[0]?.id).toBe("nested-text-copy");
    expect(topics?.id).toBe("topics-copy");
    expect(topics?.type === "topics" && topics.items[0]?.id).toBe("topic-item-copy");
    expect(topics?.type === "topics" && topics.items[0]?.content.id).toBe("topic-slot-copy");
    expect(topics?.type === "topics" && topics.items[0]?.content.children[0]?.id).toBe("topic-text-copy");
    expect(table?.id).toBe("table-copy");
    if (table?.type !== "table" || table.mode !== "structured") return;
    expect(table.columns[0]?.id).toBe("column-copy");
    expect(table.columns[0]?.header.id).toBe("header-slot-copy");
    expect(table.columns[0]?.header.children[0]?.id).toBe("header-text-copy");
    expect(table.rows[0]?.id).toBe("row-copy");
    expect(table.rows[0]?.cells[0]?.id).toBe("cell-slot-copy");
    expect(table.rows[0]?.cells[0]?.children[0]?.id).toBe("cell-text-copy");
  });

  it("normalizes slide and descendant roots while preserving title and slide clone boundaries", () => {
    const source: Slide = {
      id: "slide-copy-2-copy-copy-3",
      title: "Demo",
      summary: "summary",
      speakerNotes: "notes",
      background: { color: "#0b1020" },
      elements: [{
        id: "container-copy-2",
        type: "container",
        hidden: false,
        children: [{
          id: "image-1-copy-3",
          type: "image",
          hidden: false,
          src: "/image.png",
          alt: "Image",
          fit: "cover",
        }],
      }],
    };
    const duplicate = duplicateSlideWithUniqueIds(source, new Set());

    expect(duplicate.id).toBe("slide-copy");
    expect(duplicate.title).toBe("Demo copy");
    expect(duplicate.elements[0]?.id).toBe("container-copy");
    expect(duplicate.elements[0]?.type === "container" && duplicate.elements[0].children[0]?.id).toBe("image-1-copy");
  });
});
