"use client";

import type { CustomLibraryPaletteRecord } from "./custom-library-palette-repository";
import styles from "../library/presentation-library.module.css";
import { useStudioI18n } from "../i18n/studio-i18n-context";

interface CustomLibraryPaletteBrowserProps {
  records: readonly CustomLibraryPaletteRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const PREVIEW_COLOR_LIMIT = 6;

export function CustomLibraryPaletteBrowser({
  records,
  selectedId,
  onSelect,
}: CustomLibraryPaletteBrowserProps) {
  const { t } = useStudioI18n();

  return (
    <ul className={styles.list} aria-label={t("library.palettes")}>
      {records.map(({ id, palette }) => {
        const selected = selectedId === id;
        const visibleColors = palette.colors.slice(0, PREVIEW_COLOR_LIMIT);
        const remainingCount = palette.colors.length - visibleColors.length;

        return (
          <li key={id}>
            <button
              type="button"
              className={styles.row}
              data-custom-library-palette-row
              data-selected={selected}
              aria-pressed={selected}
              aria-label={palette.name}
              onClick={() => onSelect(id)}
            >
              <span className={styles.customLibraryPalettePreview} aria-hidden="true">
                {visibleColors.map((color, index) => (
                  <span
                    className={styles.customLibraryPaletteSwatch}
                    data-palette-swatch
                    key={`${color.name}-${index}`}
                    style={{ backgroundColor: color.value }}
                  />
                ))}
                {remainingCount > 0 ? (
                  <span className={styles.customLibraryPaletteMore}>+{remainingCount}</span>
                ) : null}
              </span>
              <span className={styles.rowDetails}>
                <strong className={styles.rowTitle}>{palette.name}</strong>
                <span className={styles.rowMetadata}>
                  <span>{t("customLibrary.paletteDetails.colorsCount", { count: palette.colors.length })}</span>
                  {palette.description ? <span>{palette.description}</span> : null}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
