"use client";

import { Button } from "@web-slideshow/ui";

import { useStudioI18n } from "../i18n/studio-i18n-context";
import styles from "../library/presentation-library.module.css";
import type { StudioMessageKey } from "../i18n/studio-i18n";
import type { CustomLibraryFontFace, CustomLibraryFontFaceProvenance, CustomLibraryFontRecord } from "./custom-library-font";
import { fontFaceRemovalSafety, managedFontPathFromUrl } from "./custom-library-font-provenance";

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

export function resolveManagedFontStoragePath(face: CustomLibraryFontFace, ownerId: string | null | undefined): string | null {
  if (!ownerId) return null;
  const identity = managedFontPathFromUrl(face.source.url, ownerId);
  if (!identity) return null;
  const extension = identity.pathname.slice(identity.pathname.lastIndexOf(".")).toLowerCase();
  const expectedFormat = extension === ".ttf" ? "truetype" : extension === ".otf" ? "opentype" : extension.slice(1);
  if (face.source.format !== expectedFormat) return null;
  const provenance = face.provenance as CustomLibraryFontFaceProvenance | undefined;
  if (provenance && (provenance.kind !== "managed-upload" || provenance.assetId.toLowerCase() !== identity.assetId.toLowerCase())) return null;
  return identity.pathname;
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
  const removalBlocked = record.font.faces.some((face) => fontFaceRemovalSafety(face, ownerId ?? "") !== "removable");

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
                  <Button size="compact" onClick={() => {
                    const pathname = resolveManagedFontStoragePath(face, ownerId);
                    if (pathname) onViewInStorage(pathname);
                  }}>
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
        <Button variant="danger" size="compact" disabled={pending || removalBlocked} onClick={onDelete}>
          {t("customLibrary.fontDetails.delete")}
        </Button>
      </div>
      {removalBlocked ? <p className={styles.stateBlock} role="status">{t("customLibrary.fontDetails.managedRemovalBlocked")}</p> : null}
    </aside>
  );
}
