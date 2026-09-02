import type { BlocksElement } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

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
// The CONTENT section owns the root-block creation affordance and the
// recursive block item
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
    color: t("inspector.blocks.color"),
    shape: t("inspector.blocks.shape"),
    statement: t("inspector.blocks.statement"),
    start: t("inspector.blocks.start"),
    scope: t("inspector.blocks.scope"),
    end: t("inspector.blocks.end"),
    value: t("inspector.blocks.value"),
    logic: t("inspector.blocks.logic"),
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
    socketLogic: t("inspector.blocks.logicBlock"),
    literalValue: t("inspector.blocks.literalValue"),
    valueAtMaxDepth: t("inspector.blocks.maxDepth"),
    textPartLabel: t("inspector.blocks.text"),
  };

  function addRootBlock() {
    blocksAuthoringControls.onAddRootBlock(element.id);
  }

  return (
    <div data-powershow-blocks-inspector="true">
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
