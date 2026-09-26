import {
  formatColorAsHex,
  parseColor,
  resolveColorValue,
} from "@web-slideshow/document-schema";
import type {
  BlocksVisualStyle,
  CodeVisualStyle,
  ElementEffect,
  GradientSurfaceBackground,
  GradientSurfaceVisualStyle,
  PresentationElement,
  TerminalVisualStyle,
  SimpleTableVisualStyle,
  StructuredTableVisualStyle,
  ColorValue,
} from "@web-slideshow/document-schema";
import { resolveEffectiveElementStyleDefaults, TERMINAL_SEMANTIC_COLORS } from "@web-slideshow/theme/element-style-defaults";
import { parseBlocksSource, type BlocksAstNode, type BlocksCategory, type BlocksInlineNode } from "@web-slideshow/renderer";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import styles from "../../editor-workspace.module.css";
import { getControlName, parseOptionalNumber } from "../inspector-helpers";
import { InspectorSection } from "../inspector-section";
import { ColorControl } from "./color-control";
import { ElementBorderControl } from "./element-border-control";
import { ElementGradientControl } from "./element-gradient-control";
import { EffectiveLengthInput } from "./effective-length-input";
import { usePresentationColorPalette } from "./presentation-color-palette";
import { useAuthoringHistory } from "../../authoring-history-context";
import type { InheritedColorSource } from "../color-inheritance";

export type CanonicalDataStyle = GradientSurfaceVisualStyle | CodeVisualStyle | TerminalVisualStyle | BlocksVisualStyle | SimpleTableVisualStyle | StructuredTableVisualStyle;
type ColorCapableCanonicalDataStyle = CodeVisualStyle | SimpleTableVisualStyle;
type DataElement = Extract<PresentationElement, { type: "code" | "terminal" | "table" | "blocks" }>;

type BackgroundKey = "color" | "gradient";
export type CanonicalDataAppearanceField =
  | "color" | "background.color" | "background.gradient" | "borderRadius" | "border"
  | "commandColor" | "promptColor" | "outputColor" | "commentColor" | "errorColor"
  | "headerBackground" | "bodyRowAlternateBackground" | "dividerOpacity" | "opacity";

export function suggestAlternatingSurfaceColor(
  value: ColorValue | undefined,
): ColorValue | undefined {
  if (typeof value !== "string") return undefined;
  const color = parseColor(value);
  if (!color || color.alpha === 0) return undefined;

  const luminance = (0.299 * color.red + 0.587 * color.green + 0.114 * color.blue) / 255;
  const delta = luminance < 0.5 ? 16 : -16;
  return formatColorAsHex({
    red: Math.max(0, Math.min(255, color.red + delta)),
    green: Math.max(0, Math.min(255, color.green + delta)),
    blue: Math.max(0, Math.min(255, color.blue + delta)),
    alpha: color.alpha,
  });
}

function setStructuredBackground(
  style: StructuredTableVisualStyle | undefined,
  key: "headerBackground" | "bodyRowAlternateBackground",
  background: ColorValue | undefined,
): StructuredTableVisualStyle {
  return { ...(style ?? {}), [key]: background };
}

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

const BLOCK_CATEGORY_ORDER: readonly BlocksCategory[] = ["events", "output", "control", "input", "math", "variables"];
const BLOCK_CATEGORY_DEFAULTS: Record<BlocksCategory, string> = {
  events: "#FFBF00", output: "#4C97FF", control: "#FFAB19",
  input: "#5CB1D6", math: "#59C059", variables: "#FF8C1A",
};
const BLOCK_CATEGORY_LABEL_KEYS: Record<BlocksCategory, "inspector.blocks.events" | "inspector.blocks.output" | "inspector.blocks.control" | "inspector.blocks.input" | "inspector.blocks.math" | "inspector.blocks.variables"> = {
  events: "inspector.blocks.events", output: "inspector.blocks.output", control: "inspector.blocks.control",
  input: "inspector.blocks.input", math: "inspector.blocks.math", variables: "inspector.blocks.variables",
};

type FallbackKind = "statement" | "scope" | "logic";
const BLOCK_FALLBACK_LABELS: Record<FallbackKind, "inspector.blocks.statement" | "inspector.blocks.scope" | "inspector.blocks.logic"> = {
  statement: "inspector.blocks.statement", scope: "inspector.blocks.scope", logic: "inspector.blocks.logic",
};

const numberHistoryMeta = { kind: "number.change", labelKey: "history.number.change" } as const;

function blockUsage(source: string): { categories: Set<BlocksCategory>; fallbacks: Set<FallbackKind> } {
  const categories = new Set<BlocksCategory>();
  const fallbacks = new Set<FallbackKind>();
  const visitInline = (nodes: BlocksInlineNode[]): void => {
    for (const node of nodes) {
      if (node.type === "text" || node.type === "option") continue;
      if (node.category !== undefined) categories.add(node.category);
      else if (node.type === "logic") fallbacks.add("logic");
      if (node.type === "logic" || node.type === "value") visitInline(node.content);
    }
  };
  const result = parseBlocksSource(source);
  if (!result.ok) return { categories, fallbacks };
  const visit = (nodes: BlocksAstNode[]): void => {
    for (const node of nodes) {
      if (node.category === undefined) fallbacks.add(node.type === "scope" ? "scope" : "statement");
      else categories.add(node.category);
      visitInline(node.content);
      if (node.type === "scope") visit(node.children);
    }
  };
  visit(result.blocks);
  return { categories, fallbacks };
}

interface Props {
  element: DataElement;
  style: CanonicalDataStyle | undefined;
  effect: ElementEffect | undefined;
  showColor?: boolean;
  onUpdateStyle: (update: (style: CanonicalDataStyle | undefined) => CanonicalDataStyle) => void;
  onUpdateEffect: (update: (effect: ElementEffect | undefined) => ElementEffect) => void;
  controlPrefix: string;
  effectiveColor?: ColorValue;
  effectiveColorSource?: InheritedColorSource;
  effectiveStyle?: CanonicalDataStyle;
  effectiveEffect?: ElementEffect;
  disabledFields?: readonly CanonicalDataAppearanceField[];
}

export function CanonicalDataAppearanceSection({ element, style, effect, showColor = false, onUpdateStyle, onUpdateEffect, controlPrefix, effectiveColor, effectiveColorSource, effectiveStyle, effectiveEffect, disabledFields = [] }: Props) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const palette = usePresentationColorPalette();
  const displayedStyle = { ...(style ?? {}), ...(effectiveStyle ?? {}), background: { ...(style?.background ?? {}), ...(effectiveStyle?.background ?? {}) } } as CanonicalDataStyle | undefined;
  const displayedEffect = { ...(effect ?? {}), ...(effectiveEffect ?? {}) };
  const isDisabled = (field: CanonicalDataAppearanceField) => disabledFields.includes(field);
  const radius = effectiveStyle?.borderRadius ?? resolveEffectiveElementStyleDefaults(element).borderRadius;
  const blocksStyle = element.type === "blocks" ? element.style : undefined;
  const usage = element.type === "blocks" ? blockUsage(element.source) : undefined;
  const categoryControls = usage === undefined ? [] : BLOCK_CATEGORY_ORDER.filter((category) => usage.categories.has(category) || blocksStyle?.categoryColors?.[category] !== undefined);
  const fallbackControls = usage === undefined ? [] : (["statement", "scope", "logic"] as const).filter((kind) => usage.fallbacks.has(kind) || blocksStyle?.[`${kind}Color`] !== undefined);
  const structuredStyle = element.type === "table" && element.mode === "structured"
    ? (displayedStyle ?? {}) as StructuredTableVisualStyle
    : undefined;
  const updateStructuredStyle = (
    update: (style: StructuredTableVisualStyle | undefined) => StructuredTableVisualStyle,
  ) => onUpdateStyle((current) => update(current as StructuredTableVisualStyle | undefined));
  const opacityHistoryKey = `number:${controlPrefix}-opacity`;
  const dividerOpacityHistoryKey = `number:${controlPrefix}-divider-opacity`;
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
  const updateDividerOpacity = (opacity: number | undefined) => {
    if (opacity === structuredStyle?.dividerOpacity) return;
    const update = () => updateStructuredStyle((current) => ({ ...(current ?? {}), dividerOpacity: opacity }));
    if (!authoringHistory) {
      update();
      return;
    }
    authoringHistory.begin(dividerOpacityHistoryKey, numberHistoryMeta);
    authoringHistory.update(dividerOpacityHistoryKey, update);
  };
  const updateStructuredBackground = (
    key: "headerBackground" | "bodyRowAlternateBackground",
    background: ColorValue | undefined,
  ) => updateStructuredStyle((current) => setStructuredBackground(current, key, background));
  const suggestAlternate = () => {
    if (isDisabled("bodyRowAlternateBackground")) return;
    const source = structuredStyle?.background?.color;
    const resolved = source === undefined ? undefined : resolveColorValue(source, palette ? { colors: palette.colors } : undefined);
    const color = suggestAlternatingSurfaceColor(resolved);
    if (color === undefined) return;
    if (structuredStyle?.bodyRowAlternateBackground === color) return;
    const meta = { kind: "element.setting", labelKey: "history.element.setting", labelParams: { setting: "table.bodyRowAlternateBackground" } } as const;
    if (authoringHistory) authoringHistory.discrete(meta, () => updateStructuredBackground("bodyRowAlternateBackground", color));
    else updateStructuredBackground("bodyRowAlternateBackground", color);
  };
  const resolvedStructuredBackground = structuredStyle?.background?.color === undefined
    ? undefined
    : resolveColorValue(structuredStyle.background.color, palette ? { colors: palette.colors } : undefined);
  return <InspectorSection title={t("inspector.appearance")}>
    {element.type === "blocks" && <div className={styles.colorControl} data-presentation-blocks-colors="true">
      {categoryControls.length > 0 && <><div className={styles.field}><span>{t("inspector.blocks.categoryColors")}</span></div>{categoryControls.map((category) => <label className={styles.field} key={category}><span>{t(BLOCK_CATEGORY_LABEL_KEYS[category])}</span><ColorControl id={`blocks-category-${category}-color`} name={getControlName(controlPrefix, `Category-${category}`)} value={blocksStyle?.categoryColors?.[category]} effectiveValue={BLOCK_CATEGORY_DEFAULTS[category]} onChange={(color) => onUpdateStyle((current) => { const next = current as BlocksVisualStyle | undefined; return { ...(next ?? {}), categoryColors: { ...(next?.categoryColors ?? {}), [category]: color } }; })} secondaryAction={{ label: t("inspector.blocks.useDefault"), onClick: () => onUpdateStyle((current) => { const next = { ...(current as BlocksVisualStyle) } as Record<string, unknown>; const categoryColors = { ...((next.categoryColors ?? {}) as Record<string, unknown>) }; delete categoryColors[category]; if (Object.keys(categoryColors).length === 0) delete next.categoryColors; else next.categoryColors = categoryColors; return next as CanonicalDataStyle; }) }} /></label>)}</>}
      {fallbackControls.length > 0 && <><div className={styles.field}><span>{t("inspector.blocks.uncategorized")}</span></div>{fallbackControls.map((kind) => <label className={styles.field} key={kind}><span>{t(BLOCK_FALLBACK_LABELS[kind])}</span><ColorControl id={`blocks-${kind}-color`} name={getControlName(controlPrefix, `${kind}Color`)} value={blocksStyle?.[`${kind}Color`]} effectiveValue={BLOCK_DEFAULT_COLORS[kind]} onChange={(color) => onUpdateStyle((current) => ({ ...(current as BlocksVisualStyle), [`${kind}Color`]: color } as CanonicalDataStyle))} secondaryAction={{ label: t("inspector.blocks.useDefault"), onClick: () => onUpdateStyle((current) => { const next = { ...(current as BlocksVisualStyle) } as Record<string, unknown>; delete next[`${kind}Color`]; return next as CanonicalDataStyle; }) }} /></label>)}</>}
      <label className={styles.field}><span>{t("inspector.blocks.textColor")}</span><ColorControl id="blocks-text-color" name={getControlName(controlPrefix, "TextColor")} value={blocksStyle?.textColor} effectiveValue="#FFFFFF" onChange={(color) => onUpdateStyle((current) => ({ ...current, textColor: color } as CanonicalDataStyle))} secondaryAction={{ label: t("inspector.blocks.useDefault"), onClick: () => onUpdateStyle((current) => { const next = { ...current } as Record<string, unknown>; delete next.textColor; return next as CanonicalDataStyle; }) }} /></label>
      <ElementBorderControl border={blocksStyle?.blockBorder} onChange={(blockBorder) => onUpdateStyle((current) => ({ ...current, blockBorder }))} controlPrefix={`${controlPrefix}-block`} allowGradient={false} label={t("inspector.blocks.blockStroke")} />
    </div>}
    {showColor && (element.type === "code" || (element.type === "table" && element.mode !== "structured")) && <div className={styles.colorControl}>
      <label className={styles.field}><span>{t("inspector.color")}</span><ColorControl id={`${controlPrefix}-color`} name={getControlName(controlPrefix, "Color")} value={(displayedStyle as ColorCapableCanonicalDataStyle | undefined)?.color} effectiveValue={element.type === "table" ? effectiveColor : undefined} effectiveSource={element.type === "table" ? effectiveColorSource : undefined} disabled={isDisabled("color")} onChange={(color) => { if (!isDisabled("color")) onUpdateStyle((current) => ({ ...(current ?? {}), color } as ColorCapableCanonicalDataStyle)); }} secondaryAction={isDisabled("color") ? undefined : element.type === "table" && element.style?.color === undefined ? undefined : { label: element.type === "table" && effectiveColorSource === "container" ? t("inspector.useInheritedColor") : t("inspector.useThemeDefault"), onClick: () => onUpdateStyle((current) => { const next = { ...(current ?? {}) } as ColorCapableCanonicalDataStyle; delete next.color; return next; }) }} /></label>
    </div>}
    {element.type === "terminal" && <div className={styles.colorControl}>
      {([
        ["commandColor", t("inspector.command"), TERMINAL_SEMANTIC_COLORS.command],
        ["promptColor", t("inspector.prompt"), TERMINAL_SEMANTIC_COLORS.prompt],
        ["outputColor", t("inspector.output"), TERMINAL_SEMANTIC_COLORS.output],
        ["commentColor", t("inspector.comment"), TERMINAL_SEMANTIC_COLORS.comment],
        ["errorColor", t("inspector.error"), TERMINAL_SEMANTIC_COLORS.error],
      ] as const).map(([property, label, effectiveValue]) => (
        <label className={styles.field} key={property}>
          <span>{label}</span>
          <ColorControl
            id={`${controlPrefix}-${property}`}
            name={getControlName(controlPrefix, property)}
            value={(displayedStyle as TerminalVisualStyle | undefined)?.[property]}
            disabled={isDisabled(property)}
            effectiveValue={effectiveValue}
            onChange={(color) => { if (!isDisabled(property)) onUpdateStyle((current) => ({ ...(current ?? {}), [property]: color } as TerminalVisualStyle)); }}
            secondaryAction={isDisabled(property) ? undefined : {
              label: t("inspector.useThemeDefault"),
              onClick: () => onUpdateStyle((current) => {
                const next = { ...(current ?? {}) } as TerminalVisualStyle;
                delete next[property];
                return next;
              }),
            }}
          />
        </label>
      ))}
    </div>}
    <div className={structuredStyle !== undefined ? styles.appearanceSubgroup : undefined}>
      {structuredStyle !== undefined && <span className={styles.appearanceSubheading}>{t("table.appearance.table")}</span>}
      <div className={styles.colorControl}>
      <label className={styles.field}><span title={t("inspector.backgroundHelp")}>{t("inspector.background")}</span><ColorControl id={`${controlPrefix}-background`} name={getControlName(controlPrefix, "Background")} value={displayedStyle?.background?.color} disabled={isDisabled("background.color")} onChange={(color) => { if (!isDisabled("background.color")) onUpdateStyle((current) => updateCanonicalBackground(current, "color", color)); }} secondaryAction={isDisabled("background.color") ? undefined : { label: structuredStyle !== undefined ? t("inspector.reset") : t("inspector.remove"), onClick: () => structuredStyle !== undefined ? onUpdateStyle((current) => ({ ...current, background: undefined, bodyRowAlternateBackground: undefined })) : onUpdateStyle((current) => updateCanonicalBackground(current, "color", undefined)) }} /></label>
      </div>
    {structuredStyle !== undefined && <>
      <div className={styles.colorControlActionRow}><button type="button" className={styles.colorPaletteDisclosure} onClick={suggestAlternate} disabled={isDisabled("bodyRowAlternateBackground") || suggestAlternatingSurfaceColor(resolvedStructuredBackground) === undefined}>{t("table.appearance.suggestAlternate")}</button></div>
      {structuredStyle.bodyRowAlternateBackground !== undefined && <label className={styles.field}><span>{t("table.appearance.alternateBackground")}</span><ColorControl id={`${controlPrefix}-body-row-alternate-background`} name={getControlName(controlPrefix, "BodyRowAlternateBackground")} value={structuredStyle.bodyRowAlternateBackground} disabled={isDisabled("bodyRowAlternateBackground")} onChange={(color) => { if (!isDisabled("bodyRowAlternateBackground")) updateStructuredBackground("bodyRowAlternateBackground", color); }} secondaryAction={isDisabled("bodyRowAlternateBackground") ? undefined : { label: t("inspector.remove"), onClick: () => updateStructuredBackground("bodyRowAlternateBackground", undefined) }} /></label>}
    </>}
    <ElementGradientControl gradient={displayedStyle?.background?.gradient} controlPrefix={`${controlPrefix}-background`} disabled={isDisabled("background.gradient")} onChange={(gradient) => { if (!isDisabled("background.gradient")) onUpdateStyle((current) => updateCanonicalBackground(current, "gradient", gradient)); }} />
    <div className={styles.fieldGrid}>
      <div className={styles.field}><label htmlFor={`${controlPrefix}-border-radius`}>{t("inspector.roundedCorners")}</label><EffectiveLengthInput id={`${controlPrefix}-border-radius`} name={getControlName(controlPrefix, "BorderRadius")} min="0" value={displayedStyle?.borderRadius} inheritedValue={radius} preferredUnit="px" units={["px", "rem"]} stepByUnit={{ px: "1", rem: "0.1" }} disabled={isDisabled("borderRadius")} onChange={(borderRadius) => { if (!isDisabled("borderRadius")) onUpdateStyle((current) => ({ ...current, borderRadius })); }} onReset={() => { if (!isDisabled("borderRadius")) onUpdateStyle((current) => ({ ...current, borderRadius: undefined })); }} /></div>
      <label className={styles.field}><span title={t("inspector.opacityHelp")}>{t("inspector.opacity")}</span><div className={styles.unitInput}><input id={`${controlPrefix}-opacity`} name={getControlName(controlPrefix, "Opacity")} type="number" min="0" max="100" value={(displayedEffect.opacity ?? 1) * 100} disabled={isDisabled("opacity")} onFocus={() => { if (!isDisabled("opacity")) authoringHistory?.begin(opacityHistoryKey, numberHistoryMeta); }} onBlur={() => { if (!isDisabled("opacity")) authoringHistory?.finish(opacityHistoryKey); }} onChange={(event) => { if (isDisabled("opacity")) return; const value = parseOptionalNumber(event.target.value); updateOpacity(value === undefined ? undefined : Math.max(0, Math.min(1, value / 100))); }} /><span>%</span></div></label>
    </div>
      <ElementBorderControl border={displayedStyle?.border} disabled={isDisabled("border")} onChange={(border) => { if (!isDisabled("border")) onUpdateStyle((current) => ({ ...current, border })); }} controlPrefix={controlPrefix} />
    </div>
    {structuredStyle !== undefined && <>
      <div className={styles.appearanceSubgroup} data-presentation-table-appearance="true">
        <span className={styles.appearanceSubheading}>{t("table.appearance.header")}</span>
        <label className={styles.field}><span>{t("inspector.background")}</span><ColorControl id={`${controlPrefix}-header-background`} name={getControlName(controlPrefix, "HeaderBackground")} value={structuredStyle.headerBackground} disabled={isDisabled("headerBackground")} onChange={(color) => { if (!isDisabled("headerBackground")) updateStructuredBackground("headerBackground", color); }} secondaryAction={isDisabled("headerBackground") ? undefined : { label: t("inspector.remove"), onClick: () => updateStructuredBackground("headerBackground", undefined) }} /></label>
      </div>
      <div className={styles.appearanceSubgroup}>
        <span className={styles.appearanceSubheading}>{t("table.appearance.dividers")}</span>
        <label className={styles.field}><span title={t("inspector.opacityHelp")}>{t("inspector.opacity")}</span><div className={styles.unitInput}><input id={`${controlPrefix}-divider-opacity`} name={getControlName(controlPrefix, "DividerOpacity")} type="number" min="0" max="100" value={(structuredStyle.dividerOpacity ?? 1) * 100} disabled={isDisabled("dividerOpacity")} onFocus={() => { if (!isDisabled("dividerOpacity")) authoringHistory?.begin(dividerOpacityHistoryKey, numberHistoryMeta); }} onBlur={() => { if (!isDisabled("dividerOpacity")) authoringHistory?.finish(dividerOpacityHistoryKey); }} onChange={(event) => { if (isDisabled("dividerOpacity")) return; const value = parseOptionalNumber(event.target.value); updateDividerOpacity(value === undefined ? undefined : Math.max(0, Math.min(1, value / 100))); }} /><span>%</span></div></label>
      </div>
    </>}
  </InspectorSection>;
}
