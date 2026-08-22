// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BlockItem,
  BlockPart,
  BlocksElement,
  PowerShowElement,
} from "@powershow/document-schema";

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { BlocksInspector } from "../src/features/editor/inspector/blocks-inspector";
import type { BlocksAuthoringControls } from "../src/features/editor/inspector/inspector-types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const textPart = (id: string): BlockPart => ({
  id,
  type: "text",
  text: id,
});

const socketValue = (id: string, categoryId: string): BlockItem => ({
  id,
  categoryId,
  shape: "value",
  parts: [textPart(`${id}-p`)],
  children: [],
});

const statement = (id: string, categoryId: string): BlockItem => ({
  id,
  categoryId,
  shape: "statement",
  parts: [textPart(`${id}-text`)],
  children: [],
});

function fixturesBlocks(
  overrides: {
    categories?: { id: string; name: string; color: string }[];
    items?: BlockItem[];
  } = {},
): BlocksElement {
  return {
    type: "blocks",
    id: "blocks-1",
    hidden: false,
    categories: [
      { id: "cat", name: "Category", color: "#6366f1" },
    ],
    items: [
      {
        id: "scope-a",
        categoryId: "cat",
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
            categoryId: "cat",
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

  function mount(initial?: BlocksElement) {
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
    renderInspector();
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

  function categoryRow(categoryId: string): HTMLLIElement {
    const row = container.querySelector<HTMLLIElement>(
      `li[data-powershow-block-category-id="${categoryId}"]`,
    );

    if (!row) {
      throw new Error(`Category row not found: ${categoryId}`);
    }

    return row;
  }

  function categoryNameInput(categoryId: string): HTMLInputElement {
    const input = categoryRow(categoryId).querySelector<HTMLInputElement>(
      'input[data-powershow-block-category-name="true"]',
    );

    if (!input) {
      throw new Error(`Category name input not found: ${categoryId}`);
    }

    return input;
  }

  function categoryColorInput(categoryId: string): HTMLInputElement {
    const input = categoryRow(categoryId).querySelector<HTMLInputElement>(
      'input[data-powershow-block-category-color="true"]',
    );

    if (!input) {
      throw new Error(`Category color input not found: ${categoryId}`);
    }

    return input;
  }

  function categoryRemoveButton(categoryId: string): HTMLButtonElement {
    const button = categoryRow(categoryId).querySelector<HTMLButtonElement>(
      'button[data-powershow-block-category-remove="true"]',
    );

    if (!button) {
      throw new Error(`Category remove button not found: ${categoryId}`);
    }

    return button;
  }

  function addCategoryButton(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>(
      'button[data-powershow-block-add-category="true"]',
    );

    if (!button) {
      throw new Error("Add category button not found");
    }

    return button;
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

  it("renders without performing any document write", async () => {
    await act(async () => {
      mount();
    });

    expect(updates).toHaveLength(0);
    expect(container.querySelector('[data-powershow-blocks-inspector="true"]'))
      .not.toBeNull();
  });

  it("reports categories and root blocks on the shell markers", async () => {
    await act(async () => {
      mount(
        fixturesBlocks({
          categories: [
            { id: "cat", name: "Category", color: "#6366f1" },
            { id: "cat-2", name: "Events", color: "#22d3ee" },
          ],
          items: [
            statement("root-a", "cat"),
            statement("root-b", "cat"),
          ],
        }),
      );
    });

    const count = container.querySelector(
      "[data-powershow-blocks-count]",
    )?.getAttribute("data-powershow-blocks-count");
    const categories = container.querySelector(
      "[data-powershow-blocks-categories]",
    )?.getAttribute("data-powershow-blocks-categories");

    expect(count).toBe("2");
    expect(categories).toBe("2");
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

  it("lists the ordered root blocks for the later recursive editor", async () => {
    await act(async () => {
      mount(
        fixturesBlocks({
          items: [
            statement("root-a", "cat"),
            statement("root-b", "cat"),
          ],
        }),
      );
    });

    const rootRows = Array.from(
      container.querySelectorAll<HTMLLIElement>(
        "[data-powershow-block-root]",
      ),
    );

    expect(rootRows.map((row) => row.getAttribute("data-powershow-block-root")))
      .toEqual(["root-a", "root-b"]);
    expect(container.textContent ?? "").toContain("root-a-text");
    expect(container.textContent ?? "").toContain("Statement");
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
  });

  it("Add category appends a provider-neutral local category", async () => {
    await act(async () => {
      mount();
    });

    await act(async () => {
      addCategoryButton().click();
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.type).toBe("blocks");
    if (updates[0]?.type === "blocks") {
      expect(updates[0].categories).toHaveLength(2);
      expect(updates[0].categories[1]).toEqual({
        id: "block-category",
        name: "Category",
        color: "#6366f1",
      });
    }
  });

  it("renames an editable category through the canonical operation", async () => {
    await act(async () => {
      mount();
    });

    await act(async () => {
      setInputValue(categoryNameInput("cat"), "Loops");
    });

    expect(updates).toHaveLength(1);
    if (updates[0]?.type === "blocks") {
      expect(updates[0].categories[0]?.name).toBe("Loops");
      expect(updates[0].categories[0]?.id).toBe("cat");
    }
  });

  it("updates the category color through the canonical operation", async () => {
    await act(async () => {
      mount();
    });

    await act(async () => {
      setInputValue(categoryColorInput("cat"), "#ff00ff");
    });

    expect(updates).toHaveLength(1);
    if (updates[0]?.type === "blocks") {
      expect(updates[0].categories[0]?.color).toBe("#ff00ff");
    }
  });

  it("removes an unused category while keeping used ones", async () => {
    await act(async () => {
      mount(
        fixturesBlocks({
          categories: [
            { id: "cat", name: "Category", color: "#6366f1" },
            { id: "unused", name: "Unused", color: "#22d3ee" },
          ],
        }),
      );
    });

    await act(async () => {
      categoryRemoveButton("unused").click();
    });

    expect(updates).toHaveLength(1);
    if (updates[0]?.type === "blocks") {
      expect(updates[0].categories.map((c) => c.id)).toEqual(["cat"]);
    }
  });

  it("cannot remove a category that is referenced anywhere", async () => {
    await act(async () => {
      mount();
    });

    const removeButton = categoryRemoveButton("cat");

    expect(removeButton.disabled).toBe(true);
    expect(removeButton.getAttribute("aria-label")).toBe("Category in use");

    await act(async () => {
      removeButton.click();
    });

    expect(updates).toHaveLength(0);
  });

  it("CONTENT no longer shows the temporary placeholder", async () => {
    await act(async () => {
      mount();
    });

    const text = container.textContent ?? "";
    expect(text).not.toContain("coming in the next checkpoint");
    expect(text).not.toContain("Visual block structure is present");
  });

  it("keeps the block-item text editor out of the content shell", async () => {
    await act(async () => {
      mount();
    });

    expect(
      container.querySelector('input[data-powershow-block-text="true"]'),
    ).toBeNull();
    expect(
      container.querySelector('textarea[data-powershow-block-text="true"]'),
    ).toBeNull();
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