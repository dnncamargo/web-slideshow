import type { TextElement, TextVisualStyle } from "@web-slideshow/document-schema";
import { resolveEffectiveElementStyleDefaults } from "@web-slideshow/theme/element-style-defaults";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import { getControlName, parseOptionalNumber } from "../inspector-helpers";
import type { UpdateElementEffect, UpdateElementVisualStyle } from "../inspector-types";
import { useAuthoringHistory } from "../../authoring-history-context";
import { InspectorSection } from "../inspector-section";
import { ColorControl } from "./color-control";
import { ElementBorderControl } from "./element-border-control";
import { ElementGradientControl } from "./element-gradient-control";
import { EffectiveLengthInput } from "./effective-length-input";
import type { TextStylePropertyInfo } from "../text-style-property";
import { TextStylePropertyMeta } from "./text-style-property-meta";

type CanonicalTextElement = TextElement;

interface CanonicalTextAppearanceSectionProps {
  element: CanonicalTextElement;
  style: TextVisualStyle | undefined;
  effect: { opacity?: number } | undefined;
  onUpdateStyle: UpdateElementVisualStyle;
  onUpdateEffect: UpdateElementEffect;
  controlPrefix: string;
  effectiveTextColor?: TextVisualStyle["color"];
  textColorDisabled?: boolean;
  textColorSource?: TextStylePropertyInfo;
  onResetTextColor?: () => void;
}

function readOpacityPercentage(value: number | undefined): number {
  return value === undefined ? 100 : value * 100;
}

const numberHistoryMeta = { kind: "number.change", labelKey: "history.number.change" } as const;

export function CanonicalTextAppearanceSection({
  element,
  style,
  effect,
  onUpdateStyle,
  onUpdateEffect,
  controlPrefix,
  effectiveTextColor,
  textColorDisabled = false,
  textColorSource,
  onResetTextColor,
}: CanonicalTextAppearanceSectionProps) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const defaults = resolveEffectiveElementStyleDefaults(element);
  const opacityHistoryKey = `number:${controlPrefix}-opacity`;
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
          <span>{t("inspector.color")}</span>
          <ColorControl
            id={`${controlPrefix}-color`}
            name={getControlName(controlPrefix, "Color")}
            value={textColorDisabled ? undefined : style?.color}
            effectiveValue={effectiveTextColor}
            disabled={textColorDisabled}
            onChange={(color) =>
              onUpdateStyle((current) => ({ ...current, color }))
            }
            secondaryAction={{
              label: t("inspector.useThemeDefault"),
              onClick: () => onUpdateStyle((current) => ({ ...current, color: undefined })),
            }}
          />
          <TextStylePropertyMeta
            source={textColorSource?.source}
            linkedValue={textColorSource?.linkedValue}
            onReset={onResetTextColor}
          />
        </label>
      </div>

      <div className={styles.backgroundControls}>
        <div className={styles.colorControl}>
          <label className={styles.field}>
            <span title={t("inspector.backgroundHelp")}>{t("inspector.background")}</span>
            <ColorControl
              id={`${controlPrefix}-background`}
              name={getControlName(controlPrefix, "Background")}
              value={style?.background?.color}
              onChange={(color) =>
                onUpdateStyle((current) => ({
                  ...current,
                  background: { ...current?.background, color },
                }))
              }
              secondaryAction={{
                label: t("inspector.remove"),
                onClick: () => onUpdateStyle((current) => ({
                  ...current,
                  background: current?.background?.gradient
                    ? { gradient: current.background.gradient }
                    : undefined,
                })),
              }}
            />
          </label>
        </div>
        <ElementGradientControl
          gradient={style?.background?.gradient}
          controlPrefix={`${controlPrefix}-background`}
          onChange={(gradient) =>
            onUpdateStyle((current) => ({
              ...current,
                background:
                  gradient === undefined
                  ? current?.background?.color
                    ? { color: current.background.color }
                    : undefined
                  : { ...current?.background, gradient },
            }))
          }
        />
      </div>

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label htmlFor={`${controlPrefix}-border-radius`}>
            {t("inspector.roundedCorners")}
          </label>
          <EffectiveLengthInput
            id={`${controlPrefix}-border-radius`}
            name={getControlName(controlPrefix, "BorderRadius")}
            min="0"
            value={style?.borderRadius}
            inheritedValue={defaults.borderRadius}
            preferredUnit="px"
            units={["px", "rem"]}
            stepByUnit={{ px: "1", rem: "0.1" }}
            onChange={(borderRadius) =>
              onUpdateStyle((current) => ({ ...current, borderRadius }))
            }
            onReset={() =>
              onUpdateStyle((current) => ({ ...current, borderRadius: undefined }))
            }
          />
        </div>
        <label className={styles.field}>
          <span title={t("inspector.opacityHelp")}>{t("inspector.opacity")}</span>
          <div className={styles.unitInput}>
            <input
              id={`${controlPrefix}-opacity`}
              name={getControlName(controlPrefix, "Opacity")}
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
        controlPrefix={controlPrefix}
      />
    </InspectorSection>
  );
}
