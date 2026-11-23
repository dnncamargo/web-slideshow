import type { ColorValue, Gradient, MathElement } from "@web-slideshow/document-schema";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import { resolveEffectiveElementStyleDefaults } from "@web-slideshow/theme/element-style-defaults";
import styles from "../../editor-workspace.module.css";
import { useAuthoringHistory } from "../../authoring-history-context";
import { getControlName } from "../inspector-helpers";
import { InspectorSection } from "../inspector-section";
import { ColorControl } from "./color-control";
import { createDefaultGradient, ElementGradientControl } from "./element-gradient-control";
import { ElementBorderControl } from "./element-border-control";
import { EffectiveLengthInput } from "./effective-length-input";

interface MathAppearanceSectionProps {
  element: MathElement;
  effectiveColor: ColorValue;
  effectiveColorSource?: "theme" | "container";
  onUpdateStyle: (update: (current: MathElement["style"]) => MathElement["style"]) => void;
}

function withoutContentFill(style: MathElement["style"]): Omit<NonNullable<MathElement["style"]>, "color" | "gradient"> {
  const { color: _color, gradient: _gradient, ...rest } = style ?? {};
  return rest;
}

export function MathAppearanceSection({ element, effectiveColor, effectiveColorSource, onUpdateStyle }: MathAppearanceSectionProps) {
  const { t } = useStudioI18n();
  const history = useAuthoringHistory();
  const style = element.style;
  const fillMode = style?.gradient !== undefined ? "gradient" : "color";
  const defaults = resolveEffectiveElementStyleDefaults({ type: "math" });
  const runFillModeChange = (mode: "color" | "gradient") => {
    if (mode === fillMode) return;
    const update = () => onUpdateStyle(current => mode === "gradient"
      ? { ...withoutContentFill(current), gradient: createDefaultGradient("linear") }
      : { ...withoutContentFill(current), color: style?.color ?? effectiveColor });
    if (history) history.discrete({ kind: "element.setting", labelKey: "history.element.setting", labelParams: { setting: "math.fill.mode" } }, update);
    else update();
  };

  return <InspectorSection title={t("inspector.appearance")}>
    <label className={styles.field}>
      <span>{t("inspector.fill")}</span>
      <select id="math-fill-mode" name="mathFillMode" value={fillMode} onChange={event => {
        if (event.target.value === "color" || event.target.value === "gradient") runFillModeChange(event.target.value);
      }}>
        <option value="color">{t("inspector.color")}</option>
        <option value="gradient">{t("inspector.gradient")}</option>
      </select>
    </label>
    {fillMode === "color" ? <label className={styles.field}>
      <ColorControl id="math-foreground-color" name="mathForegroundColor" value={style?.color} effectiveValue={effectiveColor} effectiveSource={style?.color === undefined ? effectiveColorSource : undefined} onChange={color => onUpdateStyle(current => ({ ...withoutContentFill(current), color }))} />
    </label> : <ElementGradientControl gradient={style?.gradient} controlPrefix="math-fill" allowNone={false} onChange={(gradient: Gradient | undefined) => {
      if (gradient !== undefined) onUpdateStyle(current => ({ ...withoutContentFill(current), gradient }));
    }} />}

    <label className={styles.field}>
      <span>{t("inspector.background")}</span>
      <ColorControl id="math-background-color" name="mathBackgroundColor" value={style?.background?.color} onChange={color => onUpdateStyle(current => ({ ...current, background: { ...current?.background, color } }))} secondaryAction={{ label: t("inspector.remove"), onClick: () => onUpdateStyle(current => ({ ...current, background: current?.background?.gradient === undefined ? undefined : { gradient: current.background.gradient } })) }} />
    </label>
    <ElementGradientControl gradient={style?.background?.gradient} controlPrefix="math-background" onChange={gradient => onUpdateStyle(current => ({
      ...current,
      background: gradient === undefined
        ? current?.background?.color === undefined ? undefined : { color: current.background.color }
        : { ...current?.background, gradient },
    }))} />

    <div className={styles.field}>
      <label htmlFor="math-border-radius">{t("inspector.roundedCorners")}</label>
      <EffectiveLengthInput id="math-border-radius" name={getControlName("math", "BorderRadius")} min="0" value={style?.borderRadius} inheritedValue={defaults.borderRadius} preferredUnit="px" units={["px", "rem"]} stepByUnit={{ px: "1", rem: "0.1" }} onChange={borderRadius => onUpdateStyle(current => ({ ...current, borderRadius }))} onReset={() => onUpdateStyle(current => ({ ...current, borderRadius: undefined }))} />
    </div>
    <ElementBorderControl border={style?.border} controlPrefix="math" onChange={border => onUpdateStyle(current => ({ ...current, border }))} />
  </InspectorSection>;
}
