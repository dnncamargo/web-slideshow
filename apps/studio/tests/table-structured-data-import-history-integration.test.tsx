// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  SYSTEM_TABLE_CELL_TEXT_STYLE_ID,
  SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID,
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
    id: "import-table",
    mode: "structured",
    hidden: false,
    showHeader: true,
    importSourceFileResourceId: "source-a.csv",
    columns: [{ id: "old-column", header: { id: "old-header", children: [text("old-header-text", "Old")] } }],
    rows: [{ id: "old-row", cells: [{ id: "old-cell", children: [text("old-cell-text", "Old value")] }] }],
  };
}

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "import-presentation",
    title: "Structured data import",
    slides: [{ id: "slide", title: "Slide", elements: [table()] }],
    resources: {
      files: [{
        id: "source-a.csv",
        name: "source-a.csv",
        kind: "structured-data",
        representation: "text",
        contentType: "text/csv",
        source: { type: "text", content: "old,source\nOld,1" },
      }, {
        id: "source.csv",
        name: "source.csv",
        kind: "structured-data",
        representation: "text",
        contentType: "text/csv",
        source: { type: "text", content: "name,score\nAlice,10\nBob,20" },
      }],
    },
  });
}

function getTable(snapshot: Presentation): StructuredTable {
  const element = snapshot.slides[0]?.elements[0];
  if (!element || element.type !== "table" || element.mode !== "structured") throw new Error("Expected Structured Table");
  return element;
}

describe("Structured Table data import history integration", () => {
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

  async function mount(): Promise<void> {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={latest} onSave={async (snapshot) => { latest = snapshot; }} />
        </StudioI18nProvider>,
      );
    });
    const selected = container.querySelector<HTMLElement>('[data-presentation-id="import-table"]');
    if (!selected) throw new Error("table was not rendered");
    await act(async () => selected.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function save(): Promise<void> {
    const saveButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Save");
    if (!saveButton) throw new Error("Save button was not rendered");
    await act(async () => saveButton.click());
  }

  async function key(keyValue: string, options: KeyboardEventInit): Promise<void> {
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: keyValue, bubbles: true, cancelable: true, ...options })));
  }

  it("imports as one history action and replays exact snapshots with system styles", async () => {
    await mount();
    const before = structuredClone(latest);
    const select = container.querySelector<HTMLSelectElement>("[data-presentation-table-import-file]");
    const importButton = container.querySelector<HTMLButtonElement>("[data-presentation-table-import-action]");
    if (!select || !importButton) throw new Error("Structured data import controls were not rendered");

    await act(async () => {
      select.value = "source.csv";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => importButton.click());
    await save();

    const imported = structuredClone(latest);
    const importedTable = getTable(imported);
    expect(importedTable.importSourceFileResourceId).toBe("source.csv");
    expect(importedTable.columns.map((column) => column.header.children[0]?.type === "text" ? column.header.children[0].content : "")).toEqual(["name", "score"]);
    expect(importedTable.rows.map((row) => row.cells.map((cell) => cell.children[0]?.type === "text" ? cell.children[0].content : ""))).toEqual([["Alice", "10"], ["Bob", "20"]]);
    expect(imported.textStyles?.map((style) => style.id)).toEqual([
      SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID,
      SYSTEM_TABLE_CELL_TEXT_STYLE_ID,
    ]);

    await key("z", { ctrlKey: true });
    await save();
    expect(latest).toEqual(before);

    await key("z", { ctrlKey: true, shiftKey: true });
    await save();
    expect(latest).toEqual(imported);
  });
});
