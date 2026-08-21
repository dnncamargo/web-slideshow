// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PowerShowElement,
  SimpleTableElement,
  Slide,
  StructuredTableElement,
} from "@powershow/document-schema";

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { TableInspector } from "../src/features/editor/inspector/table-inspector";
import type { TableAuthoringControls } from "../src/features/editor/inspector/inspector-types";
import {
  addColumnToStructuredTable,
  addRowToStructuredTable,
  removeColumnFromStructuredTable,
  removeRowFromStructuredTable,
  setStructuredTableShowHeader,
} from "../src/features/editor/element-operations";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function simpleTable(): SimpleTableElement {
  return {
    type: "table",
    id: "simple-table",
    hidden: false,
    columns: [{ key: "value", label: "Value" }],
    rows: [{ value: "text" }],
  };
}

function structuredTable(): StructuredTableElement {
  return {
    type: "table",
    id: "structured-table",
    mode: "structured",
    showHeader: true,
    hidden: false,
    columns: [
      {
        id: "col-1",
        header: {
          id: "hdr-1",
          children: [
            {
              type: "text",
              id: "header-text-1",
              hidden: false,
              variant: "body",
              content: "Column 1",
            },
          ],
        },
      },
      {
        id: "col-2",
        header: {
          id: "hdr-2",
          children: [
            {
              type: "text",
              id: "header-text-2",
              hidden: false,
              variant: "body",
              content: "Column 2",
            },
          ],
        },
      },
    ],
    rows: [
      {
        id: "row-1",
        cells: [
          {
            id: "cell-1-1",
            children: [
              {
                type: "text",
                id: "cell-text-1-1",
                hidden: false,
                variant: "body",
                content: "a",
              },
            ],
          },
          {
            id: "cell-1-2",
            children: [
              {
                type: "text",
                id: "cell-text-1-2",
                hidden: false,
                variant: "body",
                content: "b",
              },
            ],
          },
        ],
      },
    ],
  };
}

function wrapSlide(element: PowerShowElement): Slide[] {
  return [
    {
      id: "slide",
      title: "",
      summary: "",
      speakerNotes: "",
      elements: [element],
    },
  ];
}

describe("TableInspector", () => {
  let container: HTMLDivElement;
  let root: Root;
  let elementState: PowerShowElement;
  let updates: PowerShowElement[];
  let controls: TableAuthoringControls;

  function renderInspector() {
    root.render(
      <StudioI18nProvider>
        <TableInspector
          element={elementState as SimpleTableElement | StructuredTableElement}
          onUpdate={(update) => {
            const next = update(elementState);
            elementState = next;
            updates.push(next);
            renderInspector();
          }}
          tableAuthoringControls={controls}
        />
      </StudioI18nProvider>,
    );
  }

  function mount(initial: PowerShowElement) {
    elementState = initial;
    updates = [];
    controls = {
      onAddColumn: (tableId) => {
        const slides = addColumnToStructuredTable(wrapSlide(elementState), tableId);
        elementState = slides[0]!.elements[0]!;
        renderInspector();
      },
      onRemoveColumn: (tableId, index) => {
        const slides = removeColumnFromStructuredTable(
          wrapSlide(elementState),
          tableId,
          index,
        );
        elementState = slides[0]!.elements[0]!;
        renderInspector();
      },
      onAddRow: (tableId) => {
        const slides = addRowToStructuredTable(wrapSlide(elementState), tableId);
        elementState = slides[0]!.elements[0]!;
        renderInspector();
      },
      onRemoveRow: (tableId, index) => {
        const slides = removeRowFromStructuredTable(
          wrapSlide(elementState),
          tableId,
          index,
        );
        elementState = slides[0]!.elements[0]!;
        renderInspector();
      },
      onShowHeaderChange: (tableId, showHeader) => {
        const slides = setStructuredTableShowHeader(
          wrapSlide(elementState),
          tableId,
          showHeader,
        );
        elementState = slides[0]!.elements[0]!;
        renderInspector();
      },
    };
    renderInspector();
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  function columnRows(): HTMLElement[] {
    return Array.from(
      container.querySelectorAll<HTMLElement>("[data-powershow-table-column]"),
    );
  }

  function rowRows(): HTMLElement[] {
    return Array.from(
      container.querySelectorAll<HTMLElement>("[data-powershow-table-row]"),
    );
  }

  function addColumnButton(): HTMLButtonElement | null {
    return container.querySelector<HTMLButtonElement>(
      "[data-powershow-table-add-column]",
    );
  }

  function addRowButton(): HTMLButtonElement | null {
    return container.querySelector<HTMLButtonElement>(
      "[data-powershow-table-add-row]",
    );
  }

  function headerCheckbox(): HTMLInputElement | null {
    return container.querySelector<HTMLInputElement>('input[type="checkbox"]');
  }

  it("keeps the legacy Simple Table Inspector controls", async () => {
    await act(async () => {
      mount(simpleTable());
    });

    const labelInput = container.querySelector<HTMLInputElement>(
      'input[name^="tableColumnLabel_"]',
    );
    const keyInput = container.querySelector<HTMLInputElement>(
      'input[name^="tableColumnKey_"]',
    );
    const cellTypeSelect = container.querySelector<HTMLSelectElement>(
      'select[name^="tableCell_"]',
    );

    expect(labelInput).not.toBeNull();
    expect(keyInput).not.toBeNull();
    expect(cellTypeSelect).not.toBeNull();
    expect(headerCheckbox()).toBeNull();
  });

  it("renders minimal structural controls for a Structured Table", async () => {
    await act(async () => {
      mount(structuredTable());
    });

    expect(headerCheckbox()?.checked).toBe(true);
    expect(columnRows()).toHaveLength(2);
    expect(rowRows()).toHaveLength(1);
    expect(addColumnButton()).not.toBeNull();
    expect(addRowButton()).not.toBeNull();
  });

  it("adds a column keeping every row rectangular", async () => {
    await act(async () => {
      mount(structuredTable());
    });

    await act(async () => {
      addColumnButton()?.click();
    });

    const updated = elementState as StructuredTableElement;
    expect(updated.columns).toHaveLength(3);
    expect(columnRows()).toHaveLength(3);
    for (const row of updated.rows) {
      expect(row.cells).toHaveLength(updated.columns.length);
    }
  });

  it("removes a column keeping every row rectangular", async () => {
    await act(async () => {
      mount(structuredTable());
    });

    await act(async () => {
      const removeButtons = Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          "[data-powershow-table-remove-column]",
        ),
      );
      removeButtons[0]?.click();
    });

    const updated = elementState as StructuredTableElement;
    expect(updated.columns).toHaveLength(1);
    expect(updated.columns[0]?.id).toBe("col-2");
    expect(updated.rows[0]?.cells).toHaveLength(1);
  });

  it("adds a row producing one cell per column", async () => {
    await act(async () => {
      mount(structuredTable());
    });

    await act(async () => {
      addRowButton()?.click();
    });

    const updated = elementState as StructuredTableElement;
    expect(updated.rows).toHaveLength(2);
    expect(updated.rows[1]?.cells).toHaveLength(updated.columns.length);
    expect(rowRows()).toHaveLength(2);
  });

  it("removes only the selected structural row", async () => {
    await act(async () => {
      mount(structuredTable());
    });

    await act(async () => {
      const removeButtons = Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          "[data-powershow-table-remove-row]",
        ),
      );
      removeButtons[0]?.click();
    });

    const updated = elementState as StructuredTableElement;
    expect(updated.rows).toHaveLength(0);
    expect(updated.columns).toHaveLength(2);
  });

  it("show header toggles only the visibility state", async () => {
    await act(async () => {
      mount(structuredTable());
    });

    const headerId = (elementState as StructuredTableElement).columns[0]?.header.id;

    await act(async () => {
      const checkbox = headerCheckbox();
      if (!checkbox) {
        throw new Error("show header checkbox not found");
      }
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "checked",
      )?.set;
      if (!setter) {
        throw new Error("Unable to set checkbox checked");
      }
      setter.call(checkbox, false);
      checkbox.dispatchEvent(new Event("click", { bubbles: true }));
    });

    const updated = elementState as StructuredTableElement;
    expect(updated.showHeader).toBe(false);
    expect(updated.columns[0]?.header.id).toBe(headerId);
    expect(updated.columns[0]?.header.children).toHaveLength(1);
  });

  it("mounting the Structured Inspector performs no document write", async () => {
    await act(async () => {
      mount(structuredTable());
    });

    expect(updates).toHaveLength(0);
  });
});