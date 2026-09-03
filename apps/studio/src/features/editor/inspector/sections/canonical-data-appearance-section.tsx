import type {
  BlocksVisualStyle,
  ElementEffect,
  GradientSurfaceBackground,
  GradientSurfaceVisualStyle,
  ColorValue,
  PowerShowElement,
} from "@powershow/document-schema";
import { resolveEffectiveElementStyleDefaults } from "@powershow/theme/element-style-defaults";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import styles from "../../editor-workspace.module.css";
import { getControlName, parseOptionalNumber } from "../inspector-helpers";
import { InspectorSection } from "../inspector-section";
import { ColorControl } from "./color-control";
import { ElementBorderControl } from "./element-border-control";
import { ElementGradientControl } from "./element-gradient-control";
import { EffectiveLengthInput } from "./effective-length-input";

export type CanonicalDataStyle = GradientSurfaceVisualStyle | BlocksVisualStyle;
type LegacyColorStyle = { color?: ColorValue };
type DataElement = Extract<PowerShowElement, { type: "code" | "terminal" | "table" | "blocks" }>;

type BackgroundKey = "color" | "gradient";

function updateCanonicalBackground(
  style: CanonicalDataStyle | undefined,
  key: BackgroundKey,
  value: GradientSurfaceBackground[BackgroundKey] | undefined,
): CanonicalDataStyle {
  const background = {
    ...style?.background,
    [key]: value,
  } as GradientSurfaceBackground;

  if (background.color === undefined && background.gradient === undefined) {
    return { ...style, background: undefined };
  }

  return { ...style, background };
}

const BLOCK_DEFAULT_COLORS = {
  statement: "#4C97FF",
  scope: "#FFAB19",
  logic: "#59C059",
} as const;

interface Props {
  element: DataElement;
  style: CanonicalDataStyle | undefined;
  effect: ElementEffect | undefined;
  showColor?: boolean;
  onUpdateStyle: (update: (style: CanonicalDataStyle | undefined) => CanonicalDataStyle) => void;
  onUpdateEffect: (update: (effect: ElementEffect | undefined) => ElementEffect) => void;
  controlPrefix: string;
}

export function CanonicalDataAppearanceSection({ element, style, effect, showColor = false, onUpdateStyle, onUpdateEffect, controlPrefix }: Props) {
  const { t } = useStudioI18n();
  const radius = resolveEffectiveElementStyleDefaults(element).borderRadius;
  return <InspectorSection title={t("inspector.appearance")}>
    {element.type === "blocks" && <div className={styles.colorControl} data-powershow-blocks-colors="true">
      <div className={styles.field}><span>{t("inspector.blocks.colorGroup")}</span></div>
      <label className={styles.field}><span>{t("inspector.blocks.statement")}</span><ColorControl id="blocks-statement-color" name={getControlName(controlPrefix, "StatementColor")} value={element.style?.statementColor} effectiveValue={BLOCK_DEFAULT_COLORS.statement} onChange={(color) => onUpdateStyle((current) => ({ ...current, statementColor: color } as CanonicalDataStyle))} secondaryAction={{ label: t("inspector.blocks.useDefault"), onClick: () => onUpdateStyle((current) => { const next = { ...current } as Record<string, unknown>; delete next.statementColor; return next as CanonicalDataStyle; }) }} /></label>
      <label className={styles.field}><span>{t("inspector.blocks.scope")}</span><ColorControl id="blocks-scope-color" name={getControlName(controlPrefix, "ScopeColor")} value={element.style?.scopeColor} effectiveValue={BLOCK_DEFAULT_COLORS.scope} onChange={(color) => onUpdateStyle((current) => ({ ...current, scopeColor: color } as CanonicalDataStyle))} secondaryAction={{ label: t("inspector.blocks.useDefault"), onClick: () => onUpdateStyle((current) => { const next = { ...current } as Record<string, unknown>; delete next.scopeColor; return next as CanonicalDataStyle; }) }} /></label>
      <label className={styles.field}><span>{t("inspector.blocks.logic")}</span><ColorControl id="blocks-logic-color" name={getControlName(controlPrefix, "LogicColor")} value={element.style?.logicColor} effectiveValue={BLOCK_DEFAULT_COLORS.logic} onChange={(color) => onUpdateStyle((current) => ({ ...current, logicColor: color } as CanonicalDataStyle))} secondaryAction={{ label: t("inspector.blocks.useDefault"), onClick: () => onUpdateStyle((current) => { const next = { ...current } as Record<string, unknown>; delete next.logicColor; return next as CanonicalDataStyle; }) }} /></label>
    </div>}
    {showColor && <div className={styles.colorControl}>
      <label className={styles.field}><span>{t("inspector.color")}</span><ColorControl id={`${controlPrefix}-color`} name={getControlName(controlPrefix, "Color")} value={(style as LegacyColorStyle | undefined)?.color} onChange={(color) => onUpdateStyle((current) => ({ ...current, color } as unknown as CanonicalDataStyle))} secondaryAction={{ label: t("inspector.useThemeDefault"), onClick: () => onUpdateStyle((current) => { const next = { ...current } as Record<string, unknown>; delete next.color; return next as CanonicalDataStyle; }) }} /></label>
    </div>}
    <div className={styles.colorControl}>
      <label className={styles.field}><span title={t("inspector.backgroundHelp")}>{t("inspector.background")}</span><ColorControl id={`${controlPrefix}-background`} name={getControlName(controlPrefix, "Background")} value={style?.background?.color} onChange={(color) => onUpdateStyle((current) => updateCanonicalBackground(current, "color", color))} secondaryAction={{ label: t("inspector.remove"), onClick: () => onUpdateStyle((current) => updateCanonicalBackground(current, "color", undefined)) }} /></label>
    </div>
    <ElementGradientControl gradient={style?.background?.gradient} controlPrefix={`${controlPrefix}-background`} onChange={(gradient) => onUpdateStyle((current) => updateCanonicalBackground(current, "gradient", gradient))} />
    <div className={styles.fieldGrid}>
      <div className={styles.field}><label htmlFor={`${controlPrefix}-border-radius`}>{t("inspector.roundedCorners")}</label><EffectiveLengthInput id={`${controlPrefix}-border-radius`} name={getControlName(controlPrefix, "BorderRadius")} min="0" value={style?.borderRadius} inheritedValue={radius} preferredUnit="px" units={["px", "rem"]} stepByUnit={{ px: "1", rem: "0.1" }} onChange={(borderRadius) => onUpdateStyle((current) => ({ ...current, borderRadius }))} onReset={() => onUpdateStyle((current) => ({ ...current, borderRadius: undefined }))} /></div>
      <label className={styles.field}><span title={t("inspector.opacityHelp")}>{t("inspector.opacity")}</span><div className={styles.unitInput}><input id={`${controlPrefix}-opacity`} name={getControlName(controlPrefix, "Opacity")} type="number" min="0" max="100" value={(effect?.opacity ?? 1) * 100} onChange={(event) => { const value = parseOptionalNumber(event.target.value); onUpdateEffect((current) => ({ ...current, opacity: value === undefined ? undefined : Math.max(0, Math.min(1, value / 100)) })); }} /><span>%</span></div></label>
    </div>
    <ElementBorderControl border={style?.border} onChange={(border) => onUpdateStyle((current) => ({ ...current, border }))} controlPrefix={controlPrefix} />
  </InspectorSection>;
}
