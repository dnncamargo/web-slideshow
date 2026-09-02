// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BlockItem,
  BlockPart,
  BlocksElement,
  PowerShowElement,
} from "@powershow/document-schema";

import {
  StudioI18nProvider,
  useStudioI18n,
} from "../src/features/i18n/studio-i18n-context";
import type { StudioLocale } from "../src/features/i18n/studio-i18n";
import { BlocksInspector } from "../src/features/editor/inspector/blocks-inspector";
import type { BlocksAuthoringControls } from "../src/features/editor/inspector/inspector-types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const textPart = (id: string): BlockPart => ({
  id,
  type: "text",
  text: id,
});

const colorFor = (key: string): string =>
  key === "cat-2" ? "#22d3ee" : "#6366f1";

const socketValue = (id: string, color: string): BlockItem => ({
  id,
  color: colorFor(color),
  shape: "value",
  parts: [textPart(`${id}-p`)],
  children: [],
});

const statement = (id: string, color: string): BlockItem => ({
  id,
  color: colorFor(color),
  shape: "statement",
  parts: [textPart(`${id}-text`)],
  children: [],
});

const socketLiteral = (id: string, value: string): BlockPart => ({
  id,
  type: "socket",
  content: { type: "literal", value },
});

/** Chain of nested scopes: scope-1 at depth 1 ... scope-<depth> at depth <depth>. */
function scopeChain(depth: number): BlockItem[] {
  let items: BlockItem[] = [];

  for (let level = depth; level >= 1; level -= 1) {
    items = [
      {
        id: `scope-${level}`,
        color: colorFor("cat"),
        shape: "scope",
        parts: [textPart(`p-${level}`)],
        children: items,
      },
    ];
  }

  return items;
}

function fixturesBlocks(
  overrides: {
    items?: BlockItem[];
  } = {},
): BlocksElement {
  return {
    type: "blocks",
    id: "blocks-1",
    hidden: false,
    items: [
      {
        id: "scope-a",
        color: colorFor("cat"),
        shape: "scope",
        parts: [
          textPart("scope-a-text"),
          {
            id: "scope-a-socket",
            type: "socket",
            content: { type: "block", block: socketValue("value-a", "cat") },
          },
        ],
        children: [
          {
            id: "child-a",
            color: colorFor("cat"),
            shape: "statement",
            parts: [textPart("child-a-text")],
            children: [],
          },
        ],
      },
    ],
    ...overrides,
  };
}

/** Harness control to switch the Studio locale inside the i18n provider. */
function LocaleSwitch({ locale }: { locale: StudioLocale }) {
  const { setLocale } = useStudioI18n();

  return (
    <button
      type="button"
      data-locale-switch="true"
      onClick={() => setLocale(locale)}
    />
  );
}

describe("BlocksInspector content shell", () => {
  let container: HTMLDivElement;
  let root: Root;
  let elementState: BlocksElement;
  let updates: PowerShowElement[];
  let onUpdate: ReturnType<typeof vi.fn>;
  let controls: BlocksAuthoringControls;

  function renderInspector() {
    root.render(
      <StudioI18nProvider>
        <BlocksInspector
          element={elementState}
          onUpdate={onUpdate}
          blocksAuthoringControls={controls}
        />
      </StudioI18nProvider>,
    );
  }

  function mount(initial?: BlocksElement, extra?: ReactNode) {
    elementState = initial ?? fixturesBlocks();
    updates = [];
    onUpdate = vi.fn(
      (update: (element: PowerShowElement) => PowerShowElement) => {
        const next = update(elementState);
        elementState = next as BlocksElement;
        updates.push(elementState);
        renderInspector();
      },
    );
    controls = {
      onAddRootBlock: vi.fn(() => null),
      onAddScopeChild: vi.fn(() => null),
      onAddTextPart: vi.fn(() => null),
      onAddSocketPart: vi.fn(() => null),
      onCreateSocketValue: vi.fn(() => null),
    };
    root.render(
      <StudioI18nProvider>
        {extra}
        <BlocksInspector
          element={elementState}
          onUpdate={onUpdate}
          blocksAuthoringControls={controls}
        />
      </StudioI18nProvider>,
    );
  }

  function setInputValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;

    if (!setter) {
      throw new Error("Unable to set input value");
    }

    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function addBlockButton(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>(
      'button[data-powershow-block-add="true"]',
    );

    if (!button) {
      throw new Error("Add block button not found");
    }

    return button;
  }

  function itemRow(itemId: string): HTMLLIElement {
    const row = container.querySelector<HTMLLIElement>(
      `li[data-powershow-block-item-id="${itemId}"]`,
    );

    if (!row) {
      throw new Error(`Block item row not found: ${itemId}`);
    }

    return row;
  }

  function itemButton(itemId: string, selector: string): HTMLButtonElement {
    const row = itemRow(itemId);

    // Recursive rows (socket value blocks, scope children) nest inside the
    // requested row and reuse the same action buttons. Resolve ambiguity by
    // taking the match whose closest block-item ancestor is the row itself,
    // i.e. the button owned by this block and not by a nested one.
    const button = Array.from(row.querySelectorAll<HTMLButtonElement>(selector))
      .find(
        (candidate) =>
          candidate.closest("li[data-powershow-block-item-id]") === row,
      );

    if (!button) {
      throw new Error(`Button ${selector} not found on block: ${itemId}`);
    }

    return button;
  }

  function blockColorInput(itemId: string): HTMLInputElement {
    const input = itemRow(itemId).querySelector<HTMLInputElement>(
      'input[data-powershow-block-color="true"]',
    );

    if (!input) {
      throw new Error(`Color input not found on block: ${itemId}`);
    }

    return input;
  }

  function blockShapeSelect(itemId: string): HTMLSelectElement {
    const select = itemRow(itemId).querySelector<HTMLSelectElement>(
      'select[data-powershow-block-shape="true"]',
    );

    if (!select) {
      throw new Error(`Shape select not found on block: ${itemId}`);
    }

    return select;
  }

  function socketModeSelect(): HTMLSelectElement {
    const select = container.querySelector<HTMLSelectElement>(
      'select[data-powershow-part-socket-mode="true"]',
    );

    if (!select) {
      throw new Error("Socket mode select not found");
    }

    return select;
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
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders without performing any document write", async () => {
    await act(async () => {
      mount();
    });

    expect(updates).toHaveLength(0);
    expect(container.querySelector('[data-powershow-blocks-inspector="true"]'))
      .not.toBeNull();
  });

  it("reports root blocks without category management controls", async () => {
    await act(async () => {
      mount(
        fixturesBlocks({
          items: [
            statement("root-a", "cat"),
            statement("root-b", "cat-2"),
          ],
        }),
      );
    });

    const count = container.querySelector(
      "[data-powershow-blocks-count]",
    )?.getAttribute("data-powershow-blocks-count");
    expect(count).toBe("2");
    expect(container.querySelector("[data-powershow-blocks-categories]")).toBeNull();
    expect(container.querySelector('[data-powershow-block-add-category="true"]')).toBeNull();
  });

  it("does not invoke authoring controls on mount", async () => {
    await act(async () => {
      mount();
    });

    expect(controls.onAddRootBlock).not.toHaveBeenCalled();
    expect(controls.onAddScopeChild).not.toHaveBeenCalled();
    expect(controls.onAddTextPart).not.toHaveBeenCalled();
    expect(controls.onAddSocketPart).not.toHaveBeenCalled();
    expect(controls.onCreateSocketValue).not.toHaveBeenCalled();
  });

  it("Add block delegates exactly once to BlocksAuthoringControls", async () => {
    await act(async () => {
      mount();
    });

    await act(async () => {
      addBlockButton().click();
    });

    expect(controls.onAddRootBlock).toHaveBeenCalledTimes(1);
    expect(controls.onAddRootBlock).toHaveBeenCalledWith("blocks-1");
    expect(addBlockButton().textContent?.trim()).toBe("+ Block");
  });

  it("CONTENT no longer shows the temporary placeholder", async () => {
    await act(async () => {
      mount();
    });

    const text = container.textContent ?? "";
    expect(text).not.toContain("coming in the next checkpoint");
    expect(text).not.toContain("Visual block structure is present");
  });

  it("renders existing root blocks through the recursive BlocksItemEditor", async () => {
    await act(async () => {
      mount();
    });

    expect(
      container.querySelector('[data-powershow-blocks-editor="true"]'),
    ).not.toBeNull();
    const rootRow = itemRow("scope-a");
    expect(rootRow.getAttribute("data-powershow-block-depth")).toBe("1");
  });

  it("no longer renders the temporary B1 root summary representation", async () => {
    await act(async () => {
      mount();
    });

    expect(container.querySelector("[data-powershow-block-root]")).toBeNull();
    expect(container.querySelector('[data-powershow-blocks-editor="true"]'))
      .not.toBeNull();
  });

  it("shows the empty state when no blocks exist", async () => {
    await act(async () => {
      mount(fixturesBlocks({ items: [] }));
    });

    expect(container.querySelector('[data-powershow-blocks-editor="true"]'))
      .toBeNull();
    expect(container.textContent ?? "").toContain("No blocks");
  });

  it("shows the direct color control for an existing block", async () => {
    await act(async () => {
      mount();
    });

    expect(blockColorInput("scope-a").value).toBe("#6366f1");
  });

  it("shows the shape selector for an existing block", async () => {
    await act(async () => {
      mount();
    });

    expect(blockShapeSelect("scope-a").value).toBe("scope");
  });

  it("editing an existing Text part reaches the normal onUpdate path", async () => {
    await act(async () => {
      mount();
    });

    const textInput = itemRow("scope-a").querySelector<HTMLInputElement>(
      'input[data-powershow-part-text="true"]',
    );

    if (!textInput) {
      throw new Error("Text part input not found");
    }

    await act(async () => {
      setInputValue(textInput, "Edited text");
    });

    expect(updates).toHaveLength(1);
    if (updates[0]?.type === "blocks") {
      const firstPart = updates[0].items[0]?.parts[0];
      expect(firstPart?.type === "text" ? firstPart.text : null).toBe(
        "Edited text",
      );
    }
  });

  it("renders an existing Literal socket with its literal input", async () => {
    await act(async () => {
      mount(
        fixturesBlocks({
          items: [
            {
              id: "lit-root",
              color: "#6366f1",
              shape: "statement",
              parts: [textPart("lit-root-text"), socketLiteral("lit-sock", "42")],
              children: [],
            },
          ],
        }),
      );
    });

    expect(socketModeSelect().value).toBe("literal");

    const literalInput = container.querySelector<HTMLInputElement>(
      '[data-powershow-part-socket-literal-input="true"]',
    );

    if (!literalInput) {
      throw new Error("Literal socket input not found");
    }

    expect(literalInput.value).toBe("42");
  });

  it("renders an existing Value socket in UI mode value", async () => {
    await act(async () => {
      mount();
    });

    expect(socketModeSelect().value).toBe("value");
  });

  it("renders recursive Value block content inside the socket", async () => {
    await act(async () => {
      mount();
    });

    const valueRow = itemRow("value-a");
    expect(valueRow.getAttribute("data-powershow-block-shape")).toBe("value");
    expect(valueRow.getAttribute("data-powershow-block-depth")).toBe("2");

    const valueTextInput = valueRow.querySelector<HTMLInputElement>(
      'input[data-powershow-part-text="true"]',
    );

    if (!valueTextInput) {
      throw new Error("Value block text input not found");
    }

    expect(valueTextInput.value).toBe("value-a-p");
  });

  it("renders recursive Scope children", async () => {
    await act(async () => {
      mount();
    });

    const childRow = itemRow("child-a");
    expect(childRow.getAttribute("data-powershow-block-shape")).toBe(
      "statement",
    );
    expect(childRow.getAttribute("data-powershow-block-depth")).toBe("2");
  });

  it("Add Text Part delegates to BlocksAuthoringControls", async () => {
    await act(async () => {
      mount();
    });

    await act(async () => {
      itemButton(
        "scope-a",
        'button[data-powershow-block-add-part-text="true"]',
      ).click();
    });

    expect(controls.onAddTextPart).toHaveBeenCalledTimes(1);
    expect(controls.onAddTextPart).toHaveBeenCalledWith("blocks-1", "scope-a");
  });

  it("Add Socket Part delegates to BlocksAuthoringControls", async () => {
    await act(async () => {
      mount();
    });

    await act(async () => {
      itemButton(
        "scope-a",
        'button[data-powershow-block-add-part-socket="true"]',
      ).click();
    });

    expect(controls.onAddSocketPart).toHaveBeenCalledTimes(1);
    expect(controls.onAddSocketPart).toHaveBeenCalledWith("blocks-1", "scope-a");
  });

  it("Add Scope Child delegates to BlocksAuthoringControls", async () => {
    await act(async () => {
      mount();
    });

    await act(async () => {
      itemButton("scope-a", 'button[data-powershow-block-add-child="true"]')
        .click();
    });

    expect(controls.onAddScopeChild).toHaveBeenCalledTimes(1);
    expect(controls.onAddScopeChild).toHaveBeenCalledWith("blocks-1", "scope-a");
  });

  it("disables scope-child creation at the maximum block depth", async () => {
    await act(async () => {
      mount(fixturesBlocks({ items: scopeChain(5) }));
    });

    expect(
      itemButton("scope-5", 'button[data-powershow-block-add-child="true"]')
        .disabled,
    ).toBe(true);
    expect(
      itemButton("scope-1", 'button[data-powershow-block-add-child="true"]')
        .disabled,
    ).toBe(false);
  });

  it("keeps imported deeper-than-max content rendered and editable", async () => {
    await act(async () => {
      mount(fixturesBlocks({ items: scopeChain(7) }));
    });

    const deepRow = itemRow("scope-7");
    expect(deepRow.getAttribute("data-powershow-block-depth")).toBe("7");
    expect(
      itemButton("scope-7", 'button[data-powershow-block-add-child="true"]')
        .disabled,
    ).toBe(true);

    const deepTextInput = deepRow.querySelector<HTMLInputElement>(
      'input[data-powershow-part-text="true"]',
    );

    if (!deepTextInput) {
      throw new Error("Deep text part input not found");
    }

    await act(async () => {
      setInputValue(deepTextInput, "edited deep content");
    });

    expect(updates).toHaveLength(1);
    expect(
      itemRow("scope-7").querySelector<HTMLInputElement>(
        'input[data-powershow-part-text="true"]',
      )?.value,
    ).toBe("edited deep content");
  });

  it("resolves English editor labels through Studio i18n", async () => {
    await act(async () => {
      mount();
    });

    expect(blockColorInput("scope-a").getAttribute("aria-label")).toBe(
      "Block color",
    );
    expect(blockShapeSelect("scope-a").getAttribute("aria-label")).toBe(
      "Shape",
    );
    expect(socketModeSelect().querySelector('option[value="value"]')?.textContent)
      .toBe("Value block");
    expect(
      socketModeSelect().querySelector('option[value="literal"]')?.textContent,
    ).toBe("Written value");
  });

  it("resolves pt-BR editor labels after a locale switch", async () => {
    await act(async () => {
      mount(undefined, <LocaleSwitch locale="pt-BR" />);
    });

    await act(async () => {
      const switchButton = container.querySelector<HTMLButtonElement>(
        '[data-locale-switch="true"]',
      );

      if (!switchButton) {
        throw new Error("Locale switch button not found");
      }

      switchButton.click();
    });

    expect(blockColorInput("scope-a").getAttribute("aria-label")).toBe(
      "Cor do bloco",
    );
    expect(blockShapeSelect("scope-a").getAttribute("aria-label")).toBe(
      "Forma",
    );
    expect(
      blockShapeSelect("scope-a").querySelector(
        'option[value="scope"]',
      )?.textContent,
    ).toBe("Escopo");
    expect(socketModeSelect().querySelector('option[value="value"]')?.textContent)
      .toBe("Bloco de valor");
    expect(addBlockButton().textContent?.trim()).toBe("+ Bloco");
  });

  it("keeps Appearance and Effects sections", async () => {
    await act(async () => {
      mount();
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Appearance");
    expect(text).toContain("Effects");
  });
});
