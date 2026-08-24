import type { ContainerElement, Shadow } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import { getControlName, parseOptionalNumber, readAbsoluteNumber } from "../inspector-helpers";
import { InspectorSection } from "../inspector-section";
import { ColorControl } from "./color-control";

interface ContainerEffectsSectionProps {
  element: ContainerElement;
  onUpdate: (update: (element: ContainerElement) => ContainerElement) => void;
}

const DEFAULT_SHADOW: Shadow = { x: 0, y: 4, blur: 12, color: "#000000" };

export function ContainerEffectsSection({ element, onUpdate }: ContainerEffectsSectionProps) {
  const { t } = useStudioI18n();
  const shadow = element.effect?.shadow;

  function updateShadow(update: (shadow: Shadow) => Shadow) {
    onUpdate((current) => ({ ...current, effect: { ...current.effect, shadow: update(current.effect?.shadow ?? DEFAULT_SHADOW) } }));
  }

  return (
    <InspectorSection title={t("inspector.effects")}>
      <label className={styles.field}>
        <span title={t("inspector.shadowHelp")}>{t("inspector.shadow")}</span>
        <select
          id="container-shadow-mode"
          name={getControlName("container", "ShadowMode")}
          value={shadow === undefined ? "none" : shadow.inset ? "inset" : "outer"}
          onChange={(event) => {
            if (event.target.value === "none") {
              onUpdate((current) => ({ ...current, effect: { ...current.effect, shadow: undefined } }));
              return;
            }
            if (event.target.value !== "outer" && event.target.value !== "inset") return;
            updateShadow((current) => ({ ...current, inset: event.target.value === "inset" ? true : undefined }));
          }}
        >
          <option value="none">{t("inspector.shadow.none")}</option>
          <option value="outer">{t("inspector.shadow.outer")}</option>
          <option value="inset">{t("inspector.shadow.inset")}</option>
        </select>
      </label>

      {shadow !== undefined && (
        <>
          <div className={styles.fieldGrid}>
            {(["x", "y"] as const).map((axis) => (
              <label className={styles.field} key={axis}>
                <span>{t(`inspector.shadow${axis.toUpperCase()}` as "inspector.shadowX" | "inspector.shadowY")}</span>
                <div className={styles.unitInput}>
                  <input id={`container-shadow-${axis}`} name={getControlName("container", `Shadow${axis.toUpperCase()}`)} type="number" value={readAbsoluteNumber(shadow[axis])} onChange={(event) => updateShadow((current) => ({ ...current, [axis]: parseOptionalNumber(event.target.value) ?? 0 }))} />
                  <span>px</span>
                </div>
              </label>
            ))}
          </div>
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>{t("inspector.shadowBlur")}</span>
              <div className={styles.unitInput}>
                <input id="container-shadow-blur" name={getControlName("container", "ShadowBlur")} type="number" min="0" value={readAbsoluteNumber(shadow.blur)} onChange={(event) => updateShadow((current) => ({ ...current, blur: parseOptionalNumber(event.target.value) ?? 0 }))} />
                <span>px</span>
              </div>
            </label>
            <label className={styles.field}>
              <span>{t("inspector.shadowSpread")}</span>
              <div className={styles.unitInput}>
                <input id="container-shadow-spread" name={getControlName("container", "ShadowSpread")} type="number" value={readAbsoluteNumber(shadow.spread)} onChange={(event) => updateShadow((current) => ({ ...current, spread: parseOptionalNumber(event.target.value) ?? 0 }))} />
                <span>px</span>
              </div>
            </label>
          </div>
          <label className={styles.field}>
            <span>{t("inspector.shadowColor")}</span>
            <ColorControl id="container-shadow-color" name={getControlName("container", "ShadowColor")} value={shadow.color} onChange={(color) => updateShadow((current) => ({ ...current, color }))} />
          </label>
        </>
      )}
    </InspectorSection>
  );
}
