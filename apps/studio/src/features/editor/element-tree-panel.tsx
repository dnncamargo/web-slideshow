"use client";

import type {
  PowerShowElement,
  Slide,
  TopicItem,
  FontResource,
  PresentationPalette,
  StructuredTableElement,
} from "@powershow/document-schema";
import { useState } from "react";
import type { DragEvent } from "react";

import { ELEMENT_TYPE_MESSAGE_KEYS } from "@/features/i18n/studio-i18n";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import type { CustomLibraryRepository } from "@/features/custom-library/custom-library-repository";

import styles from "./editor-workspace.module.css";
import { ElementPropertiesPanel } from "./element-properties-panel";
import {
  findElementSiblingPosition,
  getTopicItemHierarchyActionState,
  type MoveElementOptions,
} from "./element-operations";
import { findElementById } from "./element-tree";
import { isStructuredTableContentSlotId } from "./element-hierarchy";
import { findTopicItemSiblingPosition } from "./element-hierarchy";
import {
  getElementLabel,
  getElementTreeChildren,
  getParentTargets,
  getTreeActionState,
  resolveTreeDrop,
  type TreeDropIntent,
} from "./element-tree-helpers";
import { getTextContentPlainText } from "./rich-text-authoring";
import { getGalleryItemDisplayName } from "./gallery-item-display-name";
import {
  getStructuredColumnLabel,
  getStructuredContentChildren,
  getStructuredRowLabel,
  getTableColumnNodeId,
  getTableColumnsNodeId,
  getTableRowNodeId,
  getTableRowsNodeId,
  type TableStructuralSelection,
} from "./table-tree-helpers";

interface ElementTreePanelProps {
  slide: Slide;
  selectedElementId: string | null;
  selectedContentSlotId: string | null;
  selectedGalleryItemIndex?: number | null;
  onSelectElement: (selection: ElementTreeSelection) => void;
  onMoveElement: (options: MoveElementOptions) => void;
  onMoveTopicItem: (topicsId: string, topicItemId: string, targetIndex: number) => void;
  onIndentTopicItem: (topicsId: string, topicItemId: string) => void;
  onOutdentTopicItem: (topicsId: string, topicItemId: string) => void;
  onMoveGalleryItem: (galleryId: string, itemIndex: number, offset: -1 | 1) => void;
  onGalleryStructureDrop: (options: GalleryStructureDrop) => void;
  onMoveTableColumn?: (tableId: string, columnId: string, offset: -1 | 1) => void;
  onMoveTableRow?: (tableId: string, rowId: string, offset: -1 | 1) => void;
  customLibraryRepository?: CustomLibraryRepository;
  onBrowseElementStyles: () => void;
  palette?: PresentationPalette;
  fontResources?: readonly FontResource[];
  selectedTableStructuralNode?: TableStructuralSelection;
  onSelectTableStructuralNode?: (selection: TableStructuralSelection) => void;
}

interface ElementTreeSelection {
  id: string;
  type: string;
  contentSlotId?: string | null;
  galleryItemIndex?: number | null;
}

type ElementTreeDragSource =
  | { kind: "element"; elementId: string }
  | { kind: "gallery-item"; galleryId: string; itemIndex: number };

interface GalleryStructureDrop {
  source: ElementTreeDragSource;
  target: { kind: "element"; element: PowerShowElement } | {
    kind: "gallery-item";
    galleryId: string;
    itemIndex: number;
  };
  intent: TreeDropIntent;
}

interface ElementTreeNodeProps {
  element: PowerShowElement;
  index: number;
  siblingCount: number;
  expandedIds: ReadonlySet<string>;
  selectedElementId: string | null;
  onToggle: (id: string) => void;
  onSelectElement: (selection: ElementTreeSelection) => void;
  selectedGalleryItemIndex: number | null;
  dropTarget: { id: string; intent: TreeDropIntent; itemIndex?: number } | null;
  onDragStart: (
    element: PowerShowElement,
    event: DragEvent<HTMLDivElement>,
  ) => void;
  onDragOver: (
    element: PowerShowElement,
    event: DragEvent<HTMLDivElement>,
  ) => void;
  onDrop: (element: PowerShowElement) => void;
  onDragEnd: () => void;
  onGalleryItemDragStart: (galleryId: string, itemIndex: number, event: DragEvent<HTMLDivElement>) => void;
  onGalleryItemDragOver: (galleryId: string, itemIndex: number, event: DragEvent<HTMLDivElement>) => void;
  onGalleryItemDrop: (galleryId: string, itemIndex: number) => void;
  selectedContentSlotId: string | null;
  selectedStructuralTopicItemId: string | null;
  onIndentTopicItem: (topicsId: string, topicItemId: string) => void;
  onOutdentTopicItem: (topicsId: string, topicItemId: string) => void;
  getTopicItemHierarchyActionState: (topicsId: string, topicItemId: string) => {
    canIndent: boolean;
    canOutdent: boolean;
  };
  selectedTableStructuralNode?: TableStructuralSelection;
  onSelectTableStructuralNode?: (selection: TableStructuralSelection) => void;
  onMoveTableColumn?: (tableId: string, columnId: string, offset: -1 | 1) => void;
  onMoveTableRow?: (tableId: string, rowId: string, offset: -1 | 1) => void;
  contentSlotId?: string;
}

interface GalleryItemTreeNodeProps {
  galleryId: string;
  itemIndex: number;
  item: Extract<PowerShowElement, { type: "gallery" }>["items"][number];
  selected: boolean;
  onSelectElement: (selection: ElementTreeSelection) => void;
  dropTarget: { id: string; intent: TreeDropIntent; itemIndex?: number } | null;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

interface TopicItemTreeNodeProps {
  item: TopicItem;
  owningTopicsId: string;
  index: number;
  siblingCount: number;
  expandedIds: ReadonlySet<string>;
  selectedElementId: string | null;
  selectedContentSlotId: string | null;
  selectedStructuralTopicItemId: string | null;
  selectedGalleryItemIndex: number | null;
  dropTarget: { id: string; intent: TreeDropIntent; itemIndex?: number } | null;
  onToggle: (id: string) => void;
  onSelectElement: (selection: ElementTreeSelection) => void;
  onDragStart: (
    element: PowerShowElement,
    event: DragEvent<HTMLDivElement>,
  ) => void;
  onDragOver: (
    element: PowerShowElement,
    event: DragEvent<HTMLDivElement>,
  ) => void;
  onDrop: (element: PowerShowElement) => void;
  onDragEnd: () => void;
  onGalleryItemDragStart: (galleryId: string, itemIndex: number, event: DragEvent<HTMLDivElement>) => void;
  onGalleryItemDragOver: (galleryId: string, itemIndex: number, event: DragEvent<HTMLDivElement>) => void;
  onGalleryItemDrop: (galleryId: string, itemIndex: number) => void;
  onIndentTopicItem: (topicsId: string, topicItemId: string) => void;
  onOutdentTopicItem: (topicsId: string, topicItemId: string) => void;
  getTopicItemHierarchyActionState: (topicsId: string, topicItemId: string) => {
    canIndent: boolean;
    canOutdent: boolean;
  };
}

function isStructuralTopicSelection(
  slide: Slide,
  selectedElementId: string | null,
  selectedContentSlotId: string | null,
): boolean {
  if (!selectedElementId || !selectedContentSlotId) {
    return false;
  }

  const selectedElement = findElementById(slide.elements, selectedElementId);

  if (!selectedElement || selectedElement.type !== "topics") {
    return false;
  }

  function topicItemsContainContentSlot(
    items: readonly TopicItem[],
    contentSlotId: string,
  ): boolean {
    return items.some(
      (item) =>
        item.content.id === contentSlotId ||
        topicItemsContainContentSlot(item.children, contentSlotId),
    );
  }

  return topicItemsContainContentSlot(
    selectedElement.items,
    selectedContentSlotId,
  );
}

function getTextPreview(
  content: string | Extract<PowerShowElement, { type: "text" }>["content"],
): string | null {
  const normalized = getTextContentPlainText(content);

  const compact = normalized
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!compact) {
    return null;
  }

  return compact.length > 36 ? `${compact.slice(0, 35)}…` : compact;
}

function getTopicItemDisplayInfo(
  item: TopicItem,
  topicLabel: string,
): { label: string; labelSourceElementId: string | null } {
  for (const child of item.content.children) {
    if (child.type !== "text") {
      continue;
    }

    const preview = getTextPreview(child.content);

    if (preview) {
      return { label: preview, labelSourceElementId: child.id };
    }
  }

  return { label: topicLabel, labelSourceElementId: null };
}

function collectInitiallyExpandedTopicItemIds(
  items: readonly TopicItem[],
  ids: Set<string>,
): void {
  for (const item of items) {
    ids.add(item.id);
    collectInitiallyExpandedIds(item.content.children, ids);
    collectInitiallyExpandedTopicItemIds(item.children, ids);
  }
}

function collectInitiallyExpandedIds(
  elements: readonly PowerShowElement[],
  ids: Set<string>,
): void {
  for (const element of elements) {
    if (
      element.type === "container" ||
      element.type === "topics" ||
      (element.type === "table" && element.mode === "structured") ||
      (element.type === "gallery" && element.items.length > 0)
    ) {
      ids.add(element.id);
      if (element.type === "table" && element.mode === "structured") {
        ids.add(getTableColumnsNodeId(element.id));
        ids.add(getTableRowsNodeId(element.id));
        for (const column of element.columns) {
          if (getStructuredContentChildren(column.header).length > 1) ids.add(getTableColumnNodeId(element.id, column.id));
        }
        for (const row of element.rows) {
          if (row.cells[0] && getStructuredContentChildren(row.cells[0]).length > 1) ids.add(getTableRowNodeId(element.id, row.id));
        }
      }
    }

    if (element.type === "container") {
      collectInitiallyExpandedIds(element.children, ids);
      continue;
    }

    if (element.type === "topics") {
      collectInitiallyExpandedTopicItemIds(element.items, ids);
    }
  }
}

function ElementTreeNode({
  element,
  index,
  siblingCount,
  expandedIds,
  selectedElementId,
  onToggle,
  onSelectElement,
  selectedGalleryItemIndex,
  dropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onGalleryItemDragStart,
  onGalleryItemDragOver,
  onGalleryItemDrop,
  selectedContentSlotId,
  selectedStructuralTopicItemId,
  onIndentTopicItem,
  onOutdentTopicItem,
  getTopicItemHierarchyActionState,
  selectedTableStructuralNode,
  onSelectTableStructuralNode,
  onMoveTableColumn,
  onMoveTableRow,
  contentSlotId,
}: ElementTreeNodeProps) {
  const { t } = useStudioI18n();
  const isExpandable =
    element.type === "container" ||
    element.type === "topics" ||
    (element.type === "table" && element.mode === "structured") ||
    (element.type === "gallery" && element.items.length > 0);
  const expanded = isExpandable && expandedIds.has(element.id);
  const treeChildren = getElementTreeChildren(element);
  const selected =
    element.type === "topics"
      ? selectedElementId === element.id && selectedContentSlotId === null
      : element.type === "gallery"
        ? selectedElementId === element.id && selectedGalleryItemIndex === null
        : selectedElementId === element.id &&
          (contentSlotId === undefined || selectedContentSlotId === contentSlotId);
  const indicator =
    isExpandable && element.type === "container"
      ? `[${t(element.layout?.children?.mode === "stack" ? "inspector.stack" : "inspector.flow")}]`
      : element.type === "text"
        ? element.layout?.position === "absolute"
        : element.type === "image"
          ? element.layout?.position === "absolute"
          : element.type === "gallery" || element.type === "embed" || element.type === "scripted" || element.type === "code" || element.type === "terminal" || element.type === "table" || element.type === "blocks" || element.type === "divider" || element.type === "topics" || element.type === "plot" || element.type === "interactive"
            ? element.layout?.position === "absolute"
        : false;
  const dropIntent = dropTarget?.id === element.id ? dropTarget.intent : null;
  const topicHierarchyActionState =
    element.type === "topics" &&
    selectedElementId === element.id &&
    selectedStructuralTopicItemId
      ? getTopicItemHierarchyActionState(
          element.id,
          selectedStructuralTopicItemId,
        )
      : { canIndent: false, canOutdent: false };

  return (
    <li
      className={styles.elementTreeNode}
      role="treeitem"
      aria-selected={selected}
      aria-expanded={isExpandable ? expanded : undefined}
    >
      {dropIntent === "before" && (
        <div
          className={styles.elementTreeDropIndicatorBefore}
          aria-hidden="true"
        />
      )}
      <div
        className={
          selected
            ? `${styles.elementTreeRow} ${styles.elementTreeSelected}`
            : styles.elementTreeRow
        }
        draggable
        onDragStart={(event) => onDragStart(element, event)}
        onDragOver={(event) => onDragOver(element, event)}
        onDrop={(event) => {
          event.preventDefault();
          onDrop(element);
        }}
        onDragEnd={onDragEnd}
      >
        {isExpandable ? (
          <button
            className={styles.elementTreeExpand}
            type="button"
            aria-label={t(expanded ? "tree.collapse" : "tree.expand")}
            onClick={() => onToggle(element.id)}
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className={styles.elementTreeExpand} aria-hidden="true" />
        )}

        <button
          className={styles.elementTreeSelect}
          type="button"
          onClick={() =>
            onSelectElement(
              contentSlotId === undefined
                ? { id: element.id, type: element.type }
                : { id: element.id, type: element.type, contentSlotId },
            )
          }
        >
          {getElementLabel(element, t(ELEMENT_TYPE_MESSAGE_KEYS[element.type]))}
          {indicator && <small>{indicator}</small>}
        </button>

        {element.type === "topics" && (
          <div className={styles.elementTreeTopicActions}>
            <button
              className={styles.elementTreeTopicAction}
              type="button"
              aria-label={t("tree.promoteTopic")}
              title={t("tree.promoteTopic")}
              disabled={!topicHierarchyActionState.canOutdent}
              onClick={(event) => {
                event.stopPropagation();
                if (selectedStructuralTopicItemId) {
                  onOutdentTopicItem(element.id, selectedStructuralTopicItemId);
                }
              }}
            >
              ←
            </button>
            <button
              className={styles.elementTreeTopicAction}
              type="button"
              aria-label={t("tree.demoteTopic")}
              title={t("tree.demoteTopic")}
              disabled={!topicHierarchyActionState.canIndent}
              onClick={(event) => {
                event.stopPropagation();
                if (selectedStructuralTopicItemId) {
                  onIndentTopicItem(element.id, selectedStructuralTopicItemId);
                }
              }}
            >
              →
            </button>
          </div>
        )}
      </div>
      {dropIntent === "inside" && element.type === "container" && (
        <div
          className={styles.elementTreeDropIndicatorInside}
          aria-hidden="true"
        />
      )}
      {dropIntent === "after" && (
        <div
          className={styles.elementTreeDropIndicatorAfter}
          aria-hidden="true"
        />
      )}

      {isExpandable && expanded && (
        <ul
          role="group"
          className={`${styles.elementTreeList} ${styles.elementTreeChildren}`}
        >
          {element.type === "container" &&
            treeChildren.map((child, childIndex) => (
              <ElementTreeNode
                key={child.id}
                element={child}
                index={childIndex}
                siblingCount={treeChildren.length}
                expandedIds={expandedIds}
                selectedElementId={selectedElementId}
                selectedContentSlotId={selectedContentSlotId}
                selectedStructuralTopicItemId={selectedStructuralTopicItemId}
                selectedGalleryItemIndex={selectedGalleryItemIndex}
                onToggle={onToggle}
                onSelectElement={onSelectElement}
                dropTarget={dropTarget}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                onGalleryItemDragStart={onGalleryItemDragStart}
                onGalleryItemDragOver={onGalleryItemDragOver}
                onGalleryItemDrop={onGalleryItemDrop}
                onIndentTopicItem={onIndentTopicItem}
                onOutdentTopicItem={onOutdentTopicItem}
                getTopicItemHierarchyActionState={getTopicItemHierarchyActionState}
                selectedTableStructuralNode={selectedTableStructuralNode}
                onSelectTableStructuralNode={onSelectTableStructuralNode}
                onMoveTableColumn={onMoveTableColumn}
                onMoveTableRow={onMoveTableRow}
                contentSlotId={contentSlotId}
              />
            ))}
          {element.type === "topics" &&
            element.items.map((item, itemIndex) => (
              <TopicItemTreeNode
                key={item.id}
                item={item}
                owningTopicsId={element.id}
                index={itemIndex}
                siblingCount={element.items.length}
                expandedIds={expandedIds}
                selectedElementId={selectedElementId}
                selectedContentSlotId={selectedContentSlotId}
                selectedStructuralTopicItemId={selectedStructuralTopicItemId}
                selectedGalleryItemIndex={selectedGalleryItemIndex}
                dropTarget={dropTarget}
                onToggle={onToggle}
                onSelectElement={onSelectElement}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                onGalleryItemDragStart={onGalleryItemDragStart}
                onGalleryItemDragOver={onGalleryItemDragOver}
                onGalleryItemDrop={onGalleryItemDrop}
                onIndentTopicItem={onIndentTopicItem}
                onOutdentTopicItem={onOutdentTopicItem}
                getTopicItemHierarchyActionState={getTopicItemHierarchyActionState}
              />
            ))}
          {element.type === "gallery" &&
            element.items.map((item, itemIndex) => (
              <GalleryItemTreeNode
                key={`${element.id}-${itemIndex}`}
                galleryId={element.id}
                itemIndex={itemIndex}
                item={item}
                selected={
                  selectedElementId === element.id &&
                  selectedGalleryItemIndex === itemIndex
                }
                onSelectElement={onSelectElement}
                dropTarget={dropTarget}
                onDragStart={(event) => onGalleryItemDragStart(element.id, itemIndex, event)}
                onDragOver={(event) => onGalleryItemDragOver(element.id, itemIndex, event)}
                onDrop={() => onGalleryItemDrop(element.id, itemIndex)}
                onDragEnd={onDragEnd}
              />
            ))}
          {element.type === "table" && element.mode === "structured" && (
            <StructuredTableTreeNodes
              element={element}
              expandedIds={expandedIds}
              onToggle={onToggle}
              selected={selectedTableStructuralNode ?? null}
              onSelect={(selection) => {
                onSelectElement({ id: element.id, type: "table" });
                (onSelectTableStructuralNode ?? (() => undefined))(selection);
              }}
              treeNodeProps={{
                expandedIds,
                selectedElementId,
                selectedContentSlotId,
                selectedStructuralTopicItemId,
                selectedGalleryItemIndex,
                dropTarget,
                onToggle,
                onSelectElement,
                onDragStart,
                onDragOver,
                onDrop,
                onDragEnd,
                onGalleryItemDragStart,
                onGalleryItemDragOver,
                onGalleryItemDrop,
                onIndentTopicItem,
                onOutdentTopicItem,
                getTopicItemHierarchyActionState,
                selectedTableStructuralNode,
                onSelectTableStructuralNode,
                onMoveTableColumn,
                onMoveTableRow,
              }}
            />
          )}
        </ul>
      )}
    </li>
  );
}

function StructuredTableTreeNodes({
  element,
  expandedIds,
  onToggle,
  selected,
  onSelect,
  treeNodeProps,
}: {
  element: StructuredTableElement;
  expandedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  selected: TableStructuralSelection;
  onSelect: (selection: TableStructuralSelection) => void;
  treeNodeProps: Omit<ElementTreeNodeProps, "element" | "index" | "siblingCount" | "contentSlotId">;
}) {
  const { t } = useStudioI18n();
  const columnsId = getTableColumnsNodeId(element.id);
  const rowsId = getTableRowsNodeId(element.id);
  return <>
    <li className={styles.elementTreeNode} role="treeitem" aria-expanded={expandedIds.has(columnsId)}>
      <div className={styles.elementTreeRow}>
        <button className={styles.elementTreeExpand} type="button" aria-label={t(expandedIds.has(columnsId) ? "tree.collapse" : "tree.expand")} onClick={() => onToggle(columnsId)}>{expandedIds.has(columnsId) ? "▾" : "▸"}</button>
        <button className={styles.elementTreeSelect} type="button" onClick={() => onToggle(columnsId)}>{t("table.columns")}</button>
      </div>
      {expandedIds.has(columnsId) && <ul role="group" className={styles.elementTreeList}>
        {element.columns.map((column, index) => {
          const id = getTableColumnNodeId(element.id, column.id);
          const isSelected = selected?.kind === "column" && selected.tableId === element.id && selected.id === column.id;
          const children = getStructuredContentChildren(column.header);
          const expanded = expandedIds.has(id);
          return <li key={id} className={styles.elementTreeNode} role="treeitem" aria-selected={isSelected} aria-expanded={children.length > 1 ? expanded : undefined}>
            <div className={isSelected ? `${styles.elementTreeRow} ${styles.elementTreeSelected}` : styles.elementTreeRow}>
              {children.length > 1 ? <button className={styles.elementTreeExpand} type="button" aria-label={t(expanded ? "tree.collapse" : "tree.expand")} onClick={() => onToggle(id)}>{expanded ? "▾" : "▸"}</button> : <span className={styles.elementTreeExpand} aria-hidden="true" />}
              <button className={styles.elementTreeSelect} type="button" data-powershow-table-tree-column-id={column.id} onClick={() => onSelect({ kind: "column", tableId: element.id, id: column.id })}>{getStructuredColumnLabel(element, index, t)}</button>
            </div>
            {expanded && children.length > 1 && (
              <ul role="group" className={`${styles.elementTreeList} ${styles.elementTreeChildren}`}>
                {children.map((child, childIndex) => (
                  <ElementTreeNode
                    key={child.id}
                    {...treeNodeProps}
                    element={child}
                    index={childIndex}
                    siblingCount={column.header.children.length}
                    contentSlotId={column.header.id}
                  />
                ))}
              </ul>
            )}
          </li>;
        })}
      </ul>}
    </li>
    <li className={styles.elementTreeNode} role="treeitem" aria-expanded={expandedIds.has(rowsId)}>
      <div className={styles.elementTreeRow}>
        <button className={styles.elementTreeExpand} type="button" aria-label={t(expandedIds.has(rowsId) ? "tree.collapse" : "tree.expand")} onClick={() => onToggle(rowsId)}>{expandedIds.has(rowsId) ? "▾" : "▸"}</button>
        <button className={styles.elementTreeSelect} type="button" onClick={() => onToggle(rowsId)}>{t("table.rows")}</button>
      </div>
      {expandedIds.has(rowsId) && <ul role="group" className={styles.elementTreeList}>
        {element.rows.map((row, index) => {
          const id = getTableRowNodeId(element.id, row.id);
          const isSelected = selected?.kind === "row" && selected.tableId === element.id && selected.id === row.id;
          const children = row.cells[0] ? getStructuredContentChildren(row.cells[0]) : [];
          const expanded = expandedIds.has(id);
          return <li key={id} className={styles.elementTreeNode} role="treeitem" aria-selected={isSelected} aria-expanded={children.length > 1 ? expanded : undefined}>
            <div className={isSelected ? `${styles.elementTreeRow} ${styles.elementTreeSelected}` : styles.elementTreeRow}>
              {children.length > 1 ? <button className={styles.elementTreeExpand} type="button" aria-label={t(expanded ? "tree.collapse" : "tree.expand")} onClick={() => onToggle(id)}>{expanded ? "▾" : "▸"}</button> : <span className={styles.elementTreeExpand} aria-hidden="true" />}
              <button className={styles.elementTreeSelect} type="button" data-powershow-table-tree-row-id={row.id} onClick={() => onSelect({ kind: "row", tableId: element.id, id: row.id })}>{getStructuredRowLabel(element, index, t)}</button>
            </div>
            {expanded && children.length > 1 ? (
              <ul role="group" className={`${styles.elementTreeList} ${styles.elementTreeChildren}`}>
                {children.map((child, childIndex) => (
                  <ElementTreeNode
                    key={child.id}
                    {...treeNodeProps}
                    element={child}
                    index={childIndex}
                    siblingCount={children.length}
                    contentSlotId={row.cells[0]!.id}
                  />
                ))}
              </ul>
            ) : null}
          </li>;
        })}
      </ul>}
    </li>
  </>;
}

function GalleryItemTreeNode({
  galleryId,
  itemIndex,
  item,
  selected,
  onSelectElement,
  dropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: GalleryItemTreeNodeProps) {
  const { t } = useStudioI18n();
  const dropIntent =
    dropTarget?.id === galleryId && dropTarget.itemIndex === itemIndex
      ? dropTarget.intent
      : null;

  return (
    <li
      className={styles.elementTreeNode}
      role="treeitem"
      aria-selected={selected}
    >
      {dropIntent === "before" && (
        <div className={styles.elementTreeDropIndicatorBefore} aria-hidden="true" />
      )}
      <div
        className={
          selected
            ? `${styles.elementTreeRow} ${styles.elementTreeSelected}`
            : styles.elementTreeRow
        }
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={(event) => {
          event.preventDefault();
          onDrop();
        }}
        onDragEnd={onDragEnd}
      >
        <span className={styles.elementTreeExpand} aria-hidden="true" />
        <button
          className={styles.elementTreeSelect}
          type="button"
          onClick={() =>
            onSelectElement({
              id: galleryId,
              type: "gallery",
              galleryItemIndex: itemIndex,
            })
          }
        >
          {`${itemIndex + 1}. ${getGalleryItemDisplayName(item, t("gallery.newImage"))}`}
        </button>
      </div>
      {dropIntent === "after" && (
        <div className={styles.elementTreeDropIndicatorAfter} aria-hidden="true" />
      )}
    </li>
  );
}

function TopicItemTreeNode({
  item,
  owningTopicsId,
  index,
  siblingCount,
  expandedIds,
  selectedElementId,
  selectedContentSlotId,
  dropTarget,
  onToggle,
  onSelectElement,
  selectedGalleryItemIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onGalleryItemDragStart,
  onGalleryItemDragOver,
  onGalleryItemDrop,
  selectedStructuralTopicItemId,
  onIndentTopicItem,
  onOutdentTopicItem,
  getTopicItemHierarchyActionState,
}: TopicItemTreeNodeProps) {
  const { t } = useStudioI18n();
  const displayInfo = getTopicItemDisplayInfo(item, t("tree.topic"));
  const visibleContentChildren = item.content.children.filter(
    (child) => child.id !== displayInfo.labelSourceElementId,
  );
  const structuralChildren = item.children;
  const isExpandable =
    visibleContentChildren.length > 0 || structuralChildren.length > 0;
  const expanded = isExpandable && expandedIds.has(item.id);
  const selected =
    selectedElementId === owningTopicsId &&
    selectedContentSlotId === item.content.id;

  return (
    <li
      className={styles.elementTreeNode}
      role="treeitem"
      aria-selected={selected}
      aria-expanded={isExpandable ? expanded : undefined}
    >
      <div
        className={
          selected
            ? `${styles.elementTreeRow} ${styles.elementTreeSelected}`
            : styles.elementTreeRow
        }
      >
        {isExpandable ? (
          <button
            className={styles.elementTreeExpand}
            type="button"
            aria-label={t(expanded ? "tree.collapse" : "tree.expand")}
            onClick={() => onToggle(item.id)}
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className={styles.elementTreeExpand} aria-hidden="true" />
        )}

        <button
          className={styles.elementTreeSelect}
          type="button"
          onClick={() =>
            onSelectElement({
              id: owningTopicsId,
              type: "topics",
              contentSlotId: item.content.id,
            })
          }
        >
          {displayInfo.label}
        </button>

      </div>
      {isExpandable && expanded && (
        <ul role="group" className={styles.elementTreeList}>
          {visibleContentChildren.map((child, childIndex) => (
            <ElementTreeNode
              key={child.id}
              element={child}
              index={childIndex}
              siblingCount={visibleContentChildren.length}
              expandedIds={expandedIds}
              selectedElementId={selectedElementId}
              selectedContentSlotId={selectedContentSlotId}
              selectedStructuralTopicItemId={selectedStructuralTopicItemId}
              selectedGalleryItemIndex={selectedGalleryItemIndex}
              onToggle={onToggle}
              onSelectElement={onSelectElement}
              dropTarget={dropTarget}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              onGalleryItemDragStart={onGalleryItemDragStart}
              onGalleryItemDragOver={onGalleryItemDragOver}
              onGalleryItemDrop={onGalleryItemDrop}
              onIndentTopicItem={onIndentTopicItem}
              onOutdentTopicItem={onOutdentTopicItem}
              getTopicItemHierarchyActionState={getTopicItemHierarchyActionState}
            />
          ))}
          {structuralChildren.map((child, childIndex) => (
            <TopicItemTreeNode
              key={child.id}
              item={child}
              owningTopicsId={owningTopicsId}
              index={childIndex}
              siblingCount={structuralChildren.length}
              expandedIds={expandedIds}
              selectedElementId={selectedElementId}
              selectedContentSlotId={selectedContentSlotId}
              selectedStructuralTopicItemId={selectedStructuralTopicItemId}
              selectedGalleryItemIndex={selectedGalleryItemIndex}
              dropTarget={dropTarget}
              onToggle={onToggle}
              onSelectElement={onSelectElement}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
                  onDrop={onDrop}
                  onDragEnd={onDragEnd}
                  onGalleryItemDragStart={onGalleryItemDragStart}
                  onGalleryItemDragOver={onGalleryItemDragOver}
                  onGalleryItemDrop={onGalleryItemDrop}
                  onIndentTopicItem={onIndentTopicItem}
                  onOutdentTopicItem={onOutdentTopicItem}
                  getTopicItemHierarchyActionState={getTopicItemHierarchyActionState}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ElementTreePanel({
  slide,
  selectedElementId,
  selectedContentSlotId,
  selectedGalleryItemIndex = null,
  onSelectElement,
  onMoveElement,
  onMoveTopicItem,
  onIndentTopicItem,
  onOutdentTopicItem,
  onMoveGalleryItem,
  onGalleryStructureDrop,
  onMoveTableColumn,
  onMoveTableRow,
  selectedTableStructuralNode,
  onSelectTableStructuralNode,
  customLibraryRepository,
  onBrowseElementStyles,
  palette,
  fontResources,
}: ElementTreePanelProps) {
  const { t } = useStudioI18n();
  const [localSelectedTableStructuralNode, setLocalSelectedTableStructuralNode] =
    useState<TableStructuralSelection>(null);
  const currentSelectedTableStructuralNode = selectedTableStructuralNode === undefined
    ? localSelectedTableStructuralNode
    : selectedTableStructuralNode;
  const setSelectedTableStructuralNode = onSelectTableStructuralNode ?? setLocalSelectedTableStructuralNode;
  const selectRealElement = (selection: ElementTreeSelection) => {
    setSelectedTableStructuralNode(null);
    onSelectElement(selection);
  };
  const [expandedIds, setExpandedIds] = useState(() => {
    const ids = new Set<string>();
    collectInitiallyExpandedIds(slide.elements, ids);
    return ids;
  });
  const [dragSource, setDragSource] = useState<ElementTreeDragSource | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    intent: TreeDropIntent;
    itemIndex?: number;
  } | null>(null);
  const selectedElement =
    selectedElementId === null
      ? null
      : findElementById(slide.elements, selectedElementId);
  const selectedPosition =
    selectedElementId === null
      ? null
      : findElementSiblingPosition(slide.elements, selectedElementId);
  const isStructuralTopicRow = isStructuralTopicSelection(
    slide,
    selectedElementId,
    selectedContentSlotId,
  );
  const selectedElementForMovement = isStructuralTopicRow
    ? null
    : selectedElement;
  const selectedGallery =
    selectedGalleryItemIndex !== null && selectedElement?.type === "gallery"
      ? selectedElement
      : null;
  const selectedPositionForMovement = isStructuralTopicRow
    ? null
    : selectedPosition;
  const selectedTopicItemPosition = isStructuralTopicRow
    ? findTopicItemSiblingPosition(
        slide.elements,
        selectedElementId ?? "",
        selectedContentSlotId ?? "",
      )
    : null;
  const selectedStructuralTopicItemId =
    isStructuralTopicRow ? selectedTopicItemPosition?.topicItemId ?? null : null;
  const selectedTargets = selectedElementForMovement
    ? getParentTargets(slide, selectedElementForMovement, (key) => t(key))
    : [];
  const selectedActionState = selectedPositionForMovement
    ? getTreeActionState(
        selectedPositionForMovement.index,
        selectedPositionForMovement.count,
        selectedPositionForMovement.parentRef,
      )
    : null;
  const selectedTable = currentSelectedTableStructuralNode
    ? findElementById(slide.elements, currentSelectedTableStructuralNode.tableId)
    : null;
  const selectedTableColumnIndex = selectedTable?.type === "table" && selectedTable.mode === "structured" && currentSelectedTableStructuralNode?.kind === "column"
    ? selectedTable.columns.findIndex((column) => column.id === currentSelectedTableStructuralNode.id)
    : -1;
  const selectedTableRowIndex = selectedTable?.type === "table" && selectedTable.mode === "structured" && currentSelectedTableStructuralNode?.kind === "row"
    ? selectedTable.rows.findIndex((row) => row.id === currentSelectedTableStructuralNode.id)
    : -1;
  const selectedTableRepresentativeChild = selectedPositionForMovement?.parentRef.kind === "content-slot" &&
    isStructuredTableContentSlotId(slide.elements, selectedPositionForMovement.parentRef.id);

  function getDropIntent(
    target: PowerShowElement,
    event: DragEvent<HTMLDivElement>,
  ): TreeDropIntent {
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeY = event.clientY - bounds.top;

    if (
      (target.type === "container" ||
        (target.type === "gallery" &&
          dragSource?.kind === "element" &&
          findElementById(slide.elements, dragSource.elementId)?.type === "image")) &&
      relativeY > bounds.height / 3 &&
      relativeY < (bounds.height * 2) / 3
    ) {
      return "inside";
    }

    return relativeY < bounds.height / 2 ? "before" : "after";
  }

  return (
    <div className={styles.elementTreePanel}>
      <div className={styles.elementTreeScroll}>
        <div className={styles.elementTreeRoot}>{t("tree.slide")}</div>
        <ul role="tree" className={styles.elementTreeList}>
          {slide.elements.map((element, index) => (
            <ElementTreeNode
              key={element.id}
              element={element}
              index={index}
              siblingCount={slide.elements.length}
              expandedIds={expandedIds}
              selectedElementId={selectedElementId}
              selectedContentSlotId={selectedContentSlotId}
              selectedStructuralTopicItemId={selectedStructuralTopicItemId}
              selectedGalleryItemIndex={selectedGalleryItemIndex}
              dropTarget={dropTarget}
              onToggle={(id) => {
                setExpandedIds((current) => {
                  const next = new Set(current);
                  next.has(id) ? next.delete(id) : next.add(id);
                  return next;
                });
              }}
              onSelectElement={selectRealElement}
              onDragStart={(element, event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", element.id);
                setDragSource({ kind: "element", elementId: element.id });
                selectRealElement({
                  id: element.id,
                  type: element.type,
                });
              }}
              onDragOver={(target, event) => {
                if (!dragSource) {
                  return;
                }

                const intent = getDropIntent(target, event);
                if (dragSource.kind === "gallery-item") {
                  if (target.type === "gallery" && intent === "inside") {
                    setDropTarget(null);
                    return;
                  }
                  event.preventDefault();
                  setDropTarget({ id: target.id, intent });
                  return;
                }

                if (target.type === "gallery" && intent === "inside") {
                  if (findElementById(slide.elements, dragSource.elementId)?.type === "image") {
                    event.preventDefault();
                    setDropTarget({ id: target.id, intent });
                  } else {
                    setDropTarget(null);
                  }
                  return;
                }
                const resolved = resolveTreeDrop(
                  slide.elements,
                  dragSource.elementId,
                  target.id,
                  intent,
                );

                if (resolved) {
                  event.preventDefault();
                  setDropTarget({ id: target.id, intent });
                } else {
                  setDropTarget(null);
                }
              }}
              onDrop={(target) => {
                if (
                  !dragSource ||
                  !dropTarget ||
                  dropTarget.id !== target.id
                ) {
                  return;
                }

                if (dragSource.kind === "gallery-item") {
                  onGalleryStructureDrop({
                    source: dragSource,
                    target: { kind: "element", element: target },
                    intent: dropTarget.intent,
                  });
                } else if (target.type === "gallery" && dropTarget.intent === "inside") {
                  onGalleryStructureDrop({
                    source: dragSource,
                    target: { kind: "element", element: target },
                    intent: dropTarget.intent,
                  });
                } else {
                  const resolved = resolveTreeDrop(slide.elements, dragSource.elementId, target.id, dropTarget.intent);
                  if (resolved) onMoveElement(resolved);

                  if (
                    dropTarget.intent === "inside" &&
                    target.type === "container"
                  ) {
                    setExpandedIds((current) =>
                      new Set(current).add(target.id),
                    );
                  }
                }

                setDragSource(null);
                setDropTarget(null);
              }}
              onDragEnd={() => {
                setDragSource(null);
                setDropTarget(null);
              }}
              onGalleryItemDragStart={(galleryId, itemIndex, event) => {
                event.dataTransfer.effectAllowed = "move";
                setDragSource({ kind: "gallery-item", galleryId, itemIndex });
                selectRealElement({ id: galleryId, type: "gallery", galleryItemIndex: itemIndex });
              }}
              onGalleryItemDragOver={(galleryId, itemIndex, event) => {
                if (!dragSource) return;
                const intent: TreeDropIntent = event.clientY - event.currentTarget.getBoundingClientRect().top < event.currentTarget.getBoundingClientRect().height / 2 ? "before" : "after";
                const valid =
                  (dragSource.kind === "gallery-item" && dragSource.galleryId === galleryId && dragSource.itemIndex !== itemIndex) ||
                  (dragSource.kind === "element" && findElementById(slide.elements, dragSource.elementId)?.type === "image");
                if (!valid) {
                  setDropTarget(null);
                  return;
                }
                event.preventDefault();
                setDropTarget({ id: galleryId, itemIndex, intent });
              }}
              onGalleryItemDrop={(galleryId, itemIndex) => {
                if (!dragSource || !dropTarget || dropTarget.id !== galleryId || dropTarget.itemIndex !== itemIndex) return;
                onGalleryStructureDrop({
                  source: dragSource,
                  target: { kind: "gallery-item", galleryId, itemIndex },
                  intent: dropTarget.intent,
                });
                setDragSource(null);
                setDropTarget(null);
              }}
              onIndentTopicItem={onIndentTopicItem}
              onOutdentTopicItem={onOutdentTopicItem}
              getTopicItemHierarchyActionState={(topicsId, topicItemId) =>
                getTopicItemHierarchyActionState(
                  slide.elements,
                  topicsId,
                  topicItemId,
                )}
              selectedTableStructuralNode={currentSelectedTableStructuralNode}
              onSelectTableStructuralNode={setSelectedTableStructuralNode}
              onMoveTableColumn={onMoveTableColumn}
              onMoveTableRow={onMoveTableRow}
            />
          ))}
        </ul>
      </div>
      <div className={styles.elementTreeFooter}>
        <button
          type="button"
          aria-label={currentSelectedTableStructuralNode?.kind === "column" ? t("tree.moveLeft") : t("tree.moveUp")}
          title={currentSelectedTableStructuralNode?.kind === "column" ? t("tree.moveLeft") : t("tree.moveUp")}
          disabled={
            currentSelectedTableStructuralNode?.kind === "column"
              ? selectedTableColumnIndex <= 0
              : currentSelectedTableStructuralNode?.kind === "row"
                ? selectedTableRowIndex <= 0
                : selectedGallery
              ? selectedGalleryItemIndex === 0
              : selectedTopicItemPosition
                ? selectedTopicItemPosition.index === 0
              : !selectedElementId || !selectedPositionForMovement || !selectedActionState?.canMoveUp
          }
          onClick={() => {
            if (currentSelectedTableStructuralNode?.kind === "column" && selectedTableColumnIndex >= 0) {
              onMoveTableColumn?.(currentSelectedTableStructuralNode.tableId, currentSelectedTableStructuralNode.id, -1);
            } else if (currentSelectedTableStructuralNode?.kind === "row" && selectedTableRowIndex >= 0) {
              onMoveTableRow?.(currentSelectedTableStructuralNode.tableId, currentSelectedTableStructuralNode.id, -1);
            } else if (selectedGallery && selectedGalleryItemIndex !== null) {
              onMoveGalleryItem(selectedGallery.id, selectedGalleryItemIndex, -1);
            } else if (selectedTopicItemPosition && selectedElementId) {
              onMoveTopicItem(
                selectedElementId,
                selectedTopicItemPosition.topicItemId,
                selectedTopicItemPosition.index - 1,
              );
            } else if (selectedElementId && selectedPositionForMovement) {
              onMoveElement({
                elementId: selectedElementId,
                targetParentRef: selectedPositionForMovement.parentRef,
                targetIndex: selectedPositionForMovement.index - 1,
              });
            }
          }}
        >
          ▲
        </button>
        <button
          type="button"
          aria-label={currentSelectedTableStructuralNode?.kind === "column" ? t("tree.moveRight") : t("tree.moveDown")}
          title={currentSelectedTableStructuralNode?.kind === "column" ? t("tree.moveRight") : t("tree.moveDown")}
          disabled={
            currentSelectedTableStructuralNode?.kind === "column"
              ? selectedTableColumnIndex < 0 || selectedTable?.type !== "table" || selectedTable.mode !== "structured" || selectedTableColumnIndex >= selectedTable.columns.length - 1
              : currentSelectedTableStructuralNode?.kind === "row"
                ? selectedTableRowIndex < 0 || selectedTable?.type !== "table" || selectedTable.mode !== "structured" || selectedTableRowIndex >= selectedTable.rows.length - 1
                : selectedGallery
              ? selectedGalleryItemIndex === selectedGallery.items.length - 1
              : selectedTopicItemPosition
                ? selectedTopicItemPosition.index === selectedTopicItemPosition.count - 1
              : !selectedElementId || !selectedPositionForMovement || !selectedActionState?.canMoveDown
          }
          onClick={() => {
            if (currentSelectedTableStructuralNode?.kind === "column" && selectedTableColumnIndex >= 0) {
              onMoveTableColumn?.(currentSelectedTableStructuralNode.tableId, currentSelectedTableStructuralNode.id, 1);
            } else if (currentSelectedTableStructuralNode?.kind === "row" && selectedTableRowIndex >= 0) {
              onMoveTableRow?.(currentSelectedTableStructuralNode.tableId, currentSelectedTableStructuralNode.id, 1);
            } else if (selectedGallery && selectedGalleryItemIndex !== null) {
              onMoveGalleryItem(selectedGallery.id, selectedGalleryItemIndex, 1);
            } else if (selectedTopicItemPosition && selectedElementId) {
              onMoveTopicItem(
                selectedElementId,
                selectedTopicItemPosition.topicItemId,
                selectedTopicItemPosition.index + 1,
              );
            } else if (selectedElementId && selectedPositionForMovement) {
              onMoveElement({
                elementId: selectedElementId,
                targetParentRef: selectedPositionForMovement.parentRef,
                targetIndex: selectedPositionForMovement.index + 1,
              });
            }
          }}
        >
          ▼
        </button>
        <select
          aria-label={t("tree.moveTo")}
          disabled={!selectedElementForMovement || selectedGallery !== null || selectedTableRepresentativeChild}
          value=""
          onChange={(event) => {
            if (selectedElementId && selectedElementForMovement) {
              const targetParentId = event.target.value || null;
              onMoveElement({
                elementId: selectedElementId,
                targetParentRef:
                  targetParentId === null
                    ? { kind: "slide" }
                    : { kind: "container", id: targetParentId },
              });
            }
          }}
        >
          <option value="">{t("tree.moveTo")}</option>
          {selectedTargets.map((target) => (
            <option key={target.id ?? "slide"} value={target.id ?? ""}>
              {target.label}
            </option>
          ))}
        </select>
      </div>
      <ElementPropertiesPanel
        selectedElement={selectedElement}
        isStructuralTopicSelection={isStructuralTopicRow}
        customLibraryRepository={customLibraryRepository}
        onBrowseElementStyles={onBrowseElementStyles}
        palette={palette}
        fontResources={fontResources}
      />
    </div>
  );
}
