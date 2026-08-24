import type { ContainerElement, ImageElement, PowerShowElement, TextElement, TextboxElement } from "@powershow/document-schema";
import { resolveEffectiveElementStyleDefaults } from "@powershow/theme/element-style-defaults";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import {
  getControlName,
  parseOptionalNumber,
} from "../inspector-helpers";

import { InspectorSection } from "../inspector-section";

import type {
  FontResourceControls,
  UpdateElementStyle,
} from "../inspector-types";

import { ElementBackgroundGradientControl } from "./element-background-gradient-control";
import { ElementBackgroundPatternControl } from "./element-background-pattern-control";
import { ElementBorderControl } from "./element-border-control";
import { ColorControl } from "./color-control";

import { ElementTypographyControl } from "./element-typography-control";

import { EffectiveLengthInput } from "./effective-length-input";

type LegacyStyledElement = Exclude<PowerShowElement, ContainerElement | TextElement | TextboxElement | ImageElement | Extract<PowerShowElement, { type: "gallery" | "embed" | "scripted" | "code" | "terminal" | "table" | "blocks" }>>;

interface ElementAppearanceSectionProps {
  element: LegacyStyledElement;

  onUpdateStyle: UpdateElementStyle;

  controlPrefix: string;

  showTypography?: boolean;

  fontResourceControls?: FontResourceControls;

  showColor?: boolean;

  showBackground?: boolean;

  showBackgroundGradient?: boolean;

  showBackgroundPattern?: boolean;

  showRoundedCorners?: boolean;

  showOpacity?: boolean;

  showBorder?: boolean;
}

function readOpacityPercentage(value: number | undefined): number {
  return value === undefined ? 100 : value * 100;
}

// ============================================================
// BEGIN: ELEMENT APPEARANCE SECTION
// ============================================================

export function ElementAppearanceSection({
  element,
  onUpdateStyle,
  controlPrefix,
  showTypography = false,
  fontResourceControls,
  showColor = false,
  showBackground = false,
  showBackgroundGradient = false,
  showBackgroundPattern = false,
  showRoundedCorners = false,
  showOpacity = false,
  showBorder = false,
}: ElementAppearanceSectionProps) {
  const { t } = useStudioI18n();
  const style = element.style;
  const effectiveDefaults = resolveEffectiveElementStyleDefaults(element);

  return (
    <InspectorSection title={t("inspector.appearance")}>
      {showTypography &&
        fontResourceControls &&
        effectiveDefaults.typography && (
          <ElementTypographyControl
            selectedElementId={element.id}
            style={style}
            effectiveDefaults={effectiveDefaults.typography}
            onUpdateStyle={onUpdateStyle}
            controlPrefix={controlPrefix}
            fontResourceControls={fontResourceControls}
          />
        )}

      {showColor && (
        <div className={styles.colorControl}>
          <label className={styles.field}>
            <span>{t("inspector.color")}</span>

            <ColorControl
              id={`${controlPrefix}-color`}
              name={getControlName(controlPrefix, "Color")}
              value={style?.color}
              onChange={(color) => {
                onUpdateStyle((currentStyle) => ({
                  ...currentStyle,

                  color,
                }));
              }}
            />
          </label>

          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => {
              onUpdateStyle((currentStyle) => ({
                ...currentStyle,

                color: undefined,
              }));
            }}
          >
            <span>{t("inspector.useThemeDefault")}</span>
          </button>
        </div>
      )}

      {(showBackground || showBackgroundGradient || showBackgroundPattern) && (
        <div className={styles.backgroundControls}>
          {showBackground && (
            <div className={styles.colorControl}>
              <label className={styles.field}>
                <span title={t("inspector.backgroundHelp")}>
                  {t("inspector.background")}
                </span>

                <ColorControl
                  id={`${controlPrefix}-background`}
                  name={getControlName(controlPrefix, "Background")}
                  value={style?.background}
                  onChange={(background) => {
                    onUpdateStyle((currentStyle) => ({
                      ...currentStyle,

                      background,
                    }));
                  }}
                />
              </label>

              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => {
                  onUpdateStyle((currentStyle) => ({
                    ...currentStyle,

                    background: undefined,
                  }));
                }}
              >
                <span>{t("inspector.clearBackground")}</span>
              </button>
            </div>
          )}

          {showBackgroundGradient && (
            <ElementBackgroundGradientControl
              style={style}
              onUpdateStyle={onUpdateStyle}
              controlPrefix={controlPrefix}
            />
          )}

          {showBackgroundPattern && (
            <ElementBackgroundPatternControl
              elementId={element.id}
              style={style}
              onUpdateStyle={onUpdateStyle}
              controlPrefix={controlPrefix}
            />
          )}
        </div>
      )}

      {(showRoundedCorners || showOpacity) && (
        <div className={styles.fieldGrid}>
          {showRoundedCorners && (
            <div className={styles.field}>
              <label
                htmlFor={`${controlPrefix}-border-radius`}
                title={t("inspector.roundedCornersHelp")}
              >
                {t("inspector.roundedCorners")}
              </label>

              <EffectiveLengthInput
                id={`${controlPrefix}-border-radius`}
                name={getControlName(controlPrefix, "BorderRadius")}
                min="0"
                value={style?.borderRadius}
                inheritedValue={effectiveDefaults.borderRadius}
                preferredUnit="px"
                units={["px", "rem"]}
                stepByUnit={{ px: "1", rem: "0.1" }}
                onChange={(borderRadius) => {

                  onUpdateStyle((currentStyle) => ({
                    ...currentStyle,

                    borderRadius,
                  }));
                }}
                onReset={() => {
                  onUpdateStyle((currentStyle) => ({
                    ...currentStyle,

                    borderRadius: undefined,
                  }));
                }}
              />
            </div>
          )}

          {showOpacity && (
            <label className={styles.field}>
              <span title={t("inspector.opacityHelp")}>
                {t("inspector.opacity")}
              </span>

              <div className={styles.unitInput}>
                <input
                  id={`${controlPrefix}-opacity`}
                  name={getControlName(controlPrefix, "Opacity")}
                  type="number"
                  min="0"
                  max="100"
                  value={readOpacityPercentage(style?.opacity)}
                  onChange={(event) => {
                    const percentage = parseOptionalNumber(event.target.value);

                    onUpdateStyle((currentStyle) => ({
                      ...currentStyle,

                      opacity:
                        percentage === undefined
                          ? undefined
                          : percentage / 100,
                    }));
                  }}
                />

                <span>%</span>
              </div>
            </label>
          )}
        </div>
      )}

      {showBorder && (
        <ElementBorderControl
          border={style?.border}
          onChange={(border) => {
            onUpdateStyle((currentStyle) => ({
              ...currentStyle,
              border,
            }));
          }}
          controlPrefix={controlPrefix}
        />
      )}
    </InspectorSection>
  );
}

// ============================================================
// END: ELEMENT APPEARANCE SECTION
// ============================================================
