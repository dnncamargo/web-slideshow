import type { ImageElement } from "@web-slideshow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";
import { useAuthoringHistory } from "../../authoring-history-context";

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
type CropField = ImageCropField;

const numberHistoryMeta = { kind: "number.change", labelKey: "history.number.change" } as const;

function areCropsEqual(left: Crop, right: Crop): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }

  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;
}

function areFocalPointsEqual(
  left: ImageElement["focalPoint"],
  right: ImageElement["focalPoint"],
): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }

  return left.x === right.x && left.y === right.y;
}

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
  const authoringHistory = useAuthoringHistory();
  const crop = getEffectiveImageCrop(authoredCrop);

  function updateCropField(field: CropField, rawValue: string): void {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;

    const nextCrop = updateImageCropField(authoredCrop, field, value);
    if (areCropsEqual(authoredCrop, nextCrop)) return;

    const update = () => onCropChange(nextCrop);
    if (!authoringHistory) {
      update();
      return;
    }

    const historyKey = `number:${idPrefix}-crop-${field}`;
    authoringHistory.begin(historyKey, numberHistoryMeta);
    authoringHistory.update(historyKey, update);
  }

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
                onFocus={() => authoringHistory?.begin(`number:${idPrefix}-crop-${field}`, numberHistoryMeta)}
                onBlur={() => authoringHistory?.finish(`number:${idPrefix}-crop-${field}`)}
                onChange={(event) => updateCropField(field, event.target.value)}
              />
              <span>%</span>
            </div>
          </label>
        ))}
      </div>

      <small className={styles.fieldHint}><span>{t("image.cropHelp")}</span></small>

      <button
        className={styles.secondaryButton}
        type="button"
        disabled={!isImageCropResetAvailable(authoredCrop)}
        onClick={() => {
          if (!isImageCropResetAvailable(authoredCrop)) return;
          const callback = () => onResetCrop();
          if (authoringHistory) {
            authoringHistory.discrete(
              { kind: "element.setting", labelKey: "history.element.setting", labelParams: { setting: "media.crop" } },
              callback,
            );
          } else {
            callback();
          }
        }}
      >
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
  const authoringHistory = useAuthoringHistory();
  const focalPoint = getEffectiveImageFocalPoint(authoredFocalPoint);
  const activeFocalPreset = getImageFocalPointPresetIndex(focalPoint);

  function updateFocalPoint(axis: "x" | "y", rawValue: string): void {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;

    const nextFocalPoint = updateImageFocalPoint(authoredFocalPoint, axis, value);
    if (areFocalPointsEqual(authoredFocalPoint, nextFocalPoint)) return;

    const update = () => onFocalPointChange(nextFocalPoint);
    if (!authoringHistory) {
      update();
      return;
    }

    const historyKey = `number:${idPrefix}-focal-${axis}`;
    authoringHistory.begin(historyKey, numberHistoryMeta);
    authoringHistory.update(historyKey, update);
  }

  return (
    <div className={styles.field}>
      <span title={t("image.focalPointHelp")}>{t("image.focalPoint")}</span>
      <div className={styles.imageFocalPresetGrid}>
        {IMAGE_FOCAL_POINT_PRESETS.map((preset, index) => (
          <button
            key={`${preset.x}-${preset.y}`}
            className={activeFocalPreset === index ? `${styles.imageFocalPreset} ${styles.imageFocalPresetActive}` : styles.imageFocalPreset}
            type="button"
            aria-label={t(FOCAL_PRESET_LABEL_KEYS[index]!)}
            aria-pressed={activeFocalPreset === index}
            onClick={() => {
              if (authoredFocalPoint?.x === preset.x && authoredFocalPoint.y === preset.y) return;
              const callback = () => onFocalPointChange(preset);
              if (authoringHistory) {
                authoringHistory.discrete(
                  { kind: "element.setting", labelKey: "history.element.setting", labelParams: { setting: "media.focalPoint" } },
                  callback,
                );
              } else {
                callback();
              }
            }}
          />
        ))}
      </div>
      <div className={styles.fieldGrid}>
        {(["x", "y"] as const).map((axis) => (
          <label className={styles.field} key={axis}>
            <span>{axis.toUpperCase()}</span>
            <div className={styles.unitInput}>
              <input id={`${idPrefix}-focal-${axis}`} name={`${idPrefix}Focal${axis.toUpperCase()}`} type="number" min="0" max="100" value={focalPoint[axis]} onFocus={() => authoringHistory?.begin(`number:${idPrefix}-focal-${axis}`, numberHistoryMeta)} onBlur={() => authoringHistory?.finish(`number:${idPrefix}-focal-${axis}`)} onChange={(event) => updateFocalPoint(axis, event.target.value)} />
              <span>%</span>
            </div>
          </label>
        ))}
      </div>
      <button
        className={styles.secondaryButton}
        type="button"
        disabled={!isImageFocalPointResetAvailable(authoredFocalPoint)}
        onClick={() => {
          if (!isImageFocalPointResetAvailable(authoredFocalPoint)) return;
          const callback = () => onResetFocalPoint();
          if (authoringHistory) {
            authoringHistory.discrete(
              { kind: "element.setting", labelKey: "history.element.setting", labelParams: { setting: "media.focalPoint" } },
              callback,
            );
          } else {
            callback();
          }
        }}
      >
        {t("image.resetFocalPoint")}
      </button>
      {canvasEdit && <button className={styles.secondaryButton} type="button" onClick={() => canvasEdit.onEditingChange(!canvasEdit.editing)}>{t(canvasEdit.editing ? "image.doneFocalPoint" : "image.editFocalPointOnCanvas")}</button>}
    </div>
  );
}
