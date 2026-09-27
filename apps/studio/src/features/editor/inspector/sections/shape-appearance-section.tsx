import { useState } from "react";

import type {
  ShapeElement,
  ShapeFill,
  ShapeVisualStyle,
} from "@web-slideshow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";
import { useAuthoringHistory } from "../../authoring-history-context";
import { DEFAULT_SHAPE_FILL_COLOR } from "../../shape-defaults";
import { getControlName } from "../inspector-helpers";
import { InspectorSection } from "../inspector-section";
import { ColorControl } from "./color-control";
import { ElementBorderControl } from "./element-border-control";
import { EffectiveLengthInput } from "./effective-length-input";
import {
  createDefaultGradient,
  ElementGradientControl,
} from "./element-gradient-control";
import { ImageCropControl, ImageFocalPointControl } from "./image-crop-control";

const DEFAULT_SHAPE_IMAGE_SOURCE = "/instance-demo.svg";
const SOURCE_HISTORY_META = { kind: "text.edit", labelKey: "history.text.edit" } as const;

type FillSelection = "none" | ShapeFill["type"];
type ShapeImageFill = Extract<ShapeFill, { type: "image" }>;

interface ShapeAppearanceSectionProps {
  elementId: string;
  style: ShapeElement["style"];
  onUpdateStyle: (
    update: (style: ShapeElement["style"]) => ShapeElement["style"],
  ) => void;
}

function normalizeStyle(style: ShapeVisualStyle | undefined): ShapeVisualStyle | undefined {
  if (style === undefined || (style.fill === undefined && style.stroke === undefined && style.borderRadius === undefined)) {
    return undefined;
  }

  return style;
}

function fillSelection(fill: ShapeFill | undefined): FillSelection {
  return fill?.type ?? "none";
}

function isImageFill(fill: ShapeFill | undefined): fill is ShapeImageFill {
  return fill?.type === "image";
}

export function ShapeAppearanceSection({
  elementId,
  style,
  onUpdateStyle,
}: ShapeAppearanceSectionProps) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const fill = style?.fill;
  const imageFill = isImageFill(fill) ? fill : undefined;
  const sourceHistoryKey = `text:shape-${elementId}-fill-src`;
  const [sourceDraft, setSourceDraft] = useState(imageFill?.src ?? "");
  const [hydratedSource, setHydratedSource] = useState({
    elementId,
    fillType: fill?.type,
    source: imageFill?.src,
  });

  if (
    hydratedSource.elementId !== elementId ||
    hydratedSource.fillType !== fill?.type ||
    hydratedSource.source !== imageFill?.src
  ) {
    setHydratedSource({ elementId, fillType: fill?.type, source: imageFill?.src });
    setSourceDraft(imageFill?.src ?? "");
  }

  function updateNormalizedStyle(
    update: (current: ShapeVisualStyle | undefined) => ShapeVisualStyle | undefined,
  ): void {
    onUpdateStyle((current) => normalizeStyle(update(current)));
  }

  function runDiscrete(setting: string, callback: () => void): void {
    const meta = {
      kind: "element.setting",
      labelKey: "history.element.setting",
      labelParams: { setting },
    } as const;

    if (authoringHistory) {
      authoringHistory.discrete(meta, callback);
    } else {
      callback();
    }
  }

  function setFill(nextFill: ShapeFill | undefined): void {
    if (fill?.type === nextFill?.type) {
      return;
    }

    runDiscrete("shape.fill", () => updateNormalizedStyle((current) => ({ ...current, fill: nextFill })));
  }

  function updateImageFill(update: (current: ShapeImageFill) => ShapeImageFill): void {
    updateNormalizedStyle((current) => {
      if (current === undefined || !isImageFill(current.fill)) {
        return current;
      }

      return { ...current, fill: update(current.fill) };
    });
  }

  function updateImageSource(value: string): void {
    setSourceDraft(value);
    if (value.length === 0) {
      return;
    }

    const update = () => updateImageFill((current) => ({ ...current, src: value }));
    if (!authoringHistory) {
      update();
      return;
    }

    authoringHistory.begin(sourceHistoryKey, SOURCE_HISTORY_META);
    authoringHistory.update(sourceHistoryKey, update);
  }

  return (
    <InspectorSection title={t("inspector.appearance")}>
      <label className={styles.field}>
        <span>{t("inspector.fill")}</span>
        <select
          id="shape-fill-type"
          name={getControlName("shape", "FillType")}
          value={fillSelection(fill)}
          onChange={(event) => {
            const selection = event.target.value as FillSelection;
            if (selection === "none") {
              setFill(undefined);
            } else if (selection === "color") {
              setFill(fill?.type === "color" ? fill : { type: "color", color: DEFAULT_SHAPE_FILL_COLOR });
            } else if (selection === "gradient") {
              setFill({ type: "gradient", gradient: createDefaultGradient("linear") });
            } else if (selection === "image") {
              setFill({ type: "image", src: DEFAULT_SHAPE_IMAGE_SOURCE, fit: "contain" });
            }
          }}
        >
          <option value="none">{t("inspector.none")}</option>
          <option value="color">{t("inspector.color")}</option>
          <option value="gradient">{t("inspector.gradient")}</option>
          <option value="image">{t("element.image")}</option>
        </select>
      </label>

      {fill?.type === "color" && (
        <label className={styles.field}>
          <span>{t("inspector.color")}</span>
          <ColorControl
            id="shape-fill-color"
            name={getControlName("shape", "FillColor")}
            value={fill.color}
            onChange={(color) => updateNormalizedStyle((current) => ({ ...current, fill: { type: "color", color } }))}
          />
        </label>
      )}

      {fill?.type === "gradient" && (
        <ElementGradientControl
          gradient={fill.gradient}
          controlPrefix="shape-fill"
          allowNone={false}
          onChange={(gradient) => {
            if (gradient !== undefined) {
              updateNormalizedStyle((current) => ({ ...current, fill: { type: "gradient", gradient } }));
            }
          }}
        />
      )}

      {imageFill !== undefined && (
        <>
          <label className={styles.field}>
            <span>{t("inspector.source")}</span>
            <textarea
              id="shape-fill-source"
              name="shapeFillSource"
              className={styles.textArea}
              rows={3}
              spellCheck={false}
              value={sourceDraft}
              onFocus={() => authoringHistory?.begin(sourceHistoryKey, SOURCE_HISTORY_META)}
              onBlur={() => {
                if (sourceDraft.length === 0) {
                  setSourceDraft(imageFill.src);
                }
                authoringHistory?.finish(sourceHistoryKey);
              }}
              onChange={(event) => updateImageSource(event.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span>{t("image.fit")}</span>
            <select
              id="shape-fill-fit"
              name="shapeFillFit"
              value={imageFill.fit}
              onChange={(event) => {
                const fit = event.target.value as ShapeImageFill["fit"];
                if (fit === imageFill.fit) return;
                runDiscrete("shape.fill.fit", () => updateImageFill((current) => ({ ...current, fit })));
              }}
            >
              <option value="contain">{t("image.contain")}</option>
              <option value="cover">{t("image.cover")}</option>
              <option value="fill">{t("image.fill")}</option>
            </select>
          </label>

          <ImageCropControl
            crop={imageFill.crop}
            idPrefix="shape-fill"
            onCropChange={(crop) => updateImageFill((current) => crop === undefined ? (() => { const next = { ...current }; delete next.crop; return next; })() : { ...current, crop })}
            onResetCrop={() => updateImageFill((current) => { const next = { ...current }; delete next.crop; return next; })}
          />
          <ImageFocalPointControl
            focalPoint={imageFill.focalPoint}
            idPrefix="shape-fill"
            onFocalPointChange={(focalPoint) => updateImageFill((current) => focalPoint === undefined ? (() => { const next = { ...current }; delete next.focalPoint; return next; })() : { ...current, focalPoint })}
            onResetFocalPoint={() => updateImageFill((current) => { const next = { ...current }; delete next.focalPoint; return next; })}
          />
        </>
      )}

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label htmlFor="shape-border-radius" title={t("inspector.roundedCornersHelp")}>
            {t("inspector.roundedCorners")}
          </label>
          <EffectiveLengthInput
            id="shape-border-radius"
            name="shapeBorderRadius"
            min="0"
            value={style?.borderRadius}
            preferredUnit="px"
            units={["px", "rem"]}
            stepByUnit={{ px: "1", rem: "0.1" }}
            onChange={(borderRadius) => updateNormalizedStyle((current) => ({ ...current, borderRadius }))}
            onReset={() => updateNormalizedStyle((current) => ({ ...current, borderRadius: undefined }))}
          />
        </div>
      </div>

      <ElementBorderControl
        border={style?.stroke}
        controlPrefix="shape"
        onChange={(stroke) => updateNormalizedStyle((current) => ({ ...current, stroke }))}
      />
    </InspectorSection>
  );
}
