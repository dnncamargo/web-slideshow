import type {
  ElementStyle,
  Shadow,
  TextStroke,
} from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import {
  getControlName,
  parseOptionalNumber,
  readAbsoluteNumber,
  readPickerColor,
} from "../inspector-helpers";

import { InspectorSection } from "../inspector-section";

import type { UpdateElementStyle } from "../inspector-types";

interface ElementEffectsSectionProps {
  style: ElementStyle | undefined;

  onUpdateStyle: UpdateElementStyle;

  controlPrefix: string;

  showTextStroke?: boolean;
}

type ShadowMode = "none" | "outer" | "inset";
type TextStrokeMode = "none" | "stroke";

const DEFAULT_SHADOW_X = 0;

const DEFAULT_SHADOW_Y = 4;

const DEFAULT_SHADOW_BLUR = 12;

const DEFAULT_SHADOW_COLOR = "#000000";

const DEFAULT_TEXT_STROKE_WIDTH = 1;

function createDefaultShadow(mode: Exclude<ShadowMode, "none">): Shadow {
  return {
    x: DEFAULT_SHADOW_X,

    y: DEFAULT_SHADOW_Y,

    blur: DEFAULT_SHADOW_BLUR,

    color: DEFAULT_SHADOW_COLOR,

    ...(mode === "inset" ? { inset: true } : {}),
  };
}

function getShadowMode(shadow: Shadow | undefined): ShadowMode {
  if (shadow === undefined) {
    return "none";
  }

  return shadow.inset ? "inset" : "outer";
}

function isEnabledShadowMode(
  value: string,
): value is Exclude<ShadowMode, "none"> {
  return value === "outer" || value === "inset";
}

function getTextStrokeMode(
  textStroke: TextStroke | undefined,
): TextStrokeMode {
  return textStroke === undefined ? "none" : "stroke";
}

function createDefaultTextStroke(color: string | undefined): TextStroke {
  return {
    width: DEFAULT_TEXT_STROKE_WIDTH,

    color: readPickerColor(color),
  };
}

// ============================================================
// BEGIN: ELEMENT EFFECTS SECTION
// ============================================================

export function ElementEffectsSection({
  style,
  onUpdateStyle,
  controlPrefix,
  showTextStroke = false,
}: ElementEffectsSectionProps) {
  const { t } = useStudioI18n();

  function updateShadow(update: (shadow: Shadow) => Shadow) {
    onUpdateStyle((currentStyle) => ({
      ...currentStyle,

      shadow: update(currentStyle?.shadow ?? createDefaultShadow("outer")),
    }));
  }

  return (
    <InspectorSection title={t("inspector.effects")}>
      {showTextStroke && (
        <>
          <label className={styles.field}>
            <span>{t("inspector.textStroke")}</span>

            <select
              id={`${controlPrefix}-text-stroke-mode`}
              name={getControlName(controlPrefix, "TextStrokeMode")}
              value={getTextStrokeMode(style?.textStroke)}
              onChange={(event) => {
                if (event.target.value === "none") {
                  onUpdateStyle((currentStyle) => ({
                    ...currentStyle,

                    textStroke: undefined,
                  }));

                  return;
                }

                if (event.target.value === "stroke") {
                  onUpdateStyle((currentStyle) => ({
                    ...currentStyle,

                    textStroke:
                      currentStyle?.textStroke ??
                      createDefaultTextStroke(currentStyle?.color),
                  }));
                }
              }}
            >
              <option value="none">{t("inspector.textStroke.none")}</option>

              <option value="stroke">{t("inspector.textStroke.stroke")}</option>
            </select>
          </label>

          {style?.textStroke !== undefined && (
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>{t("inspector.textStrokeWidth")}</span>

                <div className={styles.unitInput}>
                  <input
                    id={`${controlPrefix}-text-stroke-width`}
                    name={getControlName(controlPrefix, "TextStrokeWidth")}
                    type="number"
                    min="0"
                    value={readAbsoluteNumber(style.textStroke.width)}
                    onChange={(event) => {
                      const width =
                        parseOptionalNumber(event.target.value) ??
                        DEFAULT_TEXT_STROKE_WIDTH;

                      onUpdateStyle((currentStyle) => ({
                        ...currentStyle,

                        textStroke: {
                          ...(currentStyle?.textStroke ??
                            createDefaultTextStroke(currentStyle?.color)),

                          width: Math.max(0, width),
                        },
                      }));
                    }}
                  />

                  <span>px</span>
                </div>
              </label>

              <label className={styles.field}>
                <span>{t("inspector.textStrokeColor")}</span>

                <input
                  id={`${controlPrefix}-text-stroke-color`}
                  name={getControlName(controlPrefix, "TextStrokeColor")}
                  className={styles.colorInput}
                  type="color"
                  value={readPickerColor(style.textStroke.color)}
                  onChange={(event) => {
                    const color = event.target.value;

                    onUpdateStyle((currentStyle) => ({
                      ...currentStyle,

                      textStroke: {
                        ...(currentStyle?.textStroke ??
                          createDefaultTextStroke(currentStyle?.color)),

                        color,
                      },
                    }));
                  }}
                />
              </label>
            </div>
          )}
        </>
      )}

      <label className={styles.field}>
        <span title={t("inspector.shadowHelp")}>
          {t("inspector.shadow")}
        </span>

        <select
          id={`${controlPrefix}-shadow-mode`}
          name={getControlName(controlPrefix, "ShadowMode")}
          value={getShadowMode(style?.shadow)}
          onChange={(event) => {
            const shadowMode = event.target.value;

            if (shadowMode === "none") {
              onUpdateStyle((currentStyle) => ({
                ...currentStyle,

                shadow: undefined,
              }));

              return;
            }

            if (!isEnabledShadowMode(shadowMode)) {
              return;
            }

            onUpdateStyle((currentStyle) => ({
              ...currentStyle,

              shadow:
                currentStyle?.shadow === undefined
                  ? createDefaultShadow(shadowMode)
                  : {
                      ...currentStyle.shadow,

                      inset: shadowMode === "inset" ? true : undefined,
                    },
            }));
          }}
        >
          <option value="none">{t("inspector.shadow.none")}</option>

          <option value="outer">{t("inspector.shadow.outer")}</option>

          <option value="inset">{t("inspector.shadow.inset")}</option>
        </select>
      </label>

      {style?.shadow !== undefined && (
        <>
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>{t("inspector.shadowX")}</span>

              <div className={styles.unitInput}>
                <input
                  id={`${controlPrefix}-shadow-x`}
                  name={getControlName(controlPrefix, "ShadowX")}
                  type="number"
                  value={readAbsoluteNumber(style.shadow.x)}
                  onChange={(event) => {
                    const x =
                      parseOptionalNumber(event.target.value) ??
                      DEFAULT_SHADOW_X;

                    updateShadow((shadow) => ({
                      ...shadow,

                      x,
                    }));
                  }}
                />

                <span>px</span>
              </div>
            </label>

            <label className={styles.field}>
              <span>{t("inspector.shadowY")}</span>

              <div className={styles.unitInput}>
                <input
                  id={`${controlPrefix}-shadow-y`}
                  name={getControlName(controlPrefix, "ShadowY")}
                  type="number"
                  value={readAbsoluteNumber(style.shadow.y)}
                  onChange={(event) => {
                    const y =
                      parseOptionalNumber(event.target.value) ??
                      DEFAULT_SHADOW_Y;

                    updateShadow((shadow) => ({
                      ...shadow,

                      y,
                    }));
                  }}
                />

                <span>px</span>
              </div>
            </label>
          </div>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>{t("inspector.shadowBlur")}</span>

              <div className={styles.unitInput}>
                <input
                  id={`${controlPrefix}-shadow-blur`}
                  name={getControlName(controlPrefix, "ShadowBlur")}
                  type="number"
                  min="0"
                  value={readAbsoluteNumber(style.shadow.blur)}
                  onChange={(event) => {
                    const blur =
                      parseOptionalNumber(event.target.value) ??
                      DEFAULT_SHADOW_BLUR;

                    updateShadow((shadow) => ({
                      ...shadow,

                      blur,
                    }));
                  }}
                />

                <span>px</span>
              </div>
            </label>

            <label className={styles.field}>
              <span>{t("inspector.shadowSpread")}</span>

              <div className={styles.unitInput}>
                <input
                  id={`${controlPrefix}-shadow-spread`}
                  name={getControlName(controlPrefix, "ShadowSpread")}
                  type="number"
                  value={readAbsoluteNumber(style.shadow.spread)}
                  onChange={(event) => {
                    const spread = parseOptionalNumber(event.target.value);

                    updateShadow((shadow) => ({
                      ...shadow,

                      spread,
                    }));
                  }}
                />

                <span>px</span>
              </div>
            </label>
          </div>

          <label className={styles.field}>
            <span>{t("inspector.shadowColor")}</span>

            <input
              id={`${controlPrefix}-shadow-color`}
              name={getControlName(controlPrefix, "ShadowColor")}
              className={styles.colorInput}
              type="color"
              value={readPickerColor(style.shadow.color)}
              onChange={(event) => {
                const color = event.target.value;

                updateShadow((shadow) => ({
                  ...shadow,

                  color,
                }));
              }}
            />
          </label>
        </>
      )}
    </InspectorSection>
  );
}

// ============================================================
// END: ELEMENT EFFECTS SECTION
// ============================================================
