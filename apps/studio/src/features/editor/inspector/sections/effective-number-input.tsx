import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import { useAuthoringHistory } from "../../authoring-history-context";
import styles from "../../editor-workspace.module.css";
import type { TextStyleInspectorSource } from "../text-style-property";
import { TextStylePropertyMeta } from "./text-style-property-meta";

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
  disabled?: boolean;
  textStyleSource?: TextStyleInspectorSource;
  textStyleLinkedValue?: unknown;
  textStyleFormatValue?: (value: unknown) => string;
  textStyleOnReset?: () => void;
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
  disabled = false,
  textStyleSource,
  textStyleLinkedValue,
  textStyleFormatValue,
  textStyleOnReset,
}: EffectiveNumberInputProps) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const historyKey = `number:${id}`;
  const historyMeta = { kind: "number.change", labelKey: "history.number.change" };

  function beginEditing() {
    if (disabled) return;
    authoringHistory?.begin(historyKey, historyMeta);
  }

  function updateValue(nextValue: string) {
    if (disabled) return;
    if (!authoringHistory) {
      onChange(nextValue);
      return;
    }

    authoringHistory.begin(historyKey, historyMeta);
    authoringHistory.update(historyKey, () => onChange(nextValue));
  }

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
          disabled={disabled}
          onFocus={beginEditing}
          onBlur={() => { if (!disabled) authoringHistory?.finish(historyKey); }}
          onChange={(event) => {
            if (disabled) return;
            updateValue(event.target.value);
          }}
        />

        <span>{unit}</span>
      </div>

      {textStyleSource === "local" || textStyleSource === "linked" ? (
        <TextStylePropertyMeta
          source={textStyleSource}
          linkedValue={textStyleLinkedValue}
          formatValue={textStyleFormatValue}
          onReset={inherited ? undefined : textStyleOnReset ?? onReset}
        />
      ) : inherited ? (
        <span className={styles.inheritedValueLabel}>
          {t("inspector.default")}
        </span>
      ) : (
        <button
          className={styles.effectiveValueReset}
          type="button"
          disabled={disabled}
          title={t("inspector.useThemeDefault")}
          onClick={() => {
            if (disabled) return;
            if (!authoringHistory) {
              onReset();
              return;
            }

            authoringHistory.finish(historyKey);
            authoringHistory.discrete(
              { kind: "number.reset", labelKey: "history.number.reset" },
              onReset,
            );
          }}
        >
          {t("inspector.default")}
        </button>
      )}
    </div>
  );
}
