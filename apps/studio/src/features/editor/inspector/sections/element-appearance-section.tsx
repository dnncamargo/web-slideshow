import type { Border, PowerShowElement } from "@powershow/document-schema";
import { resolveEffectiveElementStyleDefaults } from "@powershow/theme/element-style-defaults";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import {
  getControlName,
  parseOptionalNumber,
  readAbsoluteNumber,
  readPickerColor,
} from "../inspector-helpers";

import { InspectorSection } from "../inspector-section";

import type {
  FontResourceControls,
  UpdateElementStyle,
} from "../inspector-types";

import { ElementBackgroundGradientControl } from "./element-background-gradient-control";

import { ElementTypographyControl } from "./element-typography-control";

import { EffectiveNumberInput } from "./effective-number-input";
import { EffectiveLengthInput } from "./effective-length-input";

interface ElementAppearanceSectionProps {
  element: PowerShowElement;

  onUpdateStyle: UpdateElementStyle;

  controlPrefix: string;

  showTypography?: boolean;

  fontResourceControls?: FontResourceControls;

  showColor?: boolean;

  showBackground?: boolean;

  showBackgroundGradient?: boolean;

  showRoundedCorners?: boolean;

  showOpacity?: boolean;

  showBorder?: boolean;
}

type EnabledBorderStyle = NonNullable<Border["style"]>;

type BorderSelection = EnabledBorderStyle | "none";

const DEFAULT_BORDER_COLOR = "#94a3b8";

const DEFAULT_BORDER_WIDTH = 1;

function readOpacityPercentage(value: number | undefined): number {
  return value === undefined ? 100 : value * 100;
}

function getBorderSelection(border: Border | undefined): BorderSelection {
  if (border === undefined) {
    return "none";
  }

  return border.style ?? "solid";
}

function isEnabledBorderStyle(value: string): value is EnabledBorderStyle {
  return value === "solid" || value === "dashed" || value === "dotted";
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

            <input
              id={`${controlPrefix}-color`}
              name={getControlName(controlPrefix, "Color")}
              className={styles.colorInput}
              type="color"
              value={readPickerColor(style?.color)}
              onChange={(event) => {
                const color = event.target.value;

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

      {(showBackground || showBackgroundGradient) && (
        <div className={styles.backgroundControls}>
          {showBackground && (
            <div className={styles.colorControl}>
              <label className={styles.field}>
                <span title={t("inspector.backgroundHelp")}>
                  {t("inspector.background")}
                </span>

                <input
                  id={`${controlPrefix}-background`}
                  name={getControlName(controlPrefix, "Background")}
                  className={styles.colorInput}
                  type="color"
                  value={readPickerColor(style?.background)}
                  onChange={(event) => {
                    const background = event.target.value;

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
        <>
          <label className={styles.field}>
            <span title={t("inspector.borderHelp")}>
              {t("inspector.border")}
            </span>

            <select
              id={`${controlPrefix}-border-style`}
              name={getControlName(controlPrefix, "BorderStyle")}
              value={getBorderSelection(style?.border)}
              onChange={(event) => {
                const borderSelection = event.target.value;

                if (borderSelection === "none") {
                  onUpdateStyle((currentStyle) => ({
                    ...currentStyle,

                    border: undefined,
                  }));

                  return;
                }

                if (!isEnabledBorderStyle(borderSelection)) {
                  return;
                }

                onUpdateStyle((currentStyle) => ({
                  ...currentStyle,

                  border:
                    currentStyle?.border === undefined
                      ? {
                          width: DEFAULT_BORDER_WIDTH,

                          style: borderSelection,

                          color: DEFAULT_BORDER_COLOR,
                        }
                      : {
                          ...currentStyle.border,

                          style: borderSelection,
                        },
                }));
              }}
            >
              <option value="none">{t("inspector.border.none")}</option>

              <option value="solid">{t("inspector.border.solid")}</option>

              <option value="dashed">{t("inspector.border.dashed")}</option>

              <option value="dotted">{t("inspector.border.dotted")}</option>
            </select>
          </label>

          {style?.border !== undefined && (
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>{t("inspector.borderWidth")}</span>

                <div className={styles.unitInput}>
                  <input
                    id={`${controlPrefix}-border-width`}
                    name={getControlName(controlPrefix, "BorderWidth")}
                    type="number"
                    min="0"
                    value={readAbsoluteNumber(style.border.width)}
                    onChange={(event) => {
                      const width =
                        parseOptionalNumber(event.target.value) ??
                        DEFAULT_BORDER_WIDTH;

                      onUpdateStyle((currentStyle) => ({
                        ...currentStyle,

                        border:
                          currentStyle?.border === undefined
                            ? {
                                width,

                                style: "solid",

                                color: DEFAULT_BORDER_COLOR,
                              }
                            : {
                                ...currentStyle.border,

                                width,
                              },
                      }));
                    }}
                  />

                  <span>px</span>
                </div>
              </label>

              <label className={styles.field}>
                <span>{t("inspector.borderColor")}</span>

                <input
                  id={`${controlPrefix}-border-color`}
                  name={getControlName(controlPrefix, "BorderColor")}
                  className={styles.colorInput}
                  type="color"
                  value={readPickerColor(style.border.color)}
                  onChange={(event) => {
                    const color = event.target.value;

                    onUpdateStyle((currentStyle) => ({
                      ...currentStyle,

                      border:
                        currentStyle?.border === undefined
                          ? {
                              width: DEFAULT_BORDER_WIDTH,

                              style: "solid",

                              color,
                            }
                          : {
                              ...currentStyle.border,

                              color,

                              gradient: undefined,
                            },
                    }));
                  }}
                />
              </label>
            </div>
          )}
        </>
      )}
    </InspectorSection>
  );
}

// ============================================================
// END: ELEMENT APPEARANCE SECTION
// ============================================================
