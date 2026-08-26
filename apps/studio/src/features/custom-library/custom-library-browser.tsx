"use client";

import type { CustomLibraryItemRecord } from "./custom-library-repository";
import styles from "../library/presentation-library.module.css";
import { useStudioI18n } from "../i18n/studio-i18n-context";
import { ELEMENT_TYPE_MESSAGE_KEYS } from "../i18n/studio-i18n";
import { CustomLibraryStylePreview } from "./custom-library-style-preview";

interface CustomLibraryBrowserProps {
  items: readonly CustomLibraryItemRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CustomLibraryBrowser({
  items,
  selectedId,
  onSelect,
}: CustomLibraryBrowserProps) {
  const { t } = useStudioI18n();

  return (
    <ul className={styles.list} aria-label={t("library.customLibrary")}>
      {items.map(({ id, item }) => {
        const selected = selectedId === id;

        return (
          <li key={id}>
            <button
              type="button"
              className={styles.row}
              data-custom-library-row
              data-selected={selected}
              aria-pressed={selected}
              aria-label={item.name}
              onClick={() => onSelect(id)}
            >
              <CustomLibraryStylePreview recipe={item.root} />
              <span className={styles.rowDetails}>
                <strong className={styles.rowTitle}>{item.name}</strong>
                <span className={styles.rowMetadata}>
                  {t(ELEMENT_TYPE_MESSAGE_KEYS[item.root.type])}
                  {item.description ? <span>{item.description}</span> : null}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
