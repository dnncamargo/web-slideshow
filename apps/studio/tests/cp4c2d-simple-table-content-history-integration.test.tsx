// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type PresentationElement,
  type Presentation,
  type SimpleTableElement,
  type TextContent,
} from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { PresentationColorPaletteProvider } from "../src/features/editor/inspector/sections/presentation-color-palette";
import { TableInspector } from "../src/features/editor/inspector/table-inspector";
import type { TableAuthoringControls } from "../src/features/editor/inspector/inspector-types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const TABLE_ID = "cp4c2d-table";

const TABLE_CONTROLS: TableAuthoringControls = {
  onAddColumn: () => {},
  onRemoveColumn: () => {},
  onAddRow: () => {},
  onRemoveRow: () => {},
  onShowHeaderChange: () => {},
};

function tableElement(
  overrides: Partial<SimpleTableElement> = {},
): SimpleTableElement {
  return {
    type: "table",
    id: TABLE_ID,
    hidden: false,
    columns: [
      { key: "value", label: "Value" },
      { key: "count", label: "Count" },
      { key: "flag", label: "Flag" },
    ],
    rows: [
      { value: "First", count: 10, flag: false },
      { value: "Second", count: 0, flag: false },
    ],
    ...overrides,
  };
}

function presentation(table = tableElement()): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4c2d-simple-table-content-history",
    title: "CP4C2D Simple Table content history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [table],
    }],
  });
}

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: value,
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function tableFrom(snapshot: Presentation): SimpleTableElement {
  const element = snapshot.slides[0]?.elements[0];
  if (!element || element.type !== "table" || element.mode === "structured") {
    throw new Error("Simple Table was not found in snapshot");
  }
  return element;
}

describe("CP4C2D Simple Table content history", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function mount(
    initial: Presentation,
    saved: Presentation[] = [],
  ): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={initial}
          onSave={async (snapshot) => {
            saved.push(snapshot);
          }}
        />
      </StudioI18nProvider>,
    ));
  }

  async function selectTable(): Promise<void> {
    const table = host.querySelector<HTMLElement>(
      `[data-powershow-id="${TABLE_ID}"]`,
    );
    if (!table) throw new Error("Simple Table was not rendered");
    await act(async () => table.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  function labelInput(columnKey: string): HTMLInputElement {
    const input = host.querySelector<HTMLInputElement>(
      `input[name="tableColumnLabel_${TABLE_ID}_${columnKey}"]`,
    );
    if (!input) throw new Error(`Column label input was not rendered: ${columnKey}`);
    return input;
  }

  function cellInput(rowIndex: number, columnKey: string): HTMLInputElement {
    const input = host.querySelector<HTMLInputElement>(
      `input[name^="tableCell_${TABLE_ID}_${rowIndex}_${columnKey}_"][name$="Value"]`,
    );
    if (!input) throw new Error(`Cell input was not rendered: ${rowIndex}/${columnKey}`);
    return input;
  }

  function cellValueSelect(rowIndex: number, columnKey: string): HTMLSelectElement {
    const select = host.querySelector<HTMLSelectElement>(
      `select[name^="tableCell_${TABLE_ID}_${rowIndex}_${columnKey}_"][name$="Value"]`,
    );
    if (!select) throw new Error(`Cell value select was not rendered: ${rowIndex}/${columnKey}`);
    return select;
  }

  function cellType(rowIndex: number, columnKey: string): HTMLSelectElement {
    const select = host.querySelector<HTMLSelectElement>(
      `select[name^="tableCell_${TABLE_ID}_${rowIndex}_${columnKey}_"][name$="Type"]`,
    );
    if (!select) throw new Error(`Cell type select was not rendered: ${rowIndex}/${columnKey}`);
    return select;
  }

  async function editInput(
    input: HTMLInputElement,
    values: readonly string[],
  ): Promise<void> {
    await act(async () => {
      input.focus();
      for (const value of values) setInputValue(input, value);
      input.blur();
    });
  }

  async function undo(): Promise<KeyboardEvent> {
    const event = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(event));
    return event;
  }

  async function redo(): Promise<KeyboardEvent> {
    const event = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(event));
    return event;
  }

  async function save(): Promise<void> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Save");
    if (!button) throw new Error("Save button was not rendered");
    await act(async () => button.click());
  }

  it("coalesces column label changes into one action", async () => {
    await mount(presentation());
    await selectTable();

    await editInput(labelInput("value"), ["Val", "Final value"]);
    expect(labelInput("value").value).toBe("Final value");

    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(true);
    expect(labelInput("value").value).toBe("Value");

    const redoEvent = await redo();
    expect(redoEvent.defaultPrevented).toBe(true);
    expect(labelInput("value").value).toBe("Final value");
  });

  it("does not create history for a same-value column label", async () => {
    await mount(presentation());
    await selectTable();

    await editInput(labelInput("value"), ["Value"]);
    const undoEvent = await undo();

    expect(undoEvent.defaultPrevented).toBe(false);
    expect(labelInput("value").value).toBe("Value");
  });

  it("preserves the exact rich column label through undo and redo", async () => {
    const original: TextContent = {
      type: "rich-text",
      runs: [
        { text: "Total " },
        { text: "Value", marks: { bold: true } },
      ],
    };
    const expected: TextContent = {
      type: "rich-text",
      runs: [
        { text: "Grand Total " },
        { text: "Value", marks: { bold: true } },
      ],
    };
    const saved: Presentation[] = [];
    await mount(presentation(tableElement({
      columns: [
        { key: "value", label: original },
        { key: "count", label: "Count" },
        { key: "flag", label: "Flag" },
      ],
    })), saved);
    await selectTable();

    await editInput(labelInput("value"), ["Grand Total Value"]);
    await save();
    expect(tableFrom(saved.at(-1)! ).columns[0]?.label).toEqual(expected);

    await undo();
    await save();
    expect(tableFrom(saved.at(-1)! ).columns[0]?.label).toEqual(original);

    await redo();
    await save();
    expect(tableFrom(saved.at(-1)! ).columns[0]?.label).toEqual(expected);
  });

  it("coalesces string cell changes and preserves rich cell content", async () => {
    const original: TextContent = {
      type: "rich-text",
      runs: [
        { text: "Important " },
        { text: "value", marks: { italic: true } },
      ],
    };
    const expected: TextContent = {
      type: "rich-text",
      runs: [
        { text: "Really Important " },
        { text: "value!", marks: { italic: true } },
      ],
    };
    const initial = presentation(tableElement({
      rows: [
        { value: original, count: 10, flag: false },
        { value: "Second", count: 0, flag: false },
      ],
    }));
    expect(tableFrom(initial).rows[0]?.value).toEqual(original);
    const saved: Presentation[] = [];
    await mount(initial, saved);
    await selectTable();

    await editInput(cellInput(0, "value"), ["Important value!", "Really Important value!"]);
    await save();
    expect(tableFrom(saved.at(-1)! ).rows[0]?.value).toEqual(expected);

    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(true);
    await save();
    expect(tableFrom(saved.at(-1)! ).rows[0]?.value).toEqual(original);

    const redoEvent = await redo();
    expect(redoEvent.defaultPrevented).toBe(true);
    await save();
    expect(tableFrom(saved.at(-1)! ).rows[0]?.value).toEqual(expected);
  });

  it("coalesces number cell changes into one action", async () => {
    await mount(presentation());
    await selectTable();

    await editInput(cellInput(0, "count"), ["20", "30"]);
    expect(cellInput(0, "count").value).toBe("30");

    await undo();
    expect(cellInput(0, "count").value).toBe("10");
    await redo();
    expect(cellInput(0, "count").value).toBe("30");
  });

  it("authors a cleared number as zero and undoes it", async () => {
    await mount(presentation());
    await selectTable();

    await editInput(cellInput(0, "count"), [""]);
    expect(cellInput(0, "count").value).toBe("0");
    await undo();
    expect(cellInput(0, "count").value).toBe("10");
    await redo();
    expect(cellInput(0, "count").value).toBe("0");
  });

  it("does not create history when clearing an already-zero number", async () => {
    await mount(presentation());
    await selectTable();

    await editInput(cellInput(1, "count"), [""]);
    const undoEvent = await undo();

    expect(undoEvent.defaultPrevented).toBe(false);
    expect(cellInput(1, "count").value).toBe("0");
  });

  it("keeps different cells independent", async () => {
    await mount(presentation());
    await selectTable();

    await editInput(cellInput(0, "value"), ["Edited first"]);
    await editInput(cellInput(1, "count"), ["20"]);

    await undo();
    expect(cellInput(0, "value").value).toBe("Edited first");
    expect(cellInput(1, "count").value).toBe("0");
    await undo();
    expect(cellInput(0, "value").value).toBe("First");
    expect(cellInput(1, "count").value).toBe("0");
  });

  it("separates a column label action from a cell action", async () => {
    await mount(presentation());
    await selectTable();

    await editInput(labelInput("value"), ["Renamed"]);
    await editInput(cellInput(0, "value"), ["Edited"]);

    await undo();
    expect(labelInput("value").value).toBe("Renamed");
    expect(cellInput(0, "value").value).toBe("First");
    await undo();
    expect(labelInput("value").value).toBe("Value");
  });

  it("keeps typing and a cell type change as two actions", async () => {
    await mount(presentation());
    await selectTable();

    await editInput(cellInput(0, "value"), ["Final text"]);
    await act(async () => setSelectValue(cellType(0, "value"), "number"));
    expect(cellType(0, "value").value).toBe("number");

    await undo();
    expect(cellType(0, "value").value).toBe("string");
    expect(cellInput(0, "value").value).toBe("Final text");
    await undo();
    expect(cellInput(0, "value").value).toBe("First");
  });

  it("keeps boolean value changes discrete", async () => {
    await mount(presentation());
    await selectTable();

    await act(async () => setSelectValue(cellValueSelect(0, "flag"), "true"));
    await undo();
    expect(cellType(0, "flag").value).toBe("boolean");
    expect(cellValueSelect(0, "flag").value).toBe("false");
  });

  it("keeps column key typing local until blur and outside history", async () => {
    await mount(presentation());
    await selectTable();

    const input = host.querySelector<HTMLInputElement>(
      `input[name="tableColumnKey_${TABLE_ID}_value"]`,
    );
    if (!input) throw new Error("Column key input was not rendered");
    await act(async () => {
      input.focus();
      setInputValue(input, "draft-key");
    });

    expect(input.value).toBe("draft-key");
    expect((await undo()).defaultPrevented).toBe(false);
    expect(input.value).toBe("draft-key");
  });

  it("authors label, string, and number values without a History provider", async () => {
    let elementState: PresentationElement = tableElement();

    const renderInspector = () => {
      root.render(
        <StudioI18nProvider>
          <PresentationColorPaletteProvider colors={[]}>
            <TableInspector
              element={elementState as SimpleTableElement}
              onUpdate={(update) => {
                elementState = update(elementState);
                renderInspector();
              }}
              tableAuthoringControls={TABLE_CONTROLS}
            />
          </PresentationColorPaletteProvider>
        </StudioI18nProvider>,
      );
    };

    await act(async () => renderInspector());

    await act(async () => {
      setInputValue(labelInput("value"), "Direct label");
    });
    await act(async () => {
      setInputValue(cellInput(0, "value"), "Direct string");
    });
    await act(async () => {
      setInputValue(cellInput(0, "count"), "42");
    });

    const table = elementState as SimpleTableElement;
    expect(table.columns[0]?.label).toBe("Direct label");
    expect(table.rows[0]?.value).toBe("Direct string");
    expect(table.rows[0]?.count).toBe(42);
  });
});
