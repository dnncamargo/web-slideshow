import type { Border } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import {
  getControlName,
  parseOptionalNumber,
  readAbsoluteNumber,
} from "../inspector-helpers";

import { ColorControl } from "./color-control";
import { useAuthoringHistory } from "../../authoring-history-context";

import {
  ElementGradientControl,
  createDefaultGradient,
} from "./element-gradient-control";

interface ElementBorderControlProps {
  border: Border | undefined;

  onChange: (border: Border | undefined) => void;

  controlPrefix: string;

  allowGradient?: boolean;

  allowNone?: boolean;

  label?: string;
}

type EnabledBorderStyle = NonNullable<Border["style"]>;

type BorderSelection = EnabledBorderStyle | "none";

type BorderPaintSelection = "color" | "gradient";

export const DEFAULT_BORDER_COLOR = "#94a3b8";

export const DEFAULT_BORDER_WIDTH = 1;

export function createDefaultBorder(): Border {
  return { width: DEFAULT_BORDER_WIDTH, style: "solid", color: DEFAULT_BORDER_COLOR };
}

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
  onChange,
  controlPrefix,
  allowGradient = true,
  allowNone = true,
  label,
}: ElementBorderControlProps) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();

  function runDiscrete(setting: string, callback: () => void): void {
    const meta = {
      kind: "element.setting",
      labelKey: "history.element.setting",
      labelParams: { setting },
    };

    if (authoringHistory) {
      authoringHistory.discrete(meta, callback);
    } else {
      callback();
    }
  }

  const paintSelection = allowGradient
    ? getPaintSelection(border)
    : border === undefined
      ? "none"
      : "color";

  const gradientPaint = allowGradient && paintSelection === "gradient";

  return (
    <>
      <label className={styles.field}>
        <span title={t("inspector.borderHelp")}>
          {label ?? t("inspector.border")}
        </span>

        <select
          id={`${controlPrefix}-border-style`}
          name={getControlName(controlPrefix, "BorderStyle")}
          value={gradientPaint ? "solid" : getBorderSelection(border)}
          onChange={(event) => {
            const borderSelection = event.target.value;

            if (borderSelection === "none") {
              if (!allowNone) return;
              if (border === undefined) return;
              runDiscrete("border.style", () => onChange(undefined));

              return;
            }

            if (!isEnabledBorderStyle(borderSelection)) {
              return;
            }

            if (gradientPaint) {
              if (border === undefined) return;
              if (border.style === "solid") return;
              runDiscrete("border.style", () => onChange({ ...border, style: "solid" }));
              return;
            }

            const nextBorder =
              border === undefined
                ? { ...createDefaultBorder(), style: borderSelection }
                : { ...border, style: borderSelection };
            if (getBorderSelection(border) === borderSelection) return;
            runDiscrete("border.style", () => onChange(nextBorder));
          }}
        >
          {allowNone && <option value="none">{t("inspector.border.none")}</option>}

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
        <>
          <div className={styles.fieldGrid}>
            {allowGradient && (
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

                    if (border === undefined) return;

                    if (paintSelection === paint) return;
                    runDiscrete("border.paint", () => onChange(
                      paint === "gradient"
                        ? {
                            ...border,
                            style: "solid",
                            color: undefined,
                            gradient: createDefaultGradient("linear"),
                          }
                        : {
                            ...border,
                            color: DEFAULT_BORDER_COLOR,
                            gradient: undefined,
                          },
                    ));
                  }}
                >
                  <option value="color">{t("inspector.borderPaint.color")}</option>

                  <option value="gradient">
                    {t("inspector.borderPaint.gradient")}
                  </option>
                </select>
              </label>
            )}

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

                    onChange(
                      border === undefined
                        ? {
                            width,
                            style: "solid",
                            color: DEFAULT_BORDER_COLOR,
                          }
                        : { ...border, width },
                    );
                  }}
                />

                <span>px</span>
              </div>
            </label>
          </div>

          {!gradientPaint && (
            <label className={styles.field}>
              <span>{t("inspector.borderColor")}</span>

              <ColorControl
                id={`${controlPrefix}-border-color`}
                name={getControlName(controlPrefix, "BorderColor")}
                value={border.color}
                onChange={(color) =>
                  onChange(
                    border === undefined
                      ? {
                          width: DEFAULT_BORDER_WIDTH,
                          style: "solid",
                          color,
                        }
                      : { ...border, color, gradient: undefined },
                  )
                }
              />
            </label>
          )}
        </>
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

            if (border === undefined) return;

            onChange({
              ...border,
              style: "solid",
              color: undefined,
              gradient,
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
