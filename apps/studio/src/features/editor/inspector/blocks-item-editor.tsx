import type {
  BlockItem,
  BlockPart,
  BlockSocketContent,
  BlocksElement,
} from "@powershow/document-schema";
import { colorToPickerHex } from "@powershow/document-schema";

import styles from "../editor-workspace.module.css";

import {
  MAX_BLOCK_AUTHORING_DEPTH,
  moveBlockItemByOffset,
  moveBlockPartByOffset,
  removeBlockItemById,
  removeBlockPartById,
  setBlockItemColor,
  setBlockItemShape,
  setSocketContentEmpty,
  setSocketContentLiteral,
  updateBlockTextPartText,
} from "../element-operations";

import type {
  BlocksAuthoringControls,
  ElementInspectorUpdate,
} from "./inspector-types";

import type { BlocksItemEditorLabels } from "./blocks-item-editor-types";

type UpdateBlocks = (
  update: (blocks: BlocksElement) => BlocksElement,
) => void;

/**
 * Socket content mode as presented in the Inspector UI.
 *
 * The canonical schema discriminates "empty" | "literal" | "block",
 * while the UI intentionally presents "Empty" | "Literal" | "Value
 * block". A canonical "block" therefore maps to the UI "value" mode.
 */
type BlockSocketUIMode = "empty" | "literal" | "value";

function toBlockSocketUIMode(
  canonicalType: BlockSocketContent["type"],
): BlockSocketUIMode {
  switch (canonicalType) {
    case "empty":
      return "empty";
    case "literal":
      return "literal";
    case "block":
      return "value";
  }
}

// ============================================================
// BEGIN: RECURSIVE BLOCK ITEM EDITOR
//
// BlockItems are structural authoring nodes INSIDE the Blocks
// inspector. They are NOT PowerShowElements and never participate
// in the global Studio selection.
//
// Canonical writes go exclusively through the ElementInspectorUpdate
// path (onUpdate): color, shape, text/literal edits, reorder and
// remove reuse the R2-A element-operations helpers. Creation calls
// that allocate presentation-wide ids delegate to the
// BlocksAuthoringControls callbacks; no id is ever allocated here.
//
// Depth: the authoring depth limit (MAX_BLOCK_AUTHORING_DEPTH = 5)
// applies to CREATION only, across both recursion edges (scope child
// and socket value block). Imported content deeper than 5 remains
// fully editable/removable; only the relevant creation controls are
// disabled.
// ============================================================

interface BlockItemRowProps {
  item: BlockItem;

  /** 1-based structural depth; root items are depth 1. */
  depth: number;

  blocksId: string;

  isFirstSibling: boolean;

  isLastSibling: boolean;

  labels: BlocksItemEditorLabels;

  controls: BlocksAuthoringControls;

  updateBlocks: UpdateBlocks;
}

interface BlockPartRowProps {
  /** Owning block of the part. */
  owner: BlockItem;

  part: BlockPart;

  partIndex: number;

  partCount: number;

  /** Structural depth of the owning block. */
  ownerDepth: number;

  blocksId: string;

  labels: BlocksItemEditorLabels;

  controls: BlocksAuthoringControls;

  updateBlocks: UpdateBlocks;
}

function BlockItemRow({
  item,
  depth,
  blocksId,
  isFirstSibling,
  isLastSibling,
  labels,
  controls,
  updateBlocks,
}: BlockItemRowProps) {
  const isValueBlock = item.shape === "value";
  const isScopeBlock = item.shape === "scope";
  const canAddScopeChild = depth < MAX_BLOCK_AUTHORING_DEPTH;
  const hasChildren = item.children.length > 0;

  return (
    <li
      className={styles.blocksRow}
      data-powershow-block-item-id={item.id}
      data-powershow-block-shape={item.shape}
      data-powershow-block-depth={depth}
      style={{ paddingInlineStart: (depth - 1) * 18 }}
    >
      <div className={styles.blocksRowLine}>
        <input
          className={styles.blocksColorInput}
          type="color"
          aria-label={labels.color}
          title={labels.color}
          data-powershow-block-color="true"
          value={colorToPickerHex(
            typeof item.color === "string" ? item.color : undefined,
          ) ?? "#6366f1"}
          onChange={(event) => {
            const color = event.currentTarget.value;
            updateBlocks((current) =>
              setBlockItemColor(current, item.id, color),
            );
          }}
        />

        {isValueBlock ? (
          <select
            className={styles.blocksInput}
            aria-label={labels.shape}
            data-powershow-block-shape="true"
            value="value"
            disabled
          >
            <option value="value">{labels.value}</option>
          </select>
        ) : (
          <select
            className={styles.blocksInput}
            aria-label={labels.shape}
            data-powershow-block-shape="true"
            value={item.shape}
            onChange={(event) => {
              const shape = event.currentTarget.value as
                | "statement"
                | "scope";
              updateBlocks((current) =>
                setBlockItemShape(current, item.id, shape),
              );
            }}
          >
            <option value="statement" disabled={isScopeBlock && hasChildren}>
              {labels.statement}
            </option>
            <option value="scope">{labels.scope}</option>
          </select>
        )}

        {!isValueBlock && (
          <>
            <button
              type="button"
              className={styles.secondaryButton}
              data-powershow-block-move-up="true"
              title={labels.moveEarlier}
              aria-label={labels.moveEarlier}
              disabled={isFirstSibling}
              onClick={() => {
                updateBlocks((current) =>
                  moveBlockItemByOffset(current, item.id, -1),
                );
              }}
            >
              ↑
            </button>

            <button
              type="button"
              className={styles.secondaryButton}
              data-powershow-block-move-down="true"
              title={labels.moveLater}
              aria-label={labels.moveLater}
              disabled={isLastSibling}
              onClick={() => {
                updateBlocks((current) =>
                  moveBlockItemByOffset(current, item.id, 1),
                );
              }}
            >
              ↓
            </button>

            <button
              type="button"
              className={styles.secondaryButton}
              data-powershow-block-remove="true"
              title={labels.remove}
              aria-label={labels.remove}
              onClick={() => {
                updateBlocks((current) =>
                  removeBlockItemById(current, item.id),
                );
              }}
            >
              ×
            </button>
          </>
        )}
      </div>

      {item.parts.length > 0 && (
        <ul className={styles.blocksChildren} data-powershow-block-parts="true">
          {item.parts.map((part, partIndex) => (
            <BlockPartRow
              key={part.id}
              owner={item}
              part={part}
              partIndex={partIndex}
              partCount={item.parts.length}
              ownerDepth={depth}
              blocksId={blocksId}
              labels={labels}
              controls={controls}
              updateBlocks={updateBlocks}
            />
          ))}
        </ul>
      )}

      <div data-powershow-block-add-part-actions="true">
        <button
          type="button"
          className={styles.secondaryButton}
          data-powershow-block-add-part-text="true"
          onClick={() => {
            void controls.onAddTextPart(blocksId, item.id);
          }}
        >
          + {labels.addTextPart}
        </button>

        <button
          type="button"
          className={styles.secondaryButton}
          data-powershow-block-add-part-socket="true"
          onClick={() => {
            void controls.onAddSocketPart(blocksId, item.id);
          }}
        >
          + {labels.addSocketPart}
        </button>
      </div>

      {isScopeBlock && hasChildren && (
        <ul className={styles.blocksChildren}>
          {item.children.map((child, childIndex) => (
            <BlockItemRow
              key={child.id}
              item={child}
              depth={depth + 1}
              blocksId={blocksId}
              isFirstSibling={childIndex === 0}
              isLastSibling={childIndex === item.children.length - 1}
              labels={labels}
              controls={controls}
              updateBlocks={updateBlocks}
            />
          ))}
        </ul>
      )}

      {isScopeBlock && (
        <button
          type="button"
          className={styles.secondaryButton}
          data-powershow-block-add-child="true"
          title={canAddScopeChild ? labels.addChild : labels.addChildAtMaxDepth}
          aria-label={
            canAddScopeChild ? labels.addChild : labels.addChildAtMaxDepth
          }
          disabled={!canAddScopeChild}
          onClick={() => {
            void controls.onAddScopeChild(blocksId, item.id);
          }}
        >
          + {labels.addChild}
        </button>
      )}
    </li>
  );
}

function BlockPartRow({
  owner,
  part,
  partIndex,
  partCount,
  ownerDepth,
  blocksId,
  labels,
  controls,
  updateBlocks,
}: BlockPartRowProps) {
  const isFirstPart = partIndex === 0;
  const isLastPart = partIndex === partCount - 1;

  const moveEarlierButton = (
    <button
      type="button"
      className={styles.secondaryButton}
      data-powershow-part-move-up="true"
      title={labels.moveEarlier}
      aria-label={labels.moveEarlier}
      disabled={isFirstPart}
      onClick={() => {
        updateBlocks((current) =>
          moveBlockPartByOffset(current, owner.id, part.id, -1),
        );
      }}
    >
      ↑
    </button>
  );

  const moveLaterButton = (
    <button
      type="button"
      className={styles.secondaryButton}
      data-powershow-part-move-down="true"
      title={labels.moveLater}
      aria-label={labels.moveLater}
      disabled={isLastPart}
      onClick={() => {
        updateBlocks((current) =>
          moveBlockPartByOffset(current, owner.id, part.id, 1),
        );
      }}
    >
      ↓
    </button>
  );

  const removeButton = (
    <button
      type="button"
      className={styles.secondaryButton}
      data-powershow-part-remove="true"
      title={labels.remove}
      aria-label={labels.remove}
      onClick={() => {
        updateBlocks((current) =>
          removeBlockPartById(current, owner.id, part.id),
        );
      }}
    >
      ×
    </button>
  );

  if (part.type === "text") {
    return (
      <li
        className={styles.blocksRow}
        data-powershow-block-part-id={part.id}
        data-powershow-block-part-type="text"
      >
        <div className={styles.blocksRowLine}>
          <input
            type="text"
            className={styles.blocksInput}
            aria-label={labels.textPartLabel}
            data-powershow-part-text="true"
            value={part.text}
            onChange={(event) => {
              const value = event.currentTarget.value;
              updateBlocks((current) =>
                updateBlockTextPartText(
                  current,
                  owner.id,
                  part.id,
                  value,
                ),
              );
            }}
          />

          {moveEarlierButton}
          {moveLaterButton}
          {removeButton}
        </div>
      </li>
    );
  }

  const canCreateValueBlock = ownerDepth < MAX_BLOCK_AUTHORING_DEPTH;

  return (
    <li
      className={styles.blocksRow}
      data-powershow-block-part-id={part.id}
      data-powershow-block-part-type="socket"
    >
      <div className={styles.blocksRowLine}>
        <select
          className={styles.blocksInput}
          aria-label={labels.socketContent}
          data-powershow-part-socket-mode="true"
          value={toBlockSocketUIMode(part.content.type)}
          title={canCreateValueBlock ? undefined : labels.valueAtMaxDepth}
          onChange={(event) => {
            const mode = event.currentTarget.value as BlockSocketUIMode;

            if (mode === "empty") {
              updateBlocks((current) =>
                setSocketContentEmpty(current, owner.id, part.id),
              );
              return;
            }

            if (mode === "literal") {
              updateBlocks((current) =>
                setSocketContentLiteral(
                  current,
                  owner.id,
                  part.id,
                  part.content.type === "literal"
                    ? part.content.value
                    : "",
                ),
              );
              return;
            }

            // mode === "value": creation delegates id allocation to the
            // workspace-level control; never allocate ids locally.
            void controls.onCreateSocketValue(blocksId, owner.id, part.id);
          }}
        >
          <option value="empty">{labels.socketEmpty}</option>
          <option value="literal">{labels.socketLiteral}</option>
          <option value="value" disabled={!canCreateValueBlock}>
            {labels.socketValue}
          </option>
        </select>

        {moveEarlierButton}
        {moveLaterButton}
        {removeButton}
      </div>

      {part.content.type === "literal" && (
        <div data-powershow-part-socket-literal="true">
          <input
            type="text"
            className={styles.blocksInput}
            aria-label={labels.literalValue}
            data-powershow-part-socket-literal-input="true"
            value={part.content.value}
            onChange={(event) => {
              const value = event.currentTarget.value;
              updateBlocks((current) =>
                setSocketContentLiteral(
                  current,
                  owner.id,
                  part.id,
                  value,
                ),
              );
            }}
          />
        </div>
      )}

      {part.content.type === "block" && (
        <ul className={styles.blocksChildren}>
          <BlockItemRow
            item={part.content.block}
            depth={ownerDepth + 1}
            blocksId={blocksId}
            isFirstSibling
            isLastSibling
            labels={labels}
            controls={controls}
            updateBlocks={updateBlocks}
          />
        </ul>
      )}
    </li>
  );
}

// ============================================================
// END: RECURSIVE BLOCK ITEM EDITOR
// ============================================================

export function BlocksItemEditor({
  element,
  onUpdate,
  blocksAuthoringControls,
  labels,
}: {
  element: BlocksElement;
  onUpdate: ElementInspectorUpdate;
  blocksAuthoringControls: BlocksAuthoringControls;
  labels: BlocksItemEditorLabels;
}) {
  const updateBlocks: UpdateBlocks = (update) => {
    onUpdate((current) => {
      if (current.type !== "blocks") {
        return current;
      }

      const next = update(current);

      return next === current ? current : next;
    });
  };

  return (
    <ul className={styles.blocksList} data-powershow-blocks-editor="true">
      {element.items.map((item, index) => (
        <BlockItemRow
          key={item.id}
          item={item}
          depth={1}
          blocksId={element.id}
          isFirstSibling={index === 0}
          isLastSibling={index === element.items.length - 1}
          labels={labels}
          controls={blocksAuthoringControls}
          updateBlocks={updateBlocks}
        />
      ))}
    </ul>
  );
}
