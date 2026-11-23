import { useLayoutEffect, useRef, useState } from "react";
import type { ColorValue, ContainerElement, ElementTypography, MathElement, MathLayout, Presentation, TextEffect } from "@web-slideshow/document-schema";
import { renderElement } from "@web-slideshow/renderer";
import { THEME_COLORS } from "@web-slideshow/theme/element-style-defaults";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import styles from "../editor-workspace.module.css";
import type { ElementInspectorUpdate } from "./inspector-types";
import { InspectorSection } from "./inspector-section";
import { useAuthoringHistory } from "../authoring-history-context";
import { ElementTypographyFields } from "./sections/element-typography-control";
import { CanonicalElementSizeSection } from "./sections/canonical-element-size-section";
import { CanonicalElementPositionSection } from "./sections/canonical-text-position-section";
import { shouldShowElementPositioning, type ElementLayerControls } from "./sections/element-positioning-helpers";
import { resolveNearestContainerColor } from "./color-inheritance";
import { MathSpacingSection } from "./sections/math-spacing-section";
import { MathAppearanceSection } from "./sections/math-appearance-section";
import { CanonicalTextEffectsSection } from "./sections/canonical-text-effects-section";
import { isAuthoredPresentationLink } from "../canvas-link-interception";

const groups = {
  structures: [["fraction", "\\frac{}{}", 6, true], ["root", "\\sqrt{}", 6, true], ["indexedRoot", "\\sqrt[]{}", 6, false], ["power", "^{}", 2, true], ["index", "_{}", 2, true], ["paren", "\\left(\\right)", 6, true], ["bracket", "\\left[\\right]", 6, true], ["brace", "\\left\\{\\right\\}", 7, true], ["absolute", "\\left|\\right|", 6, true]] as const,
  functions: [["sin", "\\sin\\left(\\right)", 11, false], ["cos", "\\cos\\left(\\right)", 11, false], ["tan", "\\tan\\left(\\right)", 11, false], ["log", "\\log\\left(\\right)", 11, false], ["ln", "\\ln\\left(\\right)", 10, false], ["exp", "\\exp\\left(\\right)", 11, false], ["lim", "\\lim_{x\\to 0}", 12, false]] as const,
  relations: [["equals", "=", 1, false], ["notEqual", "\\ne", 3, false], ["approx", "\\approx", 7, false], ["greater", ">", 1, false], ["less", "<", 1, false], ["greaterEqual", "\\geq", 4, false], ["lessEqual", "\\leq", 4, false], ["belongs", "\\in", 3, false], ["notBelongs", "\\notin", 6, false], ["subset", "\\subseteq", 10, false], ["superset", "\\supseteq", 10, false], ["equiv", "\\equiv", 6, false], ["implies", "\\implies", 8, false]] as const,
  operators: [["plus", "+", 1, false], ["minus", "-", 1, false], ["times", "\\times", 6, false], ["divide", "\\div", 5, false], ["comma", ",", 1, false], ["semicolon", ";", 1, false], ["infinity", "\\infty", 6, false], ["percent", "\\%", 2, false], ["sum", "\\sum_{i=1}^{n}", 13, false], ["product", "\\prod_{i=1}^{n}", 14, false], ["integral", "\\int_{a}^{b}", 12, false], ["limit", "\\lim_{x\\to 0}", 12, false]] as const,
  sets: [["naturals", "\\mathbb{N}", 10, false], ["integers", "\\mathbb{Z}", 10, false], ["rationals", "\\mathbb{Q}", 10, false], ["reals", "\\mathbb{R}", 10, false], ["complex", "\\mathbb{C}", 10, false], ["union", "\\cup", 5, false], ["intersection", "\\cap", 5, false], ["emptySet", "\\emptyset", 9, false], ["setDifference", "\\setminus", 9, false]] as const,
  multiline: [["aligned", "\\begin{aligned}\n&= \\\\\n&=\n\\end{aligned}", 18, false], ["cases", "\\begin{cases}\n& \\\\\n&\n\\end{cases}", 15, false], ["matrix", "\\begin{matrix}\n& \\\\\n&\n\\end{matrix}", 15, false], ["system", "\\begin{cases}\n= \\\\\n=\n\\end{cases}", 14, false]] as const,
} as const;
type Group = keyof typeof groups;

interface MathInspectorProps {
  element: MathElement;
  onUpdate: ElementInspectorUpdate;
  presentation?: Presentation;
  parent?: ContainerElement | null;
  ancestorContainers?: readonly ContainerElement[];
  layerControls?: ElementLayerControls | null;
}

const MATH_TYPOGRAPHY_PROPERTIES = ["fontSize", "fontWeight", "fontStyle", "textAlign", "lineHeight"] as const;

export function MathInspector({ element, onUpdate, presentation, parent = null, ancestorContainers, layerControls = null }: MathInspectorProps) {
  const { t } = useStudioI18n();
  const history = useAuthoringHistory();
  const ref = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<number | null>(null);
  const selection = useRef<[number, number]>([element.source.length, element.source.length]);
  const [group, setGroup] = useState<Group>("structures");
  const key = `text:math-${element.id}-source`;
  const containerColor = resolveNearestContainerColor(
    presentation,
    ancestorContainers !== undefined && ancestorContainers.length > 0 ? ancestorContainers : parent ? [parent] : [],
  );
  const effectiveColor = element.style?.color ?? containerColor ?? THEME_COLORS.textPrimary;
  const effectiveColorSource = element.style?.color !== undefined ? undefined : containerColor === undefined ? "theme" : "container";
  const updateTypography = (update: (current: ElementTypography | undefined) => ElementTypography) => {
    onUpdate(current => current.type === "math" ? { ...current, typography: update(current.typography) } : current);
  };
  const updateLayout = (update: (current: MathLayout | undefined) => MathLayout | undefined) => {
    onUpdate(current => current.type === "math" ? { ...current, layout: update(current.layout) } : current);
  };
  const updateStyle = (update: (current: MathElement["style"]) => MathElement["style"]) => {
    onUpdate(current => current.type === "math" ? { ...current, style: update(current.style) } : current);
  };
  const updateEffect = (update: (current: TextEffect | undefined) => TextEffect) => {
    onUpdate(current => current.type === "math" ? { ...current, effect: update(current.effect) } : current);
  };
  useLayoutEffect(() => { if (pending.current !== null && ref.current) { ref.current.focus(); ref.current.setSelectionRange(pending.current, pending.current); pending.current = null; } }, [element.source]);
  const insert = (snippet: string, offset: number, wrap: boolean) => {
    const input = ref.current; const [savedStart, savedEnd] = selection.current;
    const start = input && input === document.activeElement ? input.selectionStart : savedStart;
    const end = input && input === document.activeElement ? input.selectionEnd : savedEnd;
    const selected = element.source.slice(start, end);
    const wrapped = wrap && selected.length > 0;
    const templates: Record<string, (value: string) => string> = {
      "\\frac{}{}": value => `\\frac{${value}}{}`,
      "\\sqrt{}": value => `\\sqrt{${value}}`,
      "^{}": value => `^{${value}}`, "_{}": value => `_{${value}}`,
      "\\left(\\right)": value => `\\left(${value}\\right)`,
      "\\left[\\right]": value => `\\left[${value}\\right]`,
      "\\left\\{\\right\\}": value => `\\left\\{${value}\\right\\}`,
      "\\left|\\right|": value => `\\left|${value}\\right|`,
    };
    const text = wrapped ? (templates[snippet]?.(selected) ?? snippet) : snippet;
    const source = element.source.slice(0, start) + text + element.source.slice(end);
    const cursor = start + (wrapped ? (snippet === "\\frac{}{}" ? text.length - 1 : text.length) : offset);
    selection.current = [cursor, cursor]; pending.current = cursor;
    const update = () => onUpdate(current => current.type === "math" ? { ...current, source } : current);
    if (history) history.discrete({ kind: "element.setting", labelKey: "history.element.setting", labelParams: { setting: "math.sourceInsert" } }, update); else update();
  };
  const html = renderElement(element); const invalid = html.includes("presentation-math-error");
  return <>
    <InspectorSection title={t("inspector.content")} defaultOpen><div data-presentation-math-inspector="true">
      <label className={styles.field}><span>{t("inspector.math.format")}</span><span>LaTeX</span></label>
      <div className={styles.textEditor}><div className={`${styles.textEditorToolbar} ${styles.mathToolbar}`} role="group" aria-label={t("inspector.math.toolbar")}>
        <select className={styles.mathToolbarCategory} aria-label={t("inspector.math.category")} value={group} onChange={event => setGroup(event.target.value as Group)}>{(Object.keys(groups) as Group[]).map(name => <option key={name} value={name}>{t(`inspector.math.category.${name}`)}</option>)}</select>
        {groups[group].map(([id, snippet, offset, wrap]) => <button key={id} type="button" className={`${styles.textEditorToolbarButton} ${styles.mathToolbarButton}`} aria-label={t(`inspector.math.${id}`)} title={t(`inspector.math.${id}`)} onMouseDown={event => { if (ref.current) selection.current = [ref.current.selectionStart, ref.current.selectionEnd]; event.preventDefault(); }} onClick={() => insert(snippet, offset, wrap)}>{t(`inspector.math.${id}`)}</button>)}
      </div><textarea ref={ref} className={styles.textArea} value={element.source} maxLength={4096} rows={8} aria-label={t("inspector.math.source")} onSelect={event => { selection.current = [event.currentTarget.selectionStart, event.currentTarget.selectionEnd]; }} onKeyUp={event => { selection.current = [event.currentTarget.selectionStart, event.currentTarget.selectionEnd]; }} onFocus={() => history?.begin(key, { kind: "text.edit", labelKey: "history.text.edit" })} onBlur={() => history?.finish(key)} onChange={event => { const source = event.target.value; const update = () => onUpdate(current => current.type === "math" && source.length <= 4096 ? { ...current, source } : current); if (history) { history.begin(key, { kind: "text.edit", labelKey: "history.text.edit" }); history.update(key, update); } else update(); }} /></div>
      {invalid ? <div role="alert" className={styles.fieldHint}>{t("inspector.math.invalid")}</div> : <div role="status" className={styles.fieldHint}>{t("inspector.math.valid")}</div>}
      <div className={styles.field} data-presentation-math-preview="true" onClick={event => { if (isAuthoredPresentationLink(event.target)) event.preventDefault(); }} dangerouslySetInnerHTML={{ __html: html }} />
    </div></InspectorSection>
    <InspectorSection title={t("inspector.typography")}>
      <ElementTypographyFields typography={element.typography} effectiveDefaults={{}} onUpdateTypography={updateTypography} controlPrefix="math" fontResources={[]} visibleProperties={MATH_TYPOGRAPHY_PROPERTIES} />
    </InspectorSection>
    <CanonicalElementSizeSection layout={element.layout} onUpdateLayout={updateLayout} />
    <MathSpacingSection layout={element.layout} onUpdateLayout={updateLayout} />
    <MathAppearanceSection element={element} effectiveColor={effectiveColor} effectiveColorSource={effectiveColorSource} onUpdateStyle={updateStyle} />
    <CanonicalTextEffectsSection
      effect={element.effect}
      typography={element.typography}
      textColor={typeof effectiveColor === "string" ? effectiveColor : undefined}
      onUpdateEffect={updateEffect}
      onUpdateTypography={updateTypography}
      controlPrefix="math"
      showTypographyEffects={false}
      showOpacity
    />
    {shouldShowElementPositioning(layerControls) && <CanonicalElementPositionSection element={element} parent={parent} layerControls={layerControls} onUpdateLayout={updateLayout} />}
  </>;
}
