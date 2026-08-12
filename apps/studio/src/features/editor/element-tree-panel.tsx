"use client";

import type { PowerShowElement, Slide } from "@powershow/document-schema";
import { useState } from "react";

import { ELEMENT_TYPE_MESSAGE_KEYS } from "@/features/i18n/studio-i18n";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "./editor-workspace.module.css";
import type { MoveElementOptions } from "./element-operations";
import {
  collectContainerIds,
  getElementLabel,
  getParentTargets,
  getTreeActionState,
} from "./element-tree-helpers";

interface ElementTreePanelProps {
  slide: Slide;
  selectedElementId: string | null;
  onSelectElement: (element: PowerShowElement) => void;
  onMoveElement: (options: MoveElementOptions) => void;
  onMoveElementOut: (elementId: string) => void;
}


interface ElementTreeNodeProps {
  element: PowerShowElement;
  parentId: string | null;
  index: number;
  siblingCount: number;
  depth: number;
  slide: Slide;
  expandedIds: ReadonlySet<string>;
  selectedElementId: string | null;
  onToggle: (id: string) => void;
  onSelectElement: (element: PowerShowElement) => void;
  onMoveElement: (options: MoveElementOptions) => void;
  onMoveElementOut: (elementId: string) => void;
}

function ElementTreeNode({
  element,
  parentId,
  index,
  siblingCount,
  depth,
  slide,
  expandedIds,
  selectedElementId,
  onToggle,
  onSelectElement,
  onMoveElement,
  onMoveElementOut,
}: ElementTreeNodeProps) {
  const { t } = useStudioI18n();
  const isContainer = element.type === "container";
  const expanded = isContainer && expandedIds.has(element.id);
  const selected = selectedElementId === element.id;
  const targets = getParentTargets(slide, element, (key) => t(key));
  const actionState = getTreeActionState(index, siblingCount, parentId);
  const indicator =
    isContainer
      ? `[${t(element.layoutMode === "stack" ? "inspector.stack" : "inspector.flow")}]`
      : element.style?.placement?.mode === "absolute"
        ? `[${t("inspector.absolute")}]`
        : null;

  return (
    <li role="treeitem" aria-selected={selected} aria-expanded={isContainer ? expanded : undefined}>
      <div className={styles.elementTreeRow} style={{ paddingLeft: `${depth * 14}px` }}>
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
          className={selected ? `${styles.elementTreeSelect} ${styles.elementTreeSelected}` : styles.elementTreeSelect}
          type="button"
          onClick={() => onSelectElement(element)}
        >
          {getElementLabel(element, t(ELEMENT_TYPE_MESSAGE_KEYS[element.type]))}
          {indicator && <small>{indicator}</small>}
        </button>
      </div>

      {selected && (
        <div className={styles.elementTreeActions} style={{ paddingLeft: `${depth * 14 + 22}px` }}>
          <button type="button" disabled={!actionState.canMoveUp} onClick={() => onMoveElement({ elementId: element.id, targetParentId: parentId, targetIndex: index - 1 })}>
            {t("tree.moveUp")}
          </button>
          <button type="button" disabled={!actionState.canMoveDown} onClick={() => onMoveElement({ elementId: element.id, targetParentId: parentId, targetIndex: index + 1 })}>
            {t("tree.moveDown")}
          </button>
          <select
            aria-label={t("tree.moveTo")}
            value=""
            onChange={(event) => {
              const targetParentId = event.target.value || null;
              onMoveElement({ elementId: element.id, targetParentId });
            }}
          >
            <option value="">{t("tree.moveTo")}</option>
            {targets.map((target) => (
              <option key={target.id ?? "slide"} value={target.id ?? ""}>
                {target.label}
              </option>
            ))}
          </select>
          {actionState.canMoveOut && (
            <button type="button" onClick={() => onMoveElementOut(element.id)}>
              {t("tree.moveOut")}
            </button>
          )}
        </div>
      )}

      {isContainer && expanded && (
        <ul role="group" className={styles.elementTreeList}>
          {element.children.map((child, childIndex) => (
            <ElementTreeNode
              key={child.id}
              element={child}
              parentId={element.id}
              index={childIndex}
              siblingCount={element.children.length}
              depth={depth + 1}
              slide={slide}
              expandedIds={expandedIds}
              selectedElementId={selectedElementId}
              onToggle={onToggle}
              onSelectElement={onSelectElement}
              onMoveElement={onMoveElement}
              onMoveElementOut={onMoveElementOut}
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
  onMoveElementOut,
}: ElementTreePanelProps) {
  const { t } = useStudioI18n();
  const [expandedIds, setExpandedIds] = useState(() => {
    const ids = new Set<string>();
    collectContainerIds(slide.elements, ids);
    return ids;
  });

  return (
    <div className={styles.elementTreePanel}>
      <div className={styles.elementTreeRoot}>{t("tree.slide")}</div>
      <ul role="tree" className={styles.elementTreeList}>
        {slide.elements.map((element, index) => (
          <ElementTreeNode
            key={element.id}
            element={element}
            parentId={null}
            index={index}
            siblingCount={slide.elements.length}
            depth={0}
            slide={slide}
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
            onMoveElement={onMoveElement}
            onMoveElementOut={onMoveElementOut}
          />
        ))}
      </ul>
    </div>
  );
}
