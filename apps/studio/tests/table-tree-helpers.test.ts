import { describe, expect, it } from "vitest";

import type { ContentSlot, PowerShowElement, StructuredTableElement } from "@powershow/document-schema";

import { translateStudioMessage } from "../src/features/i18n/studio-i18n";
import {
  getStructuredColumnDescription,
  getStructuredRowDescription,
} from "../src/features/editor/table-tree-helpers";

const t = (key: Parameters<typeof translateStudioMessage>[1], values?: Parameters<typeof translateStudioMessage>[2]) =>
  translateStudioMessage("en", key, values);

function text(id: string, content: string): PowerShowElement {
  return { type: "text", id, hidden: false, variant: "body", content };
}

function image(id: string): PowerShowElement {
  return { type: "image", id, hidden: false, src: `/assets/${id}.png`, alt: id, fit: "contain" };
}

function slot(id: string, children: PowerShowElement[]): ContentSlot {
  return { id, children };
}

function table(overrides: Partial<StructuredTableElement> = {}): StructuredTableElement {
  return {
    type: "table",
    id: "table",
    mode: "structured",
    hidden: false,
    showHeader: false,
    columns: [{ id: "column", header: slot("header", [text("header-text", "Header")]) }],
    rows: [{ id: "row", cells: [slot("first", [text("first-text", "First")]), slot("later", [text("later-text", "Later")])] }],
    ...overrides,
  };
}

describe("table tree description helpers", () => {
  it("uses only the column header and only the first body cell", () => {
    const value = table({
      columns: [{ id: "column", header: slot("header", []) }],
      rows: [{ id: "row", cells: [slot("first", []), slot("later", [text("later-text", "Later")])] }],
    });
    expect(getStructuredColumnDescription(value, 0, t)).toBeNull();
    expect(getStructuredRowDescription(value.rows[0]!, t)).toBeNull();
  });

  it("summarizes text, images, and mixed content in encounter order", () => {
    const value = table({
      columns: [{ id: "column", header: slot("header", [image("header-image"), text("header-text", "Header")]) }],
      rows: [{ id: "row", cells: [slot("first", [text("first-text", "First"), image("first-image"), image("first-image-2")])] }],
    });
    expect(getStructuredColumnDescription(value, 0, t)).toBe("Text + Image");
    expect(getStructuredRowDescription(value.rows[0]!, t)).toBe("Text + Image");
  });
});
