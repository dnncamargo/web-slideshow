import type { ElementTypography, Glow, TextEffect, TextStroke } from "@web-slideshow/document-schema";

import { THEME_COLORS } from "@web-slideshow/theme/element-style-defaults";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import { useAuthoringHistory } from "../../authoring-history-context";
import styles from "../../editor-workspace.module.css";
import { getControlName, parseOptionalNumber, readAbsoluteNumber } from "../inspector-helpers";
import type { UpdateTextEffect, UpdateElementTypography } from "../inspector-types";
import { InspectorSection } from "../inspector-section";
import { ColorControl } from "./color-control";
import type { TextStylePropertyInfo } from "../text-style-property";
import { TextStylePropertyMeta } from "./text-style-property-meta";

interface CanonicalTextEffectsSectionProps {
  effect: TextEffect | undefined;
  typography: ElementTypography | undefined;
  textColor: string | undefined;
  onUpdateEffect: UpdateTextEffect;
  onUpdateTypography: UpdateElementTypography;
  controlPrefix: string;
  textStrokeDisabled?: boolean;
  textStrokeFallback?: TextStroke;
  textStrokeSource?: TextStylePropertyInfo;
  onResetTextStroke?: () => void;
  textDecorationColorFallback?: ElementTypography["textDecorationColor"];
  textDecorationColorSource?: TextStylePropertyInfo;
  onResetTextDecorationColor?: () => void;
}

type ShadowMode = "none" | "outer";

const defaultShadow = (): NonNullable<TextEffect["shadow"]> => ({
  x: 0,
  y: 4,
  blur: 12,
  color: "#000000",
});

const defaultGlow = (): Glow => ({ blur: 12, color: THEME_COLORS.accent });

function isDormantGlow(glow: Glow | undefined): boolean {
  if (glow === undefined) return false;
  const blur = readAbsoluteNumber(glow.blur);
  return typeof blur === "number" && blur <= 0;
}

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
  textStrokeSource,
  onResetTextStroke,
  textDecorationColorFallback,
  textDecorationColorSource,
  onResetTextDecorationColor,
}: CanonicalTextEffectsSectionProps) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const shadowMode: ShadowMode = effect?.shadow === undefined ? "none" : "outer";
  const glow = isDormantGlow(effect?.glow) ? undefined : effect?.glow;
  const glowMode = glow === undefined ? "none" : "glow";
  const effectiveTextStroke = typography?.textStroke ?? textStrokeFallback;
  const strokeMode = effectiveTextStroke === undefined || readAbsoluteNumber(effectiveTextStroke.width) === 0 ? "none" : "stroke";
  const shadow = effect?.shadow;

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

  function updateShadow(update: (shadow: NonNullable<TextEffect["shadow"]>) => NonNullable<TextEffect["shadow"]>) {
    onUpdateEffect((current) => ({
      ...current,
      shadow: update(current?.shadow ?? defaultShadow()),
    }));
  }

  function updateGlow(update: (glow: NonNullable<TextEffect["glow"]>) => NonNullable<TextEffect["glow"]>) {
    onUpdateEffect((current) => ({
      ...current,
      glow: update(current?.glow ?? defaultGlow()),
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
        <TextStylePropertyMeta
          source={textStrokeSource?.source}
          linkedValue={textStrokeSource?.linkedValue}
          onReset={onResetTextStroke}
        />
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
        <span>{t("inspector.textDecorationColor")}</span>
        <ColorControl
          id={`${controlPrefix}-text-decoration-color`}
          name={getControlName(controlPrefix, "TextDecorationColor")}
          value={typography?.textDecorationColor}
          effectiveValue={textDecorationColorFallback}
          onChange={(color) => onUpdateTypography((current) => ({ ...current, textDecorationColor: color }))}
        />
        <TextStylePropertyMeta
          source={textDecorationColorSource?.source}
          linkedValue={textDecorationColorSource?.linkedValue}
          onReset={onResetTextDecorationColor}
        />
      </label>
      <label className={styles.field}>
        <span title={t("inspector.shadowHelp")}>{t("inspector.shadow")}</span>
        <select
          id={`${controlPrefix}-shadow-mode`}
          name={getControlName(controlPrefix, "ShadowMode")}
          value={shadowMode}
          onChange={(event) => {
            const mode = event.target.value;
            if (mode !== "none" && mode !== "outer") return;
            if (mode === shadowMode) return;
            runDiscrete("shadow.mode", () => onUpdateEffect((current) => ({
              ...current,
              shadow: mode === "none"
                ? undefined
                : current?.shadow === undefined
                  ? defaultShadow()
                  : current.shadow,
            })));
          }}
        >
          <option value="none">{t("inspector.shadow.none")}</option>
          <option value="outer">{t("inspector.shadow.outer")}</option>
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
      <label className={styles.field}>
        <span>{t("inspector.glow")}</span>
        <select
          id={`${controlPrefix}-glow-mode`}
          name={getControlName(controlPrefix, "GlowMode")}
          value={glowMode}
          onChange={(event) => {
            const mode = event.target.value === "glow" ? "glow" : "none";
            if (mode === glowMode) return;
            runDiscrete("glow.mode", () => onUpdateEffect((current) => ({
              ...current,
              glow: mode === "none" ? undefined : current?.glow !== undefined && !isDormantGlow(current.glow) ? current.glow : defaultGlow(),
            })));
          }}
        >
          <option value="none">{t("inspector.glow.none")}</option>
          <option value="glow">{t("inspector.glow.glow")}</option>
        </select>
      </label>
      {glow && (
        <>
          <label className={styles.field}>
            <span>{t("inspector.shadowBlur")}</span>
            <input
              id={`${controlPrefix}-glow-blur`}
              name={getControlName(controlPrefix, "GlowBlur")}
              type="number"
              min="1"
              value={readAbsoluteNumber(glow.blur)}
              onFocus={() => beginNumberEditing("glow-blur")}
              onBlur={() => authoringHistory?.finish(`number:${controlPrefix}-glow-blur`)}
              onChange={(event) => {
                const blur = Math.max(1, parseOptionalNumber(event.target.value) ?? 1);
                updateNumber("glow-blur", glow.blur, blur, () => updateGlow((current) => ({ ...current, blur })));
              }}
            />
          </label>
          <label className={styles.field}>
            <span>{t("inspector.shadowColor")}</span>
            <ColorControl
              id={`${controlPrefix}-glow-color`}
              name={getControlName(controlPrefix, "GlowColor")}
              value={glow.color}
              onChange={(color) => updateGlow((current) => ({ ...current, color }))}
            />
          </label>
        </>
      )}
    </InspectorSection>
  );
}
