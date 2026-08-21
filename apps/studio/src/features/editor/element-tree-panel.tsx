"use client";

import type {
  PowerShowElement,
  Slide,
  TopicItem,
} from "@powershow/document-schema";
import { useState } from "react";
import type { DragEvent } from "react";

import { ELEMENT_TYPE_MESSAGE_KEYS } from "@/features/i18n/studio-i18n";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "./editor-workspace.module.css";
import {
  findElementSiblingPosition,
  type MoveElementOptions,
} from "./element-operations";
import { findElementById } from "./element-tree";
import {
  getElementLabel,
  getElementTreeChildren,
  getParentTargets,
  getTreeActionState,
  resolveTreeDrop,
  type TreeDropIntent,
} from "./element-tree-helpers";
import { getTextContentPlainText } from "./rich-text-authoring";

interface ElementTreePanelProps {
  slide: Slide;
  selectedElementId: string | null;
  selectedContentSlotId: string | null;
  onSelectElement: (selection: ElementTreeSelection) => void;
  onMoveElement: (options: MoveElementOptions) => void;
}

interface ElementTreeSelection {
  id: string;
  type: string;
  contentSlotId?: string | null;
}

interface ElementTreeNodeProps {
  element: PowerShowElement;
  index: number;
  siblingCount: number;
  expandedIds: ReadonlySet<string>;
  selectedElementId: string | null;
  onToggle: (id: string) => void;
  onSelectElement: (selection: ElementTreeSelection) => void;
  dropTarget: { id: string; intent: TreeDropIntent } | null;
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
  selectedContentSlotId: string | null;
}

interface TopicItemTreeNodeProps {
  item: TopicItem;
  owningTopicsId: string;
  index: number;
  siblingCount: number;
  expandedIds: ReadonlySet<string>;
  selectedElementId: string | null;
  selectedContentSlotId: string | null;
  dropTarget: { id: string; intent: TreeDropIntent } | null;
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

function getTopicItemLabel(item: TopicItem, topicLabel: string): string {
  for (const child of item.content.children) {
    if (child.type !== "text") {
      continue;
    }

    const preview = getTextPreview(child.content);

    if (preview) {
      return preview;
    }
  }

  return topicLabel;
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
    if (element.type === "container" || element.type === "topics") {
      ids.add(element.id);
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
  dropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  selectedContentSlotId,
}: ElementTreeNodeProps) {
  const { t } = useStudioI18n();
  const isExpandable =
    element.type === "container" || element.type === "topics";
  const expanded = isExpandable && expandedIds.has(element.id);
  const treeChildren = getElementTreeChildren(element);
  const selected =
    element.type === "topics"
      ? selectedElementId === element.id && selectedContentSlotId === null
      : selectedElementId === element.id;
  const indicator =
    isExpandable && element.type === "container"
      ? `[${t(element.layoutMode === "stack" ? "inspector.stack" : "inspector.flow")}]`
      : element.style?.placement?.mode === "absolute"
        ? `[${t("inspector.absolute")}]`
        : null;
  const dropIntent = dropTarget?.id === element.id ? dropTarget.intent : null;

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
            onSelectElement({
              id: element.id,
              type: element.type,
            })
          }
        >
          {getElementLabel(element, t(ELEMENT_TYPE_MESSAGE_KEYS[element.type]))}
          {indicator && <small>{indicator}</small>}
        </button>
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
                onToggle={onToggle}
                onSelectElement={onSelectElement}
                dropTarget={dropTarget}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
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
                dropTarget={dropTarget}
                onToggle={onToggle}
                onSelectElement={onSelectElement}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
              />
            ))}
        </ul>
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
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: TopicItemTreeNodeProps) {
  const { t } = useStudioI18n();
  const expanded = expandedIds.has(item.id);
  const selected =
    selectedElementId === owningTopicsId &&
    selectedContentSlotId === item.content.id;
  const treeChildren = item.content.children;
  const structuralChildren = item.children;

  return (
    <li
      className={styles.elementTreeNode}
      role="treeitem"
      aria-selected={selected}
      aria-expanded={expanded}
    >
      <div
        className={
          selected
            ? `${styles.elementTreeRow} ${styles.elementTreeSelected}`
            : styles.elementTreeRow
        }
      >
        <button
          className={styles.elementTreeExpand}
          type="button"
          aria-label={t(expanded ? "tree.collapse" : "tree.expand")}
          onClick={() => onToggle(item.id)}
        >
          {expanded ? "▾" : "▸"}
        </button>

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
          {getTopicItemLabel(item, t("tree.topic"))}
        </button>
      </div>
      {expanded && (
        <ul role="group" className={styles.elementTreeList}>
          <li
            className={styles.elementTreeTopicContentGroup}
            role="none"
            data-powershow-tree-content-group
          >
            <div className={styles.elementTreeTopicContentLabel}>
              {t("tree.content")}
            </div>
            <ul
              role="group"
              className={`${styles.elementTreeList} ${styles.elementTreeChildren}`}
            >
              {treeChildren.map((child, childIndex) => (
                <ElementTreeNode
                  key={child.id}
                  element={child}
                  index={childIndex}
                  siblingCount={treeChildren.length}
                  expandedIds={expandedIds}
                  selectedElementId={selectedElementId}
                  selectedContentSlotId={selectedContentSlotId}
                  onToggle={onToggle}
                  onSelectElement={onSelectElement}
                  dropTarget={dropTarget}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onDragEnd={onDragEnd}
                />
              ))}
            </ul>
          </li>
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
              dropTarget={dropTarget}
              onToggle={onToggle}
              onSelectElement={onSelectElement}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
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
  onSelectElement,
  onMoveElement,
}: ElementTreePanelProps) {
  const { t } = useStudioI18n();
  const [expandedIds, setExpandedIds] = useState(() => {
    const ids = new Set<string>();
    collectInitiallyExpandedIds(slide.elements, ids);
    return ids;
  });
  const [draggedElementId, setDraggedElementId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    intent: TreeDropIntent;
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
  const selectedPositionForMovement = isStructuralTopicRow
    ? null
    : selectedPosition;
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

  function getDropIntent(
    target: PowerShowElement,
    event: DragEvent<HTMLDivElement>,
  ): TreeDropIntent {
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeY = event.clientY - bounds.top;

    if (
      target.type === "container" &&
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
              dropTarget={dropTarget}
              onToggle={(id) => {
                setExpandedIds((current) => {
                  const next = new Set(current);
                  next.has(id) ? next.delete(id) : next.add(id);
                  return next;
                });
              }}
              onSelectElement={onSelectElement}
              onDragStart={(element, event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", element.id);
                setDraggedElementId(element.id);
                onSelectElement({
                  id: element.id,
                  type: element.type,
                });
              }}
              onDragOver={(target, event) => {
                if (!draggedElementId) {
                  return;
                }

                const intent = getDropIntent(target, event);
                const resolved = resolveTreeDrop(
                  slide.elements,
                  draggedElementId,
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
                  !draggedElementId ||
                  !dropTarget ||
                  dropTarget.id !== target.id
                ) {
                  return;
                }

                const resolved = resolveTreeDrop(
                  slide.elements,
                  draggedElementId,
                  target.id,
                  dropTarget.intent,
                );

                if (resolved) {
                  onMoveElement(resolved);

                  if (
                    dropTarget.intent === "inside" &&
                    target.type === "container"
                  ) {
                    setExpandedIds((current) =>
                      new Set(current).add(target.id),
                    );
                  }
                }

                setDraggedElementId(null);
                setDropTarget(null);
              }}
              onDragEnd={() => {
                setDraggedElementId(null);
                setDropTarget(null);
              }}
            />
          ))}
        </ul>
      </div>
      <div className={styles.elementTreeFooter}>
        <button
          type="button"
          aria-label={t("tree.moveUp")}
          title={t("tree.moveUp")}
          disabled={
            !selectedElementId ||
            !selectedPositionForMovement ||
            !selectedActionState?.canMoveUp
          }
          onClick={() => {
            if (selectedElementId && selectedPositionForMovement) {
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
          aria-label={t("tree.moveDown")}
          title={t("tree.moveDown")}
          disabled={
            !selectedElementId ||
            !selectedPositionForMovement ||
            !selectedActionState?.canMoveDown
          }
          onClick={() => {
            if (selectedElementId && selectedPositionForMovement) {
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
          disabled={!selectedElementForMovement}
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
    </div>
  );
}
