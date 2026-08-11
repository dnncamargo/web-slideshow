import { useState } from "react";

import {
  FontFaceResourceSchema,
  getFontResourceFaces,
  type FontFaceResource,
  type FontFormat,
} from "@powershow/document-schema";

import type { StudioMessageKey } from "@/features/i18n/studio-i18n";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import {
  areFontFacesEquivalent,
  normalizeFontFamily,
} from "../../font-resource-helpers";

import styles from "../../editor-workspace.module.css";

import { getControlName } from "../inspector-helpers";
import type { FontResourceControls } from "../inspector-types";

interface PresentationFontManagerProps extends FontResourceControls {
  id: string;

  onFontAdded: (family: string) => void;
}

const FONT_FORMATS: readonly FontFormat[] = [
  "woff2",
  "woff",
  "truetype",
  "opentype",
];

const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

type FontFaceStyle = NonNullable<FontFaceResource["style"]>;

export function PresentationFontManager({
  id,
  onFontAdded,
  fontResources,
  onAddFontFace,
  onRemoveFontFace,
  isFontFamilyInUse,
}: PresentationFontManagerProps) {
  const { t } = useStudioI18n();
  const [family, setFamily] = useState("");
  const [weight, setWeight] = useState(400);
  const [fontStyle, setFontStyle] = useState<FontFaceStyle>("normal");
  const [subset, setSubset] = useState("");
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<FontFormat>("woff2");
  const [error, setError] = useState<StudioMessageKey | null>(null);

  function addFontFace() {
    const trimmedFamily = family.trim();

    if (!trimmedFamily) {
      setError("inspector.fontFamilyRequired");
      return;
    }

    const trimmedSubset = subset.trim();
    const result = FontFaceResourceSchema.safeParse({
      weight,
      style: fontStyle,
      ...(trimmedSubset ? { subset: trimmedSubset } : {}),
      source: {
        type: "url",
        url: url.trim(),
        format,
      },
    });

    if (!result.success) {
      setError("inspector.invalidFontUrl");
      return;
    }

    const normalizedFamily = normalizeFontFamily(trimmedFamily);
    const existingResource = fontResources.find(
      (fontResource) =>
        normalizeFontFamily(fontResource.family) === normalizedFamily,
    );
    const duplicate = existingResource
      ? getFontResourceFaces(existingResource).some((face) =>
          areFontFacesEquivalent(face, result.data),
        )
      : false;

    if (duplicate) {
      setError("inspector.fontFaceExists");
      return;
    }

    const resourceFamily = existingResource?.family ?? trimmedFamily;

    onAddFontFace(resourceFamily, result.data);
    onFontAdded(resourceFamily);
    setFamily("");
    setWeight(400);
    setFontStyle("normal");
    setSubset("");
    setUrl("");
    setFormat("woff2");
    setError(null);
  }

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

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>{t("inspector.family")}</span>

          <input
            id="presentation-font-family"
            name={getControlName("presentation", "FontFamily")}
            type="text"
            value={family}
            onChange={(event) => {
              setFamily(event.target.value);
              setError(null);
            }}
          />
        </label>

        <label className={styles.field}>
          <span>{t("inspector.fontWeight")}</span>

          <select
            id="presentation-font-weight"
            name={getControlName("presentation", "FontWeight")}
            value={weight}
            onChange={(event) => {
              const selectedWeight = Number(event.target.value);

              if (
                FONT_WEIGHTS.some(
                  (fontWeight) => fontWeight === selectedWeight,
                )
              ) {
                setWeight(selectedWeight);
              }
            }}
          >
            {FONT_WEIGHTS.map((fontWeight) => (
              <option key={fontWeight} value={fontWeight}>
                {fontWeight}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>{t("inspector.fontStyle")}</span>

          <select
            id="presentation-font-style"
            name={getControlName("presentation", "FontStyle")}
            value={fontStyle}
            onChange={(event) => {
              const selectedStyle = event.target.value;

              if (selectedStyle === "normal" || selectedStyle === "italic") {
                setFontStyle(selectedStyle);
              }
            }}
          >
            <option value="normal">{t("inspector.fontStyle.normal")}</option>
            <option value="italic">{t("inspector.fontStyle.italic")}</option>
          </select>
        </label>

        <label className={styles.field}>
          <span>{t("inspector.format")}</span>

          <select
            id="presentation-font-format"
            name={getControlName("presentation", "FontFormat")}
            value={format}
            onChange={(event) => {
              const selectedFormat = event.target.value;

              if (FONT_FORMATS.includes(selectedFormat as FontFormat)) {
                setFormat(selectedFormat as FontFormat);
              }
            }}
          >
            {FONT_FORMATS.map((fontFormat) => (
              <option key={fontFormat} value={fontFormat}>
                {fontFormat.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={styles.field}>
        <span>{t("inspector.subset")}</span>

        <input
          id="presentation-font-subset"
          name={getControlName("presentation", "FontSubset")}
          type="text"
          value={subset}
          onChange={(event) => {
            setSubset(event.target.value);
            setError(null);
          }}
        />
      </label>

      <label className={styles.field}>
        <span>{t("inspector.fontUrl")}</span>

        <input
          id="presentation-font-url"
          name={getControlName("presentation", "FontUrl")}
          type="url"
          inputMode="url"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setError(null);
          }}
        />
      </label>

      <button
        className={styles.secondaryButton}
        type="button"
        onClick={addFontFace}
      >
        {t("inspector.addFontFace")}
      </button>

      {error && (
        <span className={styles.validationMessage} role="alert">
          {t(error)}
        </span>
      )}

      <span className={styles.appearanceSubheading}>
        {t("inspector.registeredFonts")}
      </span>

      {fontResources.length === 0 ? (
        <span className={styles.fontResourceEmpty}>
          {t("inspector.noRegisteredFonts")}
        </span>
      ) : (
        <div className={styles.fontResourceList}>
          {fontResources.map((fontResource) => {
            const faces = getFontResourceFaces(fontResource);
            const inUse = isFontFamilyInUse(fontResource.family);
            const isLegacy = fontResource.faces === undefined;

            return (
              <div className={styles.fontResourceRow} key={fontResource.id}>
                <div className={styles.fontResourceHeader}>
                  <strong>{fontResource.family}</strong>

                  {inUse && (
                    <span className={styles.fontResourceStatus}>
                      {t("inspector.inUse")}
                    </span>
                  )}
                </div>

                <div className={styles.fontFaceList}>
                  {faces.map((face, faceIndex) => {
                    const faceDetails = [
                      face.weight ?? t("inspector.default"),
                      face.style === undefined
                        ? t("inspector.default")
                        : t(`inspector.fontStyle.${face.style}`),
                      face.subset,
                      face.source.format?.toUpperCase(),
                      isLegacy ? t("inspector.legacyFace") : undefined,
                    ].filter((detail) => detail !== undefined);
                    const lastFaceInUse = inUse && faces.length === 1;

                    return (
                      <div
                        className={styles.fontFaceRow}
                        key={`${fontResource.id}-${faceIndex}`}
                      >
                        <span className={styles.fontFaceMeta}>
                          {faceDetails.join(" · ")}
                        </span>

                        <button
                          className={styles.secondaryButton}
                          type="button"
                          disabled={lastFaceInUse}
                          onClick={() => {
                            if (!lastFaceInUse) {
                              onRemoveFontFace(fontResource.id, faceIndex);
                            }
                          }}
                        >
                          {t("inspector.removeFace")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
