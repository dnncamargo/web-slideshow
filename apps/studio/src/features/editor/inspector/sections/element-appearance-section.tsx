import type { ElementStyle } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import {
  parseOptionalNumber,
  readAbsoluteNumber,
  readPickerColor,
} from "../inspector-helpers";

import { InspectorSection } from "../inspector-section";

import type { UpdateElementStyle } from "../inspector-types";

interface ElementAppearanceSectionProps {
  style: ElementStyle | undefined;

  onUpdateStyle: UpdateElementStyle;

  controlPrefix: string;

  showColor?: boolean;

  showBackground?: boolean;

  showRoundedCorners?: boolean;

  showOpacity?: boolean;
}

function readOpacityPercentage(value: number | undefined): number {
  return value === undefined ? 100 : value * 100;
}

function getControlName(prefix: string, field: string): string {
  return `${prefix}${field}`;
}

// ============================================================
// BEGIN: ELEMENT APPEARANCE SECTION
// ============================================================

export function ElementAppearanceSection({
  style,
  onUpdateStyle,
  controlPrefix,
  showColor = false,
  showBackground = false,
  showRoundedCorners = false,
  showOpacity = false,
}: ElementAppearanceSectionProps) {
  const { t } = useStudioI18n();

  return (
    <InspectorSection title={t("inspector.appearance")}>
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

      {(showRoundedCorners || showOpacity) && (
        <div className={styles.fieldGrid}>
          {showRoundedCorners && (
            <label className={styles.field}>
              <span title={t("inspector.roundedCornersHelp")}>
                {t("inspector.roundedCorners")}
              </span>

              <div className={styles.unitInput}>
                <input
                  id={`${controlPrefix}-border-radius`}
                  name={getControlName(controlPrefix, "BorderRadius")}
                  type="number"
                  min="0"
                  value={readAbsoluteNumber(style?.borderRadius)}
                  onChange={(event) => {
                    const borderRadius = parseOptionalNumber(
                      event.target.value,
                    );

                    onUpdateStyle((currentStyle) => ({
                      ...currentStyle,

                      borderRadius,
                    }));
                  }}
                />

                <span>px</span>
              </div>
            </label>
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
    </InspectorSection>
  );
}

// ============================================================
// END: ELEMENT APPEARANCE SECTION
// ============================================================
