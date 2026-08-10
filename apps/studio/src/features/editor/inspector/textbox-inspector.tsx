import type { PowerShowElement } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { readPickerColor } from "./inspector-helpers";

import { InspectorSection } from "./inspector-section";

import type { TypedInspectorProps } from "./inspector-types";

type TextboxElement = Extract<PowerShowElement, { type: "textbox" }>;

// ============================================================
// BEGIN: TEXTBOX INSPECTOR
// ============================================================

export function TextboxInspector({
  element,
  onUpdate,
}: TypedInspectorProps<TextboxElement>) {
  const { t } = useStudioI18n();

  return (
    <>
      <div className={styles.inspectorDivider} />

      <InspectorSection title={t("inspector.content")} defaultOpen>
        <label className={styles.field}>
          <span>{t("inspector.text")}</span>

          <textarea
            id="textbox-content"
            name="textboxContent"
            className={styles.textArea}
            rows={7}
            value={element.content}
            onChange={(event) => {
              const content = event.target.value;

              onUpdate((current) => {
                if (current.type !== "textbox") {
                  return current;
                }

                return {
                  ...current,

                  content,
                };
              });
            }}
          />
        </label>

        <div className={styles.colorControl}>
          <label className={styles.field}>
            <span>{t("inspector.color")}</span>

            <input
              id="textbox-color"
              name="textboxColor"
              className={styles.colorInput}
              type="color"
              value={readPickerColor(element.style?.color)}
              onChange={(event) => {
                const color = event.target.value;

                onUpdate((current) => {
                  if (current.type !== "textbox") {
                    return current;
                  }

                  return {
                    ...current,

                    style: {
                      ...current.style,

                      color,
                    },
                  };
                });
              }}
            />
          </label>

          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              onUpdate((current) => {
                if (current.type !== "textbox") {
                  return current;
                }

                return {
                  ...current,

                  style: {
                    ...current.style,

                    color: undefined,
                  },
                };
              });
            }}
          >
            <span>{t("inspector.useThemeDefault")}</span>
          </button>
        </div>
      </InspectorSection>
    </>
  );
}

// ============================================================
// END: TEXTBOX INSPECTOR
// ============================================================
