// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BlockItem,
  BlocksElement,
  Slide,
} from "@powershow/document-schema";

import { ElementTreePanel } from "../src/features/editor/element-tree-panel";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

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
  id: string,
  items: BlockItem[],
): BlocksElement {
  return {
    id,
    type: "blocks",
    hidden: false,
    items,
  };
}

function slideWithBlocks(blocks: BlocksElement): Slide {
  return {
    id: "slide-1",
    title: "Blocks slide",
    summary: "",
    speakerNotes: "",
    elements: [blocks],
  };
}

describe("ElementTreePanel Blocks wiring", () => {
  let container: HTMLDivElement;
  let root: Root;

  function renderPanel(
    slide: Slide,
    onSelectElement: ReturnType<typeof vi.fn>,
  ) {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <ElementTreePanel
            slide={slide}
            selectedElementId={null}
            selectedContentSlotId={null}
            onSelectElement={onSelectElement}
            onMoveElement={vi.fn()}
          />
        </StudioI18nProvider>,
      );
    });
  }

  function treeItems(): HTMLLIElement[] {
    return Array.from(container.querySelectorAll('li[role="treeitem"]'));
  }

  function rowButton(treeItem: HTMLLIElement): HTMLButtonElement {
    const button =
      treeItem.querySelector<HTMLButtonElement>(
        ':scope > div > button[type="button"]:last-of-type',
      ) ??
      treeItem.querySelector<HTMLButtonElement>(
        'div > button[type="button"]:last-of-type',
      );

    if (!button) {
      throw new Error("Tree item row button not found");
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

  it("renders a Blocks node with the Blocks type label", () => {
    renderPanel(
      slideWithBlocks(blocksElement("blocks-1", [blockItem("root-a", "A")])),
      vi.fn(),
    );

    const items = treeItems();

    const blocksItem = items.find((item) =>
      rowButton(item).textContent?.includes("Blocks"),
    );

    expect(blocksItem).not.toBeUndefined();
  });

  it("selects the Blocks root through the normal tree row", () => {
    const onSelectElement = vi.fn();

    renderPanel(
      slideWithBlocks(blocksElement("blocks-1", [blockItem("root-a", "A")])),
      onSelectElement,
    );

    const items = treeItems();

    const blocksItem = items.find((item) =>
      rowButton(item).textContent?.includes("Blocks"),
    );

    if (!blocksItem) {
      throw new Error("Blocks tree row not found");
    }

    act(() => {
      rowButton(blocksItem).click();
    });

    expect(onSelectElement).toHaveBeenCalledWith({
      id: "blocks-1",
      type: "blocks",
    });
  });

  it("exposes no BlockItem rows as Element Tree children", () => {
    renderPanel(
      slideWithBlocks(
        blocksElement("blocks-1", [
          blockItem("root-a", "A", [blockItem("child-a", "Nested")]),
        ]),
      ),
      vi.fn(),
    );

    const items = treeItems();

    const blocksItem = items.find((item) =>
      rowButton(item).textContent?.includes("Blocks"),
    );

    if (!blocksItem) {
      throw new Error("Blocks tree row not found");
    }

    // Leaf: no group children.
    const group = Array.from(blocksItem.children).find(
      (child): child is HTMLUListElement =>
        child instanceof HTMLUListElement &&
        child.getAttribute("role") === "group",
    );

    expect(group).toBeUndefined();

    // No BlockItem ids appear anywhere in the tree.
    const allItems = treeItems();

    for (const item of allItems) {
      expect(
        item.querySelector('[data-powershow-block-item-id]'),
      ).toBeNull();
    }
  });
});