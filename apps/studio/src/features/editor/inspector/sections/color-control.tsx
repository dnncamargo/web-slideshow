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

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import {
  addPaletteColor,
  arePaletteColorsEquivalent,
  movePaletteColor,
} from "./color-palette-helpers";
import { usePresentationColorPalette } from "./presentation-color-palette";
import { useRecentColors } from "./recent-colors-provider";
import {
  THEME_COLORS,
  type ThemeColorKey,
} from "@powershow/theme/element-style-defaults";

const DEFAULT_PICKER_COLOR = "#f8fafc";

interface ColorControlProps {
  id: string;
  name: string;
  value: Color | undefined;
  onChange: (color: Color) => void;
  disabled?: boolean;
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

export function ColorControl({
  id,
  name,
  value,
  onChange,
  disabled = false,
}: ColorControlProps) {
  const { t } = useStudioI18n();
  const palette = usePresentationColorPalette();
  const recent = useRecentColors();
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
  const currentColor = normalizeColor(draft) ?? normalizeColor(sourceValue);
  const paletteColor = parseColor(draft) ? (draft as Color) : sourceValue;
  const paletteColors = palette?.colors ?? [];
  const canAddCurrentColor =
    currentColor !== undefined &&
    !paletteColors.some((color) =>
      arePaletteColorsEquivalent(color, currentColor),
    );

  return (
    <div className={styles.colorControlGroup}>
      <div className={styles.colorValueControl}>
        <input
          id={id}
          name={name}
          className={styles.colorInput}
          type="color"
          value={pickerColor ?? DEFAULT_PICKER_COLOR}
          disabled={disabled}
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
          disabled={disabled}
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

            if (value !== undefined) {
              onChange(next);
            }
          }}
        >
          <option value="hex">HEX</option>
          <option value="rgba">RGBA</option>
        </select>
      </div>

      {palette && (
        <div className={styles.colorPalette}>
          <span className={styles.colorPaletteLabel}>{t("inspector.palette")}</span>

          <div className={styles.colorPaletteActions}>
            {paletteColors.map((color, index) => (
              <div className={styles.colorPaletteEntry} key={`${color.id}-${index}`}>
                <button
                  className={styles.colorPaletteSwatch}
                  type="button"
                  disabled={disabled}
                  aria-label={t("inspector.applyPaletteColor", { color: color.name })}
                  title={t("inspector.applyPaletteColor", { color: color.name })}
                  style={{ backgroundColor: color.value }}
                  onClick={() => {
                    setDraft(color.value);
                    setFormat(getColorFormat(color.value));
                    onChange(color.value);
                  }}
                />

                <button
                  className={styles.colorPaletteRemove}
                  type="button"
                  disabled={disabled}
                  aria-label={t("inspector.removeColorFromPalette", { color: color.name })}
                  title={t("inspector.removeColorFromPalette", { color: color.name })}
                  onClick={() => {
                    palette.onRemoveColor(index);
                  }}
                >
                  ×
                </button>
              </div>
            ))}

            <button
              className={styles.colorPaletteAdd}
              type="button"
              disabled={disabled || !canAddCurrentColor}
              aria-label={t("inspector.addCurrentColor")}
              title={t("inspector.addCurrentColor")}
              onClick={() => {
                if (currentColor) {
                  palette.onAddColor(paletteColor);
                }
              }}
            >
              +
            </button>
          </div>
        </div>
      )}

      {recent && recent.colors.length > 0 && (
        <div className={styles.colorRecent}>
          <span className={styles.colorPaletteLabel}>{t("inspector.recent")}</span>

          <div className={styles.colorPaletteActions}>
            {recent.colors.map((color, index) => (
              <div className={styles.colorPaletteEntry} key={`${color}-${index}`}>
                <button
                  className={styles.colorPaletteSwatch}
                  type="button"
                  disabled={disabled}
                  aria-label={t("inspector.applyPaletteColor", { color })}
                  title={t("inspector.applyPaletteColor", { color })}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    setDraft(color);
                    setFormat(getColorFormat(color));
                    onChange(color);
                  }}
                />

                <div className={styles.colorPaletteMoveButtons}>
                  <button
                    className={styles.colorPaletteMove}
                    type="button"
                    disabled={disabled || index === 0}
                    aria-label={t("inspector.moveColorLeft", { color })}
                    title={t("inspector.moveColorLeft", { color })}
                    onClick={() => {
                      recent.onMoveColor(index, -1);
                    }}
                  >
                    ←
                  </button>

                  <button
                    className={styles.colorPaletteMove}
                    type="button"
                    disabled={disabled || index === recent.colors.length - 1}
                    aria-label={t("inspector.moveColorRight", { color })}
                    title={t("inspector.moveColorRight", { color })}
                    onClick={() => {
                      recent.onMoveColor(index, 1);
                    }}
                  >
                    →
                  </button>
                </div>
              </div>
            ))}

             <button
               className={styles.colorPaletteClear}
               type="button"
               disabled={disabled}
               aria-label={t("inspector.clearRecentColors")}
               title={t("inspector.clearRecentColors")}
               onClick={() => {
                 recent.onClearColors();
               }}
             >
               {t("inspector.clear")}
             </button>
           </div>
         </div>
       )}

       <div className={styles.colorTheme}>
         <span className={styles.colorPaletteLabel}>{t("inspector.theme")}</span>

         <div className={styles.colorPaletteActions}>
           {(Object.keys(THEME_COLORS) as ThemeColorKey[]).map((key) => {
             const color = THEME_COLORS[key];

             return (
               <button
                 key={key}
                 className={styles.colorPaletteSwatch}
                 type="button"
                 disabled={disabled}
                 aria-label={t("inspector.applyPaletteColor", { color })}
                 title={t("inspector.applyPaletteColor", { color })}
                 style={{ backgroundColor: color }}
                 onClick={() => {
                   setDraft(color);
                   setFormat(getColorFormat(color));
                   onChange(color);
                 }}
               />
             );
           })}
         </div>
       </div>
     </div>
   );
 }
