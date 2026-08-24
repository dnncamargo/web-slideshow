import type { ElementEffect, ImageVisualStyle } from "@powershow/document-schema";
import { resolveEffectiveElementStyleDefaults } from "@powershow/theme/element-style-defaults";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";
import { parseOptionalNumber } from "../inspector-helpers";
import { InspectorSection } from "../inspector-section";
import { EffectiveLengthInput } from "./effective-length-input";
import { ElementBorderControl } from "./element-border-control";

interface Props {
  style: ImageVisualStyle | undefined;
  effect: ElementEffect | undefined;
  onUpdateStyle: (update: (style: ImageVisualStyle | undefined) => ImageVisualStyle) => void;
  onUpdateEffect: (update: (effect: ElementEffect | undefined) => ElementEffect) => void;
}

function readOpacityPercentage(value: number | undefined): number {
  return value === undefined ? 100 : value * 100;
}

export function CanonicalImageAppearanceSection({
  style,
  effect,
  onUpdateStyle,
  onUpdateEffect,
}: Props) {
  const { t } = useStudioI18n();
  const effectiveDefaults = resolveEffectiveElementStyleDefaults({ type: "image" });

  return (
    <InspectorSection title={t("inspector.appearance")}>
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
              onChange={(event) => {
                const percentage = parseOptionalNumber(event.target.value);
                onUpdateEffect((current) => ({
                  ...current,
                  opacity: percentage === undefined ? undefined : percentage / 100,
                }));
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
