import type { BlocksElement } from "@powershow/document-schema";
import { parseBlocksSource } from "@powershow/renderer";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";
import type { ElementInspectorUpdate } from "../inspector-types";

interface BlocksContentSectionProps {
  element: BlocksElement;

  onUpdate: ElementInspectorUpdate;

}

export function BlocksContentSection({
  element,
  onUpdate,
}: BlocksContentSectionProps) {
  const { t } = useStudioI18n();
  const parsed = parseBlocksSource(element.source);

  return (
    <div data-powershow-blocks-inspector="true">
      <label className={styles.field}>
        <span>{t("inspector.blocks.source")}</span>
        <textarea
          value={element.source}
          onChange={(event) => onUpdate((current) => (
            current.type === "blocks" && current.source !== event.target.value
              ? { ...current, source: event.target.value }
              : current
          ))}
          rows={8}
          data-powershow-blocks-source="true"
        />
      </label>
      {parsed.ok ? (
        <div role="status" data-powershow-blocks-syntax="valid" className={styles.fieldHint}>
          {t("inspector.blocks.syntaxValid")}
        </div>
      ) : (
        <div role="alert" data-powershow-blocks-syntax="invalid" className={styles.fieldHint}>
          {t("inspector.blocks.syntaxInvalid", {
            line: parsed.error.line,
            column: parsed.error.column,
            message: parsed.error.message,
          })}
        </div>
      )}
    </div>
  );
}
