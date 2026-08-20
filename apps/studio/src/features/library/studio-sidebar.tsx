"use client";

import { useStudioI18n } from "../i18n/studio-i18n-context";

import type { LibraryDestination } from "./presentation-library-logic";
import styles from "./presentation-library.module.css";

interface StudioSidebarProps {
  destination: LibraryDestination;
  onDestinationChange: (destination: LibraryDestination) => void;
}

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
      <nav aria-label={t("library.navigation")}>
        <section className={styles.sidebarSection}>
          <h2>{t("library.presentations")}</h2>
          {item("all", t("library.all"))}
          {item("archived", t("library.archived"))}
        </section>

        <section className={styles.sidebarSection}>
          <h2>{t("library.folders")}</h2>
          {item("folders", t("library.folders"))}
        </section>

        <section className={styles.sidebarSection}>
          <h2>{t("library.resources")}</h2>
          {item("styles", t("library.styles"))}
          {item("palettes", t("library.palettes"))}
        </section>
      </nav>
    </aside>
  );
}
