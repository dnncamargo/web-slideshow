import type { Length } from "@powershow/document-schema";
import {
  convertAuthoringLength,
  parseAuthoringLength,
  serializeAuthoringLength,
  type AuthoringLengthUnit,
} from "@powershow/theme/element-style-defaults";
import { useEffect, useState } from "react";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

interface EffectiveLengthInputProps {
  id: string;
  name: string;
  value: Length | undefined;
  inheritedValue: Length;
  inheritedSource?: "linked" | "theme";
  preferredUnit: AuthoringLengthUnit;
  units: readonly AuthoringLengthUnit[];
  relativeFontSizePx?: number;
  min?: string;
  step?: string;
  stepByUnit?: Partial<Record<AuthoringLengthUnit, string>>;
  preserveInheritedUnit?: boolean;
  onChange: (value: Length | undefined) => void;
  onReset: () => void;
}

function getInitialUnit(
  value: Length | undefined,
  units: readonly AuthoringLengthUnit[],
  preferredUnit: AuthoringLengthUnit,
): AuthoringLengthUnit {
  const parsed = value === undefined ? undefined : parseAuthoringLength(value);

  return parsed && units.includes(parsed.unit) ? parsed.unit : preferredUnit;
}

export function EffectiveLengthInput({
  id,
  name,
  value,
  inheritedValue,
  inheritedSource = "theme",
  preferredUnit,
  units,
  relativeFontSizePx,
  min,
  step,
  stepByUnit,
  preserveInheritedUnit = false,
  onChange,
  onReset,
}: EffectiveLengthInputProps) {
  const { t } = useStudioI18n();
  const supportedUnitsKey = units.join(",");
  const [unit, setUnit] = useState<AuthoringLengthUnit>(() =>
    getInitialUnit(preserveInheritedUnit ? value ?? inheritedValue : value, units, preferredUnit),
  );

  useEffect(() => {
    if (value === undefined) {
      setUnit(getInitialUnit(preserveInheritedUnit ? inheritedValue : value, units, preferredUnit));
      return;
    }

    const parsed = parseAuthoringLength(value);

    if (parsed && units.includes(parsed.unit)) {
      setUnit(parsed.unit);
    }
  }, [inheritedValue, preferredUnit, preserveInheritedUnit, supportedUnitsKey, units, value]);

  const numericValue =
    value === undefined
      ? (convertAuthoringLength(inheritedValue, unit, relativeFontSizePx) ??
        inheritedValue)
      : (convertAuthoringLength(value, unit, relativeFontSizePx) ?? "");
  const inherited = value === undefined;
  const inputStep = stepByUnit?.[unit] ?? step;

  return (
    <div className={styles.effectiveNumberControl}>
      <div className={styles.unitInput}>
        <input
          id={id}
          name={name}
          type="number"
          inputMode="decimal"
          {...(min === undefined ? {} : { min })}
          {...(inputStep === undefined ? {} : { step: inputStep })}
          value={numericValue}
          onChange={(event) => {
            const nextValue = event.target.value.trim();

            if (nextValue === "") {
              onChange(undefined);
              return;
            }

            const number = Number(nextValue);

            if (!Number.isFinite(number)) {
              return;
            }

            onChange(serializeAuthoringLength(number, unit));
          }}
        />

        <select
          id={`${id}-unit`}
          name={`${name}Unit`}
          value={unit}
          onChange={(event) => {
            const nextUnit = event.target.value as AuthoringLengthUnit;

            if (!units.includes(nextUnit)) {
              return;
            }

            if (value === undefined) {
              setUnit(nextUnit);
              return;
            }

            const converted = convertAuthoringLength(
              value,
              nextUnit,
              relativeFontSizePx,
            );

            if (converted === undefined) {
              return;
            }

            setUnit(nextUnit);
            onChange(serializeAuthoringLength(converted, nextUnit));
          }}
        >
          {units.map((supportedUnit) => (
            <option key={supportedUnit} value={supportedUnit}>
              {supportedUnit}
            </option>
          ))}
        </select>
      </div>

      {inherited ? (
        <span className={styles.inheritedValueLabel}>
          {inheritedSource === "linked" ? t("inspector.linkedValue") : t("inspector.default")}
        </span>
      ) : (
        <button
          className={styles.effectiveValueReset}
          type="button"
          title={inheritedSource === "linked" ? t("inspector.resetLinkedOverride") : t("inspector.useThemeDefault")}
          onClick={() => {
            setUnit(preferredUnit);
            onReset();
          }}
        >
          {inheritedSource === "linked" ? t("inspector.resetLinkedOverride") : t("inspector.default")}
        </button>
      )}
    </div>
  );
}
