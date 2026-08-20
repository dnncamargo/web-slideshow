// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ContentSlot,
  ImageElement,
  PowerShowElement,
  Slide,
  TableElement,
  TopicItem,
  TopicsElement,
} from "@powershow/document-schema";

import { ElementTreePanel } from "../src/features/editor/element-tree-panel";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function text(id: string, content = id): PowerShowElement {
  return {
    type: "text",
    id,
    hidden: false,
    variant: "body",
    content,
  };
}

function image(id: string, alt = id): ImageElement {
  return {
    type: "image",
    id,
    hidden: false,
    src: `/assets/${id}.png`,
    alt,
    fit: "contain",
  };
}

function table(id: string): TableElement {
  return {
    type: "table",
    id,
    hidden: false,
    columns: [{ key: "value", label: "Value" }],
    rows: [{ value: id }],
  };
}

function topicContainer(
  id: string,
  children: PowerShowElement[] = [],
): PowerShowElement {
  return {
    type: "container",
    id,
    hidden: false,
    direction: "column",
    children,
  };
}

function contentSlot(
  id: string,
  children: PowerShowElement[] = [],
): ContentSlot {
  return {
    id,
    children,
  };
}

function topicItem(
  id: string,
  slot: ContentSlot,
  children: TopicItem[] = [],
): TopicItem {
  return {
    id,
    content: slot,
    children,
  };
}

function topicsElement(items: TopicItem[]): TopicsElement {
  return {
    type: "topics",
    id: "topics-1",
    hidden: false,
    kind: "unordered",
    items,
  };
}

function slideWithTopics(items: TopicItem[]): Slide {
  return {
    id: "slide-1",
    title: "Topics",
    summary: "",
    speakerNotes: "",
    elements: [topicsElement(items)],
  };
}

function normalizeLabel(value: string | null): string {
  return (value ?? "").replace(/\s*\[[^\]]+\]\s*$/, "").trim();
}

function treeItems(container: HTMLDivElement): HTMLLIElement[] {
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

function treeItemLabel(treeItem: HTMLLIElement): string {
  return normalizeLabel(rowButton(treeItem).textContent);
}

function findTreeItem(container: HTMLDivElement, label: string): HTMLLIElement {
  const item = treeItems(container).find(
    (treeItem) => treeItemLabel(treeItem) === label,
  );

  if (!item) {
    throw new Error(`Tree item not found: ${label}`);
  }

  return item;
}

function directTreeGroup(treeItem: HTMLLIElement): HTMLUListElement | null {
  const group = Array.from(treeItem.children).find(
    (child): child is HTMLUListElement =>
      child instanceof HTMLUListElement && child.getAttribute("role") === "group",
  );

  return group ?? null;
}

function directTopicChildren(treeItem: HTMLLIElement): HTMLLIElement[] {
  const group = directTreeGroup(treeItem);

  if (!group) {
    return [];
  }

  return Array.from(group.children).filter(
    (child): child is HTMLLIElement =>
      child instanceof HTMLLIElement && child.getAttribute("role") === "treeitem",
  );
}

function contentGroup(treeItem: HTMLLIElement): HTMLElement {
  const group = treeItem.querySelector<HTMLElement>(
    "[data-powershow-tree-content-group]",
  );

  if (!group) {
    throw new Error("Content group not found");
  }

  return group;
}

function contentGroupItems(treeItem: HTMLLIElement): HTMLLIElement[] {
  return Array.from(
    contentGroup(treeItem).querySelectorAll('li[role="treeitem"]'),
  );
}

  function contentGroupLabel(treeItem: HTMLLIElement): string {
    const group = contentGroup(treeItem);
    const label = Array.from(group.children).find(
      (child): child is HTMLDivElement => child instanceof HTMLDivElement,
    );

    return normalizeLabel(label?.textContent ?? null);
  }

  function footerMoveUpButton(
    rootContainer: HTMLDivElement,
  ): HTMLButtonElement {
    const button = rootContainer.querySelector<HTMLButtonElement>(
      'button[aria-label="Move up"]',
    );

    if (!button) {
      throw new Error("Move up button not found");
    }

    return button;
  }

  function footerMoveDownButton(
    rootContainer: HTMLDivElement,
  ): HTMLButtonElement {
    const button = rootContainer.querySelector<HTMLButtonElement>(
      'button[aria-label="Move down"]',
    );

    if (!button) {
      throw new Error("Move down button not found");
    }

    return button;
  }

  function footerMoveToSelect(
    rootContainer: HTMLDivElement,
  ): HTMLSelectElement {
    const select = rootContainer.querySelector<HTMLSelectElement>(
      'select[aria-label="Move to"]',
    );

    if (!select) {
      throw new Error("Move to select not found");
    }

    return select;
  }

function clickRow(treeItem: HTMLLIElement): void {
  act(() => {
    rowButton(treeItem).click();
  });
}

describe("ElementTreePanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  function renderPanel(
    slide: Slide,
    options: {
      selectedElementId?: string | null;
      selectedContentSlotId?: string | null;
      onSelectElement?: ReturnType<typeof vi.fn>;
      onMoveElement?: ReturnType<typeof vi.fn>;
    } = {},
  ) {
    const onSelectElement = options.onSelectElement ?? vi.fn();
    const onMoveElement = options.onMoveElement ?? vi.fn();

    act(() => {
      root.render(
        <StudioI18nProvider>
          <ElementTreePanel
            slide={slide}
            selectedElementId={options.selectedElementId ?? null}
            selectedContentSlotId={options.selectedContentSlotId ?? null}
            onSelectElement={onSelectElement}
            onMoveElement={onMoveElement}
          />
        </StudioI18nProvider>,
      );
    });

    return { onSelectElement, onMoveElement };
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

  it("renders content elements under a dedicated Content group and keeps structural subtopics separate", () => {
    const slide = slideWithTopics([
      topicItem(
        "topic-a",
        contentSlot("slot-a", [text("topic-a-text", "A")]),
      ),
      topicItem(
        "topic-b",
        contentSlot("slot-b", [
          text("topic-b-text", "B"),
          image("topic-b-image"),
          table("topic-b-table"),
        ]),
        [
          topicItem(
            "topic-b-1",
            contentSlot("slot-b-1", [text("topic-b-1-text", "B.1")]),
          ),
          topicItem(
            "topic-b-2",
            contentSlot("slot-b-2", [text("topic-b-2-text", "B.2")]),
          ),
        ],
      ),
    ]);

    renderPanel(slide);

    const topicB = findTreeItem(container, "B");

    expect(contentGroupLabel(topicB)).toBe("Content");
    expect(contentGroupItems(topicB).map(treeItemLabel)).toEqual([
      "Text — B",
      "Image",
      "Table",
    ]);
    expect(directTopicChildren(topicB).map(treeItemLabel)).toEqual([
      "B.1",
      "B.2",
    ]);
  });

  it("renders recursive Content groups for structural subtopics", () => {
    const slide = slideWithTopics([
      topicItem(
        "topic-c",
        contentSlot("slot-c", [text("topic-c-text", "C")]),
        [
          topicItem(
            "topic-c-1",
            contentSlot("slot-c-1", [
              text("topic-c-1-text", "C.1"),
              image("topic-c-1-image"),
            ]),
          ),
        ],
      ),
    ]);

    renderPanel(slide);

    const topicC1 = findTreeItem(container, "C.1");

    expect(contentGroupLabel(topicC1)).toBe("Content");
    expect(contentGroupItems(topicC1).map(treeItemLabel)).toEqual([
      "Text — C.1",
      "Image",
    ]);
  });

  it("keeps an empty topic row visible and selectable", () => {
    const slide = slideWithTopics([topicItem("topic-empty", contentSlot("slot-empty"))]);
    const { onSelectElement } = renderPanel(slide);

    const emptyTopic = findTreeItem(container, "Topic");

    expect(emptyTopic).toBeTruthy();
    expect(contentGroupLabel(emptyTopic)).toBe("Content");

    clickRow(emptyTopic);

    expect(onSelectElement).toHaveBeenCalledWith({
      id: "topics-1",
      type: "topics",
      contentSlotId: "slot-empty",
    });
  });

  it("clicking a topic row dispatches the owning TopicsElement and exact content slot", () => {
    const slide = slideWithTopics([
      topicItem(
        "topic-b",
        contentSlot("slot-b", [text("topic-b-text", "B")]),
      ),
    ]);
    const { onSelectElement } = renderPanel(slide);

    clickRow(findTreeItem(container, "B"));

    expect(onSelectElement).toHaveBeenCalledWith({
      id: "topics-1",
      type: "topics",
      contentSlotId: "slot-b",
    });
  });

  it("suppresses footer movement for a structurally selected topic row", () => {
    const slide = {
      ...slideWithTopics([
        topicItem(
          "topic-a",
          contentSlot("slot-a", [text("topic-a-text", "A")]),
        ),
        topicItem(
          "topic-b",
          contentSlot("slot-b", [text("topic-b-text", "B")]),
        ),
      ]),
      elements: [
        topicContainer("before"),
        ...slideWithTopics([
          topicItem(
            "topic-a",
            contentSlot("slot-a", [text("topic-a-text", "A")]),
          ),
          topicItem(
            "topic-b",
            contentSlot("slot-b", [text("topic-b-text", "B")]),
          ),
        ]).elements,
        topicContainer("after"),
      ],
    };
    const { onMoveElement } = renderPanel(slide, {
      selectedElementId: "topics-1",
      selectedContentSlotId: "slot-b",
    });

    expect(footerMoveUpButton(container).disabled).toBe(true);
    expect(footerMoveDownButton(container).disabled).toBe(true);
    expect(footerMoveToSelect(container).disabled).toBe(true);
    expect(footerMoveToSelect(container).options).toHaveLength(1);

    act(() => {
      footerMoveUpButton(container).click();
      footerMoveDownButton(container).click();
      footerMoveToSelect(container).value = "before";
      footerMoveToSelect(container).dispatchEvent(
        new Event("change", { bubbles: true }),
      );
    });

    expect(onMoveElement).not.toHaveBeenCalled();
  });

  it("keeps ordinary TopicsElement movement available when no structural topic row is selected", () => {
    const slide = {
      ...slideWithTopics([
        topicItem(
          "topic-a",
          contentSlot("slot-a", [text("topic-a-text", "A")]),
        ),
      ]),
      elements: [
        topicContainer("before"),
        ...slideWithTopics([
          topicItem(
            "topic-a",
            contentSlot("slot-a", [text("topic-a-text", "A")]),
          ),
        ]).elements,
        topicContainer("after"),
      ],
    };
    const { onMoveElement } = renderPanel(slide, {
      selectedElementId: "topics-1",
      selectedContentSlotId: null,
    });

    expect(footerMoveUpButton(container).disabled).toBe(false);
    expect(footerMoveDownButton(container).disabled).toBe(false);
    expect(footerMoveToSelect(container).disabled).toBe(false);
    expect(footerMoveToSelect(container).options.length).toBeGreaterThan(1);

    act(() => {
      footerMoveUpButton(container).click();
    });

    expect(onMoveElement).toHaveBeenCalledWith({
      elementId: "topics-1",
      targetParentRef: { kind: "slide" },
      targetIndex: 0,
    });
  });

  it("keeps real content-child movement available when a real element is selected inside topic content", () => {
    const slide = slideWithTopics([
      topicItem(
        "topic-b",
        contentSlot("slot-b", [
          text("topic-b-text", "B"),
          image("topic-b-image"),
          table("topic-b-table"),
        ]),
      ),
    ]);
    const { onMoveElement } = renderPanel(slide, {
      selectedElementId: "topic-b-image",
      selectedContentSlotId: "slot-b",
    });

    expect(footerMoveUpButton(container).disabled).toBe(false);
    expect(footerMoveDownButton(container).disabled).toBe(false);
    expect(footerMoveToSelect(container).disabled).toBe(false);

    act(() => {
      footerMoveDownButton(container).click();
    });

    expect(onMoveElement).toHaveBeenCalledWith({
      elementId: "topic-b-image",
      targetParentRef: { kind: "content-slot", id: "slot-b" },
      targetIndex: 2,
    });
  });

  it("clicking Image and Table inside topic content dispatches the real elements", () => {
    const slide = slideWithTopics([
      topicItem(
        "topic-b",
        contentSlot("slot-b", [
          text("topic-b-text", "B"),
          image("topic-b-image"),
          table("topic-b-table"),
        ]),
      ),
    ]);
    const { onSelectElement } = renderPanel(slide);

    const topicB = findTreeItem(container, "B");
    const imageRow = contentGroupItems(topicB).find(
      (treeItem) => treeItemLabel(treeItem) === "Image",
    );
    const tableRow = contentGroupItems(topicB).find(
      (treeItem) => treeItemLabel(treeItem) === "Table",
    );

    if (!imageRow || !tableRow) {
      throw new Error("Expected image and table rows inside topic content");
    }

    clickRow(imageRow);
    clickRow(tableRow);

    expect(onSelectElement).toHaveBeenNthCalledWith(1, {
      id: "topic-b-image",
      type: "image",
    });
    expect(onSelectElement).toHaveBeenNthCalledWith(2, {
      id: "topic-b-table",
      type: "table",
    });
  });

  it("keeps containers inside topic content as real expandable children", () => {
    const slide = slideWithTopics([
      topicItem(
        "topic-b",
        contentSlot("slot-b", [
          text("topic-b-text", "B"),
          topicContainer("topic-b-container", [
            text("topic-b-container-text", "Nested container text"),
          ]),
        ]),
      ),
    ]);

    renderPanel(slide);

    const topicB = findTreeItem(container, "B");

    expect(contentGroupItems(topicB).map(treeItemLabel)).toEqual([
      "Text — B",
      "Container",
      "Text — Nested container text",
    ]);
  });

  it("does not treat the Content group as a tree item or drop target", () => {
    const slide = slideWithTopics([
      topicItem(
        "topic-b",
        contentSlot("slot-b", [
          text("topic-b-text", "B"),
          image("topic-b-image"),
        ]),
      ),
    ]);

    renderPanel(slide);

    const topicB = findTreeItem(container, "B");
    const group = contentGroup(topicB);

    expect(group.getAttribute("role")).toBe("none");
    expect(group.hasAttribute("draggable")).toBe(false);
    expect(group.querySelector(':scope > ul[role="group"]')).not.toBeNull();
  });

  it("does not mutate canonical data when rendering the selector", () => {
    const slide = slideWithTopics([
      topicItem(
        "topic-b",
        contentSlot("slot-b", [
          text("topic-b-text", "B"),
          image("topic-b-image"),
          table("topic-b-table"),
        ]),
      ),
    ]);
    const snapshot = structuredClone(slide);

    renderPanel(slide);

    expect(slide).toEqual(snapshot);
  });
});
