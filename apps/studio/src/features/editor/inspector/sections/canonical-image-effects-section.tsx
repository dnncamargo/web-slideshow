import type { ElementEffect, Shadow } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";
import { getControlName, parseOptionalNumber, readAbsoluteNumber } from "../inspector-helpers";
import { InspectorSection } from "../inspector-section";
import { ColorControl } from "./color-control";

interface Props {
  effect: ElementEffect | undefined;
  onUpdateEffect: (update: (effect: ElementEffect | undefined) => ElementEffect) => void;
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
  return shadow === undefined ? "none" : shadow.inset ? "inset" : "outer";
}

function isEnabledShadowMode(value: string): value is Exclude<ShadowMode, "none"> {
  return value === "outer" || value === "inset";
}

export function CanonicalImageEffectsSection({ effect, onUpdateEffect }: Props) {
  const { t } = useStudioI18n();
  const updateShadow = (update: (shadow: Shadow) => Shadow) =>
    onUpdateEffect((current) => ({ ...current, shadow: update(current?.shadow ?? createDefaultShadow("outer")) }));

  return (
    <InspectorSection title={t("inspector.effects")}>
      <label className={styles.field}>
        <span title={t("inspector.shadowHelp")}>{t("inspector.shadow")}</span>
        <select
          id="image-shadow-mode"
          name={getControlName("image", "ShadowMode")}
          value={getShadowMode(effect?.shadow)}
          onChange={(event) => {
            if (event.target.value === "none") {
              onUpdateEffect((current) => ({ ...current, shadow: undefined }));
            } else if (isEnabledShadowMode(event.target.value)) {
              const mode = event.target.value;
              onUpdateEffect((current) => ({
                ...current,
                shadow: current?.shadow ?? createDefaultShadow(mode),
              }));
            }
          }}
        >
          <option value="none">{t("inspector.shadow.none")}</option>
          <option value="outer">{t("inspector.shadow.outer")}</option>
          <option value="inset">{t("inspector.shadow.inset")}</option>
        </select>
      </label>

      {effect?.shadow !== undefined && (
        <>
          <div className={styles.fieldGrid}>
            {(["x", "y"] as const).map((axis) => (
              <label className={styles.field} key={axis}>
                <span>{axis.toUpperCase()}</span>
                <div className={styles.unitInput}>
                  <input
                    id={`image-shadow-${axis}`}
                    name={getControlName("image", `Shadow${axis.toUpperCase()}`)}
                    type="number"
                    value={readAbsoluteNumber(effect.shadow![axis])}
                    onChange={(event) => {
                      const value = parseOptionalNumber(event.target.value) ?? (axis === "x" ? DEFAULT_SHADOW_X : DEFAULT_SHADOW_Y);
                      updateShadow((shadow) => ({ ...shadow, [axis]: value }));
                    }}
                  />
                  <span>px</span>
                </div>
              </label>
            ))}
          </div>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>{t("inspector.shadowBlur")}</span>
              <div className={styles.unitInput}>
                <input
                  id="image-shadow-blur"
                  name={getControlName("image", "ShadowBlur")}
                  type="number"
                  min="0"
                  value={readAbsoluteNumber(effect.shadow.blur)}
                  onChange={(event) => updateShadow((shadow) => ({ ...shadow, blur: parseOptionalNumber(event.target.value) ?? DEFAULT_SHADOW_BLUR }))}
                />
                <span>px</span>
              </div>
            </label>
            <label className={styles.field}>
              <span>{t("inspector.shadowSpread")}</span>
              <div className={styles.unitInput}>
                <input
                  id="image-shadow-spread"
                  name={getControlName("image", "ShadowSpread")}
                  type="number"
                  value={readAbsoluteNumber(effect.shadow.spread)}
                  onChange={(event) => updateShadow((shadow) => ({ ...shadow, spread: parseOptionalNumber(event.target.value) }))}
                />
                <span>px</span>
              </div>
            </label>
          </div>

          <label className={styles.field}>
            <span>{t("inspector.shadowColor")}</span>
            <ColorControl
              id="image-shadow-color"
              name={getControlName("image", "ShadowColor")}
              value={effect.shadow.color}
              onChange={(color) => updateShadow((shadow) => ({ ...shadow, color }))}
            />
          </label>
        </>
      )}
    </InspectorSection>
  );
}
