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

import { ImageSizeSection } from "./sections/image-size-section";
import {
  getEffectiveImageFocalPoint,
  getImageFocalPointPresetIndex,
  IMAGE_FOCAL_POINT_PRESETS,
  updateImageFocalPoint,
} from "./sections/image-focal-point-helpers";

type ImageElement = Extract<PowerShowElement, { type: "image" }>;

const FOCAL_PRESET_LABEL_KEYS = [
  "inspector.anchor.top-left",
  "inspector.anchor.top",
  "inspector.anchor.top-right",
  "inspector.anchor.left",
  "inspector.anchor.center",
  "inspector.anchor.right",
  "inspector.anchor.bottom-left",
  "inspector.anchor.bottom",
  "inspector.anchor.bottom-right",
] as const;

// ============================================================
// BEGIN: IMAGE INSPECTOR
// ============================================================

export function ImageInspector({
  element,
  onUpdate,
  preserveImageProportion,
  onPreserveImageProportionChange,
}: TypedInspectorProps<ImageElement> & {
  preserveImageProportion: boolean;
  onPreserveImageProportionChange: (value: boolean) => void;
}) {
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
  const focalPoint = getEffectiveImageFocalPoint(element.focalPoint);
  const activeFocalPreset = getImageFocalPointPresetIndex(focalPoint);
  const focalPointIsRelevant = element.fit === "cover";

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

        <div className={styles.field}>
          <span title={t("image.focalPointHelp")}>{t("image.focalPoint")}</span>

          <div className={styles.imageFocalPresetGrid} aria-disabled={!focalPointIsRelevant}>
            {IMAGE_FOCAL_POINT_PRESETS.map((preset, index) => (
              <button
                key={`${preset.x}-${preset.y}`}
                className={
                  activeFocalPreset === index
                    ? `${styles.imageFocalPreset} ${styles.imageFocalPresetActive}`
                    : styles.imageFocalPreset
                }
                type="button"
                disabled={!focalPointIsRelevant}
                aria-label={t(FOCAL_PRESET_LABEL_KEYS[index]!)}
                aria-pressed={activeFocalPreset === index}
                onClick={() => {
                  onUpdate((current) =>
                    current.type === "image"
                      ? { ...current, focalPoint: preset }
                      : current,
                  );
                }}
              />
            ))}
          </div>

          <div className={styles.fieldGrid}>
            {(["x", "y"] as const).map((axis) => (
              <label className={styles.field} key={axis}>
                <span>{axis.toUpperCase()}</span>
                <div className={styles.unitInput}>
                  <input
                    id={`image-focal-${axis}`}
                    name={`imageFocal${axis.toUpperCase()}`}
                    type="number"
                    min="0"
                    max="100"
                    disabled={!focalPointIsRelevant}
                    value={focalPoint[axis]}
                    onChange={(event) => {
                      const value = Number(event.target.value);

                      if (!Number.isFinite(value)) {
                        return;
                      }

                      onUpdate((current) =>
                        current.type === "image"
                          ? {
                              ...current,
                              focalPoint: updateImageFocalPoint(
                                current.focalPoint,
                                axis,
                                value,
                              ),
                            }
                          : current,
                      );
                    }}
                  />
                  <span>%</span>
                </div>
              </label>
            ))}
          </div>

          <button
            className={styles.secondaryButton}
            type="button"
            disabled={!focalPointIsRelevant || element.focalPoint === undefined}
            onClick={() => {
              onUpdate((current) =>
                current.type === "image"
                  ? { ...current, focalPoint: undefined }
                  : current,
              );
            }}
          >
            {t("image.resetFocalPoint")}
          </button>
        </div>
       </InspectorSection>

       <ImageSizeSection
         element={element}
         onUpdateStyle={updateStyle}
         preserveImageProportion={preserveImageProportion}
         onPreserveImageProportionChange={onPreserveImageProportionChange}
       />

       <ElementAppearanceSection
        element={element}
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
