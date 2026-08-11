import { useState } from "react";

import {
  FontResourceSchema,
  type FontFormat,
} from "@powershow/document-schema";

import type { StudioMessageKey } from "@/features/i18n/studio-i18n";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import {
  createFontResourceId,
  normalizeFontFamily,
} from "../../font-resource-helpers";

import styles from "../../editor-workspace.module.css";

import { getControlName } from "../inspector-helpers";
import type { FontResourceControls } from "../inspector-types";

interface PresentationFontManagerProps extends FontResourceControls {
  id: string;
}

const FONT_FORMATS: readonly FontFormat[] = [
  "woff2",
  "woff",
  "truetype",
  "opentype",
];

export function PresentationFontManager({
  id,
  fontResources,
  onAddFontResource,
  onRemoveFontResource,
  isFontFamilyInUse,
}: PresentationFontManagerProps) {
  const { t } = useStudioI18n();
  const [family, setFamily] = useState("");
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<FontFormat>("woff2");
  const [error, setError] = useState<StudioMessageKey | null>(null);

  function addFont() {
    const trimmedFamily = family.trim();

    if (!trimmedFamily) {
      setError("inspector.fontFamilyRequired");
      return;
    }

    const normalizedFamily = normalizeFontFamily(trimmedFamily);
    const duplicate = fontResources.some(
      (fontResource) =>
        normalizeFontFamily(fontResource.family) === normalizedFamily,
    );

    if (duplicate) {
      setError("inspector.fontFamilyExists");
      return;
    }

    const result = FontResourceSchema.safeParse({
      id: createFontResourceId(
        trimmedFamily,
        fontResources.map((fontResource) => fontResource.id),
      ),
      family: trimmedFamily,
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

    onAddFontResource(result.data);
    setFamily("");
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
        onClick={addFont}
      >
        {t("inspector.addFont")}
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
            const inUse = isFontFamilyInUse(fontResource.family);

            return (
              <div className={styles.fontResourceRow} key={fontResource.id}>
                <div className={styles.fontResourceMeta}>
                  <strong>{fontResource.family}</strong>
                  <span>{fontResource.source.format?.toUpperCase() ?? ""}</span>
                </div>

                {inUse && (
                  <span className={styles.fontResourceStatus}>
                    {t("inspector.inUse")}
                  </span>
                )}

                <button
                  className={styles.secondaryButton}
                  type="button"
                  disabled={inUse}
                  onClick={() => {
                    if (!inUse) {
                      onRemoveFontResource(fontResource.id);
                    }
                  }}
                >
                  {t("inspector.remove")}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
