"use client";

import { useStudioI18n } from "../i18n/studio-i18n-context";
import styles from "../library/presentation-library.module.css";
import type { CustomLibraryFontRecord } from "./custom-library-font";

interface CustomLibraryFontBrowserProps {
  records: readonly CustomLibraryFontRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CustomLibraryFontBrowser({ records, selectedId, onSelect }: CustomLibraryFontBrowserProps) {
  const { t } = useStudioI18n();

  return (
    <ul className={styles.list} aria-label={t("library.fonts")}>
      {records.map(({ id, font }) => {
        const selected = selectedId === id;
        const countLabel = font.faces.length === 1
          ? t("customLibrary.fontBrowser.faceCountOne")
          : t("customLibrary.fontBrowser.faceCountMany", { count: font.faces.length });

        return (
          <li key={id}>
            <button
              type="button"
              className={styles.row}
              data-custom-library-font-row
              data-selected={selected}
              aria-pressed={selected}
              aria-label={font.family}
              onClick={() => onSelect(id)}
            >
              <span className={styles.customLibraryFontPreview} aria-hidden="true">Ag</span>
              <span className={styles.rowDetails}>
                <strong className={styles.rowTitle}>{font.family}</strong>
                <span className={styles.rowMetadata}>{countLabel}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
