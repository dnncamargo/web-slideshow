import { describe, expect, it } from "vitest";

import type { PresentationElement, StructuredTableElement } from "@web-slideshow/document-schema";
import {
  PresentationSchema,
  SYSTEM_TABLE_CELL_TEXT_STYLE_ID,
  SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID,
} from "@web-slideshow/document-schema";

import { replaceStructuredTableData } from "../src/features/editor/element-operations";
import type { ImportedTableData } from "../src/features/editor/table-structured-data-import";
import { collectPresentationAuthoringIds } from "../src/features/editor/presentation-authoring-trees";
import { presentationUsesFileResource } from "../src/features/editor/font-resource-helpers";
import { removeCustomLibraryFileFromPresentation } from "../src/features/custom-library/custom-library-file-apply";

function text(id: string, content: string): PresentationElement {
  return { type: "text", id, hidden: false, variant: "body", content };
}

function table(): StructuredTableElement {
  return {
    type: "table",
    id: "table",
    mode: "structured",
    hidden: false,
    showHeader: false,
    layout: { width: "80%", height: "60%" },
    style: { headerBackground: "#123456" },
    effect: { opacity: 0.8 },
    linkedStyleId: "linked-table-style",
    columns: [{ id: "old-column", header: { id: "old-header", children: [text("old-header-text", "Old")] } }],
    rows: [{ id: "old-row", cells: [{ id: "old-cell", children: [text("old-cell-text", "Old value")] }] }],
  };
}

const data: ImportedTableData = {
  columns: ["Name", "Score"],
  rows: [["Alice", "10"], ["Bob", "20"]],
};

describe("Structured Table imported data materialization", () => {
  it("replaces only columns and rows, preserving table state and creating canonical IDs/styles", () => {
    const presentation = PresentationSchema.parse({
      schemaVersion: 1,
      id: "presentation",
      title: "Materialization",
      slides: [{ id: "slide", title: "Slide", elements: [table()] }],
      textStyles: [],
      linkedStyles: [{ target: "table", mode: "structured", id: "linked-table-style", name: "Linked table", style: { headerBackground: "#123456" } }],
    });
    const ids = collectPresentationAuthoringIds(presentation);
    const originalIds = new Set(ids);
    const elements = replaceStructuredTableData(presentation.slides[0]!.elements, "table", data, "source.csv", ids);
    const imported = elements[0];
    if (imported?.type !== "table" || imported.mode !== "structured") throw new Error("Expected Structured Table");

    expect(imported.id).toBe("table");
    expect(imported.showHeader).toBe(false);
    expect(imported.layout).toEqual({ width: "80%", height: "60%" });
    expect(imported.style).toEqual({ headerBackground: "#123456" });
    expect(imported.effect).toEqual({ opacity: 0.8 });
    expect(imported.linkedStyleId).toBe("linked-table-style");
    expect(imported.importSourceFileResourceId).toBe("source.csv");
    expect(imported.columns.map((column) => column.header.children[0])).toMatchObject([
      { type: "text", content: "Name", variant: SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID },
      { type: "text", content: "Score", variant: SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID },
    ]);
    expect(imported.rows.map((row) => row.cells.map((cell) => cell.children[0]))).toMatchObject([
      [{ type: "text", content: "Alice", variant: SYSTEM_TABLE_CELL_TEXT_STYLE_ID }, { type: "text", content: "10", variant: SYSTEM_TABLE_CELL_TEXT_STYLE_ID }],
      [{ type: "text", content: "Bob", variant: SYSTEM_TABLE_CELL_TEXT_STYLE_ID }, { type: "text", content: "20", variant: SYSTEM_TABLE_CELL_TEXT_STYLE_ID }],
    ]);
    expect(imported.rows.every((row) => row.cells.length === imported.columns.length)).toBe(true);

    const generatedIds = [
      ...imported.columns.flatMap((column) => [column.id, column.header.id, ...column.header.children.map((child) => child.id)]),
      ...imported.rows.flatMap((row) => [row.id, ...row.cells.flatMap((cell) => [cell.id, ...cell.children.map((child) => child.id)])]),
    ];
    expect(new Set(generatedIds).size).toBe(generatedIds.length);
    expect(generatedIds.some((id) => originalIds.has(id))).toBe(false);
    expect(imported.columns.some((column) => column.id === "old-column")).toBe(false);
    expect(imported.rows.some((row) => row.id === "old-row")).toBe(false);
  });

  it("does not change a Simple Table or an invalid rectangular dataset", () => {
    const simple: PresentationElement = {
      type: "table",
      id: "simple",
      hidden: false,
      columns: [{ key: "value", label: "Value" }],
      rows: [{ value: "old" }],
    };
    const invalid: ImportedTableData = { columns: ["a", "b"], rows: [["one"]] };
    const simpleElements = [simple];
    const structuredElements = [table()];
    expect(replaceStructuredTableData(simpleElements, "simple", data, "source.csv", new Set())).toBe(simpleElements);
    expect(replaceStructuredTableData(structuredElements, "table", invalid, "source.csv", new Set())).toBe(structuredElements);
    expect(replaceStructuredTableData(structuredElements, "missing", data, "source.csv", new Set())).toBe(structuredElements);
    expect(replaceStructuredTableData(structuredElements, "table", data, "   ", new Set())).toBe(structuredElements);
    expect(structuredElements[0]).toEqual(table());

    const provenanceElements = [{ ...table(), importSourceFileResourceId: "previous.csv" }];
    expect(replaceStructuredTableData(provenanceElements, "table", invalid, "next.csv", new Set())).toBe(provenanceElements);
    expect(provenanceElements[0]).toMatchObject({ importSourceFileResourceId: "previous.csv" });
  });

  it("does not make a source Structured Data File a runtime dependency", () => {
    const sourcePresentation = PresentationSchema.parse({
      schemaVersion: 1,
      id: "resource-lifecycle-presentation",
      title: "Resource lifecycle",
      slides: [{ id: "slide", title: "Slide", elements: [table()] }],
      textStyles: [
        { id: SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID, name: "Column header", role: "body" },
        { id: SYSTEM_TABLE_CELL_TEXT_STYLE_ID, name: "Table cell", role: "body" },
      ],
      linkedStyles: [{ target: "table", mode: "structured", id: "linked-table-style", name: "Linked table", style: { headerBackground: "#123456" } }],
      resources: {
        files: [{
          id: "source.csv",
          name: "source.csv",
          kind: "structured-data",
          representation: "text",
          contentType: "text/csv",
          source: { type: "text", content: "a\n1" },
        }],
      },
    });
    const ids = collectPresentationAuthoringIds(sourcePresentation);
    const materializedElements = replaceStructuredTableData(sourcePresentation.slides[0]!.elements, "table", data, "source.csv", ids);
    const materializedTable = materializedElements[0];
    const snapshot = PresentationSchema.parse({
      ...sourcePresentation,
      slides: [{ ...sourcePresentation.slides[0]!, elements: materializedElements }],
    });
    expect(materializedTable?.type).toBe("table");
    expect(materializedTable && materializedTable.type === "table" && materializedTable.mode === "structured" ? materializedTable.importSourceFileResourceId : undefined).toBe("source.csv");
    expect(presentationUsesFileResource(snapshot, "source.csv")).toBe(false);

    const removed = removeCustomLibraryFileFromPresentation(snapshot, "source.csv");
    expect(removed.kind).toBe("removed");
    if (removed.kind !== "removed") return;
    expect(removed.presentation.resources).toBeUndefined();
    expect(removed.presentation.slides[0]?.elements[0]).toEqual(materializedTable);
  });
});
