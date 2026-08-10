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

type ImageElement = Extract<PowerShowElement, { type: "image" }>;

// ============================================================
// BEGIN: IMAGE INSPECTOR
// ============================================================

export function ImageInspector({
  element,
  onUpdate,
}: TypedInspectorProps<ImageElement>) {
  const { t } = useStudioI18n();

  const updateStyle: UpdateElementStyle = (update) => {
    onUpdate((current) => {
      if (current.type !== "image") {
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

      <InspectorSection title={t("inspector.source")} defaultOpen>
        <label className={styles.field}>
          <span>{t("inspector.source")}</span>

          <textarea
            id="image-src"
            name="imageSrc"
            className={styles.textArea}
            rows={3}
            spellCheck={false}
            value={element.src}
            onChange={(event) => {
              const src = event.target.value;

              onUpdate((current) => {
                if (current.type !== "image") {
                  return current;
                }

                return {
                  ...current,

                  src,
                };
              });
            }}
          />

          <small className={styles.fieldHint}>
            <span>{t("image.sourceHint")}</span>
          </small>
        </label>

        <label className={styles.field}>
          <span>{t("image.alternativeText")}</span>

          <textarea
            id="image-alt"
            name="imageAlt"
            className={styles.textArea}
            rows={3}
            value={element.alt}
            onChange={(event) => {
              const alt = event.target.value;

              onUpdate((current) => {
                if (current.type !== "image") {
                  return current;
                }

                return {
                  ...current,

                  alt,
                };
              });
            }}
          />
        </label>

        <label className={styles.field}>
          <span>{t("image.fit")}</span>

          <select
            id="image-fit"
            name="imageFit"
            value={element.fit}
            onChange={(event) => {
              const fit = event.target.value as ImageElement["fit"];

              onUpdate((current) => {
                if (current.type !== "image") {
                  return current;
                }

                return {
                  ...current,

                  fit,
                };
              });
            }}
          >
            <option value="contain">{t("image.contain")}</option>

            <option value="cover">{t("image.cover")}</option>

            <option value="fill">{t("image.fill")}</option>
          </select>
        </label>
      </InspectorSection>

      <ElementAppearanceSection
        style={element.style}
        onUpdateStyle={updateStyle}
        controlPrefix="image"
        showRoundedCorners
        showOpacity
        showBorder
      />

      <ElementEffectsSection
        style={element.style}
        onUpdateStyle={updateStyle}
        controlPrefix="image"
      />
    </>
  );
}

// ============================================================
// END: IMAGE INSPECTOR
// ============================================================
