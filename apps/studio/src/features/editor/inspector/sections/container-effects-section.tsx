import type { ContainerElement, Presentation, Shadow } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import { getControlName, parseOptionalNumber, readAbsoluteNumber } from "../inspector-helpers";
import { InspectorSection } from "../inspector-section";
import { ColorControl } from "./color-control";
import { getContainerShareablePropertySource } from "../linked-style-inspector";
import { ContainerLinkedPropertyMeta } from "./container-linked-property-meta";

interface ContainerEffectsSectionProps {
  element: ContainerElement;
  localElement?: ContainerElement;
  presentation?: Pick<Presentation, "linkedStyles">;
  onUpdate: (update: (element: ContainerElement) => ContainerElement) => void;
  embedded?: boolean;
  showSourceMeta?: boolean;
  allowNone?: boolean;
}

export function createDefaultShadow(): Shadow {
  return { x: 0, y: 4, blur: 12, color: "#000000" };
}

export function ContainerEffectsSection({ element, localElement = element, presentation, onUpdate, embedded = false, showSourceMeta = true, allowNone = true }: ContainerEffectsSectionProps) {
  const { t } = useStudioI18n();
  const shadow = element.effect?.shadow;
  const shadowSource = getContainerShareablePropertySource(presentation, localElement, "effect.shadow");

  function updateShadow(update: (shadow: Shadow) => Shadow) {
    onUpdate((current) => ({ ...current, effect: { ...current.effect, shadow: update(current.effect?.shadow ?? shadow ?? createDefaultShadow()) } }));
  }

  const content = (
    <>
      <label className={styles.field}>
        <span title={t("inspector.shadowHelp")}>{t("inspector.shadow")}</span>
        <select
          id="container-shadow-mode"
          name={getControlName("container", "ShadowMode")}
          value={shadow === undefined ? "none" : shadow.inset ? "inset" : "outer"}
          onChange={(event) => {
            if (event.target.value === "none") {
              if (shadowSource.linkedValue !== undefined) return;
              onUpdate((current) => ({ ...current, effect: { ...current.effect, shadow: undefined } }));
              return;
            }
            if (event.target.value !== "outer" && event.target.value !== "inset") return;
            updateShadow((current) => ({ ...current, inset: event.target.value === "inset" ? true : undefined }));
          }}
        >
          {allowNone && <option value="none" disabled={shadowSource.linkedValue !== undefined}>{t("inspector.shadow.none")}</option>}
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
      {showSourceMeta ? <ContainerLinkedPropertyMeta source={shadowSource.source} onReset={shadowSource.source === "local" && shadowSource.linkedValue !== undefined ? () => onUpdate((current) => ({ ...current, effect: current.effect === undefined ? undefined : { ...current.effect, shadow: undefined } })) : undefined} /> : null}
    </>
  );
  return embedded ? content : <InspectorSection title={t("inspector.effects")}>{content}</InspectorSection>;
}
