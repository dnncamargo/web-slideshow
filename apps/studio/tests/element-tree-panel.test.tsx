// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ContentSlot,
  ImageElement,
  GalleryElement,
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

function galleryElement(id: string, itemCount: number): GalleryElement {
  return {
    type: "gallery",
    id,
    hidden: false,
    fit: "contain",
    items: Array.from({ length: itemCount }, (_, index) => ({
      src: `/assets/${index}.png`,
      alt: `Image ${index + 1}`,
    })),
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
      child instanceof HTMLUListElement &&
      child.getAttribute("role") === "group",
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
      child instanceof HTMLLIElement &&
      child.getAttribute("role") === "treeitem",
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

function footerMoveUpButton(rootContainer: HTMLDivElement): HTMLButtonElement {
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

function footerMoveToSelect(rootContainer: HTMLDivElement): HTMLSelectElement {
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
      selectedGalleryItemIndex?: number | null;
      onSelectElement?: ReturnType<typeof vi.fn>;
      onMoveElement?: ReturnType<typeof vi.fn>;
      onMoveTopicItem?: ReturnType<typeof vi.fn>;
      onIndentTopicItem?: ReturnType<typeof vi.fn>;
      onOutdentTopicItem?: ReturnType<typeof vi.fn>;
    } = {},
  ) {
    const onSelectElement = options.onSelectElement ?? vi.fn();
    const onMoveElement = options.onMoveElement ?? vi.fn();
    const onMoveTopicItem = options.onMoveTopicItem ?? vi.fn();
    const onIndentTopicItem = options.onIndentTopicItem ?? vi.fn();
    const onOutdentTopicItem = options.onOutdentTopicItem ?? vi.fn();

    act(() => {
      root.render(
        <StudioI18nProvider>
          <ElementTreePanel
            slide={slide}
            selectedElementId={options.selectedElementId ?? null}
            selectedContentSlotId={options.selectedContentSlotId ?? null}
            selectedGalleryItemIndex={options.selectedGalleryItemIndex ?? null}
            onSelectElement={onSelectElement}
            onMoveElement={onMoveElement}
            onMoveTopicItem={onMoveTopicItem}
            onIndentTopicItem={onIndentTopicItem}
            onOutdentTopicItem={onOutdentTopicItem}
            onMoveGalleryItem={vi.fn()}
            onGalleryStructureDrop={vi.fn()}
            onBrowseElementStyles={vi.fn()}
          />
        </StudioI18nProvider>,
      );
    });

    return {
      onSelectElement,
      onMoveElement,
      onMoveTopicItem,
      onIndentTopicItem,
      onOutdentTopicItem,
    };
  }

  function topicActionButton(
    treeItem: HTMLLIElement,
    label: string,
  ): HTMLButtonElement {
    const button = treeItem.querySelector<HTMLButtonElement>(
      `button[aria-label="${label}"]`,
    );

    if (!button) {
      throw new Error(`Topic action button not found: ${label}`);
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

  it("renders content elements directly before structural subtopics", () => {
    const slide = slideWithTopics([
      topicItem("topic-a", contentSlot("slot-a", [text("topic-a-text", "A")])),
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

    expect(topicB.querySelector("[data-powershow-tree-content-group]")).toBeNull();
    expect(directTopicChildren(topicB).map(treeItemLabel)).toEqual([
      "Image",
      "Table",
      "B.1",
      "B.2",
    ]);
  });

  it("suppresses only each TopicItem label source while preserving canonical children", () => {
    const primaryA = text("topic-a-text", "A");
    const noteA = text("topic-a-note", "Additional note");
    const primaryB = text("topic-b-text", "B");
    const slide = slideWithTopics([
      topicItem("topic-a", contentSlot("slot-a", [primaryA, noteA, image("a-image")])),
      topicItem("topic-b", contentSlot("slot-b", [primaryB]), [
        topicItem("topic-b-1", contentSlot("slot-b-1", [text("b-1-text", "B.1")])),
      ]),
    ]);

    renderPanel(slide);

    const topicA = findTreeItem(container, "A");
    expect(directTopicChildren(topicA).map(treeItemLabel)).toEqual([
      "Text — Additional note",
      "Image",
    ]);
    expect(findTreeItem(container, "B")).toBeTruthy();
    expect(findTreeItem(container, "B.1")).toBeTruthy();
    expect(slide.elements[0]?.type === "topics" ? slide.elements[0].items[0]?.content.children : []).toEqual([
      primaryA,
      noteA,
      expect.objectContaining({ id: "a-image" }),
    ]);
  });

  it("renders a default TopicItem as a visual leaf without an empty group", () => {
    const slide = slideWithTopics([
      topicItem("topic-a", contentSlot("slot-a", [text("topic-a-text", "A")])),
    ]);

    renderPanel(slide);

    const topicA = findTreeItem(container, "A");
    expect(topicA.querySelector(':scope > div > button[aria-label="Expand"]')).toBeNull();
    expect(topicA.querySelector(':scope > div > span[aria-hidden="true"]')).not.toBeNull();
    expect(directTreeGroup(topicA)).toBeNull();
  });

  it("keeps TopicItems expandable for additional content or structural children", () => {
    const slide = slideWithTopics([
      topicItem("topic-a", contentSlot("slot-a", [text("a-text", "A"), image("a-image")])),
      topicItem("topic-b", contentSlot("slot-b", [text("b-text", "B")]), [
        topicItem("topic-b-1", contentSlot("slot-b-1", [text("b-1-text", "B.1")])),
      ]),
    ]);

    renderPanel(slide);

    expect(findTreeItem(container, "A").querySelector('button[aria-label="Collapse"]')).not.toBeNull();
    expect(findTreeItem(container, "B").querySelector('button[aria-label="Collapse"]')).not.toBeNull();
  });

  it("renders initially expanded synthetic Gallery Image rows in canonical order", () => {
    const galleryId = "gallery / legal: id";
    const slide: Slide = {
      id: "slide-gallery",
      title: "Gallery",
      summary: "",
      speakerNotes: "",
      elements: [galleryElement(galleryId, 3)],
    };

    renderPanel(slide);

    expect(treeItems(container).map(treeItemLabel)).toEqual([
      "Gallery",
      "1. Image 1",
      "2. Image 2",
      "3. Image 3",
    ]);
  });

  it("selects a Gallery Image as a synthetic, draggable child row", () => {
    const galleryId = "gallery / legal: id";
    const slide: Slide = {
      id: "slide-gallery",
      title: "Gallery",
      summary: "",
      speakerNotes: "",
      elements: [galleryElement(galleryId, 3)],
    };
    const { onSelectElement } = renderPanel(slide, {
      selectedElementId: galleryId,
      selectedGalleryItemIndex: 1,
    });

    const gallery = findTreeItem(container, "Gallery");
    const image1 = findTreeItem(container, "1. Image 1");
    const image2 = findTreeItem(container, "2. Image 2");
    const image3 = findTreeItem(container, "3. Image 3");

    expect(gallery.getAttribute("aria-selected")).toBe("false");
    expect(image1.getAttribute("aria-selected")).toBe("false");
    expect(image2.getAttribute("aria-selected")).toBe("true");
    expect(image3.getAttribute("aria-selected")).toBe("false");
    expect(image2.querySelector(':scope > div')?.getAttribute("draggable")).toBe("true");

    clickRow(image2);

    expect(onSelectElement).toHaveBeenCalledWith({
      id: galleryId,
      type: "gallery",
      galleryItemIndex: 1,
    });
  });

  it("does not render synthetic Gallery Image rows for an empty Gallery", () => {
    const slide: Slide = {
      id: "slide-gallery-empty",
      title: "Gallery",
      summary: "",
      speakerNotes: "",
      elements: [galleryElement("gallery-empty", 0)],
    };

    renderPanel(slide);

    expect(treeItems(container).map(treeItemLabel)).toEqual(["Gallery"]);
  });

  it("renders content elements directly for structural subtopics", () => {
    const slide = slideWithTopics([
      topicItem("topic-c", contentSlot("slot-c", [text("topic-c-text", "C")]), [
        topicItem(
          "topic-c-1",
          contentSlot("slot-c-1", [
            text("topic-c-1-text", "C.1"),
            image("topic-c-1-image"),
          ]),
        ),
      ]),
    ]);

    renderPanel(slide);

    const topicC1 = findTreeItem(container, "C.1");

    expect(directTopicChildren(topicC1).map(treeItemLabel)).toEqual([
      "Image",
    ]);
  });

  it("keeps an empty topic row visible and selectable", () => {
    const slide = slideWithTopics([
      topicItem("topic-empty", contentSlot("slot-empty")),
    ]);
    const { onSelectElement } = renderPanel(slide);

    const emptyTopic = findTreeItem(container, "Topic");

    expect(emptyTopic).toBeTruthy();
    expect(directTopicChildren(emptyTopic)).toEqual([]);

    clickRow(emptyTopic);

    expect(onSelectElement).toHaveBeenCalledWith({
      id: "topics-1",
      type: "topics",
      contentSlotId: "slot-empty",
    });
  });

  it("clicking a topic row dispatches the owning TopicsElement and exact content slot", () => {
    const slide = slideWithTopics([
      topicItem("topic-b", contentSlot("slot-b", [text("topic-b-text", "B")])),
    ]);
    const { onSelectElement } = renderPanel(slide);

    clickRow(findTreeItem(container, "B"));

    expect(onSelectElement).toHaveBeenCalledWith({
      id: "topics-1",
      type: "topics",
      contentSlotId: "slot-b",
    });
  });

  it("renders explicit hierarchy actions with the authoritative availability rules", () => {
    const slide = slideWithTopics([
      topicItem("topic-a", contentSlot("slot-a", [text("a-text", "A")]), [
        topicItem("topic-a-1", contentSlot("slot-a-1", [text("a-1-text", "A.1")])),
        topicItem("topic-a-2", contentSlot("slot-a-2", [text("a-2-text", "A.2")])),
      ]),
      topicItem("topic-b", contentSlot("slot-b", [text("b-text", "B")])),
    ]);

    function expectActions(
      selectedContentSlotId: string | null,
      canOutdent: boolean,
      canIndent: boolean,
    ): void {
      renderPanel(slide, {
        selectedElementId: selectedContentSlotId ? "topics-1" : null,
        selectedContentSlotId,
      });
      const topicsRow = findTreeItem(container, "Topics");
      expect(topicActionButton(topicsRow, "Promote topic").disabled).toBe(!canOutdent);
      expect(topicActionButton(topicsRow, "Demote topic").disabled).toBe(!canIndent);
    }

    renderPanel(slide);
    const unselectedTopicsRow = findTreeItem(container, "Topics");
    expect(topicActionButton(unselectedTopicsRow, "Promote topic").disabled).toBe(true);
    expect(topicActionButton(unselectedTopicsRow, "Demote topic").disabled).toBe(true);

    expectActions("slot-a", false, false);
    expectActions("slot-a-1", true, false);
    expectActions("slot-a-2", true, true);
    expectActions("slot-b", false, true);
  });

  it("routes hierarchy actions to the owning TopicsElement and preserves row selection routing", () => {
    const slide = slideWithTopics([
      topicItem("topic-a", contentSlot("slot-a", [text("a-text", "A")])),
      topicItem("topic-b", contentSlot("slot-b", [text("b-text", "B")])),
    ]);
    const { onIndentTopicItem, onOutdentTopicItem, onMoveElement, onSelectElement } =
      renderPanel(slide, {
        selectedElementId: "topics-1",
        selectedContentSlotId: "slot-b",
      });

    const topicsRow = findTreeItem(container, "Topics");
    const promote = topicActionButton(topicsRow, "Promote topic");
    const demote = topicActionButton(topicsRow, "Demote topic");

    expect(promote.title).toBe("Promote topic");
    expect(demote.title).toBe("Demote topic");

    act(() => {
      demote.click();
    });

    expect(onIndentTopicItem).toHaveBeenCalledWith("topics-1", "topic-b");
    expect(onOutdentTopicItem).not.toHaveBeenCalled();
    expect(onMoveElement).not.toHaveBeenCalled();
    expect(onSelectElement).not.toHaveBeenCalled();
  });

  it("keeps hierarchy actions off ordinary and synthetic child rows", () => {
    const slide = slideWithTopics([
      topicItem(
        "topic-a",
        contentSlot("slot-a", [text("a-text", "A"), image("a-image")]),
      ),
    ]);

    renderPanel(slide);

    const topicsRow = findTreeItem(container, "Topics");
    expect(topicsRow.querySelectorAll('button[aria-label="Promote topic"]')).toHaveLength(1);
    expect(topicsRow.querySelectorAll('button[aria-label="Demote topic"]')).toHaveLength(1);
    expect(container.querySelectorAll('button[aria-label="Promote topic"]')).toHaveLength(1);
    expect(container.querySelectorAll('button[aria-label="Demote topic"]')).toHaveLength(1);
    expect(findTreeItem(container, "A").querySelector('button[aria-label="Promote topic"]')).toBeNull();
    expect(findTreeItem(container, "Image").querySelector('button[aria-label="Demote topic"]')).toBeNull();
  });

  it("enables hierarchy actions only on the owning Topics row", () => {
    const first = topicsElement([
      topicItem("topic-a", contentSlot("slot-a", [text("a-text", "A")])),
    ]);
    const second = {
      ...topicsElement([
        topicItem("topic-b", contentSlot("slot-b", [text("b-text", "B")])),
        topicItem("topic-c", contentSlot("slot-c", [text("c-text", "C")])),
      ]),
      id: "topics-2",
    } satisfies TopicsElement;
    const slide: Slide = {
      ...slideWithTopics([]),
      elements: [first, second],
    };

    renderPanel(slide, {
      selectedElementId: "topics-2",
      selectedContentSlotId: "slot-c",
    });

    const topicsRows = treeItems(container).filter(
      (treeItem) => treeItemLabel(treeItem) === "Topics",
    );
    expect(topicsRows).toHaveLength(2);
    expect(topicActionButton(topicsRows[0]!, "Promote topic").disabled).toBe(true);
    expect(topicActionButton(topicsRows[0]!, "Demote topic").disabled).toBe(true);
    expect(topicActionButton(topicsRows[1]!, "Promote topic").disabled).toBe(true);
    expect(topicActionButton(topicsRows[1]!, "Demote topic").disabled).toBe(false);
  });

  it("reorders a structurally selected middle topic row through the footer", () => {
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
          topicItem(
            "topic-c",
            contentSlot("slot-c", [text("topic-c-text", "C")]),
          ),
        ]).elements,
        topicContainer("after"),
      ],
    };
    const { onMoveElement, onMoveTopicItem } = renderPanel(slide, {
      onMoveTopicItem: vi.fn(),
      selectedElementId: "topics-1",
      selectedContentSlotId: "slot-b",
    });

    expect(footerMoveUpButton(container).disabled).toBe(false);
    expect(footerMoveDownButton(container).disabled).toBe(false);
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
    expect(onMoveTopicItem).toHaveBeenNthCalledWith(1, "topics-1", "topic-b", 0);
    expect(onMoveTopicItem).toHaveBeenNthCalledWith(2, "topics-1", "topic-b", 2);
  });

  it("suppresses footer movement for a nested structural topic row", () => {
    const slide = {
      ...slideWithTopics([
        topicItem(
          "topic-b",
          contentSlot("slot-b", [text("topic-b-text", "B")]),
          [
            topicItem(
              "topic-b-1",
              contentSlot("slot-b-1", [text("topic-b-1-text", "B.1")]),
              [
                topicItem(
                  "topic-b-1-1",
                  contentSlot("slot-b-1-1", [
                    text("topic-b-1-1-text", "B.1.1"),
                  ]),
                ),
              ],
            ),
          ],
        ),
      ]),
      elements: [
        topicContainer("before"),
        ...slideWithTopics([
          topicItem(
            "topic-b",
            contentSlot("slot-b", [text("topic-b-text", "B")]),
            [
              topicItem(
                "topic-b-1",
                contentSlot("slot-b-1", [text("topic-b-1-text", "B.1")]),
                [
                  topicItem(
                    "topic-b-1-1",
                    contentSlot("slot-b-1-1", [
                      text("topic-b-1-1-text", "B.1.1"),
                    ]),
                  ),
                ],
              ),
            ],
          ),
        ]).elements,
        topicContainer("after"),
      ],
    };

    const { onMoveElement, onMoveTopicItem } = renderPanel(slide, {
      onMoveTopicItem: vi.fn(),
      selectedElementId: "topics-1",
      selectedContentSlotId: "slot-b-1-1",
    });

    expect(footerMoveUpButton(container).disabled).toBe(true);
    expect(footerMoveDownButton(container).disabled).toBe(true);
    expect(footerMoveToSelect(container).disabled).toBe(true);
    expect(footerMoveToSelect(container).options).toHaveLength(1);

    act(() => {
      footerMoveUpButton(container).click();
      footerMoveDownButton(container).click();
    });

    expect(onMoveElement).not.toHaveBeenCalled();
    expect(onMoveTopicItem).not.toHaveBeenCalled();
  });

  it("reorders a nested topic only within its structural siblings", () => {
    const slide = slideWithTopics([
      topicItem("topic-parent", contentSlot("slot-parent"), [
        topicItem("topic-child-a", contentSlot("slot-child-a")),
        topicItem("topic-child-b", contentSlot("slot-child-b")),
      ]),
    ]);
    const { onMoveTopicItem } = renderPanel(slide, {
      onMoveTopicItem: vi.fn(),
      selectedElementId: "topics-1",
      selectedContentSlotId: "slot-child-a",
    });

    expect(footerMoveUpButton(container).disabled).toBe(true);
    expect(footerMoveDownButton(container).disabled).toBe(false);

    act(() => {
      footerMoveDownButton(container).click();
    });

    expect(onMoveTopicItem).toHaveBeenCalledWith(
      "topics-1",
      "topic-child-a",
      1,
    );
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
    const imageRow = directTopicChildren(topicB).find(
      (treeItem) => treeItemLabel(treeItem) === "Image",
    );
    const tableRow = directTopicChildren(topicB).find(
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

    expect(directTopicChildren(topicB).map(treeItemLabel)).toEqual([
      "Container",
    ]);
  });

  it("does not render a Content group row", () => {
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
    expect(topicB.querySelector("[data-powershow-tree-content-group]")).toBeNull();
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
