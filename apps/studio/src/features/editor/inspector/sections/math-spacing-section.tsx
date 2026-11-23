import type { MathElement, MathLayout } from "@web-slideshow/document-schema";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import styles from "../../editor-workspace.module.css";
import { InspectorSection } from "../inspector-section";
import { EffectiveLengthInput } from "./effective-length-input";

const PADDING_FIELDS = ["padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const;
type PaddingField = typeof PADDING_FIELDS[number];

interface MathSpacingSectionProps {
  layout: MathLayout | undefined;
  onUpdateLayout: (update: (current: MathLayout | undefined) => MathLayout | undefined) => void;
}

export function MathSpacingSection({ layout, onUpdateLayout }: MathSpacingSectionProps) {
  const { t } = useStudioI18n();
  const update = (field: PaddingField, value: MathLayout[PaddingField]) => onUpdateLayout(current => {
    const next = { ...(current ?? {}) };
    if (value === undefined) delete next[field]; else next[field] = value;
    return Object.keys(next).length === 0 ? undefined : next;
  });

  return <InspectorSection title={t("inspector.spacing")}>
    <div className={styles.field}>
      <label htmlFor="math-padding">{t("inspector.padding")}</label>
      <EffectiveLengthInput id="math-padding" name="mathPadding" value={layout?.padding} preferredUnit="px" units={["px", "rem", "%"]} stepByUnit={{ px: "1", rem: "0.1", "%": "1" }} onChange={value => update("padding", value)} onReset={() => update("padding", undefined)} />
    </div>
    <details className={styles.spacingDetails}>
      <summary><span>{t("inspector.paddingSides")}</span></summary>
      <div className={styles.spacingSides}>
        {PADDING_FIELDS.slice(1).map((field, index) => {
          const side = [t("inspector.top"), t("inspector.right"), t("inspector.bottom"), t("inspector.left")][index] ?? field;
          return <div className={styles.field} key={field}>
            <label htmlFor={`math-${field}`}>{side}</label>
            <EffectiveLengthInput id={`math-${field}`} name={`math${field[0]?.toUpperCase()}${field.slice(1)}`} value={layout?.[field]} preferredUnit="px" units={["px", "rem", "%"]} stepByUnit={{ px: "1", rem: "0.1", "%": "1" }} onChange={value => update(field, value)} onReset={() => update(field, undefined)} />
          </div>;
        })}
      </div>
    </details>
  </InspectorSection>;
}
