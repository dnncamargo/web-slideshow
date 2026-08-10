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

type TextElement = Extract<PowerShowElement, { type: "text" }>;

// ============================================================
// BEGIN: TEXT INSPECTOR
// ============================================================

export function TextInspector({
  element,
  onUpdate,
}: TypedInspectorProps<TextElement>) {
  const { t } = useStudioI18n();

  const updateStyle: UpdateElementStyle = (update) => {
    onUpdate((current) => {
      if (current.type !== "text") {
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
            id="text-content"
            name="textContent"
            className={styles.textArea}
            rows={5}
            value={element.content}
            onChange={(event) => {
              const content = event.target.value;

              onUpdate((current) => {
                if (current.type !== "text") {
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

        <label className={styles.field}>
          <span>{t("inspector.style")}</span>

          <select
            id="text-variant"
            name="textVariant"
            value={element.variant}
            onChange={(event) => {
              const variant = event.target.value as TextElement["variant"];

              onUpdate((current) => {
                if (current.type !== "text") {
                  return current;
                }

                return {
                  ...current,

                  variant,
                };
              });
            }}
          >
            <option value="title">{t("inspector.titleField")}</option>

            <option value="subtitle">{t("inspector.subtitle")}</option>

            <option value="body">{t("inspector.body")}</option>

            <option value="caption">{t("inspector.caption")}</option>
          </select>
        </label>
      </InspectorSection>

      <ElementAppearanceSection
        style={element.style}
        onUpdateStyle={updateStyle}
        controlPrefix="text"
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
        controlPrefix="text"
      />
    </>
  );
}

// ============================================================
// END: TEXT INSPECTOR
// ============================================================
