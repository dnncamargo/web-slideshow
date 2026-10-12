"use client";

import { Button } from "@web-slideshow/ui";

import { useStudioI18n } from "../i18n/studio-i18n-context";
import styles from "../library/presentation-library.module.css";
import type { StudioMessageKey } from "../i18n/studio-i18n";
import type { CustomLibraryFontRecord } from "./custom-library-font";
import type { FontFaceResource } from "@web-slideshow/document-schema";

interface CustomLibraryFontDetailsProps {
  record: CustomLibraryFontRecord | null;
  pending?: boolean;
  onDelete: () => void;
  ownerId?: string | null;
  onViewInStorage?: (pathname: string) => void;
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

const UUID_FILE_PATH = /^\/users\/([^/]+)\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(ttf|otf|woff|woff2)$/i;

export function resolveManagedFontStoragePath(face: FontFaceResource, ownerId: string | null | undefined): string | null {
  if (!ownerId) return null;
  try {
    const url = new URL(face.source.url);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".public.blob.vercel-storage.com")) return null;
    const match = UUID_FILE_PATH.exec(url.pathname);
    if (!match || decodeURIComponent(match[1] ?? "") !== ownerId) return null;
    const extension = match[3]?.toLowerCase();
    const expectedFormat = extension === "ttf" ? "truetype"
      : extension === "otf" ? "opentype"
        : extension;
    if (face.source.format !== expectedFormat) return null;
    return url.pathname.slice(1);
  } catch {
    return null;
  }
}

export function CustomLibraryFontDetails({ record, pending = false, onDelete, ownerId = null, onViewInStorage }: CustomLibraryFontDetailsProps) {
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
                {resolveManagedFontStoragePath(face, ownerId) && onViewInStorage ? (
                  <Button size="compact" onClick={() => onViewInStorage(resolveManagedFontStoragePath(face, ownerId) as string)}>
                    {t("customLibrary.fontDetails.viewInStorage" as StudioMessageKey)}
                  </Button>
                ) : (
                  <span className={styles.storagePreviewFallback}>
                    {t("customLibrary.fontDetails.storageUnavailable" as StudioMessageKey)}
                  </span>
                )}
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
