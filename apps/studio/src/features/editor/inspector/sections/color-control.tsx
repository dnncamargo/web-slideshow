import {
  detachColorValue,
  type Color,
  type ColorValue,
  isPaletteColorReference,
  resolveColorValue,
} from "@powershow/document-schema";
import { useState } from "react";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import { LiteralColorInput } from "@/features/editor/color/literal-color-input";

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
  const [literalValue, setLiteralValue] = useState(sourceValue);
  const [isPaletteChooserOpen, setIsPaletteChooserOpen] = useState(false);
  const [lastSourceValue, setLastSourceValue] = useState(sourceValue);
  if (sourceValue !== lastSourceValue) {
    setLastSourceValue(sourceValue);
    setLiteralValue(sourceValue);
  }
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
      <LiteralColorInput
        id={id}
        name={name}
        value={literalValue}
        disabled={disabled}
        onChange={(color, source) => {
          setLiteralValue(color);
          setIsPaletteChooserOpen(false);

          if (source === "format" && value === undefined) {
            return;
          }

          emitLiteralColor(color);
        }}
      />

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
                    setLiteralValue(color.value);
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
                    setLiteralValue(color);
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
