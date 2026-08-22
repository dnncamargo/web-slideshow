import { useEffect, useRef, useState } from "react";

import type {
  BlockItem,
  BlocksElement,
} from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import {
  MAX_BLOCK_STRUCTURAL_DEPTH,
  moveBlockItemWithinSiblings,
  removeBlockItemFromBlockItems,
  updateBlockItemText,
} from "../element-operations";

import type {
  BlocksAuthoringControls,
  ElementInspectorUpdate,
  UpdateElementStyle,
} from "./inspector-types";

import { InspectorSection } from "./inspector-section";

import { ElementAppearanceSection } from "./sections/element-appearance-section";
import { ElementEffectsSection } from "./sections/element-effects-section";

// ============================================================
// BEGIN: BLOCKS INSPECTOR
//
// BlockItems are recursive authoring rows INSIDE this inspector.
// They are NOT Element Tree rows and NOT PowerShowElements.
//
// Text edits commit immediately on change: this follows the Code /
// Topics authoring model, NOT the Embed draft-commit model. Empty
// text is valid and persists immediately.
//
// BlockItem creation requires presentation-wide unique IDs, so it
// goes through BlocksAuthoringControls (implemented in the
// workspace). Text/remove/reorder operate on the canonical state
// directly through onUpdate and never allocate IDs.
// ============================================================

interface BlockRowProps {
  item: BlockItem;

  depth: number;

  isFirstSibling: boolean;

  isLastSibling: boolean;

  textLabel: string;

  addChildLabel: string;

  maxDepthAddChildLabel: string;

  removeLabel: string;

  moveUpLabel: string;

  moveDownLabel: string;

  onTextChange: (blockItemId: string, text: string) => void;

  onAddChild: (blockItemId: string) => void;

  onRemove: (blockItemId: string) => void;

  onMove: (blockItemId: string, offset: -1 | 1) => void;

  registerInputRef: (
    blockItemId: string,
    node: HTMLInputElement | null,
  ) => void;
}

function BlockRow({
  item,
  depth,
  isFirstSibling,
  isLastSibling,
  textLabel,
  addChildLabel,
  maxDepthAddChildLabel,
  removeLabel,
  moveUpLabel,
  moveDownLabel,
  onTextChange,
  onAddChild,
  onRemove,
  onMove,
  registerInputRef,
}: BlockRowProps) {
  const atMaxStructuralDepth =
    depth + 1 >= MAX_BLOCK_STRUCTURAL_DEPTH;

  const addChildTitle = atMaxStructuralDepth
    ? maxDepthAddChildLabel
    : addChildLabel;

  return (
    <li
      className={styles.blocksRow}
      data-powershow-block-item-id={item.id}
      style={{ paddingInlineStart: depth * 18 }}
    >
      <div className={styles.blocksRowLine}>
        <input
          ref={(node) => {
            registerInputRef(item.id, node);
          }}
          className={styles.blocksInput}
          data-powershow-block-input="true"
          type="text"
          aria-label={textLabel}
          value={item.text}
          onChange={(event) => {
            onTextChange(item.id, event.currentTarget.value);
          }}
        />

        <button
          type="button"
          className={styles.secondaryButton}
          data-powershow-block-move-up="true"
          title={moveUpLabel}
          aria-label={moveUpLabel}
          disabled={isFirstSibling}
          onClick={() => {
            onMove(item.id, -1);
          }}
        >
          ↑
        </button>

        <button
          type="button"
          className={styles.secondaryButton}
          data-powershow-block-move-down="true"
          title={moveDownLabel}
          aria-label={moveDownLabel}
          disabled={isLastSibling}
          onClick={() => {
            onMove(item.id, 1);
          }}
        >
          ↓
        </button>

        <button
          type="button"
          className={styles.secondaryButton}
          data-powershow-block-add-child="true"
          title={addChildTitle}
          aria-label={addChildTitle}
          disabled={atMaxStructuralDepth}
          onClick={() => {
            onAddChild(item.id);
          }}
        >
          +
        </button>

        <button
          type="button"
          className={styles.secondaryButton}
          data-powershow-block-remove="true"
          title={removeLabel}
          aria-label={removeLabel}
          onClick={() => {
            onRemove(item.id);
          }}
        >
          ×
        </button>
      </div>

      {item.children.length > 0 && (
        <ul className={styles.blocksChildren}>
          {item.children.map((child, childIndex) => (
            <BlockRow
              key={child.id}
              item={child}
              depth={depth + 1}
              isFirstSibling={childIndex === 0}
              isLastSibling={childIndex === item.children.length - 1}
              textLabel={textLabel}
              addChildLabel={addChildLabel}
              maxDepthAddChildLabel={maxDepthAddChildLabel}
              removeLabel={removeLabel}
              moveUpLabel={moveUpLabel}
              moveDownLabel={moveDownLabel}
              onTextChange={onTextChange}
              onAddChild={onAddChild}
              onRemove={onRemove}
              onMove={onMove}
              registerInputRef={registerInputRef}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ============================================================
// END: BLOCK ROW
// ============================================================

interface BlocksInspectorProps {
  element: BlocksElement;

  onUpdate: ElementInspectorUpdate;

  blocksAuthoringControls: BlocksAuthoringControls;
}

export function BlocksInspector({
  element,
  onUpdate,
  blocksAuthoringControls,
}: BlocksInspectorProps) {
  const { t } = useStudioI18n();

  const [pendingFocusBlockItemId, setPendingFocusBlockItemId] = useState<
    string | null
  >(null);

  const inputRefs = useRef(new Map<string, HTMLInputElement | null>());

  useEffect(() => {
    if (!pendingFocusBlockItemId) {
      return;
    }

    const input = inputRefs.current.get(pendingFocusBlockItemId);

    if (!input) {
      return;
    }

    input.focus();
    input.select();
    setPendingFocusBlockItemId(null);
  }, [element.items, pendingFocusBlockItemId]);

  function updateCurrentBlocks(
    update: (blocks: BlocksElement) => BlocksElement,
  ) {
    onUpdate((current) => {
      if (current.type !== "blocks") {
        return current;
      }

      const next = update(current);

      return next === current ? current : next;
    });
  }

  const updateBlocksStyle: UpdateElementStyle = (update) => {
    updateCurrentBlocks((current) => {
      const style = update(current.style);

      return style === current.style
        ? current
        : {
            ...current,
            style,
          };
    });
  };

  function updateBlockText(blockItemId: string, text: string) {
    updateCurrentBlocks((current) => {
      const items = updateBlockItemText(current.items, blockItemId, text);

      return items === current.items
        ? current
        : {
            ...current,
            items,
          };
    });
  }

  function addTopLevelBlock() {
    const createdBlockItemId = blocksAuthoringControls.onAddTopLevelBlock(
      element.id,
    );

    if (createdBlockItemId) {
      setPendingFocusBlockItemId(createdBlockItemId);
    }
  }

  function addChildBlock(blockItemId: string) {
    const createdBlockItemId = blocksAuthoringControls.onAddChildBlock(
      element.id,
      blockItemId,
    );

    if (createdBlockItemId) {
      setPendingFocusBlockItemId(createdBlockItemId);
    }
  }

  function removeBlock(blockItemId: string) {
    updateCurrentBlocks((current) => {
      const items = removeBlockItemFromBlockItems(
        current.items,
        blockItemId,
      );

      return items === current.items
        ? current
        : {
            ...current,
            items,
          };
    });
  }

  function moveBlock(blockItemId: string, offset: -1 | 1) {
    updateCurrentBlocks((current) => {
      const items = moveBlockItemWithinSiblings(
        current.items,
        blockItemId,
        offset,
      );

      return items === current.items
        ? current
        : {
            ...current,
            items,
          };
    });
  }

  return (
    <>
      <div className={styles.inspectorDivider} />

      <InspectorSection title={t("inspector.content")} defaultOpen>
        <small className={styles.fieldHint}>
          <span>{t("inspector.blocks.staticHelp")}</span>
        </small>

        {element.items.length === 0 ? (
          <small className={styles.fieldHint}>
            <span>{t("inspector.blocks.empty")}</span>
          </small>
        ) : (
          <ul className={styles.blocksList}>
            {element.items.map((item, index) => (
              <BlockRow
                key={item.id}
                item={item}
                depth={0}
                isFirstSibling={index === 0}
                isLastSibling={index === element.items.length - 1}
                textLabel={t("inspector.blocks.text")}
                addChildLabel={t("inspector.blocks.addChild")}
                maxDepthAddChildLabel={t("inspector.blocks.maxDepth")}
                removeLabel={t("inspector.blocks.remove")}
                moveUpLabel={t("inspector.blocks.moveUp")}
                moveDownLabel={t("inspector.blocks.moveDown")}
                onTextChange={updateBlockText}
                onAddChild={addChildBlock}
                onRemove={removeBlock}
                onMove={moveBlock}
                registerInputRef={(blockItemId, node) => {
                  if (node) {
                    inputRefs.current.set(blockItemId, node);
                  } else {
                    inputRefs.current.delete(blockItemId);
                  }
                }}
              />
            ))}
          </ul>
        )}

        <button
          type="button"
          className={styles.secondaryButton}
          data-powershow-blocks-add-root="true"
          onClick={addTopLevelBlock}
        >
          <span>{t("inspector.blocks.add")}</span>
        </button>
      </InspectorSection>

      <ElementAppearanceSection
        element={element}
        onUpdateStyle={updateBlocksStyle}
        controlPrefix="blocks"
        showColor
        showBackground
        showBackgroundGradient
        showRoundedCorners
        showOpacity
        showBorder
      />

      <ElementEffectsSection
        style={element.style}
        onUpdateStyle={updateBlocksStyle}
        controlPrefix="blocks"
      />
    </>
  );
}

// ============================================================
// END: BLOCKS INSPECTOR
// ============================================================