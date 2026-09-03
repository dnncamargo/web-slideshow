import type { BlocksElement } from "@powershow/document-schema";

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

  return (
    <div data-powershow-blocks-inspector="true">
      <label className={styles.field}>
        <span>{t("inspector.blocks.parts")}</span>
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
    </div>
  );
}
