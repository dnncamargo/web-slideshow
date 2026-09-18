import type { ElementEffect, ElementTypography, TextStroke } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import { useAuthoringHistory } from "../../authoring-history-context";
import styles from "../../editor-workspace.module.css";
import { getControlName, parseOptionalNumber, readAbsoluteNumber } from "../inspector-helpers";
import type { UpdateElementEffect, UpdateElementTypography } from "../inspector-types";
import { InspectorSection } from "../inspector-section";
import { ColorControl } from "./color-control";

interface CanonicalTextEffectsSectionProps {
  effect: ElementEffect | undefined;
  typography: ElementTypography | undefined;
  textColor: string | undefined;
  onUpdateEffect: UpdateElementEffect;
  onUpdateTypography: UpdateElementTypography;
  controlPrefix: string;
}

type ShadowMode = "none" | "outer" | "inset";

const defaultShadow = (mode: Exclude<ShadowMode, "none">) => ({
  x: 0,
  y: 4,
  blur: 12,
  color: "#000000",
  ...(mode === "inset" ? { inset: true } : {}),
});

const defaultTextStroke = (color: string | undefined): TextStroke => ({
  width: 1,
  color: color ?? "#f8fafc",
});

export function CanonicalTextEffectsSection({
  effect,
  typography,
  textColor,
  onUpdateEffect,
  onUpdateTypography,
  controlPrefix,
}: CanonicalTextEffectsSectionProps) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const shadowMode: ShadowMode = effect?.shadow === undefined ? "none" : effect.shadow.inset ? "inset" : "outer";
  const strokeMode = typography?.textStroke === undefined ? "none" : "stroke";
  const shadow = effect?.shadow;

  function runDiscrete(callback: () => void): void {
    const meta = {
      kind: "element.setting",
      labelKey: "history.element.setting",
      labelParams: { setting: "shadow.mode" },
    };

    if (authoringHistory) {
      authoringHistory.discrete(meta, callback);
    } else {
      callback();
    }
  }

  function runTextStrokeDiscrete(callback: () => void): void {
    const meta = {
      kind: "element.setting",
      labelKey: "history.element.setting",
      labelParams: { setting: "textStroke.mode" },
    };

    if (authoringHistory) {
      authoringHistory.discrete(meta, callback);
    } else {
      callback();
    }
  }

  function updateShadow(update: (shadow: NonNullable<ElementEffect["shadow"]>) => NonNullable<ElementEffect["shadow"]>) {
    onUpdateEffect((current) => ({
      ...current,
      shadow: update(current?.shadow ?? defaultShadow("outer")),
    }));
  }

  return (
    <InspectorSection title={t("inspector.effects")}>
      <label className={styles.field}>
        <span>{t("inspector.textStroke")}</span>
        <select
          id={`${controlPrefix}-text-stroke-mode`}
          name={getControlName(controlPrefix, "TextStrokeMode")}
          value={strokeMode}
          onChange={(event) => {
            const mode = event.target.value === "stroke" ? "stroke" : "none";
            if (mode === strokeMode) return;
            runTextStrokeDiscrete(() => onUpdateTypography((current) => ({
              ...current,
              textStroke: mode === "stroke" ? current?.textStroke ?? defaultTextStroke(textColor) : undefined,
            })));
          }}
        >
          <option value="none">{t("inspector.textStroke.none")}</option>
          <option value="stroke">{t("inspector.textStroke.stroke")}</option>
        </select>
      </label>
      {typography?.textStroke && (
        <>
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>{t("inspector.textStrokeWidth")}</span>
              <div className={styles.unitInput}>
                <input
                  id={`${controlPrefix}-text-stroke-width`}
                  name={getControlName(controlPrefix, "TextStrokeWidth")}
                  type="number"
                  min="0"
                  value={readAbsoluteNumber(typography.textStroke.width)}
                  onChange={(event) => {
                    const width = parseOptionalNumber(event.target.value) ?? 1;
                    onUpdateTypography((current) => ({
                      ...current,
                      textStroke: {
                        ...(current?.textStroke ?? defaultTextStroke(textColor)),
                        width: Math.max(0, width),
                      },
                    }));
                  }}
                />
                <span>px</span>
              </div>
            </label>
          </div>
          <label className={styles.field}>
            <span>{t("inspector.textStrokeColor")}</span>
            <ColorControl
              id={`${controlPrefix}-text-stroke-color`}
              name={getControlName(controlPrefix, "TextStrokeColor")}
              value={typography.textStroke.color}
              onChange={(color) =>
                onUpdateTypography((current) => ({
                  ...current,
                  textStroke: {
                    ...(current?.textStroke ?? defaultTextStroke(textColor)),
                    color,
                  },
                }))
              }
            />
          </label>
        </>
      )}
      <label className={styles.field}>
        <span title={t("inspector.shadowHelp")}>{t("inspector.shadow")}</span>
        <select
          id={`${controlPrefix}-shadow-mode`}
          name={getControlName(controlPrefix, "ShadowMode")}
          value={shadowMode}
          onChange={(event) => {
            const mode = event.target.value;
            if (mode !== "none" && mode !== "outer" && mode !== "inset") return;
            if (mode === shadowMode) return;
            runDiscrete(() => onUpdateEffect((current) => ({
              ...current,
              shadow: mode === "none"
                ? undefined
                : current?.shadow === undefined
                  ? defaultShadow(mode)
                  : { ...current.shadow, inset: mode === "inset" ? true : undefined },
            })));
          }}
        >
          <option value="none">{t("inspector.shadow.none")}</option>
          <option value="outer">{t("inspector.shadow.outer")}</option>
          <option value="inset">{t("inspector.shadow.inset")}</option>
        </select>
      </label>
      {shadow && (
        <>
          <div className={styles.fieldGrid}>
            {(["x", "y"] as const).map((axis) => (
              <label className={styles.field} key={axis}>
                <span>{axis === "x" ? t("inspector.shadowX") : t("inspector.shadowY")}</span>
                <div className={styles.unitInput}>
                  <input
                    type="number"
                    value={readAbsoluteNumber(shadow[axis])}
                    onChange={(event) => {
                      const value = parseOptionalNumber(event.target.value) ?? 0;
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
              <input
                type="number"
                min="0"
                value={readAbsoluteNumber(shadow.blur)}
                onChange={(event) => updateShadow((shadow) => ({ ...shadow, blur: parseOptionalNumber(event.target.value) ?? 0 }))}
              />
            </label>
            <label className={styles.field}>
              <span>{t("inspector.shadowSpread")}</span>
              <input
                type="number"
                value={readAbsoluteNumber(shadow.spread)}
                onChange={(event) => updateShadow((shadow) => ({ ...shadow, spread: parseOptionalNumber(event.target.value) }))}
              />
            </label>
          </div>
          <label className={styles.field}>
            <span>{t("inspector.shadowColor")}</span>
            <ColorControl
              id={`${controlPrefix}-shadow-color`}
              name={getControlName(controlPrefix, "ShadowColor")}
              value={shadow.color}
              onChange={(color) => updateShadow((shadow) => ({ ...shadow, color }))}
            />
          </label>
        </>
      )}
    </InspectorSection>
  );
}
