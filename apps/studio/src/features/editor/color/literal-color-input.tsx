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
import { useEffect, useRef, useState } from "react";

import styles from "./literal-color-input.module.css";

export type LiteralColorChangeSource = "picker" | "text" | "format";

export interface LiteralColorInputProps {
  id: string;
  name: string;
  value: Color;
  disabled?: boolean;
  onChange: (color: Color, source: LiteralColorChangeSource) => void;
  onCommit?: (color: Color, source: "picker") => void;
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
  onCommit,
}: LiteralColorInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const lastPickerPreviewRef = useRef<Color | undefined>(undefined);
  const [draft, setDraft] = useState<Color>(value);
  const [format, setFormat] = useState<ColorFormat>(() => getColorFormat(value));
  const [lastValue, setLastValue] = useState(value);
  const pickerStateRef = useRef({ draft, value, format, onChange, onCommit });
  pickerStateRef.current = { draft, value, format, onChange, onCommit };

  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
    setFormat(getColorFormat(value));
  }

  const pickerColor = colorToPickerHex(draft) ?? colorToPickerHex(value);

  const updatePickerColor = (pickerValue: string, preview: boolean) => {
    const current = pickerStateRef.current;
    const pickerBase = parseColor(current.draft) ? current.draft : current.value;
    const next = replaceColorRgb(pickerBase, pickerValue, current.format);

    if (next) {
      setDraft(next);
      if (preview || lastPickerPreviewRef.current !== next) {
        current.onChange(next, "picker");
      }
      if (preview) lastPickerPreviewRef.current = next;
      return next;
    }

    return undefined;
  };

  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) return;
    const handleCommit = () => {
      const next = updatePickerColor(picker.value, false);
      lastPickerPreviewRef.current = undefined;
      const commit = pickerStateRef.current.onCommit;
      if (next && commit) commit(next, "picker");
    };
    picker.addEventListener("change", handleCommit);
    return () => picker.removeEventListener("change", handleCommit);
  }, []);

  return (
    <div className={styles.control}>
      <input
        id={id}
        name={name}
        ref={pickerRef}
        className={styles.input}
        type="color"
        value={pickerColor ?? "#f8fafc"}
        disabled={disabled}
        onInput={(event) => { updatePickerColor(event.currentTarget.value, true); }}
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
