// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  SYSTEM_TABLE_CELL_TEXT_STYLE_ID,
  SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID,
  PresentationSchema,
  type Presentation,
  type PresentationElement,
} from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type StructuredTable = Extract<PresentationElement, { type: "table"; mode: "structured" }>;

function text(id: string, content: string): PresentationElement {
  return { type: "text", id, hidden: false, variant: "body", content };
}

function table(): StructuredTable {
  return {
    type: "table",
    id: "cp4d6-table",
    mode: "structured",
    hidden: false,
    showHeader: true,
    columns: [
      { id: "column-a", header: { id: "header-a", children: [text("header-a-text", "A")] } },
      { id: "column-b", header: { id: "header-b", children: [text("header-b-text", "B")] } },
      { id: "column-c", header: { id: "header-c", children: [text("header-c-text", "C")] } },
    ],
    rows: [
      {
        id: "row-1",
        cells: [
          { id: "cell-1-a", children: [text("cell-1-a-text", "1A")] },
          { id: "cell-1-b", children: [text("cell-1-b-text", "1B")] },
          { id: "cell-1-c", children: [text("cell-1-c-text", "1C")] },
        ],
      },
      {
        id: "row-2",
        cells: [
          { id: "cell-2-a", children: [text("cell-2-a-text", "2A")] },
          { id: "cell-2-b", children: [text("cell-2-b-text", "2B")] },
          { id: "cell-2-c", children: [text("cell-2-c-text", "2C")] },
        ],
      },
    ],
  };
}

function presentation(overrides: Partial<Presentation> = {}): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4d6-presentation",
    title: "CP4D6 structured table history",
    slides: [
      { id: "slide-1", title: "Slide 1", elements: [table()] },
      {
        id: "slide-2",
        title: "Collision slide",
        elements: [
          text("table-column", "collision"),
          text("table-header-slot", "collision"),
          text("table-header-text", "collision"),
          text("table-cell-slot", "collision"),
          text("table-text", "collision"),
          text("table-row", "collision"),
        ],
      },
    ],
    ...overrides,
  });
}

function getTable(snapshot: Presentation): StructuredTable {
  const element = snapshot.slides[0]?.elements[0];
  if (!element || element.type !== "table" || element.mode !== "structured") {
    throw new Error("Structured Table was not found");
  }
  return element;
}

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...options });
}

describe("CP4D6 Structured Table structure history", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: Presentation;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latest = presentation();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function mount(next = presentation()): Promise<void> {
    await act(async () => root.unmount());
    root = createRoot(container);
    latest = next;
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={next} onSave={async (snapshot) => { latest = snapshot; }} />
        </StudioI18nProvider>,
      );
    });
    await selectTable();
  }

  async function selectTable(): Promise<void> {
    const element = container.querySelector<HTMLElement>('[data-presentation-id="cp4d6-table"]');
    if (!element) throw new Error("table was not rendered");
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function save(): Promise<void> {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Save");
    if (!button) throw new Error("Save button was not rendered");
    await act(async () => button.click());
  }

  async function undo(): Promise<void> {
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
  }

  async function redo(): Promise<void> {
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
  }

  function button(selector: string): HTMLButtonElement {
    const result = container.querySelector<HTMLButtonElement>(selector);
    if (!result) throw new Error(`button ${selector} was not rendered`);
    return result;
  }

  function structuralSelection(id: string): HTMLButtonElement {
    const label = id === "column-a" ? "(A)"
      : id === "column-b" ? "(B)"
        : id === "column-c" ? "(C)"
          : id === "row-1" ? "(1A)"
            : "(2A)";
    const result = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.getAttribute("aria-label")?.includes(label))
      ?? (id === "row-1" || id === "row-2"
        ? Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
          .find((candidate) => candidate.getAttribute("aria-label")?.startsWith(id === "row-1" ? "Row 1" : "Row 2"))
        : undefined);
    if (!result) throw new Error(`structural selection ${id} was not rendered`);
    return result;
  }

  async function removeSelected(kind: "column" | "row", id: string): Promise<void> {
    await act(async () => structuralSelection(id).click());
    await act(async () => button(`[data-presentation-table-remove-${kind}]`).click());
    const confirm = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.startsWith(`Remove ${kind}`));
    if (!confirm) throw new Error("confirmation button was not rendered");
    await act(async () => confirm.click());
  }

  async function openElementsPanel(): Promise<void> {
    const elementsTab = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Elements");
    if (!elementsTab) throw new Error("Elements tab was not rendered");
    await act(async () => elementsTab.click());
  }

  async function openInspectorPanel(): Promise<void> {
    const inspectorTab = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Inspector");
    if (!inspectorTab) throw new Error("Inspector tab was not rendered");
    await act(async () => inspectorTab.click());
  }

  it("adds a column as one atomic action with styles, rectangular defaults, and exact replay IDs", async () => {
    await mount();
    const before = structuredClone(latest);

    await act(async () => button("[data-presentation-table-add-column]").click());
    await save();
    const added = getTable(latest);
    const addedColumn = added.columns[3];
    if (!addedColumn) throw new Error("added column was not created");
    const addedHeader = addedColumn.header.children[0];
    const addedCells = added.rows.map((row) => row.cells[3]);
    expect(added.columns).toHaveLength(4);
    expect(added.rows.every((row) => row.cells.length === added.columns.length)).toBe(true);
    expect(addedHeader).toMatchObject({ type: "text", content: "Column", variant: SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID });
    expect(addedCells.every((cell) => cell?.children[0]?.type === "text" && cell.children[0].content === "Value" && cell.children[0].variant === SYSTEM_TABLE_CELL_TEXT_STYLE_ID)).toBe(true);
    const generatedIds = [
      addedColumn.id,
      addedColumn.header.id,
      ...addedColumn.header.children.map((child) => child.id),
      ...addedCells.flatMap((cell) => cell ? [cell.id, ...cell.children.map((child) => child.id)] : []),
    ];
    expect(new Set(generatedIds).size).toBe(generatedIds.length);
    expect(latest.textStyles).toHaveLength(2);

    await undo();
    await save();
    expect(latest).toEqual(before);
    await redo();
    await save();
    expect(getTable(latest)).toEqual(added);
    expect(latest.textStyles?.map((style) => style.id)).toEqual([
      SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID,
      SYSTEM_TABLE_CELL_TEXT_STYLE_ID,
    ]);
  });

  it("adds rows with current column count, including zero columns, and replays exact IDs", async () => {
    await mount();
    await act(async () => button("[data-presentation-table-add-row]").click());
    await save();
    const added = getTable(latest);
    const addedRow = added.rows[2];
    if (!addedRow) throw new Error("added row was not created");
    expect(addedRow.cells).toHaveLength(added.columns.length);
    const addedRowSnapshot = structuredClone(addedRow);
    await undo();
    await redo();
    await save();
    expect(getTable(latest).rows[2]).toEqual(addedRowSnapshot);

    const zeroColumn = presentation({
      slides: [{ id: "slide-zero", title: "Zero", summary: "", speakerNotes: "", elements: [{ ...table(), columns: [], rows: [{ id: "zero-row", cells: [] }] }] }],
    });
    await mount(zeroColumn);
    await act(async () => button("[data-presentation-table-add-row]").click());
    await save();
    expect(getTable(latest).rows.at(-1)?.cells).toEqual([]);
  });

  it("preserves authored canonical styles and does not duplicate them", async () => {
    const authored = presentation({
      textStyles: [
        { id: SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID, name: "Authored header", role: "body", typography: { fontSize: "2rem" } },
        { id: SYSTEM_TABLE_CELL_TEXT_STYLE_ID, name: "Authored cell", role: "body", style: { color: "#123456" } },
      ],
    });
    await mount(authored);
    await act(async () => button("[data-presentation-table-add-column]").click());
    await save();
    expect(latest.textStyles).toEqual(authored.textStyles);
    expect(latest.textStyles?.filter((style) => style.id === SYSTEM_TABLE_CELL_TEXT_STYLE_ID)).toHaveLength(1);
  });

  it("removes columns and rows atomically, including last-item cases and exact subtree replay", async () => {
    await mount();
    const original = structuredClone(latest);
    const removedColumn = getTable(original).columns[1];
    if (!removedColumn) throw new Error("column missing");
    await removeSelected("column", "column-b");
    await save();
    expect(getTable(latest).columns.map((column) => column.id)).toEqual(["column-a", "column-c"]);
    expect(getTable(latest).rows.every((row) => row.cells.length === 2)).toBe(true);
    await undo();
    await save();
    expect(getTable(latest).columns[1]).toEqual(removedColumn);
    await redo();
    await save();
    expect(getTable(latest).columns.map((column) => column.id)).toEqual(["column-a", "column-c"]);

    await mount();
    await removeSelected("row", "row-1");
    await save();
    expect(getTable(latest).rows.map((row) => row.id)).toEqual(["row-2"]);
    await undo();
    await save();
    expect(getTable(latest).rows[0]).toEqual(getTable(original).rows[0]);

    const last = presentation({
      slides: [{ id: "slide-last", title: "Last", summary: "", speakerNotes: "", elements: [{ ...table(), columns: [table().columns[0]!], rows: [{ ...table().rows[0]!, cells: [table().rows[0]!.cells[0]!] }] }] }],
    });
    await mount(last);
    await removeSelected("column", "column-a");
    await save();
    expect(getTable(latest).columns).toEqual([]);
    expect(getTable(latest).rows.every((row) => row.cells.length === 0)).toBe(true);
    await removeSelected("row", "row-1");
    await save();
    expect(getTable(latest).rows).toEqual([]);
  });

  it("moves columns with aligned cells and moves complete rows as separate exact actions", async () => {
    await mount();
    await act(async () => structuralSelection("column-b").click());
    await openElementsPanel();
    await act(async () => button('button[aria-label="Move right"]').click());
    await save();
    expect(getTable(latest).columns.map((column) => column.id)).toEqual(["column-a", "column-c", "column-b"]);
    expect(getTable(latest).rows[0]?.cells.map((cell) => cell.id)).toEqual(["cell-1-a", "cell-1-c", "cell-1-b"]);
    await undo();
    await save();
    expect(getTable(latest).columns.map((column) => column.id)).toEqual(["column-a", "column-b", "column-c"]);
    await redo();
    await save();
    expect(getTable(latest).rows[1]?.cells.map((cell) => cell.id)).toEqual(["cell-2-a", "cell-2-c", "cell-2-b"]);

    await openInspectorPanel();
    await act(async () => structuralSelection("row-1").click());
    await openElementsPanel();
    await act(async () => button('button[aria-label="Move down"]').click());
    await save();
    expect(getTable(latest).rows.map((row) => row.id)).toEqual(["row-2", "row-1"]);
    expect(getTable(latest).rows[1]?.cells.map((cell) => cell.id)).toEqual(["cell-1-a", "cell-1-c", "cell-1-b"]);
    await undo();
    await save();
    expect(getTable(latest).rows.map((row) => row.id)).toEqual(["row-1", "row-2"]);
  });

  it("does not create history for invalid moves or stale removals", async () => {
    await mount();
    await act(async () => structuralSelection("column-a").click());
    await openElementsPanel();
    const invalidMove = button('button[aria-label="Move left"]');
    expect(invalidMove.disabled).toBe(true);
    const noOpUndo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(noOpUndo));
    expect(noOpUndo.defaultPrevented).toBe(false);

    await mount();
    await act(async () => structuralSelection("column-b").click());
    await openElementsPanel();
    await act(async () => button('button[aria-label="Move right"]').click());
    await openInspectorPanel();
    await act(async () => structuralSelection("column-b").click());
    await act(async () => button("[data-presentation-table-remove-column]").click());
    const staleConfirm = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.startsWith("Remove column"));
    if (!staleConfirm) throw new Error("confirmation button missing");
    await act(async () => staleConfirm.click());
    await save();
    expect(getTable(latest).columns.map((column) => column.id)).toEqual(["column-a", "column-c"]);
  });
});
