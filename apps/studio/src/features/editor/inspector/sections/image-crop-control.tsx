import type { ImageElement } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import {
  getEffectiveImageCrop,
  isImageCropResetAvailable,
  updateImageCropField,
  type ImageCropField,
} from "./image-crop-helpers";
import {
  getEffectiveImageFocalPoint,
  getImageFocalPointPresetIndex,
  IMAGE_FOCAL_POINT_PRESETS,
  isImageFocalPointResetAvailable,
  updateImageFocalPoint,
} from "./image-focal-point-helpers";

type Crop = ImageElement["crop"];

interface ImageCropControlProps {
  crop: Crop;
  onCropChange: (crop: Crop) => void;
  onResetCrop: () => void;
  idPrefix: string;
  canvasEdit?: {
    editing: boolean;
    onEditingChange: (editing: boolean) => void;
  };
}

export function ImageCropControl({
  crop: authoredCrop,
  onCropChange,
  onResetCrop,
  idPrefix,
  canvasEdit,
}: ImageCropControlProps) {
  const { t } = useStudioI18n();
  const crop = getEffectiveImageCrop(authoredCrop);

  return (
    <div className={styles.field}>
      <span title={t("image.cropHelp")}>{t("image.crop")}</span>

      <div className={styles.fieldGrid}>
        {(["x", "y", "width", "height"] as const).map((field: ImageCropField) => (
          <label className={styles.field} key={field}>
            <span>
              {field === "x" ? "X" : field === "y" ? "Y" : t(`inspector.${field}`)}
            </span>
            <div className={styles.unitInput}>
              <input
                id={`${idPrefix}-crop-${field}`}
                name={`${idPrefix}Crop${field[0]!.toUpperCase()}${field.slice(1)}`}
                type="number"
                min={field === "x" || field === "y" ? "0" : "1"}
                max={field === "x" || field === "y" ? "99" : String(100 - crop[field === "width" ? "x" : "y"])}
                step="1"
                value={crop[field]}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) onCropChange(updateImageCropField(authoredCrop, field, value));
                }}
              />
              <span>%</span>
            </div>
          </label>
        ))}
      </div>

      <small className={styles.fieldHint}><span>{t("image.cropHelp")}</span></small>

      <button className={styles.secondaryButton} type="button" disabled={!isImageCropResetAvailable(authoredCrop)} onClick={onResetCrop}>
        {t("image.resetCrop")}
      </button>

      {canvasEdit && (
        <button className={styles.secondaryButton} type="button" onClick={() => canvasEdit.onEditingChange(!canvasEdit.editing)}>
          {t(canvasEdit.editing ? "image.doneCrop" : "image.editCropOnCanvas")}
        </button>
      )}
    </div>
  );
}

interface ImageFocalPointControlProps {
  focalPoint: ImageElement["focalPoint"];
  onFocalPointChange: (focalPoint: ImageElement["focalPoint"]) => void;
  onResetFocalPoint: () => void;
  idPrefix: string;
  canvasEdit?: {
    editing: boolean;
    onEditingChange: (editing: boolean) => void;
  };
}

const FOCAL_PRESET_LABEL_KEYS = [
  "inspector.anchor.top-left", "inspector.anchor.top", "inspector.anchor.top-right",
  "inspector.anchor.left", "inspector.anchor.center", "inspector.anchor.right",
  "inspector.anchor.bottom-left", "inspector.anchor.bottom", "inspector.anchor.bottom-right",
] as const;

export function ImageFocalPointControl({
  focalPoint: authoredFocalPoint,
  onFocalPointChange,
  onResetFocalPoint,
  idPrefix,
  canvasEdit,
}: ImageFocalPointControlProps) {
  const { t } = useStudioI18n();
  const focalPoint = getEffectiveImageFocalPoint(authoredFocalPoint);
  const activeFocalPreset = getImageFocalPointPresetIndex(focalPoint);

  return (
    <div className={styles.field}>
      <span title={t("image.focalPointHelp")}>{t("image.focalPoint")}</span>
      <div className={styles.imageFocalPresetGrid}>
        {IMAGE_FOCAL_POINT_PRESETS.map((preset, index) => (
          <button key={`${preset.x}-${preset.y}`} className={activeFocalPreset === index ? `${styles.imageFocalPreset} ${styles.imageFocalPresetActive}` : styles.imageFocalPreset} type="button" aria-label={t(FOCAL_PRESET_LABEL_KEYS[index]!)} aria-pressed={activeFocalPreset === index} onClick={() => onFocalPointChange(preset)} />
        ))}
      </div>
      <div className={styles.fieldGrid}>
        {(["x", "y"] as const).map((axis) => (
          <label className={styles.field} key={axis}>
            <span>{axis.toUpperCase()}</span>
            <div className={styles.unitInput}>
              <input id={`${idPrefix}-focal-${axis}`} name={`${idPrefix}Focal${axis.toUpperCase()}`} type="number" min="0" max="100" value={focalPoint[axis]} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) onFocalPointChange(updateImageFocalPoint(authoredFocalPoint, axis, value)); }} />
              <span>%</span>
            </div>
          </label>
        ))}
      </div>
      <button className={styles.secondaryButton} type="button" disabled={!isImageFocalPointResetAvailable(authoredFocalPoint)} onClick={onResetFocalPoint}>{t("image.resetFocalPoint")}</button>
      {canvasEdit && <button className={styles.secondaryButton} type="button" onClick={() => canvasEdit.onEditingChange(!canvasEdit.editing)}>{t(canvasEdit.editing ? "image.doneFocalPoint" : "image.editFocalPointOnCanvas")}</button>}
    </div>
  );
}
