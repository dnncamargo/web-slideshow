import type { BlocksElement } from "@powershow/document-schema";
import { colorToPickerHex } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import {
  addBlockCategory,
  isBlockCategoryUsed,
  removeBlockCategory,
  renameBlockCategory,
  setBlockCategoryColor,
} from "../../element-operations";

import { BlocksItemEditor } from "../blocks-item-editor";
import type { BlocksItemEditorLabels } from "../blocks-item-editor-types";

import type {
  BlocksAuthoringControls,
  ElementInspectorUpdate,
} from "../inspector-types";

interface BlocksContentSectionProps {
  element: BlocksElement;

  onUpdate: ElementInspectorUpdate;

  blocksAuthoringControls: BlocksAuthoringControls;
}

// ============================================================
// BEGIN: BLOCKS CONTENT SECTION
//
// The CONTENT section owns local category management, the
// root-block creation affordance, and the recursive block item
// editor. BlocksItemEditor is intentionally i18n-free: this shell
// resolves every label through Studio i18n and passes a complete
// BlocksItemEditorLabels object.
// ============================================================

export function BlocksContentSection({
  element,
  onUpdate,
  blocksAuthoringControls,
}: BlocksContentSectionProps) {
  const { t } = useStudioI18n();

  const labels: BlocksItemEditorLabels = {
    category: t("inspector.blocks.category"),
    shape: t("inspector.blocks.shape"),
    statement: t("inspector.blocks.statement"),
    scope: t("inspector.blocks.scope"),
    value: t("inspector.blocks.value"),
    moveEarlier: t("inspector.blocks.moveEarlier"),
    moveLater: t("inspector.blocks.moveLater"),
    remove: t("inspector.blocks.remove"),
    addTextPart: t("inspector.blocks.addText"),
    addSocketPart: t("inspector.blocks.addSocket"),
    addChild: t("inspector.blocks.addChild"),
    addChildAtMaxDepth: t("inspector.blocks.maxDepth"),
    socketContent: t("inspector.blocks.socket"),
    socketEmpty: t("inspector.blocks.socketEmpty"),
    socketLiteral: t("inspector.blocks.literal"),
    socketValue: t("inspector.blocks.valueBlock"),
    literalValue: t("inspector.blocks.literalValue"),
    valueAtMaxDepth: t("inspector.blocks.maxDepth"),
    textPartLabel: t("inspector.blocks.text"),
  };

  function updateCurrentBlocks(update: (blocks: BlocksElement) => BlocksElement) {
    onUpdate((current) => {
      if (current.type !== "blocks") {
        return current;
      }

      const next = update(current);

      return next === current ? current : next;
    });
  }

  function addCategory() {
    updateCurrentBlocks(addBlockCategory);
  }

  function renameCategory(categoryId: string, name: string) {
    updateCurrentBlocks((current) =>
      renameBlockCategory(current, categoryId, name),
    );
  }

  function setCategoryColor(categoryId: string, color: string) {
    updateCurrentBlocks((current) =>
      setBlockCategoryColor(current, categoryId, color),
    );
  }

  function removeCategory(categoryId: string) {
    updateCurrentBlocks((current) =>
      removeBlockCategory(current, categoryId),
    );
  }

  function addRootBlock() {
    blocksAuthoringControls.onAddRootBlock(element.id);
  }

  return (
    <div data-powershow-blocks-inspector="true">
      <span
        className={styles.appearanceSubheading}
        data-powershow-blocks-categories={element.categories.length}
      >
        {t("inspector.blocks.categories")}
      </span>

      <ul className={styles.blocksList}>
        {element.categories.map((category) => {
          const categoryInUse = isBlockCategoryUsed(element, category.id);

          const removeTitle = categoryInUse
            ? t("inspector.blocks.categoryInUse")
            : t("inspector.blocks.removeCategory");

          return (
            <li
              key={category.id}
              className={styles.blocksCategoryRow}
              data-powershow-block-category-id={category.id}
            >
              <input
                className={styles.blocksInput}
                data-powershow-block-category-name="true"
                type="text"
                value={category.name}
                aria-label={t("inspector.blocks.categoryName")}
                onChange={(event) => {
                  renameCategory(category.id, event.currentTarget.value);
                }}
              />

              <input
                className={styles.blocksColorInput}
                data-powershow-block-category-color="true"
                type="color"
                value={colorToPickerHex(category.color) ?? "#6366f1"}
                aria-label={t("inspector.blocks.categoryColor")}
                title={t("inspector.blocks.categoryColor")}
                onChange={(event) => {
                  setCategoryColor(category.id, event.currentTarget.value);
                }}
              />

              <button
                type="button"
                className={styles.secondaryButton}
                data-powershow-block-category-remove="true"
                title={removeTitle}
                aria-label={removeTitle}
                disabled={categoryInUse}
                onClick={() => {
                  removeCategory(category.id);
                }}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className={styles.secondaryButton}
        data-powershow-block-add-category="true"
        onClick={addCategory}
      >
        <span>{t("inspector.blocks.addCategory")}</span>
      </button>

      <span
        className={styles.appearanceSubheading}
        data-powershow-blocks-count={element.items.length}
      >
        {t("inspector.blocks.blocks")}
      </span>

      <button
        type="button"
        className={styles.secondaryButton}
        data-powershow-block-add="true"
        onClick={addRootBlock}
      >
        <span>{t("inspector.blocks.add")}</span>
      </button>

      {element.items.length === 0 ? (
        <small className={styles.fieldHint}>
          <span>{t("inspector.blocks.empty")}</span>
        </small>
      ) : (
        <BlocksItemEditor
          element={element}
          onUpdate={onUpdate}
          blocksAuthoringControls={blocksAuthoringControls}
          labels={labels}
        />
      )}
    </div>
  );
}

// ============================================================
// END: BLOCKS CONTENT SECTION
// ============================================================
