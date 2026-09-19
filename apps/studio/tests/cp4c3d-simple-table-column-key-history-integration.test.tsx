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

import { AuthoringHistoryContext } from "../src/features/editor/authoring-history-context";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { TableInspector } from "../src/features/editor/inspector/table-inspector";
import type { TableAuthoringControls } from "../src/features/editor/inspector/inspector-types";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const TABLE_ID = "cp4c3d-simple-table";

const TABLE_CONTROLS: TableAuthoringControls = {
  onAddColumn: () => {},
  onRemoveColumn: () => {},
  onAddRow: () => {},
  onRemoveRow: () => {},
  onShowHeaderChange: () => {},
};

const richScore: TextContent = {
  type: "rich-text",
  runs: [{ text: "Ten", marks: { bold: true } }],
};

function tableElement(overrides: Partial<SimpleTableElement> = {}): SimpleTableElement {
  return {
    type: "table",
    id: TABLE_ID,
    hidden: false,
    columns: [
      { key: "name", label: "Name" },
      { key: "score", label: "Score" },
      { key: "flag", label: "Flag" },
    ],
    rows: [
      { name: "Ada", score: richScore, flag: true, unrelated: "first" },
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
    id: "cp4c3d-simple-table-column-key-history",
    title: "CP4C3D Simple Table column key history",
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
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function tableFrom(snapshot: Presentation): SimpleTableElement {
  const element = snapshot.slides[0]?.elements[0];
  if (!element || element.type !== "table" || element.mode === "structured") {
    throw new Error("Simple Table was not found in snapshot");
  }
  return element;
}

function expectRenamedTable(table: SimpleTableElement): void {
  expect(table.columns.map((column) => column.key)).toEqual(["name", "total", "flag"]);
  expect(table.columns.map((column) => column.label)).toEqual(["Name", "Score", "Flag"]);
  expect(table.rows).toEqual([
    { name: "Ada", total: richScore, flag: true, unrelated: "first" },
    { name: "Linus", total: 20, flag: false, unrelated: "second" },
    { name: "Grace", total: "", flag: true, unrelated: "third" },
    { name: "Missing", total: "", flag: false, unrelated: "fourth" },
  ]);
}

describe("CP4C3D Simple Table column key history", () => {
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
    initial = presentation(),
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
    const table = host.querySelector<HTMLElement>(`[data-presentation-id="${TABLE_ID}"]`);
    if (!table) throw new Error("Simple Table was not rendered");
    await act(async () => table.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  function keyInput(columnKey: string): HTMLInputElement {
    const input = host.querySelector<HTMLInputElement>(
      `input[name="tableColumnKey_${TABLE_ID}_${columnKey}"]`,
    );
    if (!input) throw new Error(`Column key input was not rendered: ${columnKey}`);
    return input;
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

  async function editAndBlur(input: HTMLInputElement, value: string): Promise<void> {
    await act(async () => {
      input.focus();
      setInputValue(input, value);
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

  it("keeps draft typing local until blur and outside history", async () => {
    await mount();
    await selectTable();
    const input = keyInput("score");

    await act(async () => {
      input.focus();
      setInputValue(input, "total");
    });

    expect(input.value).toBe("total");
    expect((await undo()).defaultPrevented).toBe(false);
    expect(input.value).toBe("total");
  });

  it("tracks one trimmed rename action and preserves the complete table through undo and redo", async () => {
    const saved: Presentation[] = [];
    await mount(presentation(), saved);
    await selectTable();

    await editAndBlur(keyInput("score"), "  total  ");
    await save();
    expectRenamedTable(tableFrom(saved.at(-1)!));

    expect((await undo()).defaultPrevented).toBe(true);
    await save();
    expect(tableFrom(saved.at(-1)!)).toEqual(tableElement());
    expect((await redo()).defaultPrevented).toBe(true);
    await save();
    expectRenamedTable(tableFrom(saved.at(-1)!));
  });

  it("uses Enter as the single blur commit path", async () => {
    await mount();
    await selectTable();
    const input = keyInput("score");

    await act(async () => {
      input.focus();
      setInputValue(input, "total");
      input.dispatchEvent(key("Enter"));
    });

    expect(input.value).toBe("total");
    expect((await undo()).defaultPrevented).toBe(true);
    expect((await undo()).defaultPrevented).toBe(false);
  });

  it("rejects same-key, blank, and duplicate candidates without history", async () => {
    await mount();
    await selectTable();

    await editAndBlur(keyInput("score"), "  score  ");
    expect(keyInput("score").value).toBe("  score  ");
    expect((await undo()).defaultPrevented).toBe(false);

    await editAndBlur(keyInput("score"), "   ");
    expect(keyInput("score").value).toBe("score");
    expect((await undo()).defaultPrevented).toBe(false);

    await editAndBlur(keyInput("score"), "name");
    expect(keyInput("score").value).toBe("score");
    expect((await undo()).defaultPrevented).toBe(false);
  });

  it("keeps Escape local, including its resulting blur", async () => {
    await mount();
    await selectTable();
    const input = keyInput("score");

    await act(async () => {
      input.focus();
      setInputValue(input, "total");
      input.dispatchEvent(key("Escape"));
    });
    expect(input.value).toBe("score");
    await act(async () => input.blur());
    expect((await undo()).defaultPrevented).toBe(false);
  });

  it("uses the required discrete metadata for a real rename", async () => {
    let current = tableElement();
    const metas: Array<{ kind: string; labelKey: string; labelParams?: Readonly<Record<string, string | number>> }> = [];
    const history = {
      begin: () => undefined,
      update: (_key: string, callback: () => void) => callback(),
      finish: () => undefined,
      discrete: (meta: typeof metas[number] & { kind: string; labelKey: string }, callback: () => void) => {
        metas.push(meta);
        callback();
      },
    };
    const render = () => root.render(
      <StudioI18nProvider>
        <AuthoringHistoryContext.Provider value={history}>
          <TableInspector
            element={current}
            onUpdate={(update) => {
              current = update(current) as SimpleTableElement;
              render();
            }}
            tableAuthoringControls={TABLE_CONTROLS}
          />
        </AuthoringHistoryContext.Provider>
      </StudioI18nProvider>,
    );

    await act(async () => render());

    await act(async () => {
      const input = host.querySelector<HTMLInputElement>(`input[name="tableColumnKey_${TABLE_ID}_score"]`);
      if (!input) throw new Error("Column key input was not rendered");
      input.focus();
      setInputValue(input, "total");
      input.blur();
    });

    expect(metas).toEqual([{
      kind: "element.setting",
      labelKey: "history.element.setting",
      labelParams: { setting: "table.columnKey" },
    }]);
    expect(current.columns[1]?.key).toBe("total");
  });

  it("keeps label history separate from key history", async () => {
    await mount();
    await selectTable();

    await editAndBlur(labelInput("score"), "Points");
    await editAndBlur(keyInput("score"), "total");

    await undo();
    expect(keyInput("score").value).toBe("score");
    expect(labelInput("score").value).toBe("Points");
    await undo();
    expect(labelInput("score").value).toBe("Score");
  });

  it("keeps post-rename cell history separate and derives the new cell identity", async () => {
    const saved: Presentation[] = [];
    await mount(presentation(tableElement({
      rows: [{ name: "Ada", score: 10, flag: true }],
    })), saved);
    await selectTable();

    await editAndBlur(keyInput("score"), "total");
    await save();
    await editAndBlur(cellInput(0, "total"), "42");

    await undo();
    expect(cellInput(0, "total").value).toBe("10");
    expect(keyInput("total").value).toBe("total");
    await undo();
    expect(keyInput("score").value).toBe("score");
    await save();
    expect(tableFrom(saved.at(-1)!).rows[0]).toEqual({ name: "Ada", score: 10, flag: true });
  });

  it("preserves direct rename compatibility without a History provider", async () => {
    let current: PresentationElement = tableElement();

    const render = () => root.render(
      <StudioI18nProvider>
        <TableInspector
          element={current as SimpleTableElement}
          onUpdate={(update) => {
            current = update(current);
            void render();
          }}
          tableAuthoringControls={TABLE_CONTROLS}
        />
      </StudioI18nProvider>,
    );

    await act(async () => render());
    const input = () => host.querySelector<HTMLInputElement>(
      `input[name="tableColumnKey_${TABLE_ID}_score"]`,
    );
    await act(async () => {
      const control = input();
      if (!control) throw new Error("Column key input was not rendered");
      control.focus();
      setInputValue(control, "total");
      control.blur();
    });

    const table = current as SimpleTableElement;
    expect(table.columns[1]?.key).toBe("total");
    expect(table.rows.map((row) => row.total)).toEqual([richScore, 20, "", ""]);
  });
});
