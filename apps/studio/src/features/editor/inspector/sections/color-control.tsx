import {
  colorToPickerHex,
  detachColorValue,
  formatColorAsHex,
  formatColorAsRgba,
  normalizeColor,
  parseColor,
  replaceColorRgb,
  type Color,
  type ColorValue,
  isPaletteColorReference,
  resolveColorValue,
  type ColorFormat,
} from "@powershow/document-schema";
import { useEffect, useState } from "react";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import { usePresentationColorPalette } from "./presentation-color-palette";
import { useRecentColors } from "./recent-colors-provider";

const DEFAULT_PICKER_COLOR = "#f8fafc";

interface ColorControlProps {
  id: string;
  name: string;
  value: ColorValue | undefined;
  onChange: (color: ColorValue) => void;
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
  const sourceValue = value === undefined
    ? DEFAULT_PICKER_COLOR
    : resolveColorValue(value, palette ? { colors: palette.colors } : undefined) ?? DEFAULT_PICKER_COLOR;
  const [draft, setDraft] = useState(sourceValue);
  const [format, setFormat] = useState<ColorFormat>(() =>
    getColorFormat(sourceValue),
  );
  const [isPaletteChooserOpen, setIsPaletteChooserOpen] = useState(false);

  useEffect(() => {
    setDraft(sourceValue);
    setFormat(getColorFormat(sourceValue));
  }, [sourceValue]);

  const pickerColor = colorToPickerHex(draft) ?? colorToPickerHex(sourceValue);
  const currentColor = normalizeColor(draft) ?? normalizeColor(sourceValue);
  const paletteColors = palette?.colors ?? [];
  const isLinked = value !== undefined && isPaletteColorReference(value);
  const linkedPaletteColor = isLinked
    ? paletteColors.find((color) => color.id === value.colorId)
    : undefined;
  const detachedValue = value === undefined
    ? undefined
    : detachColorValue(value, { colors: [...paletteColors] });
  const emitLiteralColor = (color: Color) => {
    recent?.onAddColor(color);
    onChange(color);
  };

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
              setIsPaletteChooserOpen(false);
              emitLiteralColor(next);
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
              setIsPaletteChooserOpen(false);
              emitLiteralColor(normalized);
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
            setIsPaletteChooserOpen(false);

            if (value !== undefined) {
              emitLiteralColor(next);
            }
          }}
        >
          <option value="hex">HEX</option>
          <option value="rgba">RGBA</option>
        </select>
      </div>

      {isLinked && (
        <div className={styles.colorLinkedStatus} role="status">
          <span>{t("inspector.linkedColor")} · {linkedPaletteColor?.name ?? value?.colorId}</span>
          {paletteColors.length > 0 ? (
            <button
              type="button"
              aria-expanded={isPaletteChooserOpen}
              aria-controls={`${id}-palette-chooser`}
              disabled={disabled}
              onClick={() => setIsPaletteChooserOpen((open) => !open)}
            >
              {t("inspector.changePalette")}
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled || detachedValue === undefined}
            onClick={() => {
              if (detachedValue !== undefined) {
                setIsPaletteChooserOpen(false);
                emitLiteralColor(detachedValue);
              }
            }}
          >
            {t("inspector.detachColor")}
          </button>
        </div>
      )}

      {!isLinked && paletteColors.length > 0 ? (
        <button
          className={styles.colorPaletteDisclosure}
          type="button"
          aria-expanded={isPaletteChooserOpen}
          aria-controls={`${id}-palette-chooser`}
          disabled={disabled}
          onClick={() => setIsPaletteChooserOpen((open) => !open)}
        >
          {t("inspector.usePalette")}
        </button>
      ) : null}

      {isPaletteChooserOpen && paletteColors.length > 0 ? (
        <div className={styles.colorPalette} id={`${id}-palette-chooser`}>
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
                  aria-pressed={isLinked && value.colorId === color.id}
                  onClick={() => {
                    setDraft(color.value);
                    setFormat(getColorFormat(color.value));
                    setIsPaletteChooserOpen(false);
                    onChange({ kind: "palette", colorId: color.id });
                  }}
                />

              </div>
            ))}

          </div>
        </div>
      ) : null}

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
                    setIsPaletteChooserOpen(false);
                    emitLiteralColor(color);
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

     </div>
   );
 }
