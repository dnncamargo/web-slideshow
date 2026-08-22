// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BlockItem,
  BlocksElement,
  PowerShowElement,
} from "@powershow/document-schema";

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { BlocksInspector } from "../src/features/editor/inspector/blocks-inspector";
import { ElementInspector } from "../src/features/editor/element-inspector";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function blockItem(
  id: string,
  text: string,
  children: BlockItem[] = [],
): BlockItem {
  return {
    id,
    text,
    children,
  };
}

function blocksElement(
  items: BlockItem[],
  overrides: Partial<Omit<BlocksElement, "type" | "items">> = {},
): BlocksElement {
  return {
    id: "blocks-1",
    type: "blocks",
    hidden: false,
    items,
    ...overrides,
  };
}

/**
 * Builds a single chain of depth `depth` with ids "level-1" (root)
 * through "level-N" (deepest).
 */
function deepChain(depth: number): BlockItem {
  let item = blockItem(`level-${depth}`, `level-${depth}`);

  for (let level = depth - 1; level >= 1; level -= 1) {
    item = blockItem(`level-${level}`, `level-${level}`, [item]);
  }

  return item;
}

describe("BlocksInspector", () => {
  let container: HTMLDivElement;
  let root: Root;
  let elementState: BlocksElement;
  let updates: BlocksElement[];
  let addTopLevelBlock: ReturnType<typeof vi.fn>;
  let addChildBlock: ReturnType<typeof vi.fn>;

  function renderInspector() {
    root.render(
      <StudioI18nProvider>
        <BlocksInspector
          element={elementState}
          onUpdate={(update) => {
            const next = update(elementState);
            if (next.type !== "blocks") {
              return;
            }
            elementState = next;
            updates.push(elementState);
            renderInspector();
          }}
          blocksAuthoringControls={{
            onAddTopLevelBlock: addTopLevelBlock,
            onAddChildBlock: addChildBlock,
          }}
        />
      </StudioI18nProvider>,
    );
  }

  function mount(initial: BlocksElement) {
    elementState = initial;
    updates = [];
    addTopLevelBlock = vi.fn(() => "root-block-created");
    addChildBlock = vi.fn(() => "child-block-created");
    renderInspector();
  }

  async function mountAsync(initial: BlocksElement) {
    await act(async () => {
      mount(initial);
    });
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

  function row(blockItemId: string): HTMLLIElement {
    const item = container.querySelector<HTMLLIElement>(
      `li[data-powershow-block-item-id="${blockItemId}"]`,
    );

    if (!item) {
      throw new Error(`Block row not found: ${blockItemId}`);
    }

    return item;
  }

  function blockInput(blockItemId: string): HTMLInputElement {
    const input = row(blockItemId).querySelector<HTMLInputElement>(
      'input[data-powershow-block-input="true"]',
    );

    if (!input) {
      throw new Error(`Block input not found: ${blockItemId}`);
    }

    return input;
  }

  function buttonInRow(
    blockItemId: string,
    attribute: string,
  ): HTMLButtonElement {
    const button = row(blockItemId).querySelector<HTMLButtonElement>(
      `button[${attribute}="true"]`,
    );

    if (!button) {
      throw new Error(
        `Block row button not found: ${attribute} for ${blockItemId}`,
      );
    }

    return button;
  }

  function addRootButton(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>(
      'button[data-powershow-blocks-add-root="true"]',
    );

    if (!button) {
      throw new Error("Add block button not found");
    }

    return button;
  }

  function setTextInputValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;

    if (!setter) {
      throw new Error("Unable to set input value");
    }

    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("renders root BlockItems recursively", async () => {
    await mountAsync(
      blocksElement([
        blockItem("root-a", "First"),
        blockItem("root-b", "Second"),
      ]),
    );

    expect(blockInput("root-a").value).toBe("First");

    expect(blockInput("root-b").value).toBe("Second");
  });

  it("renders nested BlockItems recursively", async () => {
    await mountAsync(
      blocksElement([
        blockItem("root-a", "First", [
          blockItem("child-a", "Child", [blockItem("grand-a", "Grand")]),
        ]),
      ]),
    );

    expect(blockInput("root-a").value).toBe("First");

    expect(blockInput("child-a").value).toBe("Child");

    expect(blockInput("grand-a").value).toBe("Grand");
  });

  it("reflects canonical text in the input value", async () => {
    await mountAsync(blocksElement([blockItem("root-a", "Canonical")]));

    expect(blockInput("root-a").value).toBe("Canonical");
  });

  it("writes text immediately on change", async () => {
    await mountAsync(blocksElement([blockItem("root-a", "Before")]));

    act(() => {
      setTextInputValue(blockInput("root-a"), "After");
    });

    expect(elementState.items[0]?.text).toBe("After");

    expect(updates.at(-1)?.items[0]?.text).toBe("After");
  });

  it("writes empty text immediately on change", async () => {
    await mountAsync(blocksElement([blockItem("root-a", "Before")]));

    act(() => {
      setTextInputValue(blockInput("root-a"), "");
    });

    expect(elementState.items[0]?.text).toBe("");
  });

  it("calls the authoring control when Add block is pressed and focuses the new input", async () => {
    await mountAsync(blocksElement([]));

    act(() => {
      addRootButton().click();
    });

    expect(addTopLevelBlock).toHaveBeenCalledWith("blocks-1");

    // Simulate the workspace appending the created BlockItem.
    await act(async () => {
      elementState = {
        ...elementState,
        items: [...elementState.items, blockItem("root-block-created", "New block")],
      };
      renderInspector();
    });

    expect(blockInput("root-block-created")).toBeTruthy();

    expect(document.activeElement).toBe(blockInput("root-block-created"));
  });

  it("calls the authoring control when Add child block is clicked", async () => {
    await mountAsync(blocksElement([blockItem("root-a", "First")]));

    act(() => {
      buttonInRow("root-a", "data-powershow-block-add-child").click();
    });

    expect(addChildBlock).toHaveBeenCalledWith("blocks-1", "root-a");
  });

  it("removes a BlockItem through canonical state", async () => {
    await mountAsync(
      blocksElement([
        blockItem("root-a", "First"),
        blockItem("root-b", "Second"),
      ]),
    );

    act(() => {
      buttonInRow("root-a", "data-powershow-block-remove").click();
    });

    expect(elementState.items.map((item) => item.id)).toEqual(["root-b"]);

    expect(
      container.querySelector('li[data-powershow-block-item-id="root-a"]'),
    ).toBeNull();
  });

  it("removes a parent and its displayed descendants", async () => {
    await mountAsync(
      blocksElement([
        blockItem("root-a", "First", [
          blockItem("child-a", "Child", [blockItem("grand-a", "Grand")]),
        ]),
      ]),
    );

    act(() => {
      buttonInRow("root-a", "data-powershow-block-remove").click();
    });

    expect(elementState.items).toEqual([]);

    expect(
      container.querySelector('li[data-powershow-block-item-id="root-a"]'),
    ).toBeNull();

    expect(
      container.querySelector('li[data-powershow-block-item-id="child-a"]'),
    ).toBeNull();

    expect(
      container.querySelector('li[data-powershow-block-item-id="grand-a"]'),
    ).toBeNull();
  });

  it("disables Move Up on the first sibling and Move Down on the last", async () => {
    await mountAsync(
      blocksElement([
        blockItem("root-a", "First"),
        blockItem("root-b", "Second"),
      ]),
    );

    expect(
      buttonInRow("root-a", "data-powershow-block-move-up").disabled,
    ).toBe(true);

    expect(
      buttonInRow("root-a", "data-powershow-block-move-down").disabled,
    ).toBe(false);

    expect(
      buttonInRow("root-b", "data-powershow-block-move-up").disabled,
    ).toBe(false);

    expect(
      buttonInRow("root-b", "data-powershow-block-move-down").disabled,
    ).toBe(true);
  });

  it("moves a nested BlockItem within its own siblings", async () => {
    await mountAsync(
      blocksElement([
        blockItem("root-a", "First", [
          blockItem("child-1", "One"),
          blockItem("child-2", "Two"),
        ]),
      ]),
    );

    act(() => {
      buttonInRow("child-2", "data-powershow-block-move-up").click();
    });

    expect(
      elementState.items[0]?.children.map((item) => item.id),
    ).toEqual(["child-2", "child-1"]);

    expect(elementState.items).toHaveLength(1);
  });

  it("disables Add Child at the maximum structural depth", async () => {
    await mountAsync(blocksElement([deepChain(5)]));

    expect(
      buttonInRow("level-5", "data-powershow-block-add-child").disabled,
    ).toBe(true);

    expect(
      buttonInRow("level-4", "data-powershow-block-add-child").disabled,
    ).toBe(false);
  });

  it("renders an empty state when there are no blocks", async () => {
    await mountAsync(blocksElement([]));

    expect(
      container.querySelector('li[data-powershow-block-item-id]'),
    ).toBeNull();

    expect(addRootButton()).toBeTruthy();
  });

  it("renders the Appearance section with the intended controls", async () => {
    await mountAsync(blocksElement([blockItem("root-a", "First")]));

    expect(container.querySelector("#blocks-color")).not.toBeNull();

    expect(container.querySelector("#blocks-background")).not.toBeNull();

    expect(container.querySelector("#blocks-gradient-type")).not.toBeNull();

    expect(container.querySelector("#blocks-border-radius")).not.toBeNull();

    expect(container.querySelector("#blocks-opacity")).not.toBeNull();

    expect(container.querySelector("#blocks-border-style")).not.toBeNull();
  });

  it("renders the Effects section", async () => {
    await mountAsync(blocksElement([blockItem("root", "First")]));

    expect(container.querySelector("#blocks-shadow-mode")).not.toBeNull();
  });

  it("exposes no Blockly/provider/runtime controls", async () => {
    await mountAsync(blocksElement([blockItem("root", "First")]));

    const html = container.innerHTML;

    expect(html).not.toContain("blockly");

    expect(html).not.toContain("generatedCode");

    expect(html).not.toContain("toolbox");

    expect(html).not.toContain("workspace");

    expect(html).not.toContain("provider");
  });
});

describe("ElementInspector dispatcher for Blocks", () => {
  let container: HTMLDivElement;
  let root: Root;

  const FONT_RESOURCE_CONTROLS = {
    fontResources: [],
    onAddFontFace: vi.fn(),
    onRemoveFontFace: vi.fn(),
    isFontFamilyInUse: () => false,
  };

  const TOPICS_AUTHORING_CONTROLS = {
    onAddTopLevelTopic: () => null,
    onAddChildTopic: () => null,
  };

  const BLOCKS_AUTHORING_CONTROLS = {
    onAddTopLevelBlock: () => null,
    onAddChildBlock: () => null,
  };

  const TABLE_AUTHORING_CONTROLS = {
    onAddColumn: () => {},
    onRemoveColumn: () => {},
    onAddRow: () => {},
    onRemoveRow: () => {},
    onShowHeaderChange: () => {},
  };

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

  it("renders the BlocksInspector for a selected Blocks element", async () => {
    const element: PowerShowElement = {
      id: "blocks-1",
      type: "blocks",
      hidden: false,
      items: [blockItem("root-a", "First")],
    };

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <ElementInspector
            element={element}
            onUpdate={() => undefined}
            fontResourceControls={FONT_RESOURCE_CONTROLS}
            preserveImageProportion={false}
            onPreserveImageProportionChange={() => {}}
            focalEditingImageId={null}
            onFocalEditingImageIdChange={() => {}}
            parent={null}
            layerControls={null}
            topicsAuthoringControls={TOPICS_AUTHORING_CONTROLS}
            blocksAuthoringControls={BLOCKS_AUTHORING_CONTROLS}
            tableAuthoringControls={TABLE_AUTHORING_CONTROLS}
          />
        </StudioI18nProvider>,
      );
    });

    const blocksRow = container.querySelector<HTMLLIElement>(
      'li[data-powershow-block-item-id="root-a"]',
    );

    expect(blocksRow).not.toBeNull();
  });
});