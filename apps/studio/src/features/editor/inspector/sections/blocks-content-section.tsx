import type { BlockItem, BlocksElement } from "@powershow/document-schema";
import { colorToPickerHex } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import type { StudioMessageKey } from "@/features/i18n/studio-i18n";

import styles from "../../editor-workspace.module.css";

import {
  addBlockCategory,
  isBlockCategoryUsed,
  removeBlockCategory,
  renameBlockCategory,
  setBlockCategoryColor,
} from "../../element-operations";

import type {
  BlocksAuthoringControls,
  ElementInspectorUpdate,
} from "../inspector-types";

interface BlocksContentSectionProps {
  element: BlocksElement;

  onUpdate: ElementInspectorUpdate;

  blocksAuthoringControls: BlocksAuthoringControls;
}

const SHAPE_LABEL_KEYS: Record<BlockItem["shape"], StudioMessageKey> = {
  statement: "inspector.blocks.statement",
  scope: "inspector.blocks.scope",
  value: "inspector.blocks.value",
};

const FALLBACK_CATEGORY_COLOR = "#64748b";

function firstTextPartLabel(item: BlockItem): string | null {
  for (const part of item.parts) {
    if (part.type === "text") {
      return part.text;
    }
  }

  return null;
}

// ============================================================
// BEGIN: BLOCKS CONTENT SHELL
//
// R2-B owns the outer CONTENT shell only: local category
// management and the root-block creation affordance. Detailed
// recursive BlockItem editing is delivered by a later checkpoint
// and must not be anticipated here.
// ============================================================

export function BlocksContentSection({
  element,
  onUpdate,
  blocksAuthoringControls,
}: BlocksContentSectionProps) {
  const { t } = useStudioI18n();

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
        <ul className={styles.blocksList}>
          {element.items.map((item) => {
            const category = element.categories.find(
              (candidate) => candidate.id === item.categoryId,
            );

            return (
              <li
                key={item.id}
                className={styles.blocksRow}
                data-powershow-block-root={item.id}
              >
                <span className={styles.blocksRootSummary}>
                  <span
                    className={styles.blocksCategoryChip}
                    style={{
                      backgroundColor:
                        category?.color ?? FALLBACK_CATEGORY_COLOR,
                    }}
                    aria-hidden="true"
                  />

                  <span className={styles.blocksRootLabel}>
                    {firstTextPartLabel(item) ?? t("inspector.blocks.socketEmpty")}
                  </span>

                  <small className={styles.blocksRootHint}>
                    {t(SHAPE_LABEL_KEYS[item.shape])}
                  </small>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ============================================================
// END: BLOCKS CONTENT SHELL
// ============================================================