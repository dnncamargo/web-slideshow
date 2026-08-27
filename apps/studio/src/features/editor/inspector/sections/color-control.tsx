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
import { usePickedColors } from "./picked-colors-provider";

const DEFAULT_PICKER_COLOR = "#f8fafc";

interface ColorControlProps {
  id: string;
  name: string;
  value: ColorValue | undefined;
  onChange: (color: ColorValue) => void;
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  disabled?: boolean;
}

export function ColorControl({
  id,
  name,
  value,
  onChange,
  secondaryAction,
  disabled = false,
}: ColorControlProps) {
  const { t } = useStudioI18n();
  const palette = usePresentationColorPalette();
  const picked = usePickedColors();
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
    onChange(color);
  };
  const hasReusableChoices = paletteColors.length > 0 || (picked?.colors.length ?? 0) > 0;

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
          if (source === "picker") picked?.onPickColor(color);
        }}
      />

      {(hasReusableChoices || secondaryAction) && (
        <div className={styles.colorControlActionRow}>
          {hasReusableChoices ? (
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
          {secondaryAction ? (
            <button
              className={styles.colorPaletteDisclosure}
              type="button"
              disabled={disabled || secondaryAction.disabled}
              onClick={() => {
                setIsPaletteChooserOpen(false);
                secondaryAction.onClick();
              }}
            >
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      )}

      {isLinked && (
        <div className={styles.colorLinkedStatus} role="status">
          <span>{t("inspector.linkedColor")} · {linkedPaletteColor?.name ?? value?.colorId}</span>
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

      {isPaletteChooserOpen && hasReusableChoices ? (
        <div className={styles.colorPalette} id={`${id}-palette-chooser`}>
          <span className={styles.colorPaletteLabel}>{t("inspector.palette")}</span>
          {paletteColors.length > 0 ? (
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
          ) : null}
          {picked && picked.colors.length > 0 ? (
            <>
              <span className={styles.colorPaletteLabel}>{t("inspector.picked")}</span>
              <div className={styles.colorPaletteActions}>
                {picked.colors.map((color, index) => (
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
                        onChange(color);
                      }}
                    />
                    <button
                      className={styles.colorPaletteRemove}
                      type="button"
                      disabled={disabled}
                      aria-label={t("inspector.removePickedColor", { color })}
                      title={t("inspector.removePickedColor", { color })}
                      onClick={() => picked.onRemoveColor(color)}
                    >×</button>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

     </div>
   );
 }
