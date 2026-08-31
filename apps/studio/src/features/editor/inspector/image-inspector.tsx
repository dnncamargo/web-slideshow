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
import { ImageCropControl, ImageFocalPointControl } from "./sections/image-crop-control";

type ImageElement = Extract<PowerShowElement, { type: "image" }>;

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

        <ImageCropControl crop={element.crop} idPrefix="image" onCropChange={(crop) => onUpdate((current) => current.type === "image" ? { ...current, crop } : current)} onResetCrop={() => onUpdate((current) => current.type === "image" ? { ...current, crop: undefined } : current)} canvasEdit={{ editing: cropEditing, onEditingChange: onCropEditingChange }} />
        <ImageFocalPointControl focalPoint={element.focalPoint} idPrefix="image" onFocalPointChange={(focalPoint) => onUpdate((current) => current.type === "image" ? { ...current, focalPoint } : current)} onResetFocalPoint={() => onUpdate((current) => current.type === "image" ? { ...current, focalPoint: undefined } : current)} canvasEdit={{ editing: focalEditing, onEditingChange: onFocalEditingChange }} />
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
