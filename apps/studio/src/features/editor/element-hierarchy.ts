import type {
  BlockItem,
  BlocksElement,
  ContainerElement,
  ContentSlot,
  PowerShowElement,
  Slide,
  StructuredTableElement,
  TopicItem,
  TopicsElement,
} from "@powershow/document-schema";

export type ElementParentRef =
  | { kind: "slide" }
  | { kind: "container"; id: string }
  | { kind: "content-slot"; id: string };

export interface ElementSiblingPosition {
  index: number;
  count: number;
  parentRef: ElementParentRef;
}

export interface ElementLocation {
  element: PowerShowElement;
  parentRef: ElementParentRef;
  index: number;
  count: number;
}

function isContainer(element: PowerShowElement): element is ContainerElement {
  return element.type === "container";
}

function isTopics(element: PowerShowElement): element is TopicsElement {
  return element.type === "topics";
}

function isBlocks(element: PowerShowElement): element is BlocksElement {
  return element.type === "blocks";
}

export function isStructuredTable(
  element: PowerShowElement,
): element is StructuredTableElement {
  return element.type === "table" && element.mode === "structured";
}

function findElementInStructuredTableSlots(
  table: StructuredTableElement,
  id: string,
): ElementLocation | null {
  for (const column of table.columns) {
    const found = findElementLocation(column.header.children, id, {
      kind: "content-slot",
      id: column.header.id,
    });

    if (found) {
      return found;
    }
  }

  for (const row of table.rows) {
    for (const cell of row.cells) {
      const found = findElementLocation(cell.children, id, {
        kind: "content-slot",
        id: cell.id,
      });

      if (found) {
        return found;
      }
    }
  }

  return null;
}

function findElementInStructuredTableById(
  table: StructuredTableElement,
  id: string,
): PowerShowElement | null {
  for (const column of table.columns) {
    const found = findElementById(column.header.children, id);

    if (found) {
      return found;
    }
  }

  for (const row of table.rows) {
    for (const cell of row.cells) {
      const found = findElementById(cell.children, id);

      if (found) {
        return found;
      }
    }
  }

  return null;
}

function someStructuredTableSlots(
  table: StructuredTableElement,
  predicate: (element: PowerShowElement) => boolean,
): boolean {
  for (const column of table.columns) {
    if (someElements(column.header.children, predicate)) {
      return true;
    }
  }

  for (const row of table.rows) {
    for (const cell of row.cells) {
      if (someElements(cell.children, predicate)) {
        return true;
      }
    }
  }

  return false;
}

function findContentSlotInStructuredTable(
  table: StructuredTableElement,
  id: string,
): ContentSlot | null {
  for (const column of table.columns) {
    if (column.header.id === id) {
      return column.header;
    }

    const found = findContentSlotById(column.header.children, id);

    if (found) {
      return found;
    }
  }

  for (const row of table.rows) {
    for (const cell of row.cells) {
      if (cell.id === id) {
        return cell;
      }

      const found = findContentSlotById(cell.children, id);

      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * Maps the children of every Structured Table header/cell ContentSlot through
 * `transform`. Returns null when no slot changed (immutability guard used by
 * the collection of hierarchy operations).
 */
export function updateStructuredTableSlots(
  table: StructuredTableElement,
  transform: (
    children: PowerShowElement[],
  ) => PowerShowElement[],
): StructuredTableElement | null {
  let columnsChanged = false;

  const columns = table.columns.map((column) => {
    const children = transform(column.header.children);

    if (children === column.header.children) {
      return column;
    }

    columnsChanged = true;

    return {
      ...column,
      header: { ...column.header, children },
    };
  });

  let rowsChanged = false;

  const rows = table.rows.map((row) => {
    let cellChanged = false;

    const cells = row.cells.map((cell) => {
      const children = transform(cell.children);

      if (children === cell.children) {
        return cell;
      }

      cellChanged = true;

      return { ...cell, children };
    });

    if (!cellChanged) {
      return row;
    }

    rowsChanged = true;

    return { ...row, cells };
  });

  if (!columnsChanged && !rowsChanged) {
    return null;
  }

  return {
    ...table,
    columns: columnsChanged ? columns : table.columns,
    rows: rowsChanged ? rows : table.rows,
  };
}

function collectStructuredTableContainerIds(
  table: StructuredTableElement,
  ids: Set<string>,
): void {
  for (const column of table.columns) {
    collectContainerIds(column.header.children, ids);
  }

  for (const row of table.rows) {
    for (const cell of row.cells) {
      collectContainerIds(cell.children, ids);
    }
  }
}

function structuredTableContainsTopicItemContentSlot(
  table: StructuredTableElement,
  slotId: string,
): boolean {
  for (const column of table.columns) {
    if (isTopicItemContentSlotId(column.header.children, slotId)) {
      return true;
    }
  }

  for (const row of table.rows) {
    for (const cell of row.cells) {
      if (isTopicItemContentSlotId(cell.children, slotId)) {
        return true;
      }
    }
  }

  return false;
}

function getTopicItemContentChildren(topicItem: TopicItem): PowerShowElement[] {
  return topicItem.content.children;
}

function findElementInTopicItems(
  items: readonly TopicItem[],
  id: string,
): ElementLocation | null {
  for (const item of items) {
    const contentLocation = findElementLocation(
      getTopicItemContentChildren(item),
      id,
      { kind: "content-slot", id: item.content.id },
    );

    if (contentLocation) {
      return contentLocation;
    }

    const childLocation = findElementInTopicItems(item.children, id);

    if (childLocation) {
      return childLocation;
    }
  }

  return null;
}

export function findElementLocation(
  elements: readonly PowerShowElement[],
  id: string,
  parentRef: ElementParentRef = { kind: "slide" },
): ElementLocation | null {
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];

    if (!element) {
      continue;
    }

    if (element.id === id) {
      return {
        element,
        parentRef,
        index,
        count: elements.length,
      };
    }

    if (isContainer(element)) {
      const found = findElementLocation(
        element.children,
        id,
        { kind: "container", id: element.id },
      );

      if (found) {
        return found;
      }
    }

    if (isStructuredTable(element)) {
      const found = findElementInStructuredTableSlots(element, id);

      if (found) {
        return found;
      }
    }

    if (isTopics(element)) {
      const found = findElementInTopicItems(element.items, id);

      if (found) {
        return found;
      }
    }
  }

  return null;
}

export function findElementById(
  elements: readonly PowerShowElement[],
  id: string,
): PowerShowElement | null {
  for (const element of elements) {
    if (element.id === id) {
      return element;
    }

    if (isContainer(element)) {
      const found = findElementById(element.children, id);

      if (found) {
        return found;
      }
    }

    if (isStructuredTable(element)) {
      const found = findElementInStructuredTableById(element, id);

      if (found) {
        return found;
      }
    }

    if (isTopics(element)) {
      for (const item of element.items) {
        const childFound = findElementById(item.content.children, id);

        if (childFound) {
          return childFound;
        }

        const nestedFound = findTopicItemElementById(item.children, id);

        if (nestedFound) {
          return nestedFound;
        }
      }
    }
  }

  return null;
}

function findTopicItemElementById(
  items: readonly TopicItem[],
  id: string,
): PowerShowElement | null {
  for (const item of items) {
    const found = findElementById(item.content.children, id);

    if (found) {
      return found;
    }

    const nestedFound = findTopicItemElementById(item.children, id);

    if (nestedFound) {
      return nestedFound;
    }
  }

  return null;
}

function updateTopicItems(
  items: readonly TopicItem[],
  id: string,
  update: (element: PowerShowElement) => PowerShowElement,
): TopicItem[] {
  let changed = false;

  const nextItems: TopicItem[] = items.map((item) => {
    const updatedContentChildren = updatePowerShowElements(
      item.content.children,
      id,
      update,
    );
    const updatedChildren = updateTopicItems(item.children, id, update);

    if (
      updatedContentChildren === item.content.children &&
      updatedChildren === item.children
    ) {
      return item;
    }

    changed = true;

    return {
      ...item,
      content:
        updatedContentChildren === item.content.children
          ? item.content
          : {
              ...item.content,
              children: updatedContentChildren,
            },
      children: updatedChildren,
    };
  });

  return changed ? nextItems : (items as TopicItem[]);
}

function updatePowerShowElements(
  elements: readonly PowerShowElement[],
  id: string,
  update: (element: PowerShowElement) => PowerShowElement,
): PowerShowElement[] {
  let changed = false;

  const nextElements: PowerShowElement[] = elements.map((element) => {
    if (element.id === id) {
      changed = true;
      return update(element);
    }

    if (isContainer(element)) {
      const children = updatePowerShowElements(element.children, id, update);

      if (children === element.children) {
        return element;
      }

      changed = true;

      return { ...element, children };
    }

    if (isStructuredTable(element)) {
      const updated = updateStructuredTableSlots(element, (children) =>
        updatePowerShowElements(children, id, update),
      );

      if (updated === null) {
        return element;
      }

      changed = true;

      return updated;
    }

    if (isTopics(element)) {
      const items = updateTopicItems(element.items, id, update);

      if (items === element.items) {
        return element;
      }

      changed = true;

      return { ...element, items };
    }

    return element;
  });

  return changed ? nextElements : (elements as PowerShowElement[]);
}

export function updateElementById(
  elements: readonly PowerShowElement[],
  id: string,
  update: (element: PowerShowElement) => PowerShowElement,
): PowerShowElement[] {
  return updatePowerShowElements(elements, id, update);
}

function someTopicItems(
  items: readonly TopicItem[],
  predicate: (element: PowerShowElement) => boolean,
): boolean {
  for (const item of items) {
    if (someElements(item.content.children, predicate)) {
      return true;
    }

    if (someTopicItems(item.children, predicate)) {
      return true;
    }
  }

  return false;
}

function someElements(
  elements: readonly PowerShowElement[],
  predicate: (element: PowerShowElement) => boolean,
): boolean {
  for (const element of elements) {
    if (predicate(element)) {
      return true;
    }

    if (isContainer(element) && someElements(element.children, predicate)) {
      return true;
    }

    if (isStructuredTable(element) && someStructuredTableSlots(element, predicate)) {
      return true;
    }

    if (isTopics(element) && someTopicItems(element.items, predicate)) {
      return true;
    }
  }

  return false;
}

export function someElement(
  elements: readonly PowerShowElement[],
  predicate: (element: PowerShowElement) => boolean,
): boolean {
  return someElements(elements, predicate);
}

function collectTopicItemIds(
  items: readonly TopicItem[],
  ids: Set<string>,
): void {
  for (const item of items) {
    ids.add(item.id);
    ids.add(item.content.id);

    for (const child of item.content.children) {
      collectAuthoringIds(child, ids);
    }

    collectTopicItemIds(item.children, ids);
  }
}

/**
 * Collects every BlockItem id inside a BlocksElement items tree,
 * including all descendants.
 *
 * BlockItems are authoring nodes, NOT PowerShowElements. They
 * participate in the authoring ID uniqueness inventory only and are
 * never returned by the PowerShow hierarchy APIs.
 */
function collectBlockItemIds(
  items: readonly BlockItem[],
  ids: Set<string>,
): void {
  for (const item of items) {
    ids.add(item.id);
    for (const part of item.parts) {
      ids.add(part.id);
      if (part.type === "socket" && part.content.type === "block") {
        collectBlockItemIds([part.content.block], ids);
      }
    }

    collectBlockItemIds(item.children, ids);
  }
}

export function collectAuthoringIds(
  element: PowerShowElement,
  ids: Set<string>,
): void {
  ids.add(element.id);

  if (isContainer(element)) {
    for (const child of element.children) {
      collectAuthoringIds(child, ids);
    }
  }

  if (isStructuredTable(element)) {
    for (const column of element.columns) {
      ids.add(column.id);
      ids.add(column.header.id);

      for (const child of column.header.children) {
        collectAuthoringIds(child, ids);
      }
    }

    for (const row of element.rows) {
      ids.add(row.id);

      for (const cell of row.cells) {
        ids.add(cell.id);

        for (const child of cell.children) {
          collectAuthoringIds(child, ids);
        }
      }
    }
  }

  if (isTopics(element)) {
    collectTopicItemIds(element.items, ids);
  }

  if (isBlocks(element)) {
    collectBlockItemIds(element.items, ids);
  }
}

export function collectAuthoringIdsFromElements(
  elements: readonly PowerShowElement[],
): Set<string> {
  const ids = new Set<string>();

  for (const element of elements) {
    collectAuthoringIds(element, ids);
  }

  return ids;
}

export function getElementsForParentRef(
  elements: readonly PowerShowElement[],
  parentRef: ElementParentRef,
): readonly PowerShowElement[] | null {
  if (parentRef.kind === "slide") {
    return elements;
  }

  if (parentRef.kind === "container") {
    const container = findElementById(elements, parentRef.id);

    return container?.type === "container" ? container.children : null;
  }

  return findContentSlotById(elements, parentRef.id)?.children ?? null;
}

export function findContentSlotById(
  elements: readonly PowerShowElement[],
  id: string,
): ContentSlot | null {
  for (const element of elements) {
    if (element.type === "container") {
      const found = findContentSlotById(element.children, id);

      if (found) {
        return found;
      }
    }

    if (isStructuredTable(element)) {
      const found = findContentSlotInStructuredTable(element, id);

      if (found) {
        return found;
      }
    }

    if (element.type === "topics") {
      for (const item of element.items) {
        if (item.content.id === id) {
          return item.content;
        }

        const directFound = findContentSlotById(item.content.children, id);

        if (directFound) {
          return directFound;
        }

        const nestedFound = findContentSlotInTopicItems(item.children, id);

        if (nestedFound) {
          return nestedFound;
        }
      }
    }
  }

  return null;
}

function findContentSlotInTopicItems(
  items: readonly TopicItem[],
  id: string,
): ContentSlot | null {
  for (const item of items) {
    if (item.content.id === id) {
      return item.content;
    }

    const directFound = findContentSlotById(item.content.children, id);

    if (directFound) {
      return directFound;
    }

    const nestedFound = findContentSlotInTopicItems(item.children, id);

    if (nestedFound) {
      return nestedFound;
    }
  }

  return null;
}

/**
 * Determines whether a ContentSlot id belongs to a TopicItem, traversing the
 * whole hierarchy (containers, TopicItem children, autonomous Topics nested
 * inside slots, and Structured Table slots). Used by Studio authoring rules
 * that forbid placing a TopicsElement directly inside a TopicItem ContentSlot.
 *
 * A Structured Table's own header/cell ContentSlots are never TopicItem slots,
 * so a TopicsElement remains valid inside them.
 */
export function isTopicItemContentSlotId(
  elements: readonly PowerShowElement[],
  slotId: string,
): boolean {
  for (const element of elements) {
    if (isContainer(element)) {
      if (isTopicItemContentSlotId(element.children, slotId)) {
        return true;
      }

      continue;
    }

    if (isStructuredTable(element)) {
      if (structuredTableContainsTopicItemContentSlot(element, slotId)) {
        return true;
      }

      continue;
    }

    if (isTopics(element)) {
      if (topicItemsContainSlotId(element.items, slotId)) {
        return true;
      }
    }
  }

  return false;
}

function topicItemsContainSlotId(
  items: readonly TopicItem[],
  slotId: string,
): boolean {
  for (const item of items) {
    if (item.content.id === slotId) {
      return true;
    }

    if (isTopicItemContentSlotId(item.content.children, slotId)) {
      return true;
    }

    if (topicItemsContainSlotId(item.children, slotId)) {
      return true;
    }
  }

  return false;
}

function findTopicItemInTopicItems(
  items: readonly TopicItem[],
  id: string,
): TopicItem | null {
  for (const item of items) {
    if (item.id === id) {
      return item;
    }

    const directFound = findTopicItemById(item.content.children, id);

    if (directFound) {
      return directFound;
    }

    const nestedFound = findTopicItemInTopicItems(item.children, id);

    if (nestedFound) {
      return nestedFound;
    }
  }

  return null;
}

export function findTopicItemById(
  elements: readonly PowerShowElement[],
  id: string,
): TopicItem | null {
  for (const element of elements) {
    if (element.type === "topics") {
      const found = findTopicItemInTopicItems(element.items, id);

      if (found) {
        return found;
      }
    }

    if (element.type === "container") {
      const found = findTopicItemById(element.children, id);

      if (found) {
        return found;
      }
    }
  }

  return null;
}

export function collectContainerIds(
  elements: readonly PowerShowElement[],
  ids: Set<string>,
): void {
  for (const element of elements) {
    if (element.type === "container") {
      ids.add(element.id);
      collectContainerIds(element.children, ids);
    }

    if (isStructuredTable(element)) {
      collectStructuredTableContainerIds(element, ids);
    }

    if (element.type === "topics") {
      for (const item of element.items) {
        collectContainerIds(item.content.children, ids);
        collectContainerIdsFromTopicItems(item.children, ids);
      }
    }
  }
}

/** Visits Containers in canonical authoring order, including slot content. */
export function visitContainers(
  elements: readonly PowerShowElement[],
  visit: (container: ContainerElement) => void,
): void {
  for (const element of elements) {
    if (isContainer(element)) {
      visit(element);
      visitContainers(element.children, visit);
    }

    if (isStructuredTable(element)) {
      for (const column of element.columns) {
        visitContainers(column.header.children, visit);
      }
      for (const row of element.rows) {
        for (const cell of row.cells) {
          visitContainers(cell.children, visit);
        }
      }
    }

    if (isTopics(element)) {
      for (const item of element.items) {
        visitContainers(item.content.children, visit);
        visitContainersInTopicItems(item.children, visit);
      }
    }
  }
}

function visitContainersInTopicItems(
  items: readonly TopicItem[],
  visit: (container: ContainerElement) => void,
): void {
  for (const item of items) {
    visitContainers(item.content.children, visit);
    visitContainersInTopicItems(item.children, visit);
  }
}

/** Counts linked Container references using the canonical hierarchy traversal. */
export function collectLinkedStyleReferenceCounts(
  elements: readonly PowerShowElement[],
  counts: Map<string, number> = new Map(),
): Map<string, number> {
  for (const element of elements) {
    if (element.type === "container") {
      if (element.linkedStyleId !== undefined) {
        counts.set(element.linkedStyleId, (counts.get(element.linkedStyleId) ?? 0) + 1);
      }
      collectLinkedStyleReferenceCounts(element.children, counts);
    }

    if (isStructuredTable(element)) {
      for (const column of element.columns) collectLinkedStyleReferenceCounts(column.header.children, counts);
      for (const row of element.rows) for (const cell of row.cells) collectLinkedStyleReferenceCounts(cell.children, counts);
    }

    if (element.type === "topics") {
      for (const item of element.items) {
        collectLinkedStyleReferenceCounts(item.content.children, counts);
        for (const child of item.children) collectLinkedStyleReferenceCountsFromTopicItem(child, counts);
      }
    }
  }
  return counts;
}

function collectLinkedStyleReferenceCountsFromTopicItem(item: TopicItem, counts: Map<string, number>): void {
  collectLinkedStyleReferenceCounts(item.content.children, counts);
  for (const child of item.children) collectLinkedStyleReferenceCountsFromTopicItem(child, counts);
}

function collectContainerIdsFromTopicItems(
  items: readonly TopicItem[],
  ids: Set<string>,
): void {
  for (const item of items) {
    collectContainerIds(item.content.children, ids);
    collectContainerIdsFromTopicItems(item.children, ids);
  }
}

export function collectElementAndStructuralIds(
  slides: readonly Slide[],
): Set<string> {
  const ids = new Set<string>();

  for (const slide of slides) {
    for (const element of slide.elements) {
      collectAuthoringIds(element, ids);
    }
  }

  return ids;
}
