// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  Presentation,
  PresentationElement,
  StructuredTableElement,
  SimpleTableElement,
} from "@web-slideshow/document-schema";

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { PresentationColorPaletteProvider } from "../src/features/editor/inspector/sections/presentation-color-palette";
import { TableInspector } from "../src/features/editor/inspector/table-inspector";
import type { TableAuthoringControls } from "../src/features/editor/inspector/inspector-types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function structuredTable(): StructuredTableElement {
  return {
    type: "table",
    id: "table",
    mode: "structured",
    hidden: false,
    showHeader: true,
    columns: [],
    rows: [],
  };
}

function simpleTable(): SimpleTableElement {
  return {
    type: "table",
    id: "simple",
    hidden: false,
    columns: [{ key: "value", label: "Value" }],
    rows: [{ value: "old" }],
  };
}

function file(name: string, contentType: "text/csv" | "application/json" | "application/xml", content: string) {
  return {
    id: name,
    name,
    kind: "structured-data" as const,
    representation: "text" as const,
    contentType,
    source: { type: "text" as const, content },
  };
}

describe("Structured Table data import inspector", () => {
  let container: HTMLDivElement;
  let root: Root;
  let element: PresentationElement;
  let controls: TableAuthoringControls;
  let presentation: Pick<Presentation, "linkedStyles" | "resources">;

  function renderInspector(): void {
    root.render(
      <StudioI18nProvider>
        <PresentationColorPaletteProvider colors={[]}>
          <TableInspector
            element={element as SimpleTableElement | StructuredTableElement}
            onUpdate={() => undefined}
            tableAuthoringControls={controls}
            presentation={presentation}
          />
        </PresentationColorPaletteProvider>
      </StudioI18nProvider>,
    );
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    element = structuredTable();
    presentation = {
      linkedStyles: [],
      resources: {
        files: [
          file("data.csv", "text/csv", "name,score\nAlice,10"),
          file("data.json", "application/json", JSON.stringify([{ name: "Bob" }])),
          file("data.xml", "application/xml", "<people><person><name>Cara</name></person></people>"),
          { id: "notes", name: "notes.txt", kind: "text", representation: "text", contentType: "text/plain", source: { type: "text", content: "not a table" } },
          { id: "markdown", name: "notes.md", kind: "markdown", representation: "text", contentType: "text/markdown", source: { type: "text", content: "| no |" } },
        ],
      },
    };
    controls = {
      onAddColumn: vi.fn(),
      onRemoveColumn: vi.fn(),
      onAddRow: vi.fn(),
      onRemoveRow: vi.fn(),
      onShowHeaderChange: vi.fn(),
      onImportData: vi.fn(),
    };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("shows only structured data files and does not mutate when selecting one", async () => {
    await act(async () => renderInspector());
    expect(container.querySelector('[data-presentation-table-data-import="true"]')).not.toBeNull();
    const select = container.querySelector<HTMLSelectElement>("[data-presentation-table-import-file]");
    expect(select?.options).toHaveLength(4);
    expect(Array.from(select?.options ?? []).map((option) => option.textContent)).toEqual([
      "Select a file", "data.csv", "data.json", "data.xml",
    ]);

    await act(async () => {
      if (!select) throw new Error("file selector missing");
      select.value = "data.csv";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(controls.onImportData).not.toHaveBeenCalled();
  });

  it("parses only on explicit import and sends normalized data to the authoring control", async () => {
    await act(async () => renderInspector());
    const select = container.querySelector<HTMLSelectElement>("[data-presentation-table-import-file]");
    if (!select) throw new Error("file selector missing");
    await act(async () => {
      select.value = "data.json";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(controls.onImportData).not.toHaveBeenCalled();

    await act(async () => container.querySelector<HTMLButtonElement>("[data-presentation-table-import-action]")?.click());
    expect(controls.onImportData).toHaveBeenCalledWith("table", {
      columns: ["name"],
      rows: [["Bob"]],
    });
  });

  it("does not expose import for a Simple Table", async () => {
    element = simpleTable();
    await act(async () => renderInspector());
    expect(container.querySelector('[data-presentation-table-data-import="true"]')).toBeNull();
  });

  it("reports an invalid source without invoking table mutation", async () => {
    presentation.resources = {
      files: [file("invalid.json", "application/json", "not json")],
    };
    await act(async () => renderInspector());
    const select = container.querySelector<HTMLSelectElement>("[data-presentation-table-import-file]");
    if (!select) throw new Error("file selector missing");
    await act(async () => {
      select.value = "invalid.json";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      container.querySelector<HTMLButtonElement>("[data-presentation-table-import-action]")?.click();
    });
    expect(controls.onImportData).not.toHaveBeenCalled();
    expect(container.querySelector('[data-presentation-table-import-error="true"]')).not.toBeNull();
  });
});
