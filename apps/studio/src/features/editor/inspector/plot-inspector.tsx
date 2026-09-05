import type { PlotElement } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";
import type { TypedInspectorProps } from "./inspector-types";

export function PlotInspector({
  element,
  onUpdate,
}: TypedInspectorProps<PlotElement>) {
  const { t } = useStudioI18n();

  return (
    <>
      <div className={styles.inspectorDivider} />

      <InspectorSection title={t("inspector.content")} defaultOpen>
        <label className={styles.field}>
          <span>{t("inspector.source")}</span>

          <textarea
            id="plot-source"
            name="plotSource"
            className={`${styles.textArea} ${styles.codeTextArea}`}
            rows={6}
            spellCheck={false}
            value={element.source}
            maxLength={4096}
            onChange={(event) => {
              const source = event.target.value;

              onUpdate((current) => {
                if (current.type !== "chart") {
                  return current;
                }

                return {
                  ...current,
                  source,
                };
              });
            }}
          />
        </label>

        <label className={styles.checkboxRow}>
          <input
            id="plot-fit-to-axes"
            name="plotFitToAxes"
            type="checkbox"
            checked={element.fitToAxes !== false}
            onChange={(event) => {
              onUpdate((current) => {
                if (current.type !== "chart") {
                  return current;
                }

                return {
                  ...current,
                  fitToAxes: event.target.checked,
                };
              });
            }}
          />
          <span>{t("inspector.fitToAxes")}</span>
        </label>
      </InspectorSection>
    </>
  );
}
