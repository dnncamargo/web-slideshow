import type { ElementEffect, PresentationElement, SurfaceVisualStyle } from "@web-slideshow/document-schema";
import { resolveEffectiveElementStyleDefaults } from "@web-slideshow/theme/element-style-defaults";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import styles from "../../editor-workspace.module.css";
import { getControlName, parseOptionalNumber } from "../inspector-helpers";
import { useAuthoringHistory } from "../../authoring-history-context";
import { InspectorSection } from "../inspector-section";
import type { UpdateSurfaceStyle } from "../inspector-types";
import { ColorControl } from "./color-control";
import { ElementBorderControl } from "./element-border-control";
import { EffectiveLengthInput } from "./effective-length-input";

interface Props {
  style: SurfaceVisualStyle | undefined;
  effect: ElementEffect | undefined;
  element: Extract<PresentationElement, { type: "gallery" | "embed" | "scripted" }>;
  onUpdateStyle: UpdateSurfaceStyle;
  onUpdateEffect: (update: (effect: ElementEffect | undefined) => ElementEffect) => void;
  controlPrefix: string;
}

const numberHistoryMeta = { kind: "number.change", labelKey: "history.number.change" } as const;

export function CanonicalSurfaceAppearanceSection({ style, effect, element, onUpdateStyle, onUpdateEffect, controlPrefix }: Props) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const effectiveDefaults = resolveEffectiveElementStyleDefaults(element).borderRadius;
  const opacityHistoryKey = `number:${controlPrefix}-opacity`;
  const updateOpacity = (opacity: number | undefined) => {
    if (opacity === effect?.opacity) return;
    const update = () => onUpdateEffect((current) => ({ ...current, opacity }));
    if (!authoringHistory) {
      update();
      return;
    }
    authoringHistory.begin(opacityHistoryKey, numberHistoryMeta);
    authoringHistory.update(opacityHistoryKey, update);
  };
  return <InspectorSection title={t("inspector.appearance")}>
    <div className={styles.colorControl}>
      <label className={styles.field}>
        <span title={t("inspector.backgroundHelp")}>{t("inspector.background")}</span>
        <ColorControl id={`${controlPrefix}-background`} name={getControlName(controlPrefix, "Background")} value={style?.background?.color} onChange={(color) => onUpdateStyle((current) => ({ ...current, background: { ...current?.background, color } }))} secondaryAction={{ label: t("inspector.remove"), onClick: () => onUpdateStyle((current) => ({ ...current, background: undefined })) }} />
      </label>
    </div>
    <div className={styles.fieldGrid}>
      <div className={styles.field}>
        <label htmlFor={`${controlPrefix}-border-radius`} title={t("inspector.roundedCornersHelp")}>{t("inspector.roundedCorners")}</label>
        <EffectiveLengthInput id={`${controlPrefix}-border-radius`} name={getControlName(controlPrefix, "BorderRadius")} min="0" value={style?.borderRadius} inheritedValue={effectiveDefaults} preferredUnit="px" units={["px", "rem"]} stepByUnit={{ px: "1", rem: "0.1" }} onChange={(borderRadius) => onUpdateStyle((current) => ({ ...current, borderRadius }))} onReset={() => onUpdateStyle((current) => ({ ...current, borderRadius: undefined }))} />
      </div>
      <label className={styles.field}><span title={t("inspector.opacityHelp")}>{t("inspector.opacity")}</span><div className={styles.unitInput}><input id={`${controlPrefix}-opacity`} name={getControlName(controlPrefix, "Opacity")} type="number" min="0" max="100" value={(effect?.opacity ?? 1) * 100} onFocus={() => authoringHistory?.begin(opacityHistoryKey, numberHistoryMeta)} onBlur={() => authoringHistory?.finish(opacityHistoryKey)} onChange={(event) => { const value = parseOptionalNumber(event.target.value); updateOpacity(value === undefined ? undefined : Math.max(0, Math.min(1, value / 100))); }} /><span>%</span></div></label>
    </div>
    <ElementBorderControl border={style?.border} onChange={(border) => onUpdateStyle((current) => ({ ...current, border }))} controlPrefix={controlPrefix} />
  </InspectorSection>;
}
