import type { ElementEffect, PowerShowElement, SurfaceVisualStyle } from "@powershow/document-schema";
import { resolveEffectiveElementStyleDefaults } from "@powershow/theme/element-style-defaults";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import styles from "../../editor-workspace.module.css";
import { getControlName } from "../inspector-helpers";
import { InspectorSection } from "../inspector-section";
import type { UpdateSurfaceStyle } from "../inspector-types";
import { ColorControl } from "./color-control";
import { ElementBorderControl } from "./element-border-control";
import { EffectiveLengthInput } from "./effective-length-input";

interface Props {
  style: SurfaceVisualStyle | undefined;
  effect: ElementEffect | undefined;
  element: Extract<PowerShowElement, { type: "gallery" | "embed" | "scripted" }>;
  onUpdateStyle: UpdateSurfaceStyle;
  onUpdateEffect: (update: (effect: ElementEffect | undefined) => ElementEffect) => void;
  controlPrefix: string;
}

export function CanonicalSurfaceAppearanceSection({ style, effect, element, onUpdateStyle, onUpdateEffect, controlPrefix }: Props) {
  const { t } = useStudioI18n();
  const effectiveDefaults = resolveEffectiveElementStyleDefaults(element).borderRadius;
  return <InspectorSection title={t("inspector.appearance")}>
    <div className={styles.colorControl}>
      <label className={styles.field}>
        <span title={t("inspector.backgroundHelp")}>{t("inspector.background")}</span>
        <ColorControl id={`${controlPrefix}-background`} name={getControlName(controlPrefix, "Background")} value={style?.background?.color} onChange={(color) => onUpdateStyle((current) => ({ ...current, background: { ...current?.background, color } }))} />
      </label>
      <button className={styles.secondaryButton} type="button" onClick={() => onUpdateStyle((current) => ({ ...current, background: undefined }))}><span>{t("inspector.clearBackground")}</span></button>
    </div>
    <div className={styles.fieldGrid}>
      <div className={styles.field}>
        <label htmlFor={`${controlPrefix}-border-radius`} title={t("inspector.roundedCornersHelp")}>{t("inspector.roundedCorners")}</label>
        <EffectiveLengthInput id={`${controlPrefix}-border-radius`} name={getControlName(controlPrefix, "BorderRadius")} min="0" value={style?.borderRadius} inheritedValue={effectiveDefaults} preferredUnit="px" units={["px", "rem"]} stepByUnit={{ px: "1", rem: "0.1" }} onChange={(borderRadius) => onUpdateStyle((current) => ({ ...current, borderRadius }))} onReset={() => onUpdateStyle((current) => ({ ...current, borderRadius: undefined }))} />
      </div>
      <label className={styles.field}><span title={t("inspector.opacityHelp")}>{t("inspector.opacity")}</span><div className={styles.unitInput}><input id={`${controlPrefix}-opacity`} name={getControlName(controlPrefix, "Opacity")} type="number" min="0" max="100" value={(effect?.opacity ?? 1) * 100} onChange={(event) => { const value = Number(event.target.value); onUpdateEffect((current) => ({ ...current, opacity: Number.isFinite(value) ? Math.max(0, Math.min(1, value / 100)) : undefined })); }} /><span>%</span></div></label>
    </div>
    <ElementBorderControl border={style?.border} onChange={(border) => onUpdateStyle((current) => ({ ...current, border }))} controlPrefix={controlPrefix} />
  </InspectorSection>;
}
