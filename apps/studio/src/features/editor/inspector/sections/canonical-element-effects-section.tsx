import type { ElementEffect, Shadow } from "@powershow/document-schema";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import styles from "../../editor-workspace.module.css";
import { getControlName, parseOptionalNumber, readAbsoluteNumber } from "../inspector-helpers";
import { InspectorSection } from "../inspector-section";
import type { UpdateElementEffect } from "../inspector-types";
import { ColorControl } from "./color-control";

interface Props { effect: ElementEffect | undefined; onUpdateEffect: UpdateElementEffect; controlPrefix: string; }
const defaultShadow = (): Shadow => ({ x: 0, y: 4, blur: 12, color: "#000000" });
export function CanonicalElementEffectsSection({ effect, onUpdateEffect, controlPrefix }: Props) {
  const { t } = useStudioI18n();
  const shadow = effect?.shadow;
  const updateShadow = (update: (shadow: Shadow) => Shadow) => onUpdateEffect((current) => ({ ...current, shadow: update(current?.shadow ?? defaultShadow()) }));
  return <InspectorSection title={t("inspector.effects")}>
    <label className={styles.field}><span title={t("inspector.opacityHelp")}>{t("inspector.opacity")}</span><div className={styles.unitInput}><input id={`${controlPrefix}-opacity`} name={getControlName(controlPrefix, "Opacity")} type="number" min="0" max="100" value={(effect?.opacity ?? 1) * 100} onChange={(event) => { const value = parseOptionalNumber(event.target.value); onUpdateEffect((current) => ({ ...current, opacity: value === undefined ? undefined : Math.max(0, Math.min(1, value / 100)) })); }} /><span>%</span></div></label>
    <label className={styles.field}><span title={t("inspector.shadowHelp")}>{t("inspector.shadow")}</span><select id={`${controlPrefix}-shadow-mode`} name={getControlName(controlPrefix, "ShadowMode")} value={shadow === undefined ? "none" : shadow.inset ? "inset" : "outer"} onChange={(event) => { const mode = event.target.value; onUpdateEffect((current) => ({ ...current, shadow: mode === "none" ? undefined : current?.shadow ?? { ...defaultShadow(), ...(mode === "inset" ? { inset: true } : {}) } })); }}><option value="none">{t("inspector.shadow.none")}</option><option value="outer">{t("inspector.shadow.outer")}</option><option value="inset">{t("inspector.shadow.inset")}</option></select></label>
    {shadow && <><div className={styles.fieldGrid}>
      {(["x", "y", "blur"] as const).map((key) => <label className={styles.field} key={key}><span>{key}</span><div className={styles.unitInput}><input id={`${controlPrefix}-shadow-${key}`} name={getControlName(controlPrefix, `Shadow${key[0].toUpperCase()}${key.slice(1)}`)} type="number" value={readAbsoluteNumber(shadow[key])} onChange={(event) => updateShadow((current) => ({ ...current, [key]: parseOptionalNumber(event.target.value) ?? 0 }))} /><span>px</span></div></label>)}
    </div><label className={styles.field}><span>{t("inspector.shadowColor")}</span><ColorControl id={`${controlPrefix}-shadow-color`} name={getControlName(controlPrefix, "ShadowColor")} value={shadow.color} onChange={(color) => updateShadow((current) => ({ ...current, color }))} /></label></>}
  </InspectorSection>;
}
