import type { ElementEffect, ImageVisualStyle } from "@web-slideshow/document-schema";
import { resolveEffectiveElementStyleDefaults } from "@web-slideshow/theme/element-style-defaults";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";
import { getControlName, parseOptionalNumber } from "../inspector-helpers";
import { useAuthoringHistory } from "../../authoring-history-context";
import { InspectorSection } from "../inspector-section";
import { EffectiveLengthInput } from "./effective-length-input";
import { ElementBorderControl } from "./element-border-control";
import { ColorControl } from "./color-control";
import { ElementGradientControl } from "./element-gradient-control";

type BackgroundKey = "color" | "gradient";

function updateBackground(
  style: ImageVisualStyle | undefined,
  key: BackgroundKey,
  value: NonNullable<ImageVisualStyle["background"]>[BackgroundKey] | undefined,
): ImageVisualStyle {
  const background = { ...style?.background, [key]: value };
  if (background.color === undefined && background.gradient === undefined) {
    return { ...style, background: undefined };
  }
  return { ...style, background };
}

interface Props {
  style: ImageVisualStyle | undefined;
  effect: ElementEffect | undefined;
  onUpdateStyle: (update: (style: ImageVisualStyle | undefined) => ImageVisualStyle) => void;
  onUpdateEffect: (update: (effect: ElementEffect | undefined) => ElementEffect) => void;
}

function readOpacityPercentage(value: number | undefined): number {
  return value === undefined ? 100 : value * 100;
}

const numberHistoryMeta = { kind: "number.change", labelKey: "history.number.change" } as const;

export function CanonicalImageAppearanceSection({
  style,
  effect,
  onUpdateStyle,
  onUpdateEffect,
}: Props) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const effectiveDefaults = resolveEffectiveElementStyleDefaults({ type: "image" });
  const opacityHistoryKey = "number:image-opacity";
  const updateOpacity = (opacity: number | undefined) => {
    if (opacity === effect?.opacity) return;
    const update = () => onUpdateEffect((current) => ({ ...current, opacity }));
    if (!authoringHistory) {
      update();
      return;
    }
    authoringHistory.begin(opacityHistoryKey, numberHistoryMeta);
    authoringHistory.update(opacityHistoryKey, update);
  };

  return (
    <InspectorSection title={t("inspector.appearance")}>
      <div className={styles.colorControl}>
        <label className={styles.field}>
          <span title={t("inspector.backgroundHelp")}>{t("inspector.background")}</span>
          <ColorControl
            id="image-background"
            name={getControlName("image", "Background")}
            value={style?.background?.color}
            onChange={(color) => onUpdateStyle((current) => updateBackground(current, "color", color))}
            secondaryAction={{
              label: t("inspector.remove"),
              onClick: () => onUpdateStyle((current) => updateBackground(current, "color", undefined)),
            }}
          />
        </label>
      </div>
      <ElementGradientControl
        gradient={style?.background?.gradient}
        controlPrefix="image-background"
        onChange={(gradient) => onUpdateStyle((current) => updateBackground(current, "gradient", gradient))}
      />
      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label htmlFor="image-border-radius" title={t("inspector.roundedCornersHelp")}>
            {t("inspector.roundedCorners")}
          </label>
          <EffectiveLengthInput
            id="image-border-radius"
            name="imageBorderRadius"
            min="0"
            value={style?.borderRadius}
            inheritedValue={effectiveDefaults.borderRadius}
            preferredUnit="px"
            units={["px", "rem"]}
            stepByUnit={{ px: "1", rem: "0.1" }}
            onChange={(borderRadius) => onUpdateStyle((current) => ({ ...current, borderRadius }))}
            onReset={() => onUpdateStyle((current) => ({ ...current, borderRadius: undefined }))}
          />
        </div>

        <label className={styles.field}>
          <span title={t("inspector.opacityHelp")}>{t("inspector.opacity")}</span>
          <div className={styles.unitInput}>
            <input
              id="image-opacity"
              name="imageOpacity"
              type="number"
              min="0"
              max="100"
              value={readOpacityPercentage(effect?.opacity)}
              onFocus={() => authoringHistory?.begin(opacityHistoryKey, numberHistoryMeta)}
              onBlur={() => authoringHistory?.finish(opacityHistoryKey)}
              onChange={(event) => {
                const percentage = parseOptionalNumber(event.target.value);
                updateOpacity(percentage === undefined ? undefined : percentage / 100);
              }}
            />
            <span>%</span>
          </div>
        </label>
      </div>

      <ElementBorderControl
        border={style?.border}
        onChange={(border) => onUpdateStyle((current) => ({ ...current, border }))}
        controlPrefix="image"
      />
    </InspectorSection>
  );
}
