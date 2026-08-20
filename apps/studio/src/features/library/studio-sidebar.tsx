"use client";

import { useStudioI18n } from "../i18n/studio-i18n-context";

import type { LibraryDestination } from "./presentation-library-logic";
import styles from "./presentation-library.module.css";

interface StudioSidebarProps {
  destination: LibraryDestination;
  onDestinationChange: (destination: LibraryDestination) => void;
}

/**
 * Studio fixed sidebar information architecture:
 *
 * - Presentations: All, Archived (fixed navigation)
 * - Folders: Explorer-like organization for presentations. There are no
 *   persisted folders yet, so the section shows a restrained future empty
 *   state inside its own bounded scrolling list pane. Folders are NOT a
 *   generic workspace destination.
 * - Resources: Styles, Palettes, Fonts (fixed navigation)
 */
export function StudioSidebar({
  destination,
  onDestinationChange,
}: StudioSidebarProps) {
  const { t } = useStudioI18n();

  const item = (value: LibraryDestination, label: string) => (
    <button
      type="button"
      className={styles.sidebarItem}
      data-active={destination === value}
      aria-current={destination === value ? "page" : undefined}
      onClick={() => onDestinationChange(value)}
    >
      {label}
    </button>
  );

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.sidebarNav} aria-label={t("library.navigation")}>
        <section className={styles.sidebarSection}>
          <h2>{t("library.presentations")}</h2>
          {item("all", t("library.all"))}
          {item("archived", t("library.archived"))}
        </section>

        <section
          className={`${styles.sidebarSection} ${styles.sidebarFoldersSection}`}
        >
          <h2>{t("library.folders")}</h2>
          <div className={styles.sidebarFolderList}>
            <p className={styles.sidebarEmptyState}>{t("library.foldersEmpty")}</p>
          </div>
        </section>

        <section className={styles.sidebarSection}>
          <h2>{t("library.resources")}</h2>
          {item("styles", t("library.styles"))}
          {item("palettes", t("library.palettes"))}
          {item("fonts", t("library.fonts"))}
        </section>
      </nav>
    </aside>
  );
}