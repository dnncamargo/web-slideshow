import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

interface EffectiveNumberInputProps {
  id: string;
  name: string;
  value: number | "";
  inherited: boolean;
  unit: string;
  min?: string;
  max?: string;
  step?: string;
  onChange: (value: string) => void;
  onReset: () => void;
}

export function EffectiveNumberInput({
  id,
  name,
  value,
  inherited,
  unit,
  min,
  max,
  step,
  onChange,
  onReset,
}: EffectiveNumberInputProps) {
  const { t } = useStudioI18n();

  return (
    <div className={styles.effectiveNumberControl}>
      <div className={styles.unitInput}>
        <input
          id={id}
          name={name}
          type="number"
          inputMode="decimal"
          {...(min === undefined ? {} : { min })}
          {...(max === undefined ? {} : { max })}
          {...(step === undefined ? {} : { step })}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />

        <span>{unit}</span>
      </div>

      {inherited ? (
        <span className={styles.inheritedValueLabel}>
          {t("inspector.default")}
        </span>
      ) : (
        <button
          className={styles.effectiveValueReset}
          type="button"
          title={t("inspector.useThemeDefault")}
          onClick={onReset}
        >
          {t("inspector.default")}
        </button>
      )}
    </div>
  );
}
