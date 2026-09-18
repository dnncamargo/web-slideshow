// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type Presentation,
  type SimpleTableElement,
  type TextContent,
} from "@powershow/document-schema";

import {
  AuthoringHistoryContext,
  type AuthoringHistoryContextValue,
} from "../src/features/editor/authoring-history-context";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { TableInspector } from "../src/features/editor/inspector/table-inspector";
import type { TableAuthoringControls } from "../src/features/editor/inspector/inspector-types";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const TABLE_ID = "cp4d5-simple-table";

const TABLE_CONTROLS: TableAuthoringControls = {
  onAddColumn: () => {},
  onRemoveColumn: () => {},
  onAddRow: () => {},
  onRemoveRow: () => {},
  onShowHeaderChange: () => {},
};

const richText: TextContent = {
  type: "rich-text",
  runs: [{ text: "rich", marks: { bold: true, italic: true } }],
};

function tableElement(overrides: Partial<SimpleTableElement> = {}): SimpleTableElement {
  return {
    type: "table",
    id: TABLE_ID,
    hidden: true,
    mode: "simple",
    layout: { width: 640, height: 360 },
    style: { background: { color: "#101820" }, borderRadius: 4 },
    typography: { fontFamily: "Inter", fontSize: 18, lineHeight: 1.4 },
    effect: { opacity: 0.75 },
    columns: [
      { key: "name", label: "Name" },
      { key: "score", label: "Score" },
      { key: "flag", label: "Flag" },
    ],
    rows: [
      { name: "Ada", score: richText, flag: true, unrelated: "first" },
      { name: "Linus", score: 20, flag: false, unrelated: "second" },
      { name: "Grace", score: null, flag: true, unrelated: "third" },
      { name: "Missing", flag: false, unrelated: "fourth" },
    ],
    ...overrides,
  };
}

function presentation(table = tableElement()): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4d5-simple-table-structure-history",
    title: "CP4D5 Simple Table structure history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [{ ...table, hidden: false }],
    }],
  });
}

function tableFrom(snapshot: Presentation): SimpleTableElement {
  const element = snapshot.slides[0]?.elements[0];
  if (!element || element.type !== "table" || element.mode === "structured") {
    throw new Error("Simple Table was not found in snapshot");
  }
  return element;
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
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLSelectElement.value setter");
  setter.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function expectOwnerFields(actual: SimpleTableElement, expected: SimpleTableElement): void {
  expect(actual.id).toBe(expected.id);
  expect(actual.hidden).toBe(expected.hidden);
  expect(actual.mode).toBe(expected.mode);
  expect(actual.layout).toEqual(expected.layout);
  expect(actual.style).toEqual(expected.style);
  expect(actual.typography).toEqual(expected.typography);
  expect(actual.effect).toEqual(expected.effect);
}

describe("CP4D5 Simple Table structure history", () => {
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

  function addColumnButton(): HTMLButtonElement {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.includes("Add column"));
    if (!button) throw new Error("Simple Table add-column button was not rendered");
    return button;
  }

  function addRowButton(): HTMLButtonElement {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.includes("Add row"));
    if (!button) throw new Error("Simple Table add-row button was not rendered");
    return button;
  }

  function removeColumnButton(index: number): HTMLButtonElement {
    const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .filter((candidate) => candidate.getAttribute("aria-label")?.startsWith("Remove column"));
    const button = buttons[index];
    if (!button) throw new Error(`Simple Table remove-column button ${index} was not rendered`);
    return button;
  }

  function removeRowButton(index: number): HTMLButtonElement {
    const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .filter((candidate) => candidate.getAttribute("aria-label")?.startsWith("Remove row"));
    const button = buttons[index];
    if (!button) throw new Error(`Simple Table remove-row button ${index} was not rendered`);
    return button;
  }

  function columnKeyInput(columnKey: string): HTMLInputElement {
    const input = host.querySelector<HTMLInputElement>(
      `input[name="tableColumnKey_${TABLE_ID}_${columnKey}"]`,
    );
    if (!input) throw new Error(`Column key input was not rendered: ${columnKey}`);
    return input;
  }

  function columnLabelInput(columnKey: string): HTMLInputElement {
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

  async function editInput(input: HTMLInputElement, value: string): Promise<void> {
    await act(async () => {
      input.focus();
      setInputValue(input, value);
      input.blur();
    });
  }

  async function mountWorkspace(
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
    const table = host.querySelector<HTMLElement>(`[data-powershow-id="${TABLE_ID}"]`);
    if (!table) throw new Error("Simple Table was not rendered");
    await act(async () => table.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function undo(): Promise<void> {
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
  }

  async function redo(): Promise<void> {
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
  }

  async function save(): Promise<void> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Save");
    if (!button) throw new Error("Save button was not rendered");
    await act(async () => button.click());
  }

  async function renderStandalone(
    initial: SimpleTableElement,
    historyEnabled = true,
  ): Promise<{
    getState: () => SimpleTableElement;
    setState: (next: SimpleTableElement) => void;
    committedMetas: Array<{ kind: string; labelKey: string; labelParams?: Record<string, string | number> }>;
  }> {
    let state = initial;
    const committedMetas: Array<{ kind: string; labelKey: string; labelParams?: Record<string, string | number> }> = [];
    const history: AuthoringHistoryContextValue = {
      begin: () => undefined,
      update: (_key, callback) => callback(),
      finish: () => undefined,
      discrete: (meta, callback) => {
        const before = state;
        callback();
        if (state !== before) committedMetas.push(meta);
      },
    };
    const render = () => root.render(
      <StudioI18nProvider>
        {historyEnabled ? (
          <AuthoringHistoryContext.Provider value={history}>
            <TableInspector
              element={state}
              onUpdate={(update) => {
                const next = update(state);
                if (next.type === "table" && next.mode !== "structured") state = next;
                void render();
              }}
              tableAuthoringControls={TABLE_CONTROLS}
            />
          </AuthoringHistoryContext.Provider>
        ) : (
          <TableInspector
            element={state}
            onUpdate={(update) => {
              const next = update(state);
              if (next.type === "table" && next.mode !== "structured") state = next;
              void render();
            }}
            tableAuthoringControls={TABLE_CONTROLS}
          />
        )}
      </StudioI18nProvider>,
    );
    await act(async () => render());
    return {
      getState: () => state,
      setState: (next) => { state = next; },
      committedMetas,
    };
  }

  it("tracks all four operations with exact metadata, mixed values, and owner fields", async () => {
    const initial = tableElement();
    const mounted = await renderStandalone(initial);

    await act(async () => addColumnButton().click());
    expect(mounted.committedMetas).toEqual([{
      kind: "table.addColumn",
      labelKey: "history.element.setting",
      labelParams: { setting: "table.addColumn" },
    }]);
    expect(mounted.getState().columns.at(-1)).toEqual({ key: "column_1", label: "New column" });
    expect(mounted.getState().rows).toEqual([
      { name: "Ada", score: richText, flag: true, unrelated: "first", column_1: "" },
      { name: "Linus", score: 20, flag: false, unrelated: "second", column_1: "" },
      { name: "Grace", score: null, flag: true, unrelated: "third", column_1: "" },
      { name: "Missing", flag: false, unrelated: "fourth", column_1: "" },
    ]);
    expectOwnerFields(mounted.getState(), initial);

    await act(async () => removeColumnButton(3).click());
    expect(mounted.committedMetas.at(-1)).toEqual({
      kind: "table.removeColumn",
      labelKey: "history.element.setting",
      labelParams: { setting: "table.removeColumn" },
    });
    expect(mounted.getState()).toEqual(initial);

    await act(async () => addRowButton().click());
    expect(mounted.committedMetas.at(-1)).toEqual({
      kind: "table.addRow",
      labelKey: "history.element.setting",
      labelParams: { setting: "table.addRow" },
    });
    expect(mounted.getState().rows.at(-1)).toEqual({ name: "", score: "", flag: "" });
    expectOwnerFields(mounted.getState(), initial);

    await act(async () => removeRowButton(4).click());
    expect(mounted.committedMetas.at(-1)).toEqual({
      kind: "table.removeRow",
      labelKey: "history.element.setting",
      labelParams: { setting: "table.removeRow" },
    });
    expect(mounted.getState()).toEqual(initial);
  });

  it("supports empty columns/rows, last-column removal, and exact row defaults", async () => {
    const zeroRows = tableElement({ rows: [], columns: [{ key: "name", label: "Name" }] });
    const mounted = await renderStandalone(zeroRows);
    await act(async () => addColumnButton().click());
    expect(mounted.getState().columns.map((column) => column.key)).toEqual(["name", "column_1"]);
    expect(mounted.getState().rows).toEqual([]);

    const zeroColumns = tableElement({
      columns: [],
      rows: [{ unrelated: "keep" }, { other: 42 }],
    });
    mounted.setState(zeroColumns);
    await act(async () => root.render(
      <StudioI18nProvider>
        <TableInspector element={zeroColumns} onUpdate={(update) => {
          const next = update(zeroColumns);
          if (next.type === "table" && next.mode !== "structured") mounted.setState(next);
        }} tableAuthoringControls={TABLE_CONTROLS} />
      </StudioI18nProvider>,
    ));
    await act(async () => addColumnButton().click());
    expect(mounted.getState().columns).toEqual([{ key: "column_1", label: "New column" }]);
    expect(mounted.getState().rows).toEqual([
      { unrelated: "keep", column_1: "" },
      { other: 42, column_1: "" },
    ]);

    const zeroColumnsForRow = tableElement({
      columns: [],
      rows: [{ unrelated: "keep" }],
    });
    mounted.setState(zeroColumnsForRow);
    await act(async () => root.render(
      <StudioI18nProvider>
        <TableInspector element={zeroColumnsForRow} onUpdate={(update) => {
          const next = update(zeroColumnsForRow);
          if (next.type === "table" && next.mode !== "structured") mounted.setState(next);
        }} tableAuthoringControls={TABLE_CONTROLS} />
      </StudioI18nProvider>,
    ));
    await act(async () => addRowButton().click());
    expect(mounted.getState().rows.at(-1)).toEqual({});

    const onlyColumn = tableElement({
      columns: [{ key: "only", label: "Only" }],
      rows: [{ only: richText, unrelated: "keep" }],
    });
    mounted.setState(onlyColumn);
    await act(async () => root.render(
      <StudioI18nProvider>
        <TableInspector element={onlyColumn} onUpdate={(update) => {
          const next = update(onlyColumn);
          if (next.type === "table" && next.mode !== "structured") mounted.setState(next);
        }} tableAuthoringControls={TABLE_CONTROLS} />
      </StudioI18nProvider>,
    ));
    await act(async () => removeColumnButton(0).click());
    expect(mounted.getState().columns).toEqual([]);
    expect(mounted.getState().rows).toEqual([{ unrelated: "keep" }]);
  });

  it("removes a middle column atomically and replays its exact mixed values", async () => {
    const initial = tableElement();
    const saved: Presentation[] = [];
    await mountWorkspace(presentation(initial), saved);

    await act(async () => removeColumnButton(1).click());
    await save();
    expect(tableFrom(saved[0]!).columns).toEqual([
      { key: "name", label: "Name" },
      { key: "flag", label: "Flag" },
    ]);
    expect(tableFrom(saved[0]!).rows).toEqual([
      { name: "Ada", flag: true, unrelated: "first" },
      { name: "Linus", flag: false, unrelated: "second" },
      { name: "Grace", flag: true, unrelated: "third" },
      { name: "Missing", flag: false, unrelated: "fourth" },
    ]);
    await undo();
    await save();
    expect(tableFrom(saved[1]!)).toEqual({ ...initial, hidden: false });
    await redo();
    await save();
    expect(tableFrom(saved[2]!)).toEqual(tableFrom(saved[0]!));
  });

  it("replays Add Column from the current table with the exact generated key", async () => {
    const initial = tableElement({
      columns: [{ key: "column_1", label: "Existing" }, { key: "name", label: "Name" }],
      rows: [],
    });
    const saved: Presentation[] = [];
    await mountWorkspace(presentation(initial), saved);
    await act(async () => addColumnButton().click());
    await save();
    expect(tableFrom(saved[0]!).columns).toEqual([
      { key: "column_1", label: "Existing" },
      { key: "name", label: "Name" },
      { key: "column_2", label: "New column" },
    ]);
    expect(tableFrom(saved[0]!).rows).toEqual([]);

    await undo();
    await save();
    expect(tableFrom(saved[1]!).columns).toEqual(initial.columns);
    await redo();
    await save();
    expect(tableFrom(saved[2]!).columns).toEqual(tableFrom(saved[0]!).columns);
    expect(tableFrom(saved[2]!).columns.at(-1)?.key).toBe("column_2");
  });

  it("replays Add Row and Remove Row exactly, including rich and unrelated values", async () => {
    const initial = tableElement({ rows: [{ name: "A", score: richText, extra: null }, { name: "B", score: 2, flag: false, extra: true }, { name: "C", score: null, flag: true, extra: "keep" }] });
    const saved: Presentation[] = [];
    await mountWorkspace(presentation(initial), saved);

    await act(async () => addRowButton().click());
    await save();
    expect(tableFrom(saved[0]!).rows.at(-1)).toEqual({ name: "", score: "", flag: "" });
    await undo();
    await save();
    expect(tableFrom(saved[1]!).rows).toEqual(initial.rows);
    await redo();
    await save();
    expect(tableFrom(saved[2]!).rows).toEqual(tableFrom(saved[0]!).rows);

    await act(async () => removeRowButton(1).click());
    await save();
    expect(tableFrom(saved[3]!).rows).toEqual([
      initial.rows[0],
      initial.rows[2],
      { name: "", score: "", flag: "" },
    ]);
    await undo();
    await save();
    expect(tableFrom(saved[4]!).rows[1]).toEqual(initial.rows[1]);
    await redo();
    await save();
    expect(tableFrom(saved[5]!).rows[1]).toEqual(initial.rows[2]);
  });

  it("separates label and cell content actions from structural actions", async () => {
    const initial = tableElement({ rows: [{ name: "A", score: 1, flag: false }] });
    await mountWorkspace(presentation(initial));

    await editInput(columnLabelInput("name"), "Renamed");
    await act(async () => addColumnButton().click());
    await undo();
    expect(columnLabelInput("name").value).toBe("Renamed");
    await undo();
    expect(columnLabelInput("name").value).toBe("Name");

    await editInput(cellInput(0, "score"), "42");
    await act(async () => addRowButton().click());
    await undo();
    expect(cellInput(0, "score").value).toBe("42");
    expect(host.querySelectorAll('button[aria-label^="Remove row"]')).toHaveLength(1);
    await undo();
    expect(cellInput(0, "score").value).toBe("1");
  });

  it("separates key rename and discrete cell state from structural removal", async () => {
    const initial = tableElement({ rows: [{ name: "A", score: 1, flag: false }] });
    await mountWorkspace(presentation(initial));

    await editInput(columnKeyInput("score"), "total");
    await act(async () => removeColumnButton(1).click());
    await undo();
    expect(columnKeyInput("total").value).toBe("total");
    expect(cellInput(0, "total").value).toBe("1");
    await undo();
    expect(columnKeyInput("score").value).toBe("score");
    expect(cellInput(0, "score").value).toBe("1");

    await act(async () => setSelectValue(
      host.querySelector<HTMLSelectElement>(
        `select[name^="tableCell_${TABLE_ID}_0_flag_"][name$="Value"]`,
      )!,
      "true",
    ));
    await act(async () => removeRowButton(0).click());
    await undo();
    expect(host.querySelector<HTMLSelectElement>(
      `select[name^="tableCell_${TABLE_ID}_0_flag_"][name$="Value"]`,
    )?.value).toBe("true");
    await undo();
    expect(host.querySelector<HTMLSelectElement>(
      `select[name^="tableCell_${TABLE_ID}_0_flag_"][name$="Value"]`,
    )?.value).toBe("false");
  });

  it("keeps Add/Remove and consecutive structural actions independently undoable", async () => {
    const initial = tableElement({ columns: [{ key: "name", label: "Name" }], rows: [] });
    await mountWorkspace(presentation(initial));
    await act(async () => addColumnButton().click());
    await act(async () => addColumnButton().click());
    expect(host.querySelectorAll('input[name^="tableColumnKey_"]')).toHaveLength(3);
    await undo();
    expect(host.querySelectorAll('input[name^="tableColumnKey_"]')).toHaveLength(2);
    await undo();
    expect(host.querySelectorAll('input[name^="tableColumnKey_"]')).toHaveLength(1);

    await act(async () => addRowButton().click());
    await act(async () => addRowButton().click());
    expect(host.querySelectorAll('button[aria-label^="Remove row"]')).toHaveLength(2);
    await undo();
    expect(host.querySelectorAll('button[aria-label^="Remove row"]')).toHaveLength(1);
    await act(async () => removeRowButton(0).click());
    await undo();
    expect(host.querySelectorAll('button[aria-label^="Remove row"]')).toHaveLength(1);
    await undo();
    expect(host.querySelectorAll('button[aria-label^="Remove row"]')).toHaveLength(0);
  });

  it("preserves direct compatibility without a provider and rejects stale removals as no-ops", async () => {
    const initial = tableElement({ columns: [{ key: "a", label: "A" }], rows: [{ a: "value" }] });
    const mounted = await renderStandalone(initial, false);
    await act(async () => addColumnButton().click());
    await act(async () => addRowButton().click());
    await act(async () => removeColumnButton(0).click());
    await act(async () => removeRowButton(0).click());
    expect(mounted.getState().columns).toEqual([{ key: "column_1", label: "New column" }]);
    expect(mounted.getState().rows).toEqual([{ column_1: "" }]);

    const staleColumn = tableElement({ columns: [{ key: "current", label: "Current" }] });
    mounted.setState(staleColumn);
    await act(async () => removeColumnButton(0).click());
    expect(mounted.getState()).toBe(staleColumn);

    const staleRow = tableElement({ rows: [{ name: "current" }] });
    mounted.setState(staleRow);
    await act(async () => removeRowButton(1).click());
    expect(mounted.getState()).toBe(staleRow);

    const zeroColumn = tableElement({ columns: [], rows: [{ unrelated: "keep" }] });
    mounted.setState(zeroColumn);
    await act(async () => root.render(
      <StudioI18nProvider>
        <TableInspector element={zeroColumn} onUpdate={(update) => {
          const next = update(zeroColumn);
          if (next.type === "table" && next.mode !== "structured") mounted.setState(next);
        }} tableAuthoringControls={TABLE_CONTROLS} />
      </StudioI18nProvider>,
    ));
    expect(() => removeColumnButton(0)).toThrow();
  });

  it("creates no committed history for stale column or invalid row removals", async () => {
    const mounted = await renderStandalone(tableElement(), true);
    const staleColumn = tableElement({ columns: [{ key: "current", label: "Current" }] });
    mounted.setState(staleColumn);
    await act(async () => removeColumnButton(0).click());
    expect(mounted.getState()).toBe(staleColumn);
    expect(mounted.committedMetas).toEqual([]);

    const staleRow = tableElement({ rows: [{ name: "current" }] });
    mounted.setState(staleRow);
    await act(async () => removeRowButton(1).click());
    expect(mounted.getState()).toBe(staleRow);
    expect(mounted.committedMetas).toEqual([]);
  });
});
