import styles from "../../editor-workspace.module.css";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

interface ContainerLinkedPropertyMetaProps {
  source: "local" | "linked" | "theme";
  linkedValue?: unknown;
  onReset?: () => void;
  formatValue?: (value: unknown) => string;
}

export function ContainerLinkedPropertyMeta({ source, linkedValue, onReset, formatValue }: ContainerLinkedPropertyMetaProps) {
  const { t } = useStudioI18n();
  if (source === "theme") return null;
  if (source === "linked") return <span className={styles.inheritedValueLabel}>{t("inspector.linkedValue")}</span>;
  return (
    <span className={styles.inheritedValueLabel}>
      {t("inspector.localOverride")}
      {linkedValue !== undefined && formatValue ? ` · ${t("inspector.linkedValue")}: ${formatValue(linkedValue)}` : ""}
      {onReset && <button type="button" className={styles.effectiveValueReset} onClick={onReset}>{t("inspector.resetLinkedOverride")}</button>}
    </span>
  );
}
