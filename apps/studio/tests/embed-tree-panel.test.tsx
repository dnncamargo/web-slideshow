// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EmbedElement, Slide } from "@powershow/document-schema";

import { ElementTreePanel } from "../src/features/editor/element-tree-panel";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function embedElement(
  id: string,
  overrides: Partial<Omit<EmbedElement, "type" | "id">> = {},
): EmbedElement {
  return {
    id,
    type: "embed",
    src: "https://example.com/",
    title: "Embedded content",
    hidden: false,
    ...overrides,
  };
}

function slideWithEmbed(embed: EmbedElement): Slide {
  return {
    id: "slide-1",
    title: "Embed slide",
    summary: "",
    speakerNotes: "",
    elements: [embed],
  };
}

describe("ElementTreePanel Embed wiring", () => {
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
            onBrowseElementStyles={vi.fn()}
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

  it("renders an Embed node with the normal Embed type label", () => {
    renderPanel(slideWithEmbed(embedElement("embed-1")), vi.fn());

    const items = treeItems();

    const embedItem = items.find((item) =>
      rowButton(item).textContent?.includes("Embed"),
    );

    expect(embedItem).not.toBeUndefined();
  });

  it("selects an Embed through the normal tree row", () => {
    const onSelectElement = vi.fn();

    renderPanel(
      slideWithEmbed(embedElement("embed-1", { title: "Live chart" })),
      onSelectElement,
    );

    const items = treeItems();

    const embedItem = items.find((item) =>
      rowButton(item).textContent?.includes("Embed"),
    );

    if (!embedItem) {
      throw new Error("Embed tree row not found");
    }

    act(() => {
      rowButton(embedItem).click();
    });

    expect(onSelectElement).toHaveBeenCalledWith({
      id: "embed-1",
      type: "embed",
    });
  });

  it("exposes no tree children for an Embed leaf", () => {
    renderPanel(slideWithEmbed(embedElement("embed-1")), vi.fn());

    const items = treeItems();

    const embedItem = items.find((item) =>
      rowButton(item).textContent?.includes("Embed"),
    );

    if (!embedItem) {
      throw new Error("Embed tree row not found");
    }

    const group = Array.from(embedItem.children).find(
      (child): child is HTMLUListElement =>
        child instanceof HTMLUListElement &&
        child.getAttribute("role") === "group",
    );

    expect(group).toBeUndefined();
  });
});
