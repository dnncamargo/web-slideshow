import type {
  ElementEffect,
  ElementTypography,
  PowerShowElement,
  TextVisualStyle,
} from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";

import type {
  TypographyInspectorProps,
} from "./inspector-types";

import { CanonicalTextAppearanceSection } from "./sections/canonical-text-appearance-section";

import { ElementInteractionSection } from "./sections/element-interaction-section";

import { CanonicalTextEffectsSection } from "./sections/canonical-text-effects-section";

type TextboxElement = Extract<PowerShowElement, { type: "textbox" }>;

// ============================================================
// BEGIN: TEXTBOX INSPECTOR
// ============================================================

export function TextboxInspector({
  element,
  onUpdate,
  fontResourceControls,
}: TypographyInspectorProps<TextboxElement>) {
  const { t } = useStudioI18n();

  const updateStyle = (update: (style: TextVisualStyle | undefined) => TextVisualStyle) => {
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

  const updateTypography = (update: (value: ElementTypography | undefined) => ElementTypography) => {
    onUpdate((current) => current.type === "textbox" ? { ...current, typography: update(current.typography) } : current);
  };

  const updateEffect = (update: (value: ElementEffect | undefined) => ElementEffect) => {
    onUpdate((current) => current.type === "textbox" ? { ...current, effect: update(current.effect) } : current);
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

      <ElementInteractionSection
        element={element}
        onUpdate={onUpdate}
        controlPrefix="textbox"
      />

      <CanonicalTextAppearanceSection
        element={element}
        style={element.style}
        typography={element.typography}
        effect={element.effect}
        onUpdateStyle={updateStyle}
        onUpdateTypography={updateTypography}
        onUpdateEffect={updateEffect}
        controlPrefix="textbox"
        fontResourceControls={fontResourceControls}
      />

      <CanonicalTextEffectsSection
        effect={element.effect}
        typography={element.typography}
        textColor={element.style?.color}
        onUpdateEffect={updateEffect}
        onUpdateTypography={updateTypography}
        controlPrefix="textbox"
      />
    </>
  );
}

// ============================================================
// END: TEXTBOX INSPECTOR
// ============================================================
