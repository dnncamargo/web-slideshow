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
import { createDefaultGradient, ElementGradientControl } from "./element-gradient-control";
import { EffectiveLengthInput } from "./effective-length-input";
import type { TextStylePropertyInfo } from "../text-style-property";
import { TextStylePropertyMeta } from "./text-style-property-meta";
import type { InheritedColorSource } from "../color-inheritance";

type CanonicalTextElement = TextElement;

interface CanonicalTextAppearanceSectionProps {
  element: CanonicalTextElement;
  style: TextVisualStyle | undefined;
  effect: { opacity?: number } | undefined;
  onUpdateStyle: UpdateElementVisualStyle;
  onUpdateEffect: UpdateElementEffect;
  controlPrefix: string;
  effectiveTextFill?: Pick<TextVisualStyle, "color" | "gradient">;
  effectiveTextColor?: TextVisualStyle["color"];
  fallbackTextColorSource?: InheritedColorSource;
  textColorDisabled?: boolean;
  textFillSource?: TextStylePropertyInfo;
  onResetTextFill?: () => void;
}

function readOpacityPercentage(value: number | undefined): number {
  return value === undefined ? 100 : value * 100;
}

const numberHistoryMeta = { kind: "number.change", labelKey: "history.number.change" } as const;

function clearTextFill(style: TextVisualStyle | undefined): TextVisualStyle {
  if (style === undefined) return {};
  const { color: _color, gradient: _gradient, ...remaining } = style;
  return remaining;
}

export function CanonicalTextAppearanceSection({
  element,
  style,
  effect,
  onUpdateStyle,
  onUpdateEffect,
  controlPrefix,
  effectiveTextFill,
  effectiveTextColor,
  fallbackTextColorSource,
  textColorDisabled = false,
  textFillSource,
  onResetTextFill,
}: CanonicalTextAppearanceSectionProps) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const defaults = resolveEffectiveElementStyleDefaults(element);
  const opacityHistoryKey = `number:${controlPrefix}-opacity`;
  const fillMode = style?.gradient !== undefined || effectiveTextFill?.gradient !== undefined ? "gradient" : "color";
  const localFill = style?.color !== undefined || style?.gradient !== undefined;
  const detachedFillReset = localFill && textFillSource === undefined ? {
    label: fallbackTextColorSource === "container" ? t("inspector.useInheritedColor") : t("inspector.useThemeDefault"),
    onClick: () => onUpdateStyle((current) => clearTextFill(current)),
  } : undefined;
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

  const runFillModeChange = (mode: "color" | "gradient") => {
    if (mode === fillMode) return;
    const update = () => onUpdateStyle((current) => mode === "gradient"
      ? { ...clearTextFill(current), gradient: createDefaultGradient("linear") }
      : { ...clearTextFill(current), color: effectiveTextColor ?? effectiveTextFill?.color });
    if (authoringHistory) {
      authoringHistory.discrete({
        kind: "element.setting",
        labelKey: "history.element.setting",
        labelParams: { setting: "text.fill.mode" },
      }, update);
    } else {
      update();
    }
  };

  return (
    <InspectorSection title={t("inspector.appearance")}>
      <div className={styles.colorControl}>
        <label className={styles.field}>
          <span>{t("inspector.fill")}</span>
          <select
            id={`${controlPrefix}-fill-mode`}
            name={getControlName(controlPrefix, "FillMode")}
            value={fillMode}
            disabled={textColorDisabled}
            onChange={(event) => {
              if (event.target.value === "color" || event.target.value === "gradient") runFillModeChange(event.target.value);
            }}
          >
            <option value="color">{t("inspector.color")}</option>
            <option value="gradient">{t("inspector.gradient")}</option>
          </select>
          {fillMode === "gradient" ? <TextStylePropertyMeta
              source={textFillSource?.source}
              linkedValue={textFillSource?.linkedValue}
              onReset={onResetTextFill}
            /> : null}
        </label>
        {fillMode === "color" ? (
          <label className={styles.field}>
            <ColorControl
              id={`${controlPrefix}-color`}
              name={getControlName(controlPrefix, "Color")}
              value={textColorDisabled ? undefined : style?.color}
              effectiveValue={effectiveTextFill?.color}
              effectiveSource={textColorDisabled ? undefined : effectiveTextFill?.color === undefined ? undefined : (style?.color === undefined && textFillSource?.source !== "linked" ? fallbackTextColorSource : undefined)}
              disabled={textColorDisabled}
              onChange={(color) => onUpdateStyle((current) => ({ ...clearTextFill(current), color }))}
              secondaryAction={detachedFillReset}
            />
            <TextStylePropertyMeta
              source={textFillSource?.source}
              linkedValue={textFillSource?.linkedValue}
              onReset={onResetTextFill}
            />
          </label>
        ) : (
          <>
            <ElementGradientControl
              gradient={effectiveTextFill?.gradient}
              authoredGradient={{ value: style?.gradient }}
              controlPrefix={`${controlPrefix}-fill`}
              allowNone={false}
              disabled={textColorDisabled}
              onChange={(gradient) => {
                if (gradient !== undefined) onUpdateStyle((current) => ({ ...clearTextFill(current), gradient }));
              }}
            />
            {detachedFillReset ? <button type="button" className={styles.colorPaletteDisclosure} onClick={detachedFillReset.onClick}>{detachedFillReset.label}</button> : null}
          </>
        )}
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
