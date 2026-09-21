import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import type { TextStyleInspectorSource } from "../text-style-property";

interface TextStylePropertyMetaProps {
  source: TextStyleInspectorSource | undefined;
  linkedValue?: unknown;
  formatValue?: (value: unknown) => string;
  onReset?: () => void;
}
export function TextStylePropertyMeta({
  source,
  linkedValue,
  formatValue,
  onReset,
}: TextStylePropertyMetaProps) {
  const { t } = useStudioI18n();
  if (source === undefined || source === "theme") return null;

  if (source === "linked") {
    return <span className={styles.inheritedValueLabel}>{t("inspector.linkedValue")}</span>;
  }

  const linkedText = linkedValue === undefined
    ? undefined
    : formatValue?.(linkedValue) ?? String(linkedValue);
  return (
    <span className={styles.inheritedValueLabel}>
      {t("inspector.localOverride")}
      {linkedText === undefined ? "" : ` · ${t("inspector.linkedValue")}: ${linkedText}`}
      {onReset && (
        <button
          className={styles.effectiveValueReset}
          type="button"
          title={t("inspector.resetLinkedOverride")}
          onClick={onReset}
        >
          {t("inspector.resetLinkedOverride")}
        </button>
      )}
    </span>
  );
}
