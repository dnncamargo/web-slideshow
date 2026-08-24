import type {
  ElementEffect,
  ImageVisualStyle,
  PowerShowElement,
} from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";

import { ElementInteractionSection } from "./sections/element-interaction-section";

import type { TypedInspectorProps } from "./inspector-types";

import { ImageSizeSection } from "./sections/image-size-section";
import { CanonicalImageAppearanceSection } from "./sections/canonical-image-appearance-section";
import { CanonicalImageEffectsSection } from "./sections/canonical-image-effects-section";
import {
  getEffectiveImageFocalPoint,
  getImageFocalPointPresetIndex,
  IMAGE_FOCAL_POINT_PRESETS,
  isImageFocalPointResetAvailable,
  updateImageFocalPoint,
} from "./sections/image-focal-point-helpers";
import {
  getEffectiveImageCrop,
  isImageCropResetAvailable,
  updateImageCropField,
} from "./sections/image-crop-helpers";

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
  focalEditing,
  onFocalEditingChange,
  cropEditing = false,
  onCropEditingChange = () => {},
}: TypedInspectorProps<ImageElement> & {
  preserveImageProportion: boolean;
  onPreserveImageProportionChange: (value: boolean) => void;
  focalEditing: boolean;
  onFocalEditingChange: (editing: boolean) => void;
  cropEditing?: boolean;
  onCropEditingChange?: (editing: boolean) => void;
}) {
  const { t } = useStudioI18n();

  const updateStyle = (
    update: (style: ImageVisualStyle | undefined) => ImageVisualStyle,
  ) => {
    onUpdate((current) => {
      if (current.type !== "image") {
        return current;
      }
      return { ...current, style: update(current.style) };
    });
  };

  const updateEffect = (
    update: (effect: ElementEffect | undefined) => ElementEffect,
  ) => {
    onUpdate((current) => {
      if (current.type !== "image") return current;
      return { ...current, effect: update(current.effect) };
    });
  };
  const focalPoint = getEffectiveImageFocalPoint(element.focalPoint);
  const crop = getEffectiveImageCrop(element.crop);
  const activeFocalPreset = getImageFocalPointPresetIndex(focalPoint);

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
          <span title={t("image.cropHelp")}>{t("image.crop")}</span>

          <div className={styles.fieldGrid}>
            {(["x", "y", "width", "height"] as const).map((field) => (
              <label className={styles.field} key={field}>
                <span>
                  {field === "x"
                    ? "X"
                    : field === "y"
                      ? "Y"
                      : t(`inspector.${field}`)}
                </span>
                <div className={styles.unitInput}>
                  <input
                    id={`image-crop-${field}`}
                    name={`imageCrop${field[0]!.toUpperCase()}${field.slice(1)}`}
                    type="number"
                    min={field === "x" || field === "y" ? "0" : "1"}
                    max={
                      field === "x" || field === "y"
                        ? "99"
                        : String(100 - crop[field === "width" ? "x" : "y"])
                    }
                    step="1"
                    value={crop[field]}
                    onChange={(event) => {
                      const value = Number(event.target.value);

                      if (!Number.isFinite(value)) {
                        return;
                      }

                      onUpdate((current) =>
                        current.type === "image"
                          ? {
                              ...current,
                              crop: updateImageCropField(
                                current.crop,
                                field,
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

          <small className={styles.fieldHint}>
            <span>{t("image.cropHelp")}</span>
          </small>

          <button
            className={styles.secondaryButton}
            type="button"
            disabled={!isImageCropResetAvailable(element.crop)}
            onClick={() => {
              onUpdate((current) =>
                current.type === "image"
                  ? { ...current, crop: undefined }
                  : current,
              );
            }}
          >
            {t("image.resetCrop")}
          </button>
        </div>

        <div className={styles.field}>
          <span title={t("image.focalPointHelp")}>{t("image.focalPoint")}</span>

          <div className={styles.imageFocalPresetGrid}>
            {IMAGE_FOCAL_POINT_PRESETS.map((preset, index) => (
              <button
                key={`${preset.x}-${preset.y}`}
                className={
                  activeFocalPreset === index
                    ? `${styles.imageFocalPreset} ${styles.imageFocalPresetActive}`
                    : styles.imageFocalPreset
                }
                type="button"
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
            disabled={!isImageFocalPointResetAvailable(element.focalPoint)}
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

          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              onCropEditingChange(!cropEditing);
            }}
          >
            {t(cropEditing ? "image.doneCrop" : "image.editCropOnCanvas")}
          </button>

          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              onFocalEditingChange(!focalEditing);
            }}
          >
            {t(focalEditing ? "image.doneFocalPoint" : "image.editFocalPointOnCanvas")}
          </button>
        </div>
       </InspectorSection>

       <ElementInteractionSection
         element={element}
         onUpdate={onUpdate}
         controlPrefix="image"
       />

       <ImageSizeSection
         element={element}
         onUpdateLayout={(update) => {
           onUpdate((current) =>
             current.type === "image"
               ? { ...current, layout: update(current.layout) }
               : current,
           );
         }}
         preserveImageProportion={preserveImageProportion}
         onPreserveImageProportionChange={onPreserveImageProportionChange}
       />

      <CanonicalImageAppearanceSection
        style={element.style}
        effect={element.effect}
        onUpdateStyle={updateStyle}
        onUpdateEffect={updateEffect}
      />

      <CanonicalImageEffectsSection
        effect={element.effect}
        onUpdateEffect={updateEffect}
      />
    </>
  );
}

// ============================================================
// END: IMAGE INSPECTOR
// ============================================================
