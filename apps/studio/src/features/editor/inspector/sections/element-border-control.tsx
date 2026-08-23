import type { Border } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import {
  getControlName,
  parseOptionalNumber,
  readAbsoluteNumber,
} from "../inspector-helpers";

import type { UpdateElementStyle } from "../inspector-types";

import { ColorControl } from "./color-control";

import {
  ElementGradientControl,
  createDefaultGradient,
} from "./element-gradient-control";

interface ElementBorderControlProps {
  border: Border | undefined;

  onUpdateStyle: UpdateElementStyle;

  controlPrefix: string;
}

type EnabledBorderStyle = NonNullable<Border["style"]>;

type BorderSelection = EnabledBorderStyle | "none";

type BorderPaintSelection = "color" | "gradient";

const DEFAULT_BORDER_COLOR = "#94a3b8";

const DEFAULT_BORDER_WIDTH = 1;

function getBorderSelection(border: Border | undefined): BorderSelection {
  if (border === undefined) {
    return "none";
  }

  return border.style ?? "solid";
}

function getPaintSelection(
  border: Border | undefined,
): BorderPaintSelection | "none" {
  if (border === undefined) {
    return "none";
  }

  if (border.gradient !== undefined) {
    return "gradient";
  }

  return "color";
}

function isEnabledBorderStyle(value: string): value is EnabledBorderStyle {
  return value === "solid" || value === "dashed" || value === "dotted";
}

// ============================================================
// BEGIN: ELEMENT BORDER CONTROL
// ============================================================

export function ElementBorderControl({
  border,
  onUpdateStyle,
  controlPrefix,
}: ElementBorderControlProps) {
  const { t } = useStudioI18n();

  const paintSelection = getPaintSelection(border);

  const gradientPaint = paintSelection === "gradient";

  return (
    <>
      <label className={styles.field}>
        <span title={t("inspector.borderHelp")}>
          {t("inspector.border")}
        </span>

        <select
          id={`${controlPrefix}-border-style`}
          name={getControlName(controlPrefix, "BorderStyle")}
          value={gradientPaint ? "solid" : getBorderSelection(border)}
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

            onUpdateStyle((currentStyle) => {
              if (gradientPaint) {
                if (currentStyle?.border === undefined) {
                  return { ...currentStyle };
                }

                return {
                  ...currentStyle,

                  border: {
                    ...currentStyle.border,

                    style: "solid",
                  },
                };
              }

              return {
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
              };
            });
          }}
        >
          <option value="none">{t("inspector.border.none")}</option>

          <option value="solid">{t("inspector.border.solid")}</option>

          {!gradientPaint && (
            <>
              <option value="dashed">{t("inspector.border.dashed")}</option>

              <option value="dotted">{t("inspector.border.dotted")}</option>
            </>
          )}
        </select>
      </label>

      {border !== undefined && (
        <label className={styles.field}>
          <span title={t("inspector.borderPaintHelp")}>
            {t("inspector.borderPaint")}
          </span>

          <select
            id={`${controlPrefix}-border-paint`}
            name={getControlName(controlPrefix, "BorderPaint")}
            value={paintSelection}
            onChange={(event) => {
              const paint = event.target.value;

              if (paint !== "color" && paint !== "gradient") {
                return;
              }

              onUpdateStyle((currentStyle) => {
                if (currentStyle?.border === undefined) {
                  return { ...currentStyle };
                }

                if (paint === "gradient") {
                  return {
                    ...currentStyle,

                    border: {
                      ...currentStyle.border,

                      style: "solid",

                      color: undefined,

                      gradient: createDefaultGradient("linear"),
                    },
                  };
                }

                return {
                  ...currentStyle,

                  border: {
                    ...currentStyle.border,

                    color: DEFAULT_BORDER_COLOR,

                    gradient: undefined,
                  },
                };
              });
            }}
          >
            <option value="color">{t("inspector.borderPaint.color")}</option>

            <option value="gradient">
              {t("inspector.borderPaint.gradient")}
            </option>
          </select>
        </label>
      )}

      {border !== undefined && (
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>{t("inspector.borderWidth")}</span>

            <div className={styles.unitInput}>
              <input
                id={`${controlPrefix}-border-width`}
                name={getControlName(controlPrefix, "BorderWidth")}
                type="number"
                min="0"
                value={readAbsoluteNumber(border.width)}
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

          {!gradientPaint && (
            <label className={styles.field}>
              <span>{t("inspector.borderColor")}</span>

              <ColorControl
                id={`${controlPrefix}-border-color`}
                name={getControlName(controlPrefix, "BorderColor")}
                value={border.color}
                onChange={(color) => {
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
          )}
        </div>
      )}

      {gradientPaint && border !== undefined && (
        <ElementGradientControl
          gradient={border.gradient}
          controlPrefix={`${controlPrefix}-border`}
          allowNone={false}
          onChange={(gradient) => {
            if (gradient === undefined) {
              return;
            }

            onUpdateStyle((currentStyle) => {
              if (currentStyle?.border === undefined) {
                return { ...currentStyle };
              }

              return {
                ...currentStyle,

                border: {
                  ...currentStyle.border,

                  style: "solid",

                  color: undefined,

                  gradient,
                },
              };
            });
          }}
        />
      )}
    </>
  );
}

// ============================================================
// END: ELEMENT BORDER CONTROL
// ============================================================
