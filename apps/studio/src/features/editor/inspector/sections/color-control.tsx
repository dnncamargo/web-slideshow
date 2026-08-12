import {
  colorToPickerHex,
  formatColorAsHex,
  formatColorAsRgba,
  normalizeColor,
  parseColor,
  replaceColorRgb,
  type Color,
  type ColorFormat,
} from "@powershow/document-schema";
import { useEffect, useState } from "react";

import styles from "../../editor-workspace.module.css";

const DEFAULT_PICKER_COLOR = "#f8fafc";

interface ColorControlProps {
  id: string;
  name: string;
  value: Color | undefined;
  onChange: (color: Color) => void;
}

function getColorFormat(value: string): ColorFormat {
  return value.trim().startsWith("#") ? "hex" : "rgba";
}

function formatColor(value: string, format: ColorFormat): Color | undefined {
  const color = parseColor(value);

  if (!color) {
    return undefined;
  }

  return format === "hex" ? formatColorAsHex(color) : formatColorAsRgba(color);
}

export function ColorControl({ id, name, value, onChange }: ColorControlProps) {
  const sourceValue = value ?? DEFAULT_PICKER_COLOR;
  const [draft, setDraft] = useState(sourceValue);
  const [format, setFormat] = useState<ColorFormat>(() =>
    getColorFormat(sourceValue),
  );

  useEffect(() => {
    setDraft(sourceValue);
    setFormat(getColorFormat(sourceValue));
  }, [sourceValue]);

  const pickerColor = colorToPickerHex(draft) ?? colorToPickerHex(sourceValue);

  return (
    <div className={styles.colorValueControl}>
      <input
        id={id}
        name={name}
        className={styles.colorInput}
        type="color"
        value={pickerColor ?? DEFAULT_PICKER_COLOR}
        onChange={(event) => {
          const next = replaceColorRgb(
            parseColor(draft) ? draft : sourceValue,
            event.target.value,
            format,
          );

          if (next) {
            setDraft(next);
            onChange(next);
          }
        }}
      />

      <input
        id={`${id}-value`}
        name={`${name}Value`}
        type="text"
        autoComplete="off"
        value={draft}
        onChange={(event) => {
          const nextDraft = event.target.value;
          const normalized = normalizeColor(nextDraft);

          setDraft(nextDraft);

          if (normalized) {
            setFormat(getColorFormat(nextDraft));
            onChange(normalized);
          }
        }}
      />

      <select
        id={`${id}-format`}
        name={`${name}Format`}
        value={format}
        onChange={(event) => {
          const nextFormat = event.target.value as ColorFormat;

          if (nextFormat !== "hex" && nextFormat !== "rgba") {
            return;
          }

          const next = formatColor(draft, nextFormat);

          if (!next) {
            return;
          }

          setFormat(nextFormat);
          setDraft(next);

          if (value !== undefined) {
            onChange(next);
          }
        }}
      >
        <option value="hex">HEX</option>
        <option value="rgba">RGBA</option>
      </select>
    </div>
  );
}
