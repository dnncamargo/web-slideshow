import type { ElementEffect, Shadow } from "@web-slideshow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import { useAuthoringHistory } from "../../authoring-history-context";

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
const NUMBER_HISTORY_META = { kind: "number.change", labelKey: "history.number.change" } as const;
type ShadowNumberKey = "x" | "y" | "blur" | "spread";

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
  const authoringHistory = useAuthoringHistory();
  const shadowMode = getShadowMode(effect?.shadow);
  const runDiscrete = (callback: () => void): void => {
    const meta = { kind: "element.setting", labelKey: "history.element.setting", labelParams: { setting: "shadow.mode" } };
    if (authoringHistory) authoringHistory.discrete(meta, callback);
    else callback();
  };
  const updateShadow = (update: (shadow: Shadow) => Shadow) =>
    onUpdateEffect((current) => ({ ...current, shadow: update(current?.shadow ?? createDefaultShadow("outer")) }));
  const beginNumberEditing = (key: ShadowNumberKey) => authoringHistory?.begin(`number:image-shadow-${key}`, NUMBER_HISTORY_META);
  const updateShadowNumber = (key: ShadowNumberKey, value: number | undefined) => {
    const currentValue = effect?.shadow?.[key];
    const unchanged = value === undefined ? currentValue === undefined : readAbsoluteNumber(currentValue) === value;
    if (unchanged) return;
    const historyKey = `number:image-shadow-${key}`;
    const update = () => updateShadow((shadow) => ({ ...shadow, [key]: value }));
    if (!authoringHistory) {
      update();
      return;
    }
    authoringHistory.begin(historyKey, NUMBER_HISTORY_META);
    authoringHistory.update(historyKey, update);
  };

  return (
    <InspectorSection title={t("inspector.effects")}>
      <label className={styles.field}>
        <span title={t("inspector.shadowHelp")}>{t("inspector.shadow")}</span>
        <select
          id="image-shadow-mode"
          name={getControlName("image", "ShadowMode")}
          value={getShadowMode(effect?.shadow)}
          onChange={(event) => {
            const mode = event.target.value;
            if (mode !== "none" && !isEnabledShadowMode(mode)) return;
            if (mode === shadowMode) return;
            runDiscrete(() => onUpdateEffect((current) => ({
              ...current,
              shadow: mode === "none"
                ? undefined
                : current?.shadow === undefined
                  ? createDefaultShadow(mode)
                  : { ...current.shadow, inset: mode === "inset" ? true : undefined },
            })));
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
                    onFocus={() => beginNumberEditing(axis)}
                    onBlur={() => authoringHistory?.finish(`number:image-shadow-${axis}`)}
                    onChange={(event) => updateShadowNumber(axis, parseOptionalNumber(event.target.value) ?? (axis === "x" ? DEFAULT_SHADOW_X : DEFAULT_SHADOW_Y))}
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
                  onFocus={() => beginNumberEditing("blur")}
                  onBlur={() => authoringHistory?.finish("number:image-shadow-blur")}
                  onChange={(event) => updateShadowNumber("blur", parseOptionalNumber(event.target.value) ?? DEFAULT_SHADOW_BLUR)}
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
                  onFocus={() => beginNumberEditing("spread")}
                  onBlur={() => authoringHistory?.finish("number:image-shadow-spread")}
                  onChange={(event) => updateShadowNumber("spread", parseOptionalNumber(event.target.value))}
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
