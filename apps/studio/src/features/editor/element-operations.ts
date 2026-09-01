import type {
  BlockCategory,
  BlockItem,
  BlockPart,
  BlockSocketPart,
  BlockTextPart,
  BlocksElement,
  ContentSlot,
  GalleryElement,
  PowerShowElement,
  Slide,
  StructuredTableColumn,
  StructuredTableElement,
  StructuredTableRow,
  TopicItem,
  TopicsElement,
} from "@powershow/document-schema";

import {
  getTextContentPlainText,
  reconcileTextContentEdit,
} from "./rich-text-authoring";

import {
  collectAuthoringIds,
  findElementLocation,
  getElementsForParentRef,
  type ElementParentRef,
  findElementById,
  isStructuredTable,
  isTopicItemContentSlotId,
  updateElementById,
  updateStructuredTableSlots,
} from "./element-hierarchy";

// ============================================================
// BEGIN: TIPOS DE ELEMENTOS CRIÁVEIS
//
// Chart e Interactive ficam fora desta primeira rodada porque
// ainda não possuem edição/renderização completa no Editor.
// ============================================================

export type ElementCreateType =
  | "text"
  | "container"
  | "image"
  | "code"
  | "terminal"
  | "table"
  | "topics"
  | "divider"
  | "gallery"
  | "embed"
  | "blocks"
  | "scripted";

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

export function collectPresentationElementIds(
  slides: readonly Slide[],
): Set<string> {
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

      if (
        textChild?.type !== "text" ||
        getTextContentPlainText(textChild.content) === content
      ) {
        return currentItem;
      }

      const nextContent = reconcileTextContentEdit(textChild.content, content);

      const children = [...currentItem.content.children];

      children[textIndex] = {
        ...textChild,
        content: nextContent,
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
// BEGIN: BLOCKS AUTHORING (BlockItem / BlockPart)
//
// Um BlockItem é um nó estrutural do documento. Ele NÃO é um
// PowerShowElement: participa do inventário de IDs de autoria, com
// recursão por DUAS arestas: scope children (BlockItem.children) e
// reporter nesting (socket content.block).
// ============================================================

/**
 * AUTHORING limit for compositional BlockItem nesting.
 *
 * root BlockItem = depth 1; scope child = parent depth + 1;
 * socket content.block = owner depth + 1.
 *
 * The limit controls CREATION only. At depth 5 existing content stays
 * editable, removal/reorder/text/literal/part edits keep working, and
 * imported documents deeper than 5 remain loadable. The canonical
 * schema stays unbounded.
 */
export const MAX_BLOCK_AUTHORING_DEPTH = 5;

export function createDefaultStackBlockItem(
  usedIds: Set<string>,
  categoryId: string,
): BlockItem {
  const id = createUniqueId("block-item", usedIds);
  usedIds.add(id);
  const partId = createUniqueId("block-part", usedIds);
  usedIds.add(partId);

  return {
    id,
    categoryId,
    shape: "statement",
    parts: [
      {
        id: partId,
        type: "text",
        text: "New block",
      },
    ],
    children: [],
  };
}

export function createDefaultValueBlockItem(
  usedIds: Set<string>,
  categoryId: string,
): BlockItem {
  const id = createUniqueId("block-item", usedIds);
  usedIds.add(id);
  const partId = createUniqueId("block-part", usedIds);
  usedIds.add(partId);

  return {
    id,
    categoryId,
    shape: "value",
    parts: [
      {
        id: partId,
        type: "text",
        text: "Value",
      },
    ],
    children: [],
  };
}

export function createDefaultTextPart(usedIds: Set<string>): BlockTextPart {
  const partId = createUniqueId("block-part", usedIds);
  usedIds.add(partId);

  return {
    id: partId,
    type: "text",
    text: "Text",
  };
}

export function createDefaultSocketPart(
  usedIds: Set<string>,
): BlockSocketPart {
  const partId = createUniqueId("block-part", usedIds);
  usedIds.add(partId);

  return {
    id: partId,
    type: "socket",
    content: { type: "empty" },
  };
}

// ------------------------------------------------------------
// BlockItem lookup / update through BOTH recursion edges:
// scope children and socket content.block (nested anywhere).
// ------------------------------------------------------------

export function findBlockItemById(
  blocks: BlocksElement,
  blockItemId: string,
): BlockItem | null {
  return findBlockItemInItems(blocks.items, blockItemId);
}

function findBlockItemInItems(
  items: readonly BlockItem[],
  blockItemId: string,
): BlockItem | null {
  for (const item of items) {
    if (item.id === blockItemId) {
      return item;
    }

    const child = findBlockItemInItems(item.children, blockItemId);

    if (child) {
      return child;
    }

    const socket = findBlockItemInSocketParts(item.parts, blockItemId);

    if (socket) {
      return socket;
    }
  }

  return null;
}

function findBlockItemInSocketParts(
  parts: readonly BlockPart[],
  blockItemId: string,
): BlockItem | null {
  for (const part of parts) {
    if (part.type !== "socket" || part.content.type !== "block") {
      continue;
    }

    if (part.content.block.id === blockItemId) {
      return part.content.block;
    }

    const child = findBlockItemInItems(
      part.content.block.children,
      blockItemId,
    );

    if (child) {
      return child;
    }

    const nested = findBlockItemInSocketParts(
      part.content.block.parts,
      blockItemId,
    );

    if (nested) {
      return nested;
    }
  }

  return null;
}

/**
 * Immutable recursive update primitive. Locates a BlockItem through
 * BOTH recursion edges (root items, scope children, socket
 * content.block, sockets nested inside value blocks), applies the
 * updater, and returns a new BlocksElement. Returns the exact same
 * reference on no-op and never mutates the source.
 */
export function updateBlockItemById(
  blocks: BlocksElement,
  blockItemId: string,
  update: (item: BlockItem) => BlockItem,
): BlocksElement {
  const items = updateBlockItemInItems(blocks.items, blockItemId, update);

  return items === blocks.items ? blocks : { ...blocks, items };
}

function updateBlockItemInItems(
  items: readonly BlockItem[],
  blockItemId: string,
  update: (item: BlockItem) => BlockItem,
): BlockItem[] {
  let changed = false;

  const nextItems = items.map((item) => {
    if (item.id === blockItemId) {
      const nextItem = update(item);

      if (nextItem === item) {
        return item;
      }

      changed = true;

      return nextItem;
    }

    const children = updateBlockItemInItems(
      item.children,
      blockItemId,
      update,
    );
    const parts = updateBlockItemInSocketParts(
      item.parts,
      blockItemId,
      update,
    );

    if (children === item.children && parts === item.parts) {
      return item;
    }

    changed = true;

    return { ...item, children, parts };
  });

  return changed ? nextItems : (items as BlockItem[]);
}

function updateBlockItemInSocketParts(
  parts: readonly BlockPart[],
  blockItemId: string,
  update: (item: BlockItem) => BlockItem,
): BlockPart[] {
  let changed = false;

  const nextParts = parts.map((part) => {
    if (part.type !== "socket" || part.content.type !== "block") {
      return part;
    }

    if (part.content.block.id === blockItemId) {
      const nextBlock = update(part.content.block);

      if (nextBlock === part.content.block) {
        return part;
      }

      changed = true;

      return {
        ...part,
        content: { type: "block" as const, block: nextBlock },
      };
    }

    const children = updateBlockItemInItems(
      part.content.block.children,
      blockItemId,
      update,
    );
    const nestedParts = updateBlockItemInSocketParts(
      part.content.block.parts,
      blockItemId,
      update,
    );

    if (
      children === part.content.block.children &&
      nestedParts === part.content.block.parts
    ) {
      return part;
    }

    changed = true;

    return {
      ...part,
      content: {
        type: "block" as const,
        block: {
          ...part.content.block,
          children,
          parts: nestedParts,
        },
      },
    };
  });

  return changed ? nextParts : (parts as BlockPart[]);
}

/**
 * Structural authoring depth of a BlockItem, counting BOTH edges:
 * scope children increment the depth like stack nesting, while a
 * socket content.block is owner depth + 1. Root items are depth 1.
 * Returns null when the BlockItem is not found.
 */
export function findBlockItemDepth(
  blocks: BlocksElement,
  blockItemId: string,
): number | null {
  return findBlockItemDepthInItems(blocks.items, blockItemId, 1);
}

function findBlockItemDepthInItems(
  items: readonly BlockItem[],
  blockItemId: string,
  depth: number,
): number | null {
  for (const item of items) {
    if (item.id === blockItemId) {
      return depth;
    }

    const child = findBlockItemDepthInItems(
      item.children,
      blockItemId,
      depth + 1,
    );

    if (child !== null) {
      return child;
    }

    const socket = findBlockItemDepthInSocketParts(
      item.parts,
      blockItemId,
      depth + 1,
    );

    if (socket !== null) {
      return socket;
    }
  }

  return null;
}

function findBlockItemDepthInSocketParts(
  parts: readonly BlockPart[],
  blockItemId: string,
  depth: number,
): number | null {
  for (const part of parts) {
    if (part.type !== "socket" || part.content.type !== "block") {
      continue;
    }

    if (part.content.block.id === blockItemId) {
      return depth;
    }

    const child = findBlockItemDepthInItems(
      part.content.block.children,
      blockItemId,
      depth + 1,
    );

    if (child !== null) {
      return child;
    }

    const nested = findBlockItemDepthInSocketParts(
      part.content.block.parts,
      blockItemId,
      depth + 1,
    );

    if (nested !== null) {
      return nested;
    }
  }

  return null;
}

// ------------------------------------------------------------
// CATEGORY OPERATIONS
//
// Category ids are unique locally inside the BlocksElement only:
// block-category, block-category-2, block-category-3, ...
// ------------------------------------------------------------

export function addBlockCategory(
  blocks: BlocksElement,
  name = "Category",
  color: BlockCategory["color"] = "#6366f1",
): BlocksElement {
  const id = resolveNextBlockCategoryId(blocks.categories);

  return {
    ...blocks,
    categories: [...blocks.categories, { id, name, color }],
  };
}

function resolveNextBlockCategoryId(
  categories: readonly BlockCategory[],
): string {
  const used = new Set(categories.map((category) => category.id));

  let candidate = "block-category";
  let suffix = 2;

  while (used.has(candidate)) {
    candidate = `block-category-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export function renameBlockCategory(
  blocks: BlocksElement,
  categoryId: string,
  name: string,
): BlocksElement {
  const index = blocks.categories.findIndex(
    (category) => category.id === categoryId,
  );

  if (index < 0) {
    return blocks;
  }

  const category = blocks.categories[index];

  if (!category || category.name === name) {
    return blocks;
  }

  const nextCategories = [...blocks.categories];

  nextCategories[index] = { ...category, name };

  return { ...blocks, categories: nextCategories };
}

export function setBlockCategoryColor(
  blocks: BlocksElement,
  categoryId: string,
  color: BlockCategory["color"],
): BlocksElement {
  const index = blocks.categories.findIndex(
    (category) => category.id === categoryId,
  );

  if (index < 0) {
    return blocks;
  }

  const category = blocks.categories[index];

  if (!category || category.color === color) {
    return blocks;
  }

  const nextCategories = [...blocks.categories];

  nextCategories[index] = { ...category, color };

  return { ...blocks, categories: nextCategories };
}

/**
 * Removes a category ONLY when it is not referenced anywhere. When the
 * category is used by any root item, scope descendant, socket value, or
 * nested value socket, the removal is an exact same-reference no-op.
 */
export function removeBlockCategory(
  blocks: BlocksElement,
  categoryId: string,
): BlocksElement {
  if (isBlockCategoryUsed(blocks, categoryId)) {
    return blocks;
  }

  if (!blocks.categories.some((category) => category.id === categoryId)) {
    return blocks;
  }

  return {
    ...blocks,
    categories: blocks.categories.filter(
      (category) => category.id !== categoryId,
    ),
  };
}

/**
 * Whether a category id is referenced anywhere in the BlocksElement:
 * root items, scope descendants, socket-contained value blocks, and
 * nested value sockets.
 */
export function isBlockCategoryUsed(
  blocks: BlocksElement,
  categoryId: string,
): boolean {
  return blocks.items.some((item) =>
    blockItemUsesCategory(item, categoryId),
  );
}

function blockItemUsesCategory(
  item: BlockItem,
  categoryId: string,
): boolean {
  if (item.categoryId === categoryId) {
    return true;
  }

  for (const child of item.children) {
    if (blockItemUsesCategory(child, categoryId)) {
      return true;
    }
  }

  for (const part of item.parts) {
    if (
      part.type === "socket" &&
      part.content.type === "block" &&
      blockItemUsesCategory(part.content.block, categoryId)
    ) {
      return true;
    }
  }

  return false;
}

// ------------------------------------------------------------
// STACK OPERATIONS
//
// A STACK means exactly BlocksElement.items and scope.children.
// Value blocks inside sockets are NEVER stack siblings.
// ------------------------------------------------------------

function isStackBlockShape(shape: BlockItem["shape"]): boolean {
  return shape === "statement" || shape === "scope";
}

function isBlockCategoryResolvable(
  blocks: BlocksElement,
  categoryId: string,
): boolean {
  return blocks.categories.some((category) => category.id === categoryId);
}

function isBlockItemCategoryResolvable(
  blocks: BlocksElement,
  item: BlockItem,
): boolean {
  return isBlockCategoryResolvable(blocks, item.categoryId);
}

export function appendBlockItemToRoot(
  blocks: BlocksElement,
  item: BlockItem,
): BlocksElement {
  // Root stack creation requires a category vocabulary.
  if (blocks.categories.length === 0) {
    return blocks;
  }

  // Root stacks may never hold value blocks.
  if (!isStackBlockShape(item.shape)) {
    return blocks;
  }

  // Every inserted BlockItem.categoryId must resolve.
  if (!isBlockItemCategoryResolvable(blocks, item)) {
    return blocks;
  }

  return { ...blocks, items: [...blocks.items, item] };
}

export function appendBlockItemToScope(
  blocks: BlocksElement,
  scopeBlockId: string,
  item: BlockItem,
): BlocksElement {
  const target = findBlockItemById(blocks, scopeBlockId);

  if (!target || target.shape !== "scope") {
    return blocks;
  }

  const depth = findBlockItemDepth(blocks, scopeBlockId);

  if (depth === null || depth >= MAX_BLOCK_AUTHORING_DEPTH) {
    return blocks;
  }

  // scope.children may only hold statement/scope (never value).
  if (!isStackBlockShape(item.shape)) {
    return blocks;
  }

  // Every inserted BlockItem.categoryId must resolve.
  if (!isBlockItemCategoryResolvable(blocks, item)) {
    return blocks;
  }

  return updateBlockItemById(blocks, scopeBlockId, (scopeBlock) =>
    scopeBlock.shape !== "scope"
      ? scopeBlock
      : { ...scopeBlock, children: [...scopeBlock.children, item] },
  );
}

interface BlockStackLocation {
  index: number;
  siblings: readonly BlockItem[];
  block: BlockItem;
  parentScopeId: string | null;
}

/**
 * Locates a stack BlockItem through stack edges only (items +
 * scope.children). Socket-contained value blocks are not stack
 * siblings and are never located here.
 */
function findBlockStackLocationInItems(
  items: readonly BlockItem[],
  blockItemId: string,
  parentScopeId: string | null,
): BlockStackLocation | null {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    if (!item) {
      continue;
    }

    if (item.id === blockItemId) {
      return { index, siblings: items, block: item, parentScopeId };
    }

    const nested = findBlockStackLocationInItems(
      item.children,
      blockItemId,
      item.id,
    );

    if (nested) {
      return nested;
    }
  }

  return null;
}

/**
 * Removes a statement/scope and everything it contains through children
 * and socket values. Absent targets are exact same-reference no-ops.
 */
export function removeBlockItemById(
  blocks: BlocksElement,
  blockItemId: string,
): BlocksElement {
  const location = findBlockStackLocationInItems(
    blocks.items,
    blockItemId,
    null,
  );

  if (!location) {
    return blocks;
  }

  if (location.parentScopeId === null) {
    return {
      ...blocks,
      items: blocks.items.filter((item) => item.id !== blockItemId),
    };
  }

  return updateBlockItemById(blocks, location.parentScopeId, (scopeBlock) => ({
    ...scopeBlock,
    children: scopeBlock.children.filter(
      (item) => item.id !== blockItemId,
    ),
  }));
}

/**
 * Moves a stack block up/down among its current siblings only: root
 * within root, scope child within the same scope.children. The subtree
 * moves intact; never reparents; never moves a socket value.
 * Boundary/absent moves are exact same-reference no-ops.
 */
export function moveBlockItemByOffset(
  blocks: BlocksElement,
  blockItemId: string,
  offset: -1 | 1,
): BlocksElement {
  const location = findBlockStackLocationInItems(
    blocks.items,
    blockItemId,
    null,
  );

  if (!location) {
    return blocks;
  }

  const targetIndex = location.index + offset;

  if (
    targetIndex < 0 ||
    targetIndex >= location.siblings.length ||
    targetIndex === location.index
  ) {
    return blocks;
  }

  const nextSiblings = [...location.siblings];
  const [moved] = nextSiblings.splice(location.index, 1);

  if (!moved) {
    return blocks;
  }

  nextSiblings.splice(targetIndex, 0, moved);

  if (location.parentScopeId === null) {
    return { ...blocks, items: nextSiblings };
  }

  return updateBlockItemById(blocks, location.parentScopeId, (scopeBlock) => ({
    ...scopeBlock,
    children: nextSiblings,
  }));
}

// ------------------------------------------------------------
// BLOCK CATEGORY ASSIGNMENT
// ------------------------------------------------------------

/**
 * Reassigns the category of any reachable BlockItem (including socket
 * values). The new categoryId must resolve inside the owning
 * BlocksElement; otherwise the operation is an exact no-op. The
 * canonical document updates immediately.
 */
export function setBlockItemCategory(
  blocks: BlocksElement,
  blockItemId: string,
  categoryId: string,
): BlocksElement {
  if (!blocks.categories.some((category) => category.id === categoryId)) {
    return blocks;
  }

  return updateBlockItemById(blocks, blockItemId, (item) =>
    item.categoryId === categoryId ? item : { ...item, categoryId },
  );
}

// ------------------------------------------------------------
// SHAPE EDITING
// ------------------------------------------------------------

/**
 * Stack blocks may switch statement <-> scope only, preserving
 * id/category/parts and never deleting children:
 *
 * - statement -> scope: allowed; children stay [].
 * - scope -> statement: allowed ONLY when children.length === 0.
 * - A stack block can NEVER become value; the API does not expose it.
 */
export function setBlockItemShape(
  blocks: BlocksElement,
  blockItemId: string,
  shape: "statement" | "scope",
): BlocksElement {
  return updateBlockItemById(blocks, blockItemId, (item) => {
    if (item.shape === shape) {
      return item;
    }

    // A socket value has no shape-changing operation.
    if (item.shape === "value") {
      return item;
    }

    // A populated scope must not be flattened destructively.
    if (item.shape === "scope" && item.children.length > 0) {
      return item;
    }

    return { ...item, shape };
  });
}

// ------------------------------------------------------------
// PART OPERATIONS
// ------------------------------------------------------------

export function appendBlockPartToItem(
  blocks: BlocksElement,
  blockItemId: string,
  part: BlockPart,
): BlocksElement {
  return updateBlockItemById(blocks, blockItemId, (item) => ({
    ...item,
    parts: [...item.parts, part],
  }));
}

export function updateBlockTextPartText(
  blocks: BlocksElement,
  blockItemId: string,
  partId: string,
  text: string,
): BlocksElement {
  return updateBlockItemById(blocks, blockItemId, (item) => {
    const index = item.parts.findIndex(
      (part) => part.type === "text" && part.id === partId,
    );

    if (index < 0) {
      return item;
    }

    const part = item.parts[index];

    if (!part || part.type !== "text") {
      return item;
    }

    if (part.text === text) {
      return item;
    }

    const nextParts = [...item.parts];

    nextParts[index] = { ...part, text };

    return { ...item, parts: nextParts };
  });
}

export function removeBlockPartById(
  blocks: BlocksElement,
  blockItemId: string,
  partId: string,
): BlocksElement {
  return updateBlockItemById(blocks, blockItemId, (item) => {
    const nextParts = item.parts.filter((part) => part.id !== partId);

    if (nextParts.length === item.parts.length) {
      return item;
    }

    return { ...item, parts: nextParts };
  });
}

export function moveBlockPartByOffset(
  blocks: BlocksElement,
  blockItemId: string,
  partId: string,
  offset: -1 | 1,
): BlocksElement {
  return updateBlockItemById(blocks, blockItemId, (item) => {
    const index = item.parts.findIndex((part) => part.id === partId);

    if (index < 0) {
      return item;
    }

    const targetIndex = index + offset;

    if (
      targetIndex < 0 ||
      targetIndex >= item.parts.length ||
      targetIndex === index
    ) {
      return item;
    }

    const nextParts = [...item.parts];
    const [moved] = nextParts.splice(index, 1);

    if (!moved) {
      return item;
    }

    nextParts.splice(targetIndex, 0, moved);

    return { ...item, parts: nextParts };
  });
}

// ------------------------------------------------------------
// SOCKET CONTENT OPERATIONS
//
// Supported transitions: empty -> literal, empty -> block,
// literal -> empty, literal -> block, block -> empty, block -> literal.
// block -> block is an exact no-op that preserves the existing graph.
// No statement/scope may be inserted into a socket: setSocketContentBlock
// keeps the socket value shape contract.
// ------------------------------------------------------------

export function setSocketContentEmpty(
  blocks: BlocksElement,
  blockItemId: string,
  partId: string,
): BlocksElement {
  return updateBlockItemById(blocks, blockItemId, (item) => {
    const index = item.parts.findIndex(
      (part) => part.type === "socket" && part.id === partId,
    );

    if (index < 0) {
      return item;
    }

    const part = item.parts[index];

    if (!part || part.type !== "socket") {
      return item;
    }

    if (part.content.type === "empty") {
      return item;
    }

    const nextParts = [...item.parts];

    // Switching FROM block drops the nested value graph entirely.
    nextParts[index] = { ...part, content: { type: "empty" as const } };

    return { ...item, parts: nextParts };
  });
}

export function setSocketContentLiteral(
  blocks: BlocksElement,
  blockItemId: string,
  partId: string,
  value: string,
): BlocksElement {
  return updateBlockItemById(blocks, blockItemId, (item) => {
    const index = item.parts.findIndex(
      (part) => part.type === "socket" && part.id === partId,
    );

    if (index < 0) {
      return item;
    }

    const part = item.parts[index];

    if (!part || part.type !== "socket") {
      return item;
    }

    if (part.content.type === "literal" && part.content.value === value) {
      return item;
    }

    const nextParts = [...item.parts];

    nextParts[index] = {
      ...part,
      content: { type: "literal" as const, value },
    };

    return { ...item, parts: nextParts };
  });
}

/**
 * Switches a socket to a fresh value block. Refuses (same-reference
 * no-op) when the owner is missing, the part is not a socket, the
 * socket already holds a block, or the owner is at authoring depth
 * >= MAX_BLOCK_AUTHORING_DEPTH.
 */
export function setSocketContentBlock(
  blocks: BlocksElement,
  blockItemId: string,
  partId: string,
  valueBlock: BlockItem,
): BlocksElement {
  // Sockets may only hold value blocks: never statement/scope, and a
  // value block's children must be empty. No silent shape conversion.
  if (
    valueBlock.shape !== "value" ||
    valueBlock.children.length > 0
  ) {
    return blocks;
  }

  // Every inserted BlockItem.categoryId must resolve.
  if (!isBlockItemCategoryResolvable(blocks, valueBlock)) {
    return blocks;
  }

  const depth = findBlockItemDepth(blocks, blockItemId);

  if (depth === null || depth >= MAX_BLOCK_AUTHORING_DEPTH) {
    return blocks;
  }

  const owner = findBlockItemById(blocks, blockItemId);

  if (!owner) {
    return blocks;
  }

  const socket = owner.parts.find(
    (part) => part.type === "socket" && part.id === partId,
  );

  if (
    !socket ||
    socket.type !== "socket" ||
    socket.content.type === "block"
  ) {
    return blocks;
  }

  return updateBlockItemById(blocks, blockItemId, (item) => {
    const index = item.parts.findIndex(
      (part) => part.type === "socket" && part.id === partId,
    );

    if (index < 0) {
      return item;
    }

    const part = item.parts[index];

    if (!part || part.type !== "socket" || part.content.type === "block") {
      return item;
    }

    const nextParts = [...item.parts];

    nextParts[index] = {
      ...part,
      content: { type: "block" as const, block: valueBlock },
    };

    return { ...item, parts: nextParts };
  });
}

// ------------------------------------------------------------
// PRESENTATION-LEVEL CREATION (workspace contract)
//
// Creation of BlockItems/BlockParts needs presentation-wide authoring
// ids. These helpers allocate from the full slide inventory, validate
// the target, and write the canonical update. They return the created
// id (block id for stacks, part id for parts, value block id for
// sockets) or null when the owner is stale/invalid or the creation is
// refused.
// ------------------------------------------------------------

export interface BlocksCreationOutcome {
  slides: Slide[];
  createdId: string;
}

function findBlocksElementInSlides(
  slides: readonly Slide[],
  blocksId: string,
): BlocksElement | null {
  for (const slide of slides) {
    const element = findElementById(slide.elements, blocksId);

    if (element?.type === "blocks") {
      return element;
    }
  }

  return null;
}

function updateBlocksElementInSlides(
  slides: readonly Slide[],
  blocksId: string,
  update: (blocks: BlocksElement) => BlocksElement,
): Slide[] | null {
  let changed = false;

  const nextSlides = slides.map((slide) => {
    const elements = updateElementById(slide.elements, blocksId, (element) =>
      element.type === "blocks" ? update(element) : element,
    );

    if (elements === slide.elements) {
      return slide;
    }

    changed = true;

    return { ...slide, elements };
  });

  return changed ? nextSlides : null;
}

export function addRootBlockToPresentation(
  slides: readonly Slide[],
  blocksId: string,
): BlocksCreationOutcome | null {
  const blocks = findBlocksElementInSlides(slides, blocksId);

  if (!blocks) {
    return null;
  }

  const firstCategory = blocks.categories[0];

  if (!firstCategory) {
    return null;
  }

  const usedIds = collectPresentationElementIds(slides);
  const item = createDefaultStackBlockItem(usedIds, firstCategory.id);

  if (appendBlockItemToRoot(blocks, item) === blocks) {
    return null;
  }

  const nextSlides = updateBlocksElementInSlides(slides, blocksId, (current) =>
    appendBlockItemToRoot(current, item),
  );

  if (!nextSlides) {
    return null;
  }

  return { slides: nextSlides, createdId: item.id };
}

export function addScopeChildToPresentation(
  slides: readonly Slide[],
  blocksId: string,
  scopeBlockId: string,
): BlocksCreationOutcome | null {
  const blocks = findBlocksElementInSlides(slides, blocksId);

  if (!blocks) {
    return null;
  }

  const scope = findBlockItemById(blocks, scopeBlockId);

  if (!scope || scope.shape !== "scope") {
    return null;
  }

  const depth = findBlockItemDepth(blocks, scopeBlockId);

  if (depth === null || depth >= MAX_BLOCK_AUTHORING_DEPTH) {
    return null;
  }

  const usedIds = collectPresentationElementIds(slides);
  const item = createDefaultStackBlockItem(usedIds, scope.categoryId);

  if (appendBlockItemToScope(blocks, scopeBlockId, item) === blocks) {
    return null;
  }

  const nextSlides = updateBlocksElementInSlides(
    slides,
    blocksId,
    (current) => appendBlockItemToScope(current, scopeBlockId, item),
  );

  if (!nextSlides) {
    return null;
  }

  return { slides: nextSlides, createdId: item.id };
}

export function addTextPartToPresentation(
  slides: readonly Slide[],
  blocksId: string,
  blockItemId: string,
): BlocksCreationOutcome | null {
  const blocks = findBlocksElementInSlides(slides, blocksId);

  if (!blocks || !findBlockItemById(blocks, blockItemId)) {
    return null;
  }

  const usedIds = collectPresentationElementIds(slides);
  const part = createDefaultTextPart(usedIds);

  if (appendBlockPartToItem(blocks, blockItemId, part) === blocks) {
    return null;
  }

  const nextSlides = updateBlocksElementInSlides(
    slides,
    blocksId,
    (current) => appendBlockPartToItem(current, blockItemId, part),
  );

  if (!nextSlides) {
    return null;
  }

  return { slides: nextSlides, createdId: part.id };
}

export function addSocketPartToPresentation(
  slides: readonly Slide[],
  blocksId: string,
  blockItemId: string,
): BlocksCreationOutcome | null {
  const blocks = findBlocksElementInSlides(slides, blocksId);

  if (!blocks || !findBlockItemById(blocks, blockItemId)) {
    return null;
  }

  const usedIds = collectPresentationElementIds(slides);
  const part = createDefaultSocketPart(usedIds);

  if (appendBlockPartToItem(blocks, blockItemId, part) === blocks) {
    return null;
  }

  const nextSlides = updateBlocksElementInSlides(
    slides,
    blocksId,
    (current) => appendBlockPartToItem(current, blockItemId, part),
  );

  if (!nextSlides) {
    return null;
  }

  return { slides: nextSlides, createdId: part.id };
}

export function createSocketValueInPresentation(
  slides: readonly Slide[],
  blocksId: string,
  ownerBlockId: string,
  socketPartId: string,
): BlocksCreationOutcome | null {
  const blocks = findBlocksElementInSlides(slides, blocksId);

  if (!blocks) {
    return null;
  }

  const owner = findBlockItemById(blocks, ownerBlockId);

  if (!owner) {
    return null;
  }

  const socket = owner.parts.find(
    (part) => part.type === "socket" && part.id === socketPartId,
  );

  if (!socket || socket.type !== "socket" || socket.content.type === "block") {
    return null;
  }

  const depth = findBlockItemDepth(blocks, ownerBlockId);

  if (depth === null || depth >= MAX_BLOCK_AUTHORING_DEPTH) {
    return null;
  }

  const usedIds = collectPresentationElementIds(slides);
  const value = createDefaultValueBlockItem(usedIds, owner.categoryId);

  if (setSocketContentBlock(blocks, ownerBlockId, socketPartId, value) === blocks) {
    return null;
  }

  const nextSlides = updateBlocksElementInSlides(
    slides,
    blocksId,
    (current) =>
      setSocketContentBlock(current, ownerBlockId, socketPartId, value),
  );

  if (!nextSlides) {
    return null;
  }

  return { slides: nextSlides, createdId: value.id };
}

// ============================================================
// END: BLOCKS AUTHORING
// ============================================================

// ============================================================
// BEGIN: ADD ELEMENT DESTINATION
// ============================================================

export type AddElementDestination =
  | { kind: "slide-root" }
  | { kind: "append-container"; containerId: string }
  | { kind: "append-content-slot"; contentSlotId: string }
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

function structuredTableContainsContentSlot(
  table: StructuredTableElement,
  contentSlotId: string,
): boolean {
  for (const column of table.columns) {
    if (column.header.id === contentSlotId) {
      return true;
    }
  }

  for (const row of table.rows) {
    for (const cell of row.cells) {
      if (cell.id === contentSlotId) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Resolves where a freshly created element lands given the current selection
 * and an optional explicit ContentSlot context (the header/cell or TopicItem
 * the user clicked on the canvas).
 *
 * - no selection (or stale selection) -> slide root
 * - container selected -> inside the container
 * - TopicsElement selected + explicit clicked ContentSlot of THAT
 *   TopicsElement + ordinary element -> inside exactly that ContentSlot
 * - Structured Table selected + explicit clicked ContentSlot of THAT Table ->
 *   inside exactly that ContentSlot
 * - any other element -> sibling immediately after it
 *
 * Neither a TopicsElement nor a Structured Table is guessed as an implicit
 * content-slot destination: without an explicit ContentSlot context, adding
 * while one of them is selected keeps the normal sibling behavior.
 *
 * The supplied contentSlotId is only honored when it actually belongs to the
 * currently selected owning element; stale or unowned ContentSlot ids are
 * ignored.
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
    return { kind: "append-content-slot", contentSlotId };
  }

  if (
    isStructuredTable(selected) &&
    contentSlotId !== null &&
    structuredTableContainsContentSlot(selected, contentSlotId)
  ) {
    return { kind: "append-content-slot", contentSlotId };
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

    case "container": {
      return {
        id: createUniqueId("container-element", usedIds),

        type: "container",

        hidden: false,

        layout: { width: "70%", height: "60%", padding: 24, children: { gap: 16, horizontalAlign: "center", verticalAlign: "center" } },
        style: { background: { color: "rgba(15, 23, 42, 0.55)" } },

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

        layout: {
          width: "60%",
          height: "55%",
        },
      };
    }

    case "gallery": {
      return {
        id: createUniqueId("gallery-element", usedIds),

        type: "gallery",

        hidden: false,

        fit: "contain",

        items: [
          {
            src: "/powershow-demo.svg",

            alt: "Gallery image",
          },
        ],

        layout: {
          width: "60%",

          height: "55%",
        },
      };
    }

    case "embed": {
      return {
        id: createUniqueId("embed-element", usedIds),

        type: "embed",

        hidden: false,

        src: "https://example.com/",

        title: "Embedded content",

        layout: {
          width: "60%",

          height: "55%",
        },
      };
    }

    case "scripted": {
      return {
        id: createUniqueId("scripted-element", usedIds),

        type: "scripted",

        hidden: false,

        title: "Scripted content",

        html: "",

        css: "",

        script: "",

        layout: {
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
      const tableId = createUniqueId("table-element", usedIds);
      usedIds.add(tableId);

      const columnId = createUniqueId("table-column", usedIds);
      usedIds.add(columnId);

      const headerSlotId = createUniqueId("table-header-slot", usedIds);
      usedIds.add(headerSlotId);

      const headerTextId = createUniqueId("table-header-text", usedIds);
      usedIds.add(headerTextId);

      const rowId = createUniqueId("table-row", usedIds);
      usedIds.add(rowId);

      const cellSlotId = createUniqueId("table-cell-slot", usedIds);
      usedIds.add(cellSlotId);

      const cellTextId = createUniqueId("table-cell-text", usedIds);
      usedIds.add(cellTextId);

      const headerText: PowerShowElement = {
        id: headerTextId,
        type: "text",
        hidden: false,
        variant: "body",
        content: "Column 1",
      };

      const cellText: PowerShowElement = {
        id: cellTextId,
        type: "text",
        hidden: false,
        variant: "body",
        content: "Value",
      };

      return {
        id: tableId,
        type: "table",
        mode: "structured",
        showHeader: true,
        hidden: false,
        columns: [
          {
            id: columnId,
            header: {
              id: headerSlotId,
              children: [headerText],
            },
          },
        ],
        rows: [
          {
            id: rowId,
            cells: [
              {
                id: cellSlotId,
                children: [cellText],
              },
            ],
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

    case "blocks": {
      const categoryId = createUniqueId("block-category", usedIds);
      usedIds.add(categoryId);
      const createdItem = createDefaultStackBlockItem(usedIds, categoryId);

      return {
        id: createUniqueId("blocks-element", usedIds),

        type: "blocks",

        hidden: false,

        categories: [{
          id: categoryId,
          name: "Block",
          color: "#6366f1",
        }],

        items: [createdItem],
      } satisfies BlocksElement;
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

function cloneBlockItemWithUniqueIds(
  item: BlockItem,
  usedIds: Set<string>,
): BlockItem {
  const id = createUniqueId(`${item.id}-copy`, usedIds);
  usedIds.add(id);

  const parts = item.parts.map((part) => {
    const partId = createUniqueId(`${part.id}-copy`, usedIds);
    usedIds.add(partId);
    if (part.type !== "socket" || part.content.type !== "block") {
      return { ...part, id: partId };
    }
    return {
      ...part,
      id: partId,
      content: {
        type: "block" as const,
        block: cloneBlockItemWithUniqueIds(part.content.block, usedIds),
      },
    };
  });

  return {
    ...item,
    id,
    parts,
    children: item.children.map((child) =>
      cloneBlockItemWithUniqueIds(child, usedIds),
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

  if (clone.type === "blocks") {
    return {
      ...clone,
      id,
      items: clone.items.map((item) =>
        cloneBlockItemWithUniqueIds(item, usedIds),
      ),
    } satisfies BlocksElement;
  }

  if (clone.type === "table" && clone.mode === "structured") {
    return {
      ...clone,
      id,
      columns: clone.columns.map((column) => {
        const columnId = createUniqueId(`${column.id}-copy`, usedIds);
        usedIds.add(columnId);

        return {
          ...column,
          id: columnId,
          header: cloneContentSlotWithUniqueIds(column.header, usedIds),
        };
      }),
      rows: clone.rows.map((row) => {
        const rowId = createUniqueId(`${row.id}-copy`, usedIds);
        usedIds.add(rowId);

        return {
          ...row,
          id: rowId,
          cells: row.cells.map((cell) =>
            cloneContentSlotWithUniqueIds(cell, usedIds),
          ),
        };
      }),
    };
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

export function insertElementIntoChildrenAt(
  children: readonly PowerShowElement[],
  index: number,
  elementToInsert: PowerShowElement,
): PowerShowElement[] {
  return [
    ...children.slice(0, index),
    elementToInsert,
    ...children.slice(index),
  ];
}

function appendElementToStructuredTableSlots(
  table: StructuredTableElement,
  contentSlotId: string,
  newElement: PowerShowElement,
): StructuredTableElement | null {
  let columnsChanged = false;

  const columns = table.columns.map((column) => {
    if (column.header.id === contentSlotId) {
      columnsChanged = true;

      return {
        ...column,
        header: {
          ...column.header,
          children: [...column.header.children, newElement],
        },
      };
    }

    const children = appendElementToContentSlot(
      column.header.children,
      contentSlotId,
      newElement,
    );

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
      if (cell.id === contentSlotId) {
        cellChanged = true;

        return {
          ...cell,
          children: [...cell.children, newElement],
        };
      }

      const children = appendElementToContentSlot(
        cell.children,
        contentSlotId,
        newElement,
      );

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

function insertIntoStructuredTableParentRef(
  table: StructuredTableElement,
  parentRef: ElementParentRef,
  index: number,
  elementToInsert: PowerShowElement,
): StructuredTableElement | null {
  if (parentRef.kind !== "content-slot") {
    return updateStructuredTableSlots(table, (children) =>
      insertElementIntoParentRef(
        children,
        parentRef,
        index,
        elementToInsert,
      ),
    );
  }

  const slotId = parentRef.id;

  let columnsChanged = false;

  const columns = table.columns.map((column) => {
    if (column.header.id === slotId) {
      columnsChanged = true;

      return {
        ...column,
        header: {
          ...column.header,
          children: insertElementIntoChildrenAt(
            column.header.children,
            index,
            elementToInsert,
          ),
        },
      };
    }

    const children = insertElementIntoParentRef(
      column.header.children,
      parentRef,
      index,
      elementToInsert,
    );

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
      if (cell.id === slotId) {
        cellChanged = true;

        return {
          ...cell,
          children: insertElementIntoChildrenAt(
            cell.children,
            index,
            elementToInsert,
          ),
        };
      }

      const children = insertElementIntoParentRef(
        cell.children,
        parentRef,
        index,
        elementToInsert,
      );

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

    if (isStructuredTable(element)) {
      const updated = updateStructuredTableSlots(element, (children) =>
        insertElementAfterId(children, targetId, newElement),
      );

      if (updated !== null) {
        result[result.length - 1] = updated;
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

    if (isStructuredTable(element)) {
      const updated = updateStructuredTableSlots(element, (children) =>
        appendElementToContainer(children, containerId, newElement),
      );

      if (updated !== null) {
        changed = true;
        return updated;
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

    if (isStructuredTable(element)) {
      const updated = appendElementToStructuredTableSlots(
        element,
        contentSlotId,
        newElement,
      );

      if (updated !== null) {
        changed = true;
        return updated;
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

      if (isStructuredTable(element)) {
        const updated = updateStructuredTableSlots(element, (children) =>
          removeElementById(children, id),
        );

        if (updated !== null) {
          changed = true;
          return [updated];
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

    if (isStructuredTable(element)) {
      const updated = insertIntoStructuredTableParentRef(
        element,
        parentRef,
        index,
        elementToInsert,
      );

      if (updated !== null) {
        changed = true;
        return updated;
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
// BEGIN: GALLERY STRUCTURAL CONVERSIONS
//
// Gallery items deliberately have no authoring identity. These operations
// therefore use the owning Gallery id plus the current array index, and keep
// each conversion atomic at the document-tree level.
// ============================================================

type GalleryItemValue = GalleryElement["items"][number];
type GalleryTreeDropIntent = "before" | "after" | "inside";

export interface GalleryStructuralResult {
  elements: PowerShowElement[];
  changed: boolean;
  galleryItemIndex?: number;
  imageId?: string;
}

function findGallery(
  elements: readonly PowerShowElement[],
  galleryId: string,
): GalleryElement | null {
  const element = findElementById(elements, galleryId);
  return element?.type === "gallery" ? element : null;
}

function updateGalleryItems(
  elements: PowerShowElement[],
  galleryId: string,
  update: (items: readonly GalleryItemValue[]) => GalleryItemValue[],
): PowerShowElement[] {
  return updateElementById(elements, galleryId, (element) =>
    element.type === "gallery" ? { ...element, items: update(element.items) } : element,
  );
}

/** Moves an item to its final index after removal. */
export function reorderGalleryItem(
  elements: PowerShowElement[],
  galleryId: string,
  itemIndex: number,
  finalIndex: number,
): GalleryStructuralResult {
  const gallery = findGallery(elements, galleryId);

  if (
    !gallery ||
    itemIndex < 0 ||
    itemIndex >= gallery.items.length ||
    finalIndex < 0 ||
    finalIndex >= gallery.items.length ||
    itemIndex === finalIndex
  ) {
    return { elements, changed: false };
  }

  const item = gallery.items[itemIndex];
  if (!item) return { elements, changed: false };

  const withoutItem = [
    ...gallery.items.slice(0, itemIndex),
    ...gallery.items.slice(itemIndex + 1),
  ];
  const items = [
    ...withoutItem.slice(0, finalIndex),
    item,
    ...withoutItem.slice(finalIndex),
  ];

  return {
    elements: updateGalleryItems(elements, galleryId, () => items),
    changed: true,
    galleryItemIndex: finalIndex,
  };
}

function resolveGalleryDetachDestination(
  elements: PowerShowElement[],
  targetId: string,
  intent: GalleryTreeDropIntent,
): MoveElementOptions | null {
  const target = findElementById(elements, targetId);
  const targetPosition = findElementSiblingPosition(elements, targetId);

  if (!target || !targetPosition) return null;

  if (intent === "inside") {
    return target.type === "container"
      ? { elementId: "", targetParentRef: { kind: "container", id: target.id } }
      : null;
  }

  return {
    elementId: "",
    targetParentRef: targetPosition.parentRef,
    targetIndex: targetPosition.index + (intent === "after" ? 1 : 0),
  };
}

export function detachGalleryItemToImage(
  elements: PowerShowElement[],
  slides: readonly Slide[],
  galleryId: string,
  itemIndex: number,
  targetId: string,
  intent: GalleryTreeDropIntent,
): GalleryStructuralResult {
  const gallery = findGallery(elements, galleryId);
  const destination = resolveGalleryDetachDestination(elements, targetId, intent);
  const item = gallery?.items[itemIndex];

  if (!gallery || !item || !destination) {
    return { elements, changed: false };
  }

  const image = createElement("image", slides);
  if (image.type !== "image") return { elements, changed: false };

  const detachedImage: PowerShowElement = {
    ...image,
    src: item.src,
    alt: item.alt,
    fit: item.fit ?? gallery.fit,
    ...(item.focalPoint === undefined ? {} : { focalPoint: item.focalPoint }),
    ...(item.crop === undefined ? {} : { crop: item.crop }),
  };

  const targetElements = getTargetElementsForParentRef(elements, destination.targetParentRef);
  const targetIndex = destination.targetIndex ?? targetElements?.length;
  if (!targetElements || targetIndex === undefined || targetIndex < 0 || targetIndex > targetElements.length) {
    return { elements, changed: false };
  }

  const withoutItem = updateGalleryItems(elements, galleryId, (items) => [
    ...items.slice(0, itemIndex),
    ...items.slice(itemIndex + 1),
  ]);

  return {
    elements: insertElementIntoParentRef(
      withoutItem,
      destination.targetParentRef,
      targetIndex,
      detachedImage,
    ),
    changed: true,
    imageId: detachedImage.id,
  };
}

export function attachImageToGallery(
  elements: PowerShowElement[],
  imageId: string,
  galleryId: string,
  itemIndex: number,
): GalleryStructuralResult {
  const image = findElementById(elements, imageId);
  const gallery = findGallery(elements, galleryId);

  if (
    image?.type !== "image" ||
    !gallery ||
    itemIndex < 0 ||
    itemIndex > gallery.items.length
  ) {
    return { elements, changed: false };
  }

  const item: GalleryItemValue = {
    src: image.src,
    alt: image.alt,
    fit: image.fit,
    ...(image.focalPoint === undefined ? {} : { focalPoint: image.focalPoint }),
    ...(image.crop === undefined ? {} : { crop: image.crop }),
  };
  const withoutImage = removeElementById(elements, imageId);

  return {
    elements: updateGalleryItems(withoutImage, galleryId, (items) => [
      ...items.slice(0, itemIndex),
      item,
      ...items.slice(itemIndex),
    ]),
    changed: true,
    galleryItemIndex: itemIndex,
  };
}

// ============================================================
// END: GALLERY STRUCTURAL CONVERSIONS
// ============================================================

// ============================================================
// END: MOVE ELEMENT
// ============================================================

// ============================================================
// BEGIN: STRUCTURED TABLE MUTATION
//
// add/remove column and row mutations preserve the canonical
// Structured Table invariant row.cells.length === columns.length.
// All created structural and content IDs are globally unique
// across the whole presentation.
// ============================================================

function buildStructuredText(usedIds: Set<string>, content: string): PowerShowElement {
  const textId = createUniqueId("table-text", usedIds);
  usedIds.add(textId);

  return {
    id: textId,
    type: "text",
    hidden: false,
    variant: "body",
    content,
  };
}

function buildStructuredCell(usedIds: Set<string>): ContentSlot {
  const slotId = createUniqueId("table-cell-slot", usedIds);
  usedIds.add(slotId);

  return {
    id: slotId,
    children: [buildStructuredText(usedIds, "Value")],
  };
}

function buildStructuredColumn(usedIds: Set<string>): StructuredTableColumn {
  const columnId = createUniqueId("table-column", usedIds);
  usedIds.add(columnId);

  const headerSlotId = createUniqueId("table-header-slot", usedIds);
  usedIds.add(headerSlotId);

  const headerTextId = createUniqueId("table-header-text", usedIds);
  usedIds.add(headerTextId);

  return {
    id: columnId,
    header: {
      id: headerSlotId,
      children: [
        {
          id: headerTextId,
          type: "text",
          hidden: false,
          variant: "body",
          content: "Column",
        },
      ],
    },
  };
}

function buildStructuredRow(
  usedIds: Set<string>,
  columnCount: number,
): StructuredTableRow {
  const rowId = createUniqueId("table-row", usedIds);
  usedIds.add(rowId);

  const cells: ContentSlot[] = [];

  for (let index = 0; index < columnCount; index += 1) {
    cells.push(buildStructuredCell(usedIds));
  }

  return { id: rowId, cells };
}

function applyStructuredTableMutation(
  slides: readonly Slide[],
  tableId: string,
  mutate: (
    table: StructuredTableElement,
    usedIds: Set<string>,
  ) => StructuredTableElement,
): Slide[] {
  const usedIds = collectPresentationElementIds(slides);
  let changed = false;

  const nextSlides = slides.map((slide) => {
    const elements = updateElementById(slide.elements, tableId, (element) => {
      if (element.type !== "table" || element.mode !== "structured") {
        return element;
      }

      return mutate(element, usedIds);
    });

    if (elements === slide.elements) {
      return slide;
    }

    changed = true;

    return { ...slide, elements };
  });

  return changed ? nextSlides : (slides as Slide[]);
}

export function addColumnToStructuredTable(
  slides: readonly Slide[],
  tableId: string,
): Slide[] {
  return applyStructuredTableMutation(slides, tableId, (table, usedIds) => {
    const column = buildStructuredColumn(usedIds);

    return {
      ...table,
      columns: [...table.columns, column],
      rows: table.rows.map((row) => ({
        ...row,
        cells: [...row.cells, buildStructuredCell(usedIds)],
      })),
    };
  });
}

export function removeColumnFromStructuredTable(
  slides: readonly Slide[],
  tableId: string,
  index: number,
): Slide[] {
  return applyStructuredTableMutation(slides, tableId, (table) => {
    if (!table.columns[index]) {
      return table;
    }

    return {
      ...table,
      columns: table.columns.filter((_column, columnIndex) => columnIndex !== index),
      rows: table.rows.map((row) => ({
        ...row,
        cells: row.cells.filter((_cell, cellIndex) => cellIndex !== index),
      })),
    };
  });
}

export function addRowToStructuredTable(
  slides: readonly Slide[],
  tableId: string,
): Slide[] {
  return applyStructuredTableMutation(slides, tableId, (table, usedIds) => ({
    ...table,
    rows: [...table.rows, buildStructuredRow(usedIds, table.columns.length)],
  }));
}

export function removeRowFromStructuredTable(
  slides: readonly Slide[],
  tableId: string,
  index: number,
): Slide[] {
  return applyStructuredTableMutation(slides, tableId, (table) => ({
    ...table,
    rows: table.rows.filter((_row, rowIndex) => rowIndex !== index),
  }));
}

export function setStructuredTableShowHeader(
  slides: readonly Slide[],
  tableId: string,
  showHeader: boolean,
): Slide[] {
  return applyStructuredTableMutation(slides, tableId, (table) => ({
    ...table,
    showHeader,
  }));
}

// ============================================================
// END: STRUCTURED TABLE MUTATION
// ============================================================
