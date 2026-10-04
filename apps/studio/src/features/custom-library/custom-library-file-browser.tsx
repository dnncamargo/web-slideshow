"use client";

import { useStudioI18n } from "../i18n/studio-i18n-context";
import styles from "../library/presentation-library.module.css";
import {
  formatCustomLibraryFileSize,
  type CustomLibraryFileRecord,
} from "./custom-library-file";

interface CustomLibraryFileBrowserProps {
  records: readonly CustomLibraryFileRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CustomLibraryFileBrowser({
  records,
  selectedId,
  onSelect,
}: CustomLibraryFileBrowserProps) {
  const { t } = useStudioI18n();

  return (
    <ul className={styles.list} aria-label={t("library.files")}>
      {records.map(({ id, file }) => {
        const selected = selectedId === id;

        return (
          <li key={id}>
            <button
              type="button"
              className={styles.row}
              data-custom-library-file-row
              data-selected={selected}
              aria-pressed={selected}
              aria-label={file.name}
              onClick={() => onSelect(id)}
            >
              <span className={styles.customLibraryFilePreview} aria-hidden="true">
                <span className={styles.customLibraryFilePreviewGlyph}>
                  {file.kind.slice(0, 3).toUpperCase()}
                </span>
              </span>
              <span className={styles.rowDetails}>
                <strong className={styles.rowTitle}>{file.name}</strong>
                <span className={styles.rowMetadata}>
                  <span>{t(`customLibrary.file.kind.${file.kind}`)}</span>
                  <span>{formatCustomLibraryFileSize(file.source.sizeBytes)}</span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
