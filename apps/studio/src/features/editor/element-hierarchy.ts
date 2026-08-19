import type {
  ContainerElement,
  ContentSlot,
  PowerShowElement,
  Slide,
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

  if (isTopics(element)) {
    collectTopicItemIds(element.items, ids);
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

    if (element.type === "topics") {
      for (const item of element.items) {
        collectContainerIds(item.content.children, ids);
        collectContainerIdsFromTopicItems(item.children, ids);
      }
    }
  }
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
