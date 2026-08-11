import { useState } from "react";

import type { WebFontSourceSelection } from "@/features/fonts/web-font-types";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";
import { getControlName } from "../inspector-helpers";
import type { FontResourceControls } from "../inspector-types";
import { ManualFontFaceForm } from "./manual-font-face-form";
import { RegisteredFontList } from "./registered-font-list";
import { WebFontDiscoveryControl } from "./web-font-discovery-control";

interface PresentationFontManagerProps extends FontResourceControls {
  id: string;
}
export function PresentationFontManager({
  id,
  fontResources,
  onAddFontFace,
  onRemoveFontFace,
  isFontFamilyInUse,
}: PresentationFontManagerProps) {
  const { t } = useStudioI18n();
  const [source, setSource] =
    useState<WebFontSourceSelection>("fontsource");

  return (
    <div
      id={id}
      className={styles.fontManager}
      role="region"
      aria-label={t("inspector.presentationFonts")}
    >
      <strong className={styles.fontManagerTitle}>
        {t("inspector.presentationFonts")}
      </strong>

      <label className={styles.field}>
        <span>{t("inspector.fontSource")}</span>

        <select
          id="presentation-font-provider"
          name={getControlName("presentation", "FontProvider")}
          value={source}
          onChange={(event) => {
            const nextSource = event.target.value;

            if (
              nextSource === "fontsource" ||
              nextSource === "google-fonts" ||
              nextSource === "manual"
            ) {
              setSource(nextSource);
            }
          }}
        >
          <option value="fontsource">{t("inspector.fontsource")}</option>
          <option value="google-fonts">{t("inspector.googleFonts")}</option>
          <option value="manual">{t("inspector.manualFontSource")}</option>
        </select>
      </label>

      {source === "manual" ? (
        <ManualFontFaceForm
          fontResources={fontResources}
          onAddFontFace={onAddFontFace}
        />
      ) : (
        <WebFontDiscoveryControl
          key={source}
          provider={source}
          fontResources={fontResources}
          onAddFontFace={onAddFontFace}
        />
      )}

      <RegisteredFontList
        fontResources={fontResources}
        onRemoveFontFace={onRemoveFontFace}
        isFontFamilyInUse={isFontFamilyInUse}
      />
    </div>
  );
}
