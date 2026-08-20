import type {
  ContentSlot,
  PowerShowElement,
  Slide,
  TopicItem,
  TopicsElement,
} from "@powershow/document-schema";

import {
  collectAuthoringIds,
  findElementLocation,
  getElementsForParentRef,
  type ElementParentRef,
  findElementById,
  isTopicItemContentSlotId,
  updateElementById,
} from "./element-hierarchy";

// ============================================================
// BEGIN: TIPOS DE ELEMENTOS CRIÁVEIS
//
// Chart e Interactive ficam fora desta primeira rodada porque
// ainda não possuem edição/renderização completa no Editor.
// ============================================================

export type ElementCreateType =
  | "text"
  | "textbox"
  | "container"
  | "image"
  | "code"
  | "terminal"
  | "table"
  | "topics"
  | "divider";

// ============================================================
// END: TIPOS DE ELEMENTOS CRIÁVEIS
// ============================================================

// ============================================================
// BEGIN: COLETA DE IDS
// ============================================================

function collectElementIds(
  elements: readonly PowerShowElement[],
  ids: Set<string>,
) {
  for (const element of elements) {
    collectAuthoringIds(element, ids);
  }
}

function collectPresentationElementIds(slides: readonly Slide[]): Set<string> {
  const ids = new Set<string>();

  for (const slide of slides) {
    collectElementIds(slide.elements, ids);
  }

  return ids;
}

// ============================================================
// END: COLETA DE IDS
// ============================================================

// ============================================================
// BEGIN: ID ÚNICO
// ============================================================

function createUniqueId(baseId: string, usedIds: Set<string>): string {
  if (!usedIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;

  while (usedIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

// ============================================================
// END: ID ÚNICO
// ============================================================

// ============================================================
// BEGIN: TÓPICOS (TopicItem)
//
// Um TopicItem é um nó estrutural do documento. Ele NÃO é um
// PowerShowElement. Cada item carrega um ContentSlot com um
// único Text por padrão.
// ============================================================

/**
 * AUTHORING limit for structural TopicItem.children nesting.
 *
 * top-level TopicItem = depth 1, child = depth 2, ..., maximum = depth 5.
 * Creating a child from a TopicItem already at depth 5 is refused. This is
 * a Studio authoring rule only: canonical documents deeper than 5 still
 * load, render, and persist unchanged.
 */
export const MAX_TOPIC_STRUCTURAL_DEPTH = 5;

export interface CreatedTopicItem {
  item: TopicItem;

  textId: string;
}

function buildDefaultTopicItem(usedIds: Set<string>): CreatedTopicItem {
  const textId = createUniqueId("topic-text", usedIds);
  usedIds.add(textId);

  const slotId = createUniqueId("topic-slot", usedIds);
  usedIds.add(slotId);

  const itemId = createUniqueId("topic-item", usedIds);
  usedIds.add(itemId);

  const item: TopicItem = {
    id: itemId,

    content: {
      id: slotId,

      children: [
        {
          id: textId,

          type: "text",

          hidden: false,

          variant: "body",

          content: "New topic",
        },
      ],
    },

    children: [],
  };

  return { item, textId };
}

export function createDefaultTopicItem(
  slides: readonly Slide[],
): CreatedTopicItem {
  const usedIds = collectPresentationElementIds(slides);

  return buildDefaultTopicItem(usedIds);
}

export function appendTopicItemToTopics(
  elements: PowerShowElement[],
  topicsId: string,
  item: TopicItem,
): PowerShowElement[] {
  const target = findElementById(elements, topicsId);

  if (target?.type !== "topics") {
    return elements;
  }

  return updateElementById(elements, topicsId, (element) => {
    if (element.type !== "topics") {
      return element;
    }

    return {
      ...element,
      items: [...element.items, item],
    };
  });
}

export function appendTopicItemToTopicItems(
  items: readonly TopicItem[],
  topicItemId: string,
  item: TopicItem,
  depth: number = 1,
): TopicItem[] {
  let changed = false;

  const nextItems = items.map((currentItem) => {
    if (currentItem.id === topicItemId) {
      if (depth >= MAX_TOPIC_STRUCTURAL_DEPTH) {
        return currentItem;
      }

      changed = true;

      return {
        ...currentItem,
        children: [...currentItem.children, item],
      };
    }

    const children = appendTopicItemToTopicItems(
      currentItem.children,
      topicItemId,
      item,
      depth + 1,
    );

    if (children === currentItem.children) {
      return currentItem;
    }

    changed = true;

    return {
      ...currentItem,
      children,
    };
  });

  return changed ? nextItems : (items as TopicItem[]);
}

/**
 * Structural depth of a TopicItem inside a TopicsElement items tree.
 * Top-level items are depth 1. Returns null when the item is not found.
 */
export function findTopicItemStructuralDepthInItems(
  items: readonly TopicItem[],
  topicItemId: string,
  depth: number = 1,
): number | null {
  for (const item of items) {
    if (item.id === topicItemId) {
      return depth;
    }

    const nested = findTopicItemStructuralDepthInItems(
      item.children,
      topicItemId,
      depth + 1,
    );

    if (nested !== null) {
      return nested;
    }
  }

  return null;
}

export function appendChildTopicItemToTopics(
  elements: readonly PowerShowElement[],
  topicsId: string,
  topicItemId: string,
  item: TopicItem,
): PowerShowElement[] {
  const target = findElementById(elements, topicsId);

  if (target?.type !== "topics") {
    return elements as PowerShowElement[];
  }

  const itemDepth = findTopicItemStructuralDepthInItems(
    target.items,
    topicItemId,
  );

  if (itemDepth === null || itemDepth >= MAX_TOPIC_STRUCTURAL_DEPTH) {
    return elements as PowerShowElement[];
  }

  const items = appendTopicItemToTopicItems(target.items, topicItemId, item);

  if (items === target.items) {
    return elements as PowerShowElement[];
  }

  return updateElementById(elements, topicsId, (element) => {
    if (element.type !== "topics") {
      return element;
    }

    return {
      ...element,
      items,
    };
  });
}

export function updateTopicItemTextContent(
  items: readonly TopicItem[],
  topicItemId: string,
  content: string,
): TopicItem[] {
  let changed = false;

  const nextItems = items.map((currentItem) => {
    if (currentItem.id === topicItemId) {
      const textIndex = currentItem.content.children.findIndex(
        (child) => child.type === "text",
      );

      if (textIndex < 0) {
        return currentItem;
      }

      const textChild = currentItem.content.children[textIndex];

      if (textChild?.type !== "text" || textChild.content === content) {
        return currentItem;
      }

      const children = [...currentItem.content.children];

      children[textIndex] = {
        ...textChild,
        content,
      };

      changed = true;

      return {
        ...currentItem,
        content: {
          ...currentItem.content,
          children,
        },
      };
    }

    const children = updateTopicItemTextContent(
      currentItem.children,
      topicItemId,
      content,
    );

    if (children === currentItem.children) {
      return currentItem;
    }

    changed = true;

    return {
      ...currentItem,
      children,
    };
  });

  return changed ? nextItems : (items as TopicItem[]);
}

export function removeTopicItemFromTopicItems(
  items: readonly TopicItem[],
  topicItemId: string,
): TopicItem[] {
  let changed = false;

  const nextItems: TopicItem[] = [];

  for (const currentItem of items) {
    if (currentItem.id === topicItemId) {
      changed = true;
      continue;
    }

    const children = removeTopicItemFromTopicItems(
      currentItem.children,
      topicItemId,
    );

    if (children === currentItem.children) {
      nextItems.push(currentItem);
      continue;
    }

    changed = true;

    nextItems.push({
      ...currentItem,
      children,
    });
  }

  return changed ? nextItems : (items as TopicItem[]);
}

// ============================================================
// END: TÓPICOS (TopicItem)
// ============================================================

// ============================================================
// BEGIN: ADD ELEMENT DESTINATION
// ============================================================

export type AddElementDestination =
  | { kind: "slide-root" }
  | { kind: "append-container"; containerId: string }
  | { kind: "append-topic-content"; contentSlotId: string }
  | { kind: "insert-after"; targetId: string };

function topicItemsContainContentSlot(
  items: readonly TopicItem[],
  contentSlotId: string,
): boolean {
  for (const item of items) {
    if (item.content.id === contentSlotId) {
      return true;
    }

    if (topicItemsContainContentSlot(item.children, contentSlotId)) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves where a freshly created element lands given the current selection
 * and an optional explicit ContentSlot context (the TopicItem the user
 * clicked on the canvas).
 *
 * - no selection (or stale selection) -> slide root
 * - container selected -> inside the container
 * - TopicsElement selected + explicit clicked ContentSlot of THAT
 *   TopicsElement + ordinary element -> inside exactly that ContentSlot
 * - any other element -> sibling immediately after it
 *
 * The TopicsElement is never guessed as an implicit destination: without an
 * explicit ContentSlot context, adding while a TopicsElement is selected
 * keeps the normal sibling behavior.
 */
export function resolveAddElementDestination(
  elements: readonly PowerShowElement[],
  selectedElementId: string | null,
  newElement: PowerShowElement,
  contentSlotId: string | null = null,
): AddElementDestination {
  if (selectedElementId === null) {
    return { kind: "slide-root" };
  }

  const selected = findElementById(elements, selectedElementId);

  if (!selected) {
    return { kind: "slide-root" };
  }

  if (selected.type === "container") {
    return { kind: "append-container", containerId: selected.id };
  }

  if (
    selected.type === "topics" &&
    newElement.type !== "topics" &&
    contentSlotId !== null &&
    topicItemsContainContentSlot(selected.items, contentSlotId)
  ) {
    return { kind: "append-topic-content", contentSlotId };
  }

  return { kind: "insert-after", targetId: selected.id };
}

// ============================================================
// END: ADD ELEMENT DESTINATION
// ============================================================

// ============================================================
// BEGIN: CREATE ELEMENT
//
// Os defaults são deliberadamente pequenos.
//
// Estamos criando elementos válidos e imediatamente editáveis,
// sem tentar criar um "design inteligente" automaticamente.
// ============================================================

export function createElement(
  type: ElementCreateType,
  slides: readonly Slide[],
): PowerShowElement {
  const usedIds = collectPresentationElementIds(slides);

  switch (type) {
    case "text": {
      return {
        id: createUniqueId("text-element", usedIds),

        type: "text",

        hidden: false,

        content: "New text",

        variant: "body",
      };
    }

    case "textbox": {
      return {
        id: createUniqueId("textbox-element", usedIds),

        type: "textbox",

        hidden: false,

        content: "New textbox",
      };
    }

    case "container": {
      return {
        id: createUniqueId("container-element", usedIds),

        type: "container",

        hidden: false,

        direction: "column",

        gap: 16,

        horizontalAlign: "center",

        verticalAlign: "center",

        style: {
          width: "70%",

          height: "60%",

          padding: 24,

          background: "rgba(15, 23, 42, 0.55)",
        },

        children: [],
      };
    }

    case "image": {
      return {
        id: createUniqueId("image-element", usedIds),

        type: "image",

        hidden: false,

        src: "/powershow-demo.svg",

        alt: "New image",

        fit: "contain",

        style: {
          width: "60%",

          height: "55%",
        },
      };
    }

    case "code": {
      return {
        id: createUniqueId("code-element", usedIds),

        type: "code",

        hidden: false,

        code: 'const message = "Hello PowerShow";',

        language: "typescript",

        showLineNumbers: true,

        highlightedLines: [],
      };
    }

    case "terminal": {
      return {
        id: createUniqueId("terminal-element", usedIds),

        type: "terminal",

        hidden: false,

        title: "Terminal",

        lines: [
          {
            type: "command",

            content: "pnpm dev",
          },
        ],
      };
    }

    case "table": {
      return {
        id: createUniqueId("table-element", usedIds),

        type: "table",

        hidden: false,

        columns: [
          {
            key: "column_1",

            label: "Column 1",
          },
        ],

        rows: [
          {
            column_1: "Value",
          },
        ],
      };
    }

    case "topics": {
      const created = buildDefaultTopicItem(usedIds);

      return {
        id: createUniqueId("topics-element", usedIds),

        type: "topics",

        hidden: false,

        kind: "unordered",

        items: [created.item],
      } satisfies TopicsElement;
    }

    case "divider": {
      return {
        id: createUniqueId("divider-element", usedIds),

        type: "divider",

        hidden: false,

        orientation: "horizontal",
      };
    }
  }
}

// ============================================================
// END: CREATE ELEMENT
// ============================================================

// ============================================================
// BEGIN: CLONE COM IDS ÚNICOS
// ============================================================

function cloneContentSlotWithUniqueIds(
  slot: ContentSlot,
  usedIds: Set<string>,
): ContentSlot {
  const id = createUniqueId(`${slot.id}-copy`, usedIds);
  usedIds.add(id);

  return {
    ...slot,
    id,
    children: slot.children.map((child) =>
      clonePowerShowElementWithUniqueIds(child, usedIds),
    ),
  };
}

function cloneTopicItemWithUniqueIds(
  item: TopicItem,
  usedIds: Set<string>,
): TopicItem {
  const id = createUniqueId(`${item.id}-copy`, usedIds);
  usedIds.add(id);

  return {
    ...item,
    id,
    content: cloneContentSlotWithUniqueIds(item.content, usedIds),
    children: item.children.map((child) =>
      cloneTopicItemWithUniqueIds(child, usedIds),
    ),
  };
}

function clonePowerShowElementWithUniqueIds(
  source: PowerShowElement,
  usedIds: Set<string>,
): PowerShowElement {
  const clone = structuredClone(source);
  const id = createUniqueId(`${source.id}-copy`, usedIds);
  usedIds.add(id);

  if (clone.type === "container") {
    return {
      ...clone,
      id,
      children: clone.children.map((child) =>
        clonePowerShowElementWithUniqueIds(child, usedIds),
      ),
    };
  }

  if (clone.type === "topics") {
    return {
      ...clone,
      id,
      items: clone.items.map((item) =>
        cloneTopicItemWithUniqueIds(item, usedIds),
      ),
    } satisfies TopicsElement;
  }

  return {
    ...clone,
    id,
  };
}

export function duplicateElement(
  source: PowerShowElement,
  slides: readonly Slide[],
): PowerShowElement {
  const usedIds = collectPresentationElementIds(slides);

  return clonePowerShowElementWithUniqueIds(source, usedIds);
}

// ============================================================
// END: CLONE COM IDS ÚNICOS
// ============================================================

// ============================================================
// BEGIN: INSERIR APÓS ELEMENTO
// ============================================================

function insertElementAfterIdInTopicItems(
  items: readonly TopicItem[],
  targetId: string,
  newElement: PowerShowElement,
): TopicItem[] {
  let changed = false;

  const nextItems: TopicItem[] = items.map((item) => {
    const children = insertElementAfterId(
      item.content.children,
      targetId,
      newElement,
    );
    const nestedChildren = insertElementAfterIdInTopicItems(
      item.children,
      targetId,
      newElement,
    );

    if (
      children === item.content.children &&
      nestedChildren === item.children
    ) {
      return item;
    }

    changed = true;

    return {
      ...item,
      content:
        children === item.content.children
          ? item.content
          : {
              ...item.content,
              children,
            },
      children: nestedChildren,
    };
  });

  return changed ? nextItems : (items as TopicItem[]);
}

export function insertElementAfterId(
  elements: PowerShowElement[],
  targetId: string,
  newElement: PowerShowElement,
): PowerShowElement[] {
  const targetLocation = findElementLocation(elements, targetId);

  if (
    targetLocation?.parentRef.kind === "content-slot" &&
    isForbiddenTopicPlacement(elements, targetLocation.parentRef.id, newElement)
  ) {
    return elements;
  }

  let changed = false;
  const result: PowerShowElement[] = [];

  for (const element of elements) {
    result.push(element);

    if (element.id === targetId) {
      result.push(newElement);
      changed = true;
      continue;
    }

    if (element.type === "container") {
      const children = insertElementAfterId(
        element.children,
        targetId,
        newElement,
      );

      if (children !== element.children) {
        result[result.length - 1] = { ...element, children };
        changed = true;
      }
      continue;
    }

    if (element.type === "topics") {
      const items = insertElementAfterIdInTopicItems(
        element.items,
        targetId,
        newElement,
      );

      if (items !== element.items) {
        result[result.length - 1] = { ...element, items };
        changed = true;
      }
    }
  }

  return changed ? result : elements;
}

// ============================================================
// END: INSERIR APÓS ELEMENTO
// ============================================================

// ============================================================
// BEGIN: APPEND EM CONTAINER / CONTENT SLOT
// ============================================================

/**
 * Studio authoring rule: a TopicsElement must not inhabit a TopicItem
 * ContentSlot. Subtopics have the canonical representation TopicItem.children.
 *
 * The rule targets only TopicItem content slots; TopicsElement stays valid
 * in Slide/Container contexts and in any future non-Topic content slot.
 */
function isForbiddenTopicPlacement(
  elements: readonly PowerShowElement[],
  contentSlotId: string,
  newElement: PowerShowElement,
): boolean {
  return (
    newElement.type === "topics" &&
    isTopicItemContentSlotId(elements, contentSlotId)
  );
}

function appendElementToContainerInTopicItems(
  items: readonly TopicItem[],
  containerId: string,
  newElement: PowerShowElement,
): TopicItem[] {
  let changed = false;

  const nextItems: TopicItem[] = items.map((item) => {
    const children = appendElementToContainer(
      item.content.children,
      containerId,
      newElement,
    );
    const nestedChildren = appendElementToContainerInTopicItems(
      item.children,
      containerId,
      newElement,
    );

    if (
      children === item.content.children &&
      nestedChildren === item.children
    ) {
      return item;
    }

    changed = true;

    return {
      ...item,
      content:
        children === item.content.children
          ? item.content
          : {
              ...item.content,
              children,
            },
      children: nestedChildren,
    };
  });

  return changed ? nextItems : (items as TopicItem[]);
}

export function appendElementToContainer(
  elements: PowerShowElement[],
  containerId: string,
  newElement: PowerShowElement,
): PowerShowElement[] {
  let changed = false;

  const nextElements: PowerShowElement[] = elements.map((element) => {
    if (element.type === "container" && element.id === containerId) {
      changed = true;
      return { ...element, children: [...element.children, newElement] };
    }

    if (element.type === "container") {
      const children = appendElementToContainer(
        element.children,
        containerId,
        newElement,
      );

      if (children !== element.children) {
        changed = true;
        return { ...element, children };
      }
      return element;
    }

    if (element.type === "topics") {
      const items = appendElementToContainerInTopicItems(
        element.items,
        containerId,
        newElement,
      );

      if (items !== element.items) {
        changed = true;
        return { ...element, items };
      }
    }

    return element;
  });

  return changed ? nextElements : (elements as PowerShowElement[]);
}

function appendElementToContentSlotInTopicItems(
  items: readonly TopicItem[],
  contentSlotId: string,
  newElement: PowerShowElement,
): TopicItem[] {
  let changed = false;

  const nextItems: TopicItem[] = items.map((item) => {
    if (item.content.id === contentSlotId) {
      changed = true;

      return {
        ...item,
        content: {
          ...item.content,
          children: [...item.content.children, newElement],
        },
      };
    }

    const children = appendElementToContentSlot(
      item.content.children,
      contentSlotId,
      newElement,
    );
    const nestedChildren = appendElementToContentSlotInTopicItems(
      item.children,
      contentSlotId,
      newElement,
    );

    if (
      children === item.content.children &&
      nestedChildren === item.children
    ) {
      return item;
    }

    changed = true;

    return {
      ...item,
      content:
        children === item.content.children
          ? item.content
          : {
              ...item.content,
              children,
            },
      children: nestedChildren,
    };
  });

  return changed ? nextItems : (items as TopicItem[]);
}

export function appendElementToContentSlot(
  elements: PowerShowElement[],
  contentSlotId: string,
  newElement: PowerShowElement,
): PowerShowElement[] {
  if (isForbiddenTopicPlacement(elements, contentSlotId, newElement)) {
    return elements;
  }

  let changed = false;

  const nextElements: PowerShowElement[] = elements.map((element) => {
    if (element.type === "container") {
      const children = appendElementToContentSlot(
        element.children,
        contentSlotId,
        newElement,
      );

      if (children !== element.children) {
        changed = true;
        return { ...element, children };
      }
      return element;
    }

    if (element.type === "topics") {
      const items = appendElementToContentSlotInTopicItems(
        element.items,
        contentSlotId,
        newElement,
      );

      if (items !== element.items) {
        changed = true;
        return { ...element, items };
      }
    }

    return element;
  });

  return changed ? nextElements : (elements as PowerShowElement[]);
}

// ============================================================
// END: APPEND EM CONTAINER / CONTENT SLOT
// ============================================================

// ============================================================
// BEGIN: DELETE ELEMENT
// ============================================================

function removeElementByIdInTopicItems(
  items: readonly TopicItem[],
  id: string,
): TopicItem[] {
  let changed = false;

  const nextItems: TopicItem[] = items.map((item) => {
    const children = removeElementById(item.content.children, id);
    const nestedChildren = removeElementByIdInTopicItems(item.children, id);

    if (
      children === item.content.children &&
      nestedChildren === item.children
    ) {
      return item;
    }

    changed = true;

    return {
      ...item,
      content:
        children === item.content.children
          ? item.content
          : {
              ...item.content,
              children,
            },
      children: nestedChildren,
    };
  });

  return changed ? nextItems : (items as TopicItem[]);
}

export function removeElementById(
  elements: PowerShowElement[],
  id: string,
): PowerShowElement[] {
  let changed = false;

  const nextElements: PowerShowElement[] = elements.flatMap(
    (element): PowerShowElement[] => {
      if (element.id === id) {
        changed = true;
        return [];
      }

      if (element.type === "container") {
        const children = removeElementById(element.children, id);

        if (children !== element.children) {
          changed = true;
          return [{ ...element, children }];
        }

        return [element];
      }

      if (element.type === "topics") {
        const items = removeElementByIdInTopicItems(element.items, id);

        if (items !== element.items) {
          changed = true;
          return [{ ...element, items }];
        }
      }

      return [element];
    },
  );

  return changed ? nextElements : (elements as PowerShowElement[]);
}

// ============================================================
// END: DELETE ELEMENT
// ============================================================

// ============================================================
// BEGIN: ELEMENT SIBLING POSITION
// ============================================================

export interface ElementSiblingPosition {
  index: number;
  count: number;
  parentRef: ElementParentRef;
}

export function findElementSiblingPosition(
  elements: readonly PowerShowElement[],
  id: string,
): ElementSiblingPosition | null {
  const location = findElementLocation(elements, id);

  return location
    ? {
        index: location.index,
        count: location.count,
        parentRef: location.parentRef,
      }
    : null;
}

// ============================================================
// END: ELEMENT SIBLING POSITION
// ============================================================

// ============================================================
// BEGIN: MOVE ELEMENT
// ============================================================

export function moveElementById(
  elements: PowerShowElement[],
  id: string,
  offset: -1 | 1,
): PowerShowElement[] {
  const location = findElementLocation(elements, id);

  if (!location) {
    return elements;
  }

  return moveElementToSiblingIndexById(elements, id, location.index + offset);
}

export function moveElementToSiblingIndexById(
  elements: PowerShowElement[],
  id: string,
  targetIndex: number,
): PowerShowElement[] {
  const location = findElementLocation(elements, id);

  if (!location) {
    return elements;
  }

  const siblings = getElementsForParentRef(elements, location.parentRef);

  if (
    !siblings ||
    targetIndex < 0 ||
    targetIndex >= siblings.length ||
    targetIndex === location.index
  ) {
    return elements;
  }

  const withoutSource = removeElementById(elements, id);
  const targetElements = getElementsForParentRef(
    withoutSource,
    location.parentRef,
  );

  if (!targetElements) {
    return elements;
  }

  const insertIndex = Math.min(targetIndex, targetElements.length);

  return insertElementIntoParentRef(
    withoutSource,
    location.parentRef,
    insertIndex,
    location.element,
  );
}

export interface MoveElementOptions {
  elementId: string;
  targetParentRef: ElementParentRef;
  targetIndex?: number;
}

export type MoveElementError =
  | "element-not-found"
  | "target-parent-not-found"
  | "invalid-target-parent"
  | "cycle"
  | "invalid-target-index";

export interface MoveElementResult {
  elements: PowerShowElement[];
  moved: boolean;
  error?: MoveElementError;
}

function collectDescendantIds(
  element: PowerShowElement,
  ids: Set<string>,
): void {
  collectAuthoringIds(element, ids);
}

function removeElementFromHierarchy(
  elements: PowerShowElement[],
  id: string,
): PowerShowElement[] {
  return removeElementById(elements, id);
}

function insertElementIntoParentRef(
  elements: PowerShowElement[],
  parentRef: ElementParentRef,
  index: number,
  elementToInsert: PowerShowElement,
): PowerShowElement[] {
  if (parentRef.kind === "slide") {
    return [
      ...elements.slice(0, index),
      elementToInsert,
      ...elements.slice(index),
    ];
  }

  let changed = false;

  const nextElements: PowerShowElement[] = elements.map((element) => {
    if (
      parentRef.kind === "container" &&
      element.type === "container" &&
      element.id === parentRef.id
    ) {
      changed = true;

      return {
        ...element,
        children: [
          ...element.children.slice(0, index),
          elementToInsert,
          ...element.children.slice(index),
        ],
      };
    }

    if (element.type === "container") {
      const children = insertElementIntoParentRef(
        element.children,
        parentRef,
        index,
        elementToInsert,
      );

      if (children !== element.children) {
        changed = true;
        return { ...element, children };
      }

      return element;
    }

    if (element.type === "topics") {
      const items = insertIntoTopicItems(
        element.items,
        parentRef,
        index,
        elementToInsert,
      );

      if (items !== element.items) {
        changed = true;
        return { ...element, items };
      }
    }

    return element;
  });

  return changed ? nextElements : elements;
}

function insertIntoTopicItems(
  items: readonly TopicItem[],
  parentRef: ElementParentRef,
  index: number,
  elementToInsert: PowerShowElement,
): TopicItem[] {
  let changed = false;

  const nextItems: TopicItem[] = items.map((item) => {
    if (parentRef.kind === "content-slot" && item.content.id === parentRef.id) {
      changed = true;

      return {
        ...item,
        content: {
          ...item.content,
          children: [
            ...item.content.children.slice(0, index),
            elementToInsert,
            ...item.content.children.slice(index),
          ],
        },
      };
    }

    const contentChildren = insertElementIntoParentRef(
      item.content.children,
      parentRef,
      index,
      elementToInsert,
    );
    const nestedChildren = insertIntoTopicItems(
      item.children,
      parentRef,
      index,
      elementToInsert,
    );

    if (
      contentChildren === item.content.children &&
      nestedChildren === item.children
    ) {
      return item;
    }

    changed = true;
    return {
      ...item,
      content:
        contentChildren === item.content.children
          ? item.content
          : {
              ...item.content,
              children: contentChildren,
            },
      children: nestedChildren,
    };
  });

  return changed ? nextItems : (items as TopicItem[]);
}

function getTargetElementsForParentRef(
  elements: PowerShowElement[],
  parentRef: ElementParentRef,
): PowerShowElement[] | null {
  return getElementsForParentRef(elements, parentRef) as
    | PowerShowElement[]
    | null;
}

export function moveElement(
  elements: PowerShowElement[],
  options: MoveElementOptions,
): MoveElementResult {
  const source = findElementLocation(elements, options.elementId);

  if (!source) {
    return { elements, moved: false, error: "element-not-found" };
  }

  const targetElements = getTargetElementsForParentRef(
    elements,
    options.targetParentRef,
  );

  if (!targetElements) {
    return { elements, moved: false, error: "target-parent-not-found" };
  }

  const forbiddenIds = new Set<string>();
  collectDescendantIds(source.element, forbiddenIds);

  if (
    options.targetParentRef.kind !== "slide" &&
    forbiddenIds.has(options.targetParentRef.id)
  ) {
    return { elements, moved: false, error: "cycle" };
  }

  if (
    options.targetParentRef.kind === "content-slot" &&
    isForbiddenTopicPlacement(
      elements,
      options.targetParentRef.id,
      source.element,
    )
  ) {
    return { elements, moved: false, error: "invalid-target-parent" };
  }

  const withoutSource = removeElementFromHierarchy(elements, options.elementId);
  const nextTargetElements = getTargetElementsForParentRef(
    withoutSource,
    options.targetParentRef,
  );

  if (!nextTargetElements) {
    return { elements, moved: false, error: "invalid-target-parent" };
  }

  const targetIndex = options.targetIndex ?? nextTargetElements.length;

  if (targetIndex < 0 || targetIndex > nextTargetElements.length) {
    return { elements, moved: false, error: "invalid-target-index" };
  }

  return {
    elements: insertElementIntoParentRef(
      withoutSource,
      options.targetParentRef,
      targetIndex,
      source.element,
    ),
    moved: true,
  };
}

export function moveElementOut(
  elements: PowerShowElement[],
  elementId: string,
): MoveElementResult {
  const source = findElementLocation(elements, elementId);

  if (!source || source.parentRef.kind !== "container") {
    return { elements, moved: false, error: "invalid-target-parent" };
  }

  const parent = findElementLocation(elements, source.parentRef.id);

  if (!parent) {
    return { elements, moved: false, error: "invalid-target-parent" };
  }

  return moveElement(elements, {
    elementId,
    targetParentRef: parent.parentRef,
    targetIndex: parent.index + 1,
  });
}

// ============================================================
// END: MOVE ELEMENT
// ============================================================
