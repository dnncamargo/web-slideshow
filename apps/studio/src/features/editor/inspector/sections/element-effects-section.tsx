import type { ElementStyle, Shadow } from "@powershow/document-schema";

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
}

type ShadowMode = "none" | "outer" | "inset";

const DEFAULT_SHADOW_X = 0;

const DEFAULT_SHADOW_Y = 4;

const DEFAULT_SHADOW_BLUR = 12;

const DEFAULT_SHADOW_COLOR = "#000000";

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

// ============================================================
// BEGIN: ELEMENT EFFECTS SECTION
// ============================================================

export function ElementEffectsSection({
  style,
  onUpdateStyle,
  controlPrefix,
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
