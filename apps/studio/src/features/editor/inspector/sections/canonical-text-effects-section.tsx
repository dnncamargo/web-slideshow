import type { ElementEffect, ElementTypography, TextStroke } from "@web-slideshow/document-schema";

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
  textStrokeDisabled?: boolean;
  textStrokeFallback?: TextStroke;
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
const numberHistoryMeta = { kind: "number.change", labelKey: "history.number.change" } as const;

export function CanonicalTextEffectsSection({
  effect,
  typography,
  textColor,
  onUpdateEffect,
  onUpdateTypography,
  controlPrefix,
  textStrokeDisabled = false,
  textStrokeFallback,
}: CanonicalTextEffectsSectionProps) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const shadowMode: ShadowMode = effect?.shadow === undefined ? "none" : effect.shadow.inset ? "inset" : "outer";
  const effectiveTextStroke = typography?.textStroke ?? textStrokeFallback;
  const strokeMode = effectiveTextStroke === undefined || readAbsoluteNumber(effectiveTextStroke.width) === 0 ? "none" : "stroke";
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
    if (textStrokeDisabled) return;
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

  function updateNumber(key: string, currentValue: string | number | undefined, value: number | undefined, update: () => void, disabled = false): void {
    if (disabled) return;
    const unchanged = value === undefined ? currentValue === undefined : readAbsoluteNumber(currentValue) === value;
    if (unchanged) return;
    const historyKey = `number:${controlPrefix}-${key}`;
    if (!authoringHistory) {
      update();
      return;
    }
    authoringHistory.begin(historyKey, numberHistoryMeta);
    authoringHistory.update(historyKey, update);
  }

  function beginNumberEditing(key: string, disabled = false): void {
    if (disabled) return;
    authoringHistory?.begin(`number:${controlPrefix}-${key}`, numberHistoryMeta);
  }

  return (
    <InspectorSection title={t("inspector.effects")}>
      <label className={styles.field}>
        <span>{t("inspector.textStroke")}</span>
        <select
          id={`${controlPrefix}-text-stroke-mode`}
          name={getControlName(controlPrefix, "TextStrokeMode")}
          value={strokeMode}
          disabled={textStrokeDisabled}
          onChange={(event) => {
            const mode = event.target.value === "stroke" ? "stroke" : "none";
            if (mode === strokeMode) return;
            runTextStrokeDiscrete(() => onUpdateTypography((current) => {
              const localStroke = current?.textStroke;
              const inheritedStroke = textStrokeFallback;
              const baseStroke = localStroke ?? inheritedStroke ?? defaultTextStroke(textColor);
              if (mode === "none") {
                return {
                  ...current,
                  textStroke: {
                    ...baseStroke,
                    width: 0,
                  },
                };
              }

              const inheritedWidth = inheritedStroke === undefined ? "" : readAbsoluteNumber(inheritedStroke.width);
              const fallbackWidth = typeof inheritedWidth === "number" && inheritedWidth > 0
                ? inheritedWidth
                : 1;
              const width = localStroke !== undefined && readAbsoluteNumber(localStroke.width) === 0
                ? fallbackWidth
                : readAbsoluteNumber(baseStroke.width) || 1;
              return {
                ...current,
                textStroke: {
                  ...baseStroke,
                  width,
                },
              };
            }));
          }}
        >
          <option value="none">{t("inspector.textStroke.none")}</option>
          <option value="stroke">{t("inspector.textStroke.stroke")}</option>
        </select>
      </label>
      {effectiveTextStroke && (
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
                  value={readAbsoluteNumber(effectiveTextStroke.width)}
                  disabled={textStrokeDisabled}
                  onFocus={() => beginNumberEditing("text-stroke-width", textStrokeDisabled)}
                  onBlur={() => { if (!textStrokeDisabled) authoringHistory?.finish(`number:${controlPrefix}-text-stroke-width`); }}
                  onChange={(event) => {
                    const width = Math.max(0, parseOptionalNumber(event.target.value) ?? 1);
                    updateNumber("text-stroke-width", effectiveTextStroke.width, width, () => onUpdateTypography((current) => ({
                      ...current,
                      textStroke: {
                        ...(current?.textStroke ?? textStrokeFallback ?? defaultTextStroke(textColor)),
                        width,
                      },
                    })), textStrokeDisabled);
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
              value={effectiveTextStroke.color}
              disabled={textStrokeDisabled}
              onChange={(color) =>
                onUpdateTypography((current) => ({
                  ...current,
                  textStroke: {
                    ...(current?.textStroke ?? textStrokeFallback ?? defaultTextStroke(textColor)),
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
                    id={`${controlPrefix}-shadow-${axis}`}
                    type="number"
                    value={readAbsoluteNumber(shadow[axis])}
                    onFocus={() => beginNumberEditing(`shadow-${axis}`)}
                    onBlur={() => authoringHistory?.finish(`number:${controlPrefix}-shadow-${axis}`)}
                    onChange={(event) => updateNumber(`shadow-${axis}`, shadow[axis], parseOptionalNumber(event.target.value) ?? 0, () => updateShadow((current) => ({ ...current, [axis]: parseOptionalNumber(event.target.value) ?? 0 })))}
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
                onFocus={() => beginNumberEditing("shadow-blur")}
                onBlur={() => authoringHistory?.finish(`number:${controlPrefix}-shadow-blur`)}
                onChange={(event) => updateNumber("shadow-blur", shadow.blur, parseOptionalNumber(event.target.value) ?? 0, () => updateShadow((current) => ({ ...current, blur: parseOptionalNumber(event.target.value) ?? 0 })))}
              />
            </label>
            <label className={styles.field}>
              <span>{t("inspector.shadowSpread")}</span>
              <input
                type="number"
                value={readAbsoluteNumber(shadow.spread)}
                onFocus={() => beginNumberEditing("shadow-spread")}
                onBlur={() => authoringHistory?.finish(`number:${controlPrefix}-shadow-spread`)}
                onChange={(event) => updateNumber("shadow-spread", shadow.spread, parseOptionalNumber(event.target.value), () => updateShadow((current) => ({ ...current, spread: parseOptionalNumber(event.target.value) })))}
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
