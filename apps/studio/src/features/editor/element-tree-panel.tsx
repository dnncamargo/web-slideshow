"use client";

import type { PowerShowElement, Slide } from "@powershow/document-schema";
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
  collectContainerIds,
  getElementLabel,
  getParentTargets,
  getTreeActionState,
  resolveTreeDrop,
  type TreeDropIntent,
} from "./element-tree-helpers";

interface ElementTreePanelProps {
  slide: Slide;
  selectedElementId: string | null;
  onSelectElement: (element: PowerShowElement) => void;
  onMoveElement: (options: MoveElementOptions) => void;
}


interface ElementTreeNodeProps {
  element: PowerShowElement;
  index: number;
  siblingCount: number;
  expandedIds: ReadonlySet<string>;
  selectedElementId: string | null;
  onToggle: (id: string) => void;
  onSelectElement: (element: PowerShowElement) => void;
  dropTarget: { id: string; intent: TreeDropIntent } | null;
  onDragStart: (element: PowerShowElement, event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (element: PowerShowElement, event: DragEvent<HTMLDivElement>) => void;
  onDrop: (element: PowerShowElement) => void;
  onDragEnd: () => void;
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
}: ElementTreeNodeProps) {
  const { t } = useStudioI18n();
  const isContainer = element.type === "container";
  const expanded = isContainer && expandedIds.has(element.id);
  const selected = selectedElementId === element.id;
  const indicator =
    isContainer
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
      aria-expanded={isContainer ? expanded : undefined}
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
        onDragStart={(event) => onDragStart(element, event)}
        onDragOver={(event) => onDragOver(element, event)}
        onDrop={(event) => {
          event.preventDefault();
          onDrop(element);
        }}
        onDragEnd={onDragEnd}
      >
        {isContainer ? (
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
          onClick={() => onSelectElement(element)}
        >
          {getElementLabel(element, t(ELEMENT_TYPE_MESSAGE_KEYS[element.type]))}
          {indicator && <small>{indicator}</small>}
        </button>
      </div>
      {dropIntent === "inside" && isContainer && (
        <div className={styles.elementTreeDropIndicatorInside} aria-hidden="true" />
      )}
      {dropIntent === "after" && (
        <div className={styles.elementTreeDropIndicatorAfter} aria-hidden="true" />
      )}

      {isContainer && expanded && (
        <ul role="group" className={`${styles.elementTreeList} ${styles.elementTreeChildren}`}>
          {element.children.map((child, childIndex) => (
            <ElementTreeNode
              key={child.id}
              element={child}
              index={childIndex}
              siblingCount={element.children.length}
              expandedIds={expandedIds}
              selectedElementId={selectedElementId}
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
      )}
    </li>
  );
}

export function ElementTreePanel({
  slide,
  selectedElementId,
  onSelectElement,
  onMoveElement,
}: ElementTreePanelProps) {
  const { t } = useStudioI18n();
  const [expandedIds, setExpandedIds] = useState(() => {
    const ids = new Set<string>();
    collectContainerIds(slide.elements, ids);
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
  const selectedTargets = selectedElement
    ? getParentTargets(slide, selectedElement, (key) => t(key))
    : [];
  const selectedActionState = selectedPosition
    ? getTreeActionState(
        selectedPosition.index,
        selectedPosition.count,
        selectedPosition.parentRef,
      )
    : null;

  function getDropIntent(
    target: PowerShowElement,
    event: DragEvent<HTMLDivElement>,
  ): TreeDropIntent {
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeY = event.clientY - bounds.top;

    if (target.type === "container" && relativeY > bounds.height / 3 && relativeY < (bounds.height * 2) / 3) {
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
            onToggle={(id) => {
              setExpandedIds((current) => {
                const next = new Set(current);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
              });
            }}
            onSelectElement={onSelectElement}
            dropTarget={dropTarget}
            onDragStart={(element, event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", element.id);
              setDraggedElementId(element.id);
              onSelectElement(element);
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
              if (!draggedElementId || !dropTarget || dropTarget.id !== target.id) {
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

                if (dropTarget.intent === "inside" && target.type === "container") {
                  setExpandedIds((current) => new Set(current).add(target.id));
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
          disabled={!selectedElementId || !selectedPosition || !selectedActionState?.canMoveUp}
              onClick={() => {
                if (selectedElementId && selectedPosition) {
                  onMoveElement({
                    elementId: selectedElementId,
                    targetParentRef: selectedPosition.parentRef,
                    targetIndex: selectedPosition.index - 1,
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
          disabled={!selectedElementId || !selectedPosition || !selectedActionState?.canMoveDown}
              onClick={() => {
                if (selectedElementId && selectedPosition) {
                  onMoveElement({
                    elementId: selectedElementId,
                    targetParentRef: selectedPosition.parentRef,
                    targetIndex: selectedPosition.index + 1,
                  });
                }
              }}
        >
          ▼
        </button>
        <select
          aria-label={t("tree.moveTo")}
          disabled={!selectedElement}
          value=""
          onChange={(event) => {
            if (selectedElementId) {
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
