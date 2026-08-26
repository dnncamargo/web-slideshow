"use client";

import { Button } from "@powershow/ui";

import { useStudioI18n } from "../i18n/studio-i18n-context";
import type { CustomLibraryPaletteRecord } from "./custom-library-palette-repository";
import styles from "../library/presentation-library.module.css";

interface CustomLibraryPaletteDetailsProps {
  record: CustomLibraryPaletteRecord | null;
  onDelete: () => void;
}

export function CustomLibraryPaletteDetails({
  record,
  onDelete,
}: CustomLibraryPaletteDetailsProps) {
  const { t } = useStudioI18n();

  if (!record) {
    return (
      <aside className={styles.detailsPane} aria-label={t("library.details")}>
        <h2 className={styles.detailsHeading}>{t("library.details")}</h2>
        <p className={styles.detailsEmpty}>{t("customLibrary.paletteDetails.noSelection")}</p>
      </aside>
    );
  }

  return (
    <aside className={styles.detailsPane} aria-label={t("library.details")}>
      <h2 className={styles.detailsHeading}>{t("library.details")}</h2>
      <dl className={styles.detailsList}>
        <div className={styles.detailsRow}>
          <dt>{t("customLibrary.paletteDetails.name")}</dt>
          <dd>{record.palette.name}</dd>
        </div>
        <div className={styles.detailsRow}>
          <dt>{t("customLibrary.paletteDetails.description")}</dt>
          <dd>{record.palette.description ?? "—"}</dd>
        </div>
        <div className={styles.detailsRow}>
          <dt>{t("customLibrary.paletteDetails.colors")}</dt>
          <dd>{record.palette.colors.length}</dd>
        </div>
        <div className={styles.detailsRow}>
          <dt>{t("customLibrary.paletteDetails.colorList")}</dt>
          <dd>
            <ul className={styles.customLibraryPaletteColorList}>
              {record.palette.colors.map((color, index) => (
                <li className={styles.customLibraryPaletteColorRow} data-palette-color-row key={`${color.name}-${index}`}>
                  <span
                    className={styles.customLibraryPaletteSwatch}
                    style={{ backgroundColor: color.value }}
                    aria-hidden="true"
                  />
                  <span>
                    <strong>{color.name}</strong>
                    <span className={styles.customLibraryPaletteColorValue}>{color.value}</span>
                  </span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
      <div className={styles.customLibraryDeleteAction}>
        <Button variant="danger" size="compact" onClick={onDelete}>
          {t("customLibrary.paletteDetails.delete")}
        </Button>
      </div>
    </aside>
  );
}
