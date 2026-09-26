import type { Border } from "@web-slideshow/document-schema";

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

  /** When supplied, this is the locally authored value behind the effective border. */
  authoredBorder?: { value: Border | undefined };

  onChange: (border: Border | undefined) => void;

  controlPrefix: string;

  allowGradient?: boolean;

  allowNone?: boolean;

  label?: string;

  disabled?: boolean;
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
  authoredBorder,
  onChange,
  controlPrefix,
  allowGradient = true,
  allowNone = true,
  label,
  disabled = false,
}: ElementBorderControlProps) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const numberHistoryMeta = { kind: "number.change", labelKey: "history.number.change" } as const;

  function runDiscrete(setting: string, callback: () => void): void {
    if (disabled) return;
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
          disabled={disabled}
          onChange={(event) => {
            if (disabled) return;
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
                  disabled={disabled}
                  onChange={(event) => {
                    if (disabled) return;
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
                  disabled={disabled}
                  onFocus={() => authoringHistory?.begin(`number:${controlPrefix}-border-width`, numberHistoryMeta)}
                  onBlur={() => authoringHistory?.finish(`number:${controlPrefix}-border-width`)}
                  onChange={(event) => {
                    if (disabled) return;
                    const width =
                      parseOptionalNumber(event.target.value) ??
                      DEFAULT_BORDER_WIDTH;

                    const nextBorder = border === undefined
                      ? {
                          width,
                          style: "solid" as const,
                          color: DEFAULT_BORDER_COLOR,
                        }
                      : { ...border, width };
                    const authoredValue = authoredBorder === undefined
                      ? border
                      : authoredBorder.value;
                    const unchanged = authoredValue?.width === width;
                    if (unchanged) return;

                    const update = () => onChange(nextBorder);
                    if (!authoringHistory) {
                      update();
                      return;
                    }

                    const historyKey = `number:${controlPrefix}-border-width`;
                    authoringHistory.begin(historyKey, numberHistoryMeta);
                    authoringHistory.update(historyKey, update);
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
                disabled={disabled}
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
          {...(authoredBorder === undefined
            ? {}
            : { authoredGradient: { value: authoredBorder.value?.gradient } })}
          controlPrefix={`${controlPrefix}-border`}
          allowNone={false}
          disabled={disabled}
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
