"use client";

import { useState } from "react";

import { Button } from "@web-slideshow/ui";

import { useStudioI18n } from "../i18n/studio-i18n-context";
import { GoogleFontImportControl } from "../fonts/components/google-font-import-control";
import { ManualFontControl } from "../fonts/components/manual-font-control";
import { FontFileUploadControl } from "../fonts/components/font-file-upload-control";
import { WebFontSearchControl } from "../fonts/components/web-font-search-control";
import type { FontFamilyFaces, OnAddFontFace } from "../fonts/font-acquisition-types";
import styles from "../library/presentation-library.module.css";

export interface CustomLibraryFontAcquisitionProps {
  fontFamilies: readonly FontFamilyFaces[];
  onAddFontFace: OnAddFontFace;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
}

type FontSource = "fontsource" | "google-fonts" | "upload" | "manual";

export function CustomLibraryFontAcquisition({
  fontFamilies,
  onAddFontFace,
  saving = false,
  error = null,
  onClose,
}: CustomLibraryFontAcquisitionProps) {
  const { t } = useStudioI18n();
  const [source, setSource] = useState<FontSource>("fontsource");
  const [lastAddedFamily, setLastAddedFamily] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <div className={styles.fontAcquisition}>
      <h2 className={styles.detailsHeading}>{t("customLibrary.fontManagement.title")}</h2>

      <label className={styles.fontAcquisitionSource}>
        <span>{t("customLibrary.fontManagement.source")}</span>
        <select
          id="custom-library-font-source"
          name="customLibraryFontSource"
          value={source}
          disabled={saving || uploading}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "fontsource" || next === "google-fonts" || next === "upload" || next === "manual") {
              setSource(next);
              setLastAddedFamily(null);
            }
          }}
        >
          <option value="fontsource">{t("customLibrary.fontManagement.fontsource")}</option>
          <option value="google-fonts">{t("customLibrary.fontManagement.googleFonts")}</option>
          <option value="upload">{t("customLibrary.fontManagement.uploadFile")}</option>
          <option value="manual">{t("customLibrary.fontManagement.manual")}</option>
        </select>
      </label>

      {saving ? <p className={styles.stateBlock} role="status">{t("customLibrary.fontManagement.saving")}</p> : null}
      {error ? <p className={styles.errorText} role="alert">{error}</p> : null}
      {lastAddedFamily ? <p className={styles.stateBlock} role="status">{t("customLibrary.fontManagement.added", { family: lastAddedFamily })}</p> : null}

      {source === "fontsource" ? (
        <WebFontSearchControl
          provider="fontsource"
          fontFamilies={fontFamilies}
          onAddFontFace={onAddFontFace}
          onFontAdded={setLastAddedFamily}
          controlPrefix="custom-library-font"
        />
      ) : null}
      {source === "google-fonts" ? (
        <>
          <WebFontSearchControl
            provider="google-fonts"
            fontFamilies={fontFamilies}
            onAddFontFace={onAddFontFace}
            onFontAdded={setLastAddedFamily}
            controlPrefix="custom-library-font"
          />
          <GoogleFontImportControl
            fontFamilies={fontFamilies}
            onAddFontFace={onAddFontFace}
            onFontAdded={setLastAddedFamily}
            controlPrefix="custom-library-font"
          />
        </>
      ) : null}
      {source === "manual" ? (
        <ManualFontControl
          fontFamilies={fontFamilies}
          onAddFontFace={onAddFontFace}
          onFontAdded={setLastAddedFamily}
          controlPrefix="custom-library-font"
        />
      ) : null}
      {source === "upload" ? (
        <FontFileUploadControl
          fontFamilies={fontFamilies}
          onAddFontFace={onAddFontFace}
          onFontAdded={setLastAddedFamily}
          onUploadingChange={setUploading}
          controlPrefix="custom-library-font"
        />
      ) : null}

      <div className={styles.fontAcquisitionFooter}>
        <Button size="compact" variant="secondary" disabled={saving || uploading} onClick={onClose}>
        {t("customLibrary.fontManagement.close")}
        </Button>
      </div>
    </div>
  );
}
