import type { PowerShowElement } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";

import type {
  TypedInspectorProps,
  UpdateElementStyle,
} from "./inspector-types";

import { ElementAppearanceSection } from "./sections/element-appearance-section";

import { ElementEffectsSection } from "./sections/element-effects-section";

type TextboxElement = Extract<PowerShowElement, { type: "textbox" }>;

// ============================================================
// BEGIN: TEXTBOX INSPECTOR
// ============================================================

export function TextboxInspector({
  element,
  onUpdate,
}: TypedInspectorProps<TextboxElement>) {
  const { t } = useStudioI18n();

  const updateStyle: UpdateElementStyle = (update) => {
    onUpdate((current) => {
      if (current.type !== "textbox") {
        return current;
      }

      return {
        ...current,

        style: update(current.style),
      };
    });
  };

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
      </InspectorSection>

      <ElementAppearanceSection
        style={element.style}
        onUpdateStyle={updateStyle}
        controlPrefix="textbox"
        showTypography
        showColor
        showBackground
        showBackgroundGradient
        showRoundedCorners
        showOpacity
        showBorder
      />

      <ElementEffectsSection
        style={element.style}
        onUpdateStyle={updateStyle}
        controlPrefix="textbox"
      />
    </>
  );
}

// ============================================================
// END: TEXTBOX INSPECTOR
// ============================================================
