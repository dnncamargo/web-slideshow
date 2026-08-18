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
  | "table";

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


function collectPresentationElementIds(
  slides: readonly Slide[],
): Set<string> {
  const ids =
    new Set<string>();


  for (const slide of slides) {
    collectElementIds(
      slide.elements,
      ids,
    );
  }


  return ids;
}

// ============================================================
// END: COLETA DE IDS
// ============================================================


// ============================================================
// BEGIN: ID ÚNICO
// ============================================================

function createUniqueId(
  baseId: string,
  usedIds: Set<string>,
): string {
  if (
    !usedIds.has(
      baseId,
    )
  ) {
    return baseId;
  }


  let suffix = 2;


  while (
    usedIds.has(
      `${baseId}-${suffix}`,
    )
  ) {
    suffix += 1;
  }


  return `${baseId}-${suffix}`;
}

// ============================================================
// END: ID ÚNICO
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
  const usedIds =
    collectPresentationElementIds(
      slides,
    );


  switch (type) {
    case "text": {
      return {
        id:
          createUniqueId(
            "text-element",
            usedIds,
          ),

        type:
          "text",

        hidden:
          false,

        content:
          "New text",

        variant:
          "body",
      };
    }


    case "textbox": {
      return {
        id:
          createUniqueId(
            "textbox-element",
            usedIds,
          ),

        type:
          "textbox",

        hidden:
          false,

        content:
          "New textbox",
      };
    }


    case "container": {
      return {
        id:
          createUniqueId(
            "container-element",
            usedIds,
          ),

        type:
          "container",

        hidden:
          false,

        direction:
          "column",

        gap:
          16,

        horizontalAlign:
          "center",

        verticalAlign:
          "center",

        style: {
          width:
            "70%",

          height:
            "60%",

          padding:
            24,

          background:
            "rgba(15, 23, 42, 0.55)",
        },

        children:
          [],
      };
    }


    case "image": {
      return {
        id:
          createUniqueId(
            "image-element",
            usedIds,
          ),

        type:
          "image",

        hidden:
          false,

        src:
          "/powershow-demo.svg",

        alt:
          "New image",

        fit:
          "contain",

        style: {
          width:
            "60%",

          height:
            "55%",
        },
      };
    }


    case "code": {
      return {
        id:
          createUniqueId(
            "code-element",
            usedIds,
          ),

        type:
          "code",

        hidden:
          false,

        code:
          "const message = \"Hello PowerShow\";",

        language:
          "typescript",

        showLineNumbers:
          true,

        highlightedLines:
          [],
      };
    }


    case "terminal": {
      return {
        id:
          createUniqueId(
            "terminal-element",
            usedIds,
          ),

        type:
          "terminal",

        hidden:
          false,

        title:
          "Terminal",

        lines: [
          {
            type:
              "command",

            content:
              "pnpm dev",
          },
        ],
      };
    }


    case "table": {
      return {
        id:
          createUniqueId(
            "table-element",
            usedIds,
          ),

        type:
          "table",

        hidden:
          false,

        columns: [
          {
            key:
              "column_1",

            label:
              "Column 1",
          },
        ],

        rows: [
          {
            column_1:
              "Value",
          },
        ],
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
    children: item.children.map((child) => cloneTopicItemWithUniqueIds(child, usedIds)),
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
      items: clone.items.map((item) => cloneTopicItemWithUniqueIds(item, usedIds)),
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
    const children = insertElementAfterId(item.content.children, targetId, newElement);
    const nestedChildren = insertElementAfterIdInTopicItems(item.children, targetId, newElement);

    if (children === item.content.children && nestedChildren === item.children) {
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
      const children = insertElementAfterId(element.children, targetId, newElement);

      if (children !== element.children) {
        result[result.length - 1] = { ...element, children };
        changed = true;
      }
      continue;
    }

    if (element.type === "topics") {
      const items = insertElementAfterIdInTopicItems(element.items, targetId, newElement);

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

function appendElementToContainerInTopicItems(
  items: readonly TopicItem[],
  containerId: string,
  newElement: PowerShowElement,
): TopicItem[] {
  let changed = false;

  const nextItems: TopicItem[] = items.map((item) => {
    const children = appendElementToContainer(item.content.children, containerId, newElement);
    const nestedChildren = appendElementToContainerInTopicItems(item.children, containerId, newElement);

    if (children === item.content.children && nestedChildren === item.children) {
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
      const children = appendElementToContainer(element.children, containerId, newElement);

      if (children !== element.children) {
        changed = true;
        return { ...element, children };
      }
      return element;
    }

    if (element.type === "topics") {
      const items = appendElementToContainerInTopicItems(element.items, containerId, newElement);

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

    const children = appendElementToContentSlot(item.content.children, contentSlotId, newElement);
    const nestedChildren = appendElementToContentSlotInTopicItems(item.children, contentSlotId, newElement);

    if (children === item.content.children && nestedChildren === item.children) {
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
  let changed = false;

  const nextElements: PowerShowElement[] = elements.map((element) => {
    if (element.type === "container") {
      const children = appendElementToContentSlot(element.children, contentSlotId, newElement);

      if (children !== element.children) {
        changed = true;
        return { ...element, children };
      }
      return element;
    }

    if (element.type === "topics") {
      const items = appendElementToContentSlotInTopicItems(element.items, contentSlotId, newElement);

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

    if (children === item.content.children && nestedChildren === item.children) {
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

  const nextElements: PowerShowElement[] = elements.flatMap((element): PowerShowElement[] => {
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
  });

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

  if (!siblings || targetIndex < 0 || targetIndex >= siblings.length || targetIndex === location.index) {
    return elements;
  }

  const withoutSource = removeElementById(elements, id);
  const targetElements = getElementsForParentRef(withoutSource, location.parentRef);

  if (!targetElements) {
    return elements;
  }

  const insertIndex = Math.min(targetIndex, targetElements.length);

  return insertElementIntoParentRef(withoutSource, location.parentRef, insertIndex, location.element);
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

function collectDescendantIds(element: PowerShowElement, ids: Set<string>): void {
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
    if (parentRef.kind === "container" && element.type === "container" && element.id === parentRef.id) {
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
  return getElementsForParentRef(elements, parentRef) as PowerShowElement[] | null;
}

export function moveElement(
  elements: PowerShowElement[],
  options: MoveElementOptions,
): MoveElementResult {
  const source = findElementLocation(elements, options.elementId);

  if (!source) {
    return { elements, moved: false, error: "element-not-found" };
  }

  const targetElements = getTargetElementsForParentRef(elements, options.targetParentRef);

  if (!targetElements) {
    return { elements, moved: false, error: "target-parent-not-found" };
  }

  const forbiddenIds = new Set<string>();
  collectDescendantIds(source.element, forbiddenIds);

  if (options.targetParentRef.kind !== "slide" && forbiddenIds.has(options.targetParentRef.id)) {
    return { elements, moved: false, error: "cycle" };
  }

  const withoutSource = removeElementFromHierarchy(elements, options.elementId);
  const nextTargetElements = getTargetElementsForParentRef(withoutSource, options.targetParentRef);

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
