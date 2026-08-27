"use client";

import { Button } from "@powershow/ui";

import { useStudioI18n } from "../i18n/studio-i18n-context";
import styles from "../library/presentation-library.module.css";
import type { CustomLibraryFontRecord } from "./custom-library-font";

interface CustomLibraryFontDetailsProps {
  record: CustomLibraryFontRecord | null;
  pending?: boolean;
  onDelete: () => void;
}

const styleOrder = { normal: 0, italic: 1 } as const;

function styleLabel(style: "normal" | "italic" | undefined, t: ReturnType<typeof useStudioI18n>["t"]): string {
  if (style === "normal") return t("inspector.fontStyle.normal");
  if (style === "italic") return t("inspector.fontStyle.italic");
  return t("inspector.default");
}

function weightLabel(weight: number | undefined, t: ReturnType<typeof useStudioI18n>["t"]): string {
  return weight === undefined ? t("inspector.default") : String(weight);
}

export function CustomLibraryFontDetails({ record, pending = false, onDelete }: CustomLibraryFontDetailsProps) {
  const { t } = useStudioI18n();

  if (!record) {
    return (
      <aside className={`${styles.detailsPane} ${styles.fontDetailsPane}`} aria-label={t("library.details")}>
        <h2 className={styles.detailsHeading}>{t("library.details")}</h2>
        <p className={styles.detailsEmpty}>{t("customLibrary.fontDetails.noSelection")}</p>
      </aside>
    );
  }

  const weights = [...new Set(record.font.faces.map((face) => face.weight))]
    .sort((first, second) => (first === undefined ? -1 : second === undefined ? 1 : first - second))
    .map((weight) => weightLabel(weight, t));
  const stylesInUse = [...new Set(record.font.faces.map((face) => face.style))]
    .sort((first, second) => (first === undefined ? -1 : second === undefined ? 1 : styleOrder[first] - styleOrder[second]))
    .map((style) => styleLabel(style, t));

  return (
    <aside className={`${styles.detailsPane} ${styles.fontDetailsPane}`} aria-label={t("library.details")}>
      <h2 className={styles.detailsHeading}>{t("library.details")}</h2>
      <dl className={styles.detailsList}>
        <div className={styles.detailsRow}><dt>{t("customLibrary.fontDetails.family")}</dt><dd>{record.font.family}</dd></div>
        <div className={styles.detailsRow}><dt>{t("customLibrary.fontDetails.faces")}</dt><dd>{record.font.faces.length}</dd></div>
        <div className={styles.detailsRow}><dt>{t("customLibrary.fontDetails.weights")}</dt><dd>{weights.join(" · ")}</dd></div>
        <div className={styles.detailsRow}><dt>{t("customLibrary.fontDetails.styles")}</dt><dd>{stylesInUse.join(" · ")}</dd></div>
        <div className={styles.detailsRow}>
          <dt>{t("customLibrary.fontDetails.faceList")}</dt>
          <dd>
            <ul className={styles.customLibraryFontFaceList}>
              {record.font.faces.map((face, index) => (
                <li className={styles.customLibraryFontFaceRow} key={`${face.source.url}-${index}`}>
                  {[weightLabel(face.weight, t), styleLabel(face.style, t), face.subset, face.source.format?.toUpperCase()]
                    .filter((value): value is string => value !== undefined)
                    .join(" · ")}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
      <div className={styles.paletteDetailsActions}>
        <Button variant="danger" size="compact" disabled={pending} onClick={onDelete}>
          {t("customLibrary.fontDetails.delete")}
        </Button>
      </div>
    </aside>
  );
}
