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
import { useState } from "react";

import styles from "./literal-color-input.module.css";

export type LiteralColorChangeSource = "picker" | "text" | "format";

export interface LiteralColorInputProps {
  id: string;
  name: string;
  value: Color;
  disabled?: boolean;
  onChange: (color: Color, source: LiteralColorChangeSource) => void;
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

export function LiteralColorInput({
  id,
  name,
  value,
  disabled = false,
  onChange,
}: LiteralColorInputProps) {
  const [draft, setDraft] = useState<Color>(value);
  const [format, setFormat] = useState<ColorFormat>(() => getColorFormat(value));
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
    setFormat(getColorFormat(value));
  }

  const pickerColor = colorToPickerHex(draft) ?? colorToPickerHex(value);

  return (
    <div className={styles.control}>
      <input
        id={id}
        name={name}
        className={styles.input}
        type="color"
        value={pickerColor ?? "#f8fafc"}
        disabled={disabled}
        onChange={(event) => {
          const next = replaceColorRgb(draft, event.target.value, format);

          if (next) {
            setDraft(next);
            onChange(next, "picker");
          }
        }}
      />

      <input
        id={`${id}-value`}
        name={`${name}Value`}
        type="text"
        autoComplete="off"
        value={draft}
        disabled={disabled}
        onChange={(event) => {
          const nextDraft = event.target.value;
          const normalized = normalizeColor(nextDraft);

          setDraft(nextDraft);

          if (normalized) {
            setFormat(getColorFormat(nextDraft));
            onChange(normalized, "text");
          }
        }}
      />

      <select
        id={`${id}-format`}
        name={`${name}Format`}
        value={format}
        disabled={disabled}
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
          onChange(next, "format");
        }}
      >
        <option value="hex">HEX</option>
        <option value="rgba">RGBA</option>
      </select>
    </div>
  );
}
