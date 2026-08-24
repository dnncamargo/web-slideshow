import { describe, expect, it } from "vitest";

import type {
  ContentSlot,
  ImageElement,
  PowerShowElement,
  Slide,
  StructuredTableElement,
  TopicItem,
  TopicsElement,
} from "@powershow/document-schema";

import {
  addColumnToStructuredTable,
  addRowToStructuredTable,
  appendElementToContentSlot,
  createElement,
  duplicateElement,
  findElementSiblingPosition,
  moveElement,
  removeColumnFromStructuredTable,
  removeElementById,
  removeRowFromStructuredTable,
  resolveAddElementDestination,
  setStructuredTableShowHeader,
} from "../src/features/editor/element-operations";

import {
  collectAuthoringIds,
  findContentSlotById,
  findElementById,
  findElementLocation,
  someElement,
  updateElementById,
} from "../src/features/editor/element-hierarchy";

function text(id: string, content = id): PowerShowElement {
  return {
    type: "text",
    id,
    hidden: false,
    variant: "body",
    content,
  };
}

function image(id: string): ImageElement {
  return {
    type: "image",
    id,
    hidden: false,
    src: `/assets/${id}.png`,
    alt: id,
    fit: "contain",
  };
}

function container(id: string, children: PowerShowElement[] = []): PowerShowElement {
  return {
    type: "container",
    id,
    hidden: false,
    children,
  };
}

function contentSlot(id: string, children: PowerShowElement[] = []): ContentSlot {
  return {
    id,
    children,
  };
}

function structuredTable(
  overrides: Partial<Omit<StructuredTableElement, "type">> = {},
): StructuredTableElement {
  return {
    type: "table",
    id: "table-1",
    mode: "structured",
    showHeader: true,
    hidden: false,
    columns: [
      { id: "col-1", header: { id: "hdr-1", children: [text("hdr-text-1", "H1")] } },
      { id: "col-2", header: { id: "hdr-2", children: [text("hdr-text-2", "H2")] } },
    ],
    rows: [
      {
        id: "row-1",
        cells: [
          { id: "cell-1-1", children: [text("cell-text-1-1", "C1")] },
          { id: "cell-1-2", children: [text("cell-text-1-2", "C2")] },
        ],
      },
      {
        id: "row-2",
        cells: [
          { id: "cell-2-1", children: [text("cell-text-2-1", "C3")] },
          { id: "cell-2-2", children: [text("cell-text-2-2", "C4")] },
        ],
      },
    ],
    ...overrides,
  };
}

function slide(elements: PowerShowElement[]): Slide {
  return {
    id: "slide",
    title: "",
    summary: "",
    speakerNotes: "",
    elements,
  };
}

function collectIds(element: PowerShowElement): string[] {
  const ids = new Set<string>();
  collectAuthoringIds(element, ids);
  return [...ids];
}

function countElementOccurrences(
  elements: readonly PowerShowElement[],
  id: string,
): number {
  let count = 0;

  for (const element of elements) {
    if (element.id === id) {
      count += 1;
    }

    if (element.type === "container") {
      count += countElementOccurrences(element.children, id);
      continue;
    }

    if (isStructured(element)) {
      count += countSlotsOccurrences(structuredTableSlots(element), id);
    }

    if (element.type === "topics") {
      for (const item of element.items) {
        count += countElementOccurrences(item.content.children, id);
      }
    }
  }

  return count;
}

function isStructured(element: PowerShowElement): element is StructuredTableElement {
  return element.type === "table" && element.mode === "structured";
}

function structuredTableSlots(table: StructuredTableElement): ContentSlot[] {
  const slots: ContentSlot[] = [];

  for (const column of table.columns) {
    slots.push(column.header);
  }

  for (const row of table.rows) {
    slots.push(...row.cells);
  }

  return slots;
}

function countSlotsOccurrences(slots: readonly ContentSlot[], id: string): number {
  let count = 0;

  for (const slot of slots) {
    count += countElementOccurrences(slot.children, id);
  }

  return count;
}

function topicItem(
  id: string,
  slot: ContentSlot,
  children: TopicItem[] = [],
): TopicItem {
  return { id, content: slot, children };
}

function topics(id: string, items: TopicItem[]): TopicsElement {
  return {
    type: "topics",
    id,
    hidden: false,
    kind: "unordered",
    items,
  };
}

describe("structured table hierarchy traversal", () => {
  it("finds an element nested inside a Structured header", () => {
    const location = findElementLocation(
      [structuredTable()],
      "hdr-text-2",
      { kind: "slide" },
    );

    expect(location).toMatchObject({
      index: 0,
      parentRef: { kind: "content-slot", id: "hdr-2" },
    });
  });

  it("finds an element nested inside a Structured body cell", () => {
    const found = findElementById([structuredTable()], "cell-text-2-1");
    expect(found?.id).toBe("cell-text-2-1");

    const location = findElementLocation([structuredTable()], "cell-text-2-1");
    expect(location?.parentRef).toEqual({
      kind: "content-slot",
      id: "cell-2-1",
    });
  });

  it("finds a nested Container inside a body cell", () => {
    const table = structuredTable({
      rows: [
        {
          id: "row-1",
          cells: [
            { id: "cell-1-1", children: [container("inner", [text("deep")])] },
            { id: "cell-1-2", children: [] },
          ],
        },
      ],
    });

    const found = findElementById([table], "deep");
    expect(found?.id).toBe("deep");

    const location = findElementLocation([table], "inner");
    expect(location?.parentRef).toEqual({
      kind: "content-slot",
      id: "cell-1-1",
    });
  });

  it("finds a nested Structured Table inside a body cell when recursion permits", () => {
    const inner = structuredTable({
      id: "inner-table",
      columns: [
        {
          id: "inner-col-1",
          header: {
            id: "inner-hdr-1",
            children: [text("inner-toggle", "IH")],
          },
        },
      ],
      rows: [
        {
          id: "inner-row-1",
          cells: [
            {
              id: "inner-cell-1-1",
              children: [text("inner-cell-text-1-1", "IC")],
            },
          ],
        },
      ],
    });

    const outer = structuredTable({
      rows: [
        {
          id: "row-1",
          cells: [
            { id: "cell-1-1", children: [inner] },
            { id: "cell-1-2", children: [] },
          ],
        },
      ],
    });

    const found = findElementById([outer], "inner-cell-text-1-1");
    expect(found?.id).toBe("inner-cell-text-1-1");

    const innerHeaderSlot = findContentSlotById([outer], "inner-hdr-1");
    expect(innerHeaderSlot?.id).toBe("inner-hdr-1");

    const innerBodySlot = findContentSlotById([outer], "inner-cell-1-1");
    expect(innerBodySlot?.id).toBe("inner-cell-1-1");
  });

  it("updates an element inside a body cell immutably", () => {
    const table = structuredTable();
    const updated = updateElementById([table], "cell-text-1-2", (element) =>
      element.type === "text" ? { ...element, content: "updated" } : element,
    );

    expect(updated).not.toBe([table]);
    const updatedTable = updated[0];
    if (isStructured(updatedTable)) {
      const cell = updatedTable.rows[0]?.cells[1];
      expect(cell?.children[0]).toMatchObject({ content: "updated" });
    }
  });

  it("removes an element inside a body cell while keeping other slots intact", () => {
    const table = structuredTable();
    const result = removeElementById([table], "cell-text-1-1");

    const resultingTable = result[0];
    if (isStructured(resultingTable)) {
      expect(
        resultingTable.rows[0]?.cells[0]?.children.map((element) => element.id),
      ).toEqual([]);
      expect(
        resultingTable.rows[0]?.cells[1]?.children.map((element) => element.id),
      ).toEqual(["cell-text-1-2"]);
    }
  });

  it("appends an element to a Structured header ContentSlot", () => {
    const table = structuredTable();
    const result = appendElementToContentSlot(
      [table],
      "hdr-1",
      image("added"),
    );

    const resultingTable = result[0];
    if (isStructured(resultingTable)) {
      expect(
        resultingTable.columns[0]?.header.children.map((element) => element.id),
      ).toEqual(["hdr-text-1", "added"]);
    }
  });

  it("appends an element to a Structured body ContentSlot", () => {
    const table = structuredTable();
    const result = appendElementToContentSlot(
      [table],
      "cell-2-2",
      image("added"),
    );

    const resultingTable = result[0];
    if (isStructured(resultingTable)) {
      expect(
        resultingTable.rows[1]?.cells[1]?.children.map((element) => element.id),
      ).toEqual(["cell-text-2-2", "added"]);
    }
  });

  it("reorders siblings inside a Structured ContentSlot through generic operations", () => {
    const table = structuredTable({
      rows: [
        {
          id: "row-1",
          cells: [
            {
              id: "cell-1-1",
              children: [text("first"), text("second"), image("third")],
            },
            { id: "cell-1-2", children: [] },
          ],
        },
      ],
    });

    expect(findElementSiblingPosition([table], "second")).toMatchObject({
      index: 1,
      count: 3,
      parentRef: { kind: "content-slot", id: "cell-1-1" },
    });

    const moved = moveElement([table], {
      elementId: "second",
      targetParentRef: { kind: "content-slot", id: "cell-1-1" },
      targetIndex: 0,
    });

    expect(moved.moved).toBe(true);
    const resultingTable = moved.elements[0];
    if (isStructured(resultingTable)) {
      expect(
        resultingTable.rows[0]?.cells[0]?.children.map((element) => element.id),
      ).toEqual(["second", "first", "third"]);
    }
  });

  it("collects all Structured Table structural and content IDs", () => {
    const ids = collectIds(structuredTable());

    for (const expected of [
      "table-1",
      "col-1",
      "col-2",
      "hdr-1",
      "hdr-2",
      "hdr-text-1",
      "hdr-text-2",
      "row-1",
      "row-2",
      "cell-1-1",
      "cell-1-2",
      "cell-2-1",
      "cell-2-2",
      "cell-text-1-1",
      "cell-text-1-2",
      "cell-text-2-1",
      "cell-text-2-2",
    ]) {
      expect(ids).toContain(expected);
    }

    expect(ids).toHaveLength(17);
  });

  it("reports a predicate from nested Table slots via someElement", () => {
    const table = structuredTable();
    expect(someElement([table], (element) => element.id === "cell-text-2-2")).toBe(
      true,
    );
    expect(someElement([table], (element) => element.id === "missing")).toBe(
      false,
    );
  });

  it("duplicates a Structured Table without reusing any structural or content ID", () => {
    const table = structuredTable();
    const slides = [slide([table])];

    const duplicate = duplicateElement(table, slides);
    const sourceIds = collectIds(table);
    const duplicateIds = collectIds(duplicate);

    expect(duplicate.type).toBe("table");
    if (duplicate.type === "table" && duplicate.mode === "structured") {
      expect(duplicate.columns).toHaveLength(2);
      expect(duplicate.rows).toHaveLength(2);
      expect(duplicate.showHeader).toBe(true);
    }

    expect(duplicateIds.some((id) => sourceIds.includes(id))).toBe(false);
  });

  it("findContentSlotById locates header and body slots", () => {
    const table = structuredTable();

    expect(findContentSlotById([table], "hdr-1")?.id).toBe("hdr-1");
    expect(findContentSlotById([table], "cell-2-1")?.id).toBe("cell-2-1");
    expect(findContentSlotById([table], "missing")).toBeNull();
  });

  it("allows a TopicsElement inside a Structured Table ContentSlot", () => {
    const table = structuredTable();
    const elements = [table];

    const addedTopics: TopicsElement = {
      type: "topics",
      id: "autonomous-topics",
      hidden: false,
      kind: "unordered",
      items: [
        topicItem("topic-a", contentSlot("slot-a", [text("topic-a-text")])),
      ],
    };

    const result = appendElementToContentSlot(
      elements,
      "cell-1-1",
      addedTopics,
    );

    expect(result).not.toBe(elements);
    expect(findElementById(result, "autonomous-topics")?.id).toBe(
      "autonomous-topics",
    );
    expect(countElementOccurrences(result, "autonomous-topics")).toBe(1);
  });

  it("keeps Topic ContentSlots distinguishable from Structured Table slots", () => {
    const table = structuredTable({
      rows: [
        {
          id: "row-1",
          cells: [
            {
              id: "cell-1-1",
              children: [
                topics("nested-topics", [
                  topicItem("topic-a", contentSlot("slot-a", [text("t1")])),
                ]),
              ],
            },
            { id: "cell-1-2", children: [] },
          ],
        },
      ],
    });

    // A TopicsElement must still be refused inside the nested TopicItem slot.
    const addedTopics: TopicsElement = {
      type: "topics",
      id: "bad-topics",
      hidden: false,
      kind: "unordered",
      items: [],
    };

    const elements = [table];

    const refused = appendElementToContentSlot(
      elements,
      "slot-a",
      addedTopics,
    );

    expect(refused).toBe(elements);
    expect(findElementById(refused, "bad-topics")).toBeNull();
  });

  it("resolves a Table ContentSlot to a generic ContentSlot insertion destination", () => {
    const table = structuredTable();

    expect(
      resolveAddElementDestination([table], "table-1", image("new"), "cell-1-1"),
    ).toEqual({ kind: "append-content-slot", contentSlotId: "cell-1-1" });

    expect(
      resolveAddElementDestination([table], "table-1", image("new"), "hdr-2"),
    ).toEqual({ kind: "append-content-slot", contentSlotId: "hdr-2" });
  });

  it("rejects a ContentSlot id that does not belong to the selected table", () => {
    const table = structuredTable();

    expect(
      resolveAddElementDestination([table], "table-1", image("new"), "stale-slot"),
    ).toEqual({ kind: "insert-after", targetId: "table-1" });
  });

  it("does not guess a Table cell without an explicit ContentSlot context", () => {
    const table = structuredTable();

    expect(
      resolveAddElementDestination([table], "table-1", image("new")),
    ).toEqual({ kind: "insert-after", targetId: "table-1" });
  });
});

describe("structured table creation and structure", () => {
  it("creates a new Table as a Structured Table", () => {
    const created = createElement("table", [slide([])]);

    expect(created.type).toBe("table");
    if (created.type === "table") {
      expect(created.mode).toBe("structured");
    }
  });

  it("creates a rectangular default Structured Table", () => {
    const created = createElement("table", [slide([])]);

    if (created.type !== "table" || created.mode !== "structured") {
      throw new Error("Expected a Structured Table");
    }

    expect(created.columns).toHaveLength(1);
    expect(created.rows).toHaveLength(1);
    expect(created.rows[0]?.cells).toHaveLength(created.columns.length);
    expect(created.showHeader).toBe(true);
  });

  it("creates unique structural and child IDs for the default Table", () => {
    const created = createElement("table", [slide([])]);

    expect(created.type).toBe("table");
    if (created.type === "table" && created.mode === "structured") {
      const ids = collectIds(created);
      const distinct = new Set(ids);

      expect(distinct.size).toBe(ids.length);
      expect(ids).toContain("table-element");
      expect(ids).toContain("table-column");
      expect(ids).toContain("table-header-slot");
      expect(ids).toContain("table-header-text");
      expect(ids).toContain("table-row");
      expect(ids).toContain("table-cell-slot");
      expect(ids).toContain("table-cell-text");
    }
  });

  it("adds a column preserving every row length", () => {
    let slides = [
      slide([structuredTable()]),
    ];
    const tableId = "table-1";

    slides = addColumnToStructuredTable(slides, tableId);

    const table = slides[0]?.elements[0];

    if (table?.type === "table" && table.mode === "structured") {
      expect(table.columns).toHaveLength(3);
      for (const row of table.rows) {
        expect(row.cells).toHaveLength(3);
      }
    }
  });

  it("removes a column preserving every row length", () => {
    let slides = [slide([structuredTable()])];
    slides = removeColumnFromStructuredTable(slides, "table-1", 1);

    const table = slides[0]?.elements[0];
    if (table?.type === "table" && table.mode === "structured") {
      expect(table.columns).toHaveLength(1);
      for (const row of table.rows) {
        expect(row.cells).toHaveLength(1);
      }
      expect(table.columns[0]?.id).toBe("col-1");
    }
  });

  it("adds a row producing one cell per column", () => {
    let slides = [slide([structuredTable()])];
    slides = addRowToStructuredTable(slides, "table-1");

    const table = slides[0]?.elements[0];
    if (table?.type === "table" && table.mode === "structured") {
      expect(table.rows).toHaveLength(3);
      const newRow = table.rows[2];
      expect(newRow?.cells).toHaveLength(table.columns.length);
    }
  });

  it("adds a row with zero columns producing cells: []", () => {
    let slides = [
      slide([
        structuredTable({ columns: [], rows: [] }),
      ]),
    ];

    slides = addRowToStructuredTable(slides, "table-1");

    const table = slides[0]?.elements[0];
    if (table?.type === "table" && table.mode === "structured") {
      expect(table.rows).toHaveLength(1);
      expect(table.rows[0]?.cells).toEqual([]);
    }
  });

  it("removes a row preserving columns", () => {
    let slides = [slide([structuredTable()])];
    slides = removeRowFromStructuredTable(slides, "table-1", 0);

    const table = slides[0]?.elements[0];
    if (table?.type === "table" && table.mode === "structured") {
      expect(table.rows).toHaveLength(1);
      expect(table.columns).toHaveLength(2);
      expect(table.rows[0]?.id).toBe("row-2");
    }
  });

  it("showHeader toggle preserves header slot identity and content", () => {
    const table = structuredTable();
    const headerBefore = table.columns[0]?.header;
    const headerTextBefore = headerBefore?.children[0];

    const slides = setStructuredTableShowHeader([slide([table])], "table-1", false);

    const resultingTable = slides[0]?.elements[0];
    if (resultingTable?.type === "table" && resultingTable.mode === "structured") {
      expect(resultingTable.showHeader).toBe(false);
      expect(resultingTable.columns[0]?.header!.id).toBe(headerBefore?.id);
      expect(resultingTable.columns[0]?.header!.children[0]).toBe(headerTextBefore);
    }
  });

  it("preserves canonical ContentSlot metadata when adding a child", () => {
    const metadata = {
      layout: { padding: "12px" },
      style: { color: "#fff", background: { color: "#111827" }, borderRadius: "4px", className: "slot" },
      typography: { fontSize: "1rem", fontWeight: 600 },
    } as const;
    const table = structuredTable({
      columns: [{ id: "col-1", header: { id: "hdr-1", children: [], ...metadata } }],
      rows: [{ id: "row-1", cells: [{ id: "cell-1-1", children: [], ...metadata }] }],
    });
    const result = appendElementToContentSlot([table], "cell-1-1", text("new"))[0];
    expect(result?.type === "table" && result.mode === "structured" ? result.rows[0]?.cells[0] : undefined).toMatchObject(metadata);
  });
});
