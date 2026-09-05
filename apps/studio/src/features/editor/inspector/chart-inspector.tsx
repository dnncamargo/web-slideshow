import type { ChartElement } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";
import type { TypedInspectorProps } from "./inspector-types";

export function ChartInspector({
  element,
  onUpdate,
}: TypedInspectorProps<ChartElement>) {
  const { t } = useStudioI18n();

  return (
    <>
      <div className={styles.inspectorDivider} />

      <InspectorSection title={t("inspector.content")} defaultOpen>
        <label className={styles.field}>
          <span>{t("inspector.source")}</span>

          <textarea
            id="chart-source"
            name="chartSource"
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
            id="chart-fit-to-axes"
            name="chartFitToAxes"
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
