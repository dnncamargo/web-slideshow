import { useEffect, useRef, useState } from "react";

import {
  type FontFaceResource,
} from "@powershow/document-schema";

import type { StudioMessageKey } from "@/features/i18n/studio-i18n";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import type {
  GoogleFontImportErrorCode,
  GoogleFontImportResponse,
  GoogleFontImportResult,
} from "@/features/fonts/google-font-import-types";

import { areFontFacesEquivalent, normalizeFontFamily } from "@/features/fonts/font-face-helpers";
import styles from "./font-acquisition.module.css";
import type { FontFamilyFaces, OnAddFontFace } from "../font-acquisition-types";

interface GoogleFontImportControlProps {
  fontFamilies: readonly FontFamilyFaces[];
  onAddFontFace: OnAddFontFace;
  onFontAdded: (family: string) => void;
  controlPrefix: string;
}

type ImportState = "idle" | "resolving" | "resolved";

const GOOGLE_FONT_IMPORT_ERROR_MESSAGES: Readonly<
  Record<GoogleFontImportErrorCode, StudioMessageKey>
> = {
  invalid_google_fonts_url: "inspector.googleFontImport.invalidUrl",
  unsupported_google_fonts_parameter:
    "inspector.googleFontImport.unsupportedParameter",
  text_optimized_font_not_supported:
    "inspector.googleFontImport.textNotSupported",
  google_stylesheet_unavailable:
    "inspector.googleFontImport.stylesheetUnavailable",
  google_stylesheet_timeout: "inspector.googleFontImport.timeout",
  google_stylesheet_too_large: "inspector.googleFontImport.tooLarge",
  invalid_google_stylesheet_response:
    "inspector.googleFontImport.invalidResponse",
  no_supported_font_faces: "inspector.googleFontImport.noSupportedFaces",
};

function variantSelectionId(familyIndex: number, variantIndex: number): string {
  return `${familyIndex}:${variantIndex}`;
}

function isGoogleFontImportResponse(
  value: unknown,
): value is GoogleFontImportResponse {
  if (typeof value !== "object" || value === null || !("ok" in value)) {
    return false;
  }

  if (value.ok === false) {
    return "error" in value && typeof value.error === "string";
  }

  if (value.ok !== true || !("result" in value)) {
    return false;
  }

  const result = value.result;

  return (
    typeof result === "object" &&
    result !== null &&
    "families" in result &&
    Array.isArray(result.families) &&
    "unsupported" in result &&
    Array.isArray(result.unsupported)
  );
}

function countSupportedVariants(result: GoogleFontImportResult): number {
  return result.families.reduce(
    (total, family) => total + family.variants.length,
    0,
  );
}

export function GoogleFontImportControl({
  fontFamilies,
  onAddFontFace,
  onFontAdded,
  controlPrefix,
}: GoogleFontImportControlProps) {
  const { t } = useStudioI18n();
  const requestController = useRef<AbortController | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [state, setState] = useState<ImportState>("idle");
  const [result, setResult] = useState<GoogleFontImportResult>();
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(
    () => new Set(),
  );
  const [error, setError] = useState<StudioMessageKey | null>(null);

  useEffect(
    () => () => {
      requestController.current?.abort();
    },
    [],
  );

  async function resolveImport() {
    requestController.current?.abort();

    const controller = new AbortController();
    requestController.current = controller;
    setState("resolving");
    setResult(undefined);
    setSelectedVariants(new Set());
    setError(null);

    try {
      const response = await fetch("/api/fonts/google/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl }),
        signal: controller.signal,
      });
      const body: unknown = await response.json();

      if (!isGoogleFontImportResponse(body)) {
        setError("inspector.googleFontImport.invalidResponse");
        setState("idle");
        return;
      }

      if (!body.ok) {
        setError(
          GOOGLE_FONT_IMPORT_ERROR_MESSAGES[body.error] ??
            "inspector.googleFontImport.stylesheetUnavailable",
        );
        setState("idle");
        return;
      }

      const selections = new Set<string>();

      body.result.families.forEach((family, familyIndex) => {
        family.variants.forEach((_variant, variantIndex) => {
          selections.add(variantSelectionId(familyIndex, variantIndex));
        });
      });

      setResult(body.result);
      setSelectedVariants(selections);
      setState("resolved");
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") {
        return;
      }

      setError("inspector.googleFontImport.stylesheetUnavailable");
      setState("idle");
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
      }
    }
  }

  async function addSelectedFaces() {
    if (!result) {
      return;
    }

    const knownFaces = new Map<string, FontFaceResource[]>();

    for (const fontFamily of fontFamilies) {
      knownFaces.set(
        normalizeFontFamily(fontFamily.family),
        [...fontFamily.faces],
      );
    }

    const addedFamilies: string[] = [];
    let sawRejectedFace = false;

    for (const [familyIndex, family] of result.families.entries()) {
      const normalizedFamily = normalizeFontFamily(family.family);
      const registeredResource = fontFamilies.find(
        (fontFamily) => normalizeFontFamily(fontFamily.family) === normalizedFamily,
      );
      const canonicalFamily = registeredResource?.family ?? family.family;
      const familyFaces = knownFaces.get(normalizedFamily) ?? [];
      let addedToFamily = false;

      for (const [variantIndex, variant] of family.variants.entries()) {
        if (
          !selectedVariants.has(
            variantSelectionId(familyIndex, variantIndex),
          )
        ) {
          continue;
        }

        for (const face of variant.faces) {
          if (
            familyFaces.some((registeredFace) =>
              areFontFacesEquivalent(registeredFace, face),
            )
          ) {
            continue;
          }

          const added = await onAddFontFace(canonicalFamily, face);

          if (!added) {
            sawRejectedFace = true;
            continue;
          }

          familyFaces.push(face);
          addedToFamily = true;
        }
      }

      knownFaces.set(normalizedFamily, familyFaces);

      if (addedToFamily) {
        addedFamilies.push(canonicalFamily);
      }
    }

    const firstAddedFamily = addedFamilies[0];

    if (!firstAddedFamily) {
      setError(sawRejectedFace ? null : "inspector.fontFaceExists");
      return;
    }

    onFontAdded(firstAddedFamily);
    setError(null);
  }

  return (
    <div className={styles.googleFontImport}>
      <span className={styles.appearanceSubheading}>
        {t("inspector.googleFontImport.title")}
      </span>

      <label className={styles.field}>
        <span>{t("inspector.googleFontImport.pasteLink")}</span>

        <input
           id={`${controlPrefix}-google-import-url`}
           name={`${controlPrefix}-google-import-url`}
          type="url"
          inputMode="url"
          autoComplete="off"
          value={importUrl}
          placeholder="https://fonts.googleapis.com/css2?family=Audiowide"
          onChange={(event) => {
            requestController.current?.abort();
            setImportUrl(event.target.value);
            setState("idle");
            setResult(undefined);
            setSelectedVariants(new Set());
            setError(null);
          }}
        />
      </label>

      <button
        className={styles.secondaryButton}
        type="button"
        disabled={state === "resolving" || importUrl.trim().length === 0}
        onClick={() => {
          void resolveImport();
        }}
      >
        {state === "resolving"
          ? t("inspector.googleFontImport.resolving")
          : t("inspector.googleFontImport.resolve")}
      </button>

      {error && (
        <span className={styles.validationMessage} role="alert">
          {t(error)}
        </span>
      )}

      {result && state === "resolved" && (
        <div className={styles.googleFontResolved}>
          <div className={styles.googleFontResolvedHeader}>
            <strong>{t("inspector.googleFontImport.resolvedFonts")}</strong>

            <span>
              {t("inspector.googleFontImport.supportedSummary", {
                count: countSupportedVariants(result),
              })}
            </span>
          </div>

          {result.unsupported.length > 0 && (
            <span className={styles.googleFontUnsupported}>
              {t("inspector.googleFontImport.unsupportedSummary", {
                count: result.unsupported.length,
              })}
            </span>
          )}

          {result.families.map((resolvedFamily, familyIndex) => {
            const familyVariantIds = resolvedFamily.variants.map(
              (_variant, variantIndex) =>
                variantSelectionId(familyIndex, variantIndex),
            );
            const familySelected = familyVariantIds.every((selectionId) =>
              selectedVariants.has(selectionId),
            );

            return (
              <div
                className={styles.googleFontFamily}
                key={`${resolvedFamily.family}-${familyIndex}`}
              >
                <label className={styles.checkboxRow}>
                  <input
                id={`${controlPrefix}-google-import-family-${familyIndex}`}
                    name={`googleFontImportFamily${familyIndex}`}
                    type="checkbox"
                    checked={familySelected}
                    onChange={(event) => {
                      const checked = event.target.checked;

                      setSelectedVariants((current) => {
                        const next = new Set(current);

                        familyVariantIds.forEach((selectionId) => {
                          if (checked) {
                            next.add(selectionId);
                          } else {
                            next.delete(selectionId);
                          }
                        });

                        return next;
                      });
                    }}
                  />

                  <strong>{resolvedFamily.family}</strong>
                </label>

                <div className={styles.googleFontVariantList}>
                  {resolvedFamily.variants.map((variant, variantIndex) => {
                    const selectionId = variantSelectionId(
                      familyIndex,
                      variantIndex,
                    );
                    const selected = selectedVariants.has(selectionId);

                    return (
                      <div
                        className={styles.googleFontVariant}
                        key={`${variant.weight}-${variant.style}-${variantIndex}`}
                      >
                        <label className={styles.checkboxRow}>
                          <input
                      id={`${controlPrefix}-google-import-variant-${familyIndex}-${variantIndex}`}
                            name={`googleFontImportVariant${familyIndex}_${variantIndex}`}
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => {
                              const checked = event.target.checked;

                              setSelectedVariants((current) => {
                                const next = new Set(current);

                                if (checked) {
                                  next.add(selectionId);
                                } else {
                                  next.delete(selectionId);
                                }

                                return next;
                              });
                            }}
                          />

                          <span>
                            {variant.weight} ·{" "}
                            {t(`inspector.fontStyle.${variant.style}`)}
                          </span>

                          {selected && (
                            <span className={styles.googleFontSelected}>
                              {t("inspector.googleFontImport.selected")}
                            </span>
                          )}
                        </label>

                        <details className={styles.googleFontFiles}>
                          <summary>
                            {t("inspector.googleFontImport.fontFiles", {
                              count: variant.faces.length,
                            })}
                          </summary>

                          <ul>
                            {variant.faces.map((face, faceIndex) => (
                              <li
                                key={`${face.source.url}-${face.unicodeRange ?? "default"}-${faceIndex}`}
                              >
                                {face.unicodeRange ??
                                  t("inspector.default")}
                              </li>
                            ))}
                          </ul>
                        </details>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <button
            className={styles.secondaryButton}
            type="button"
            disabled={selectedVariants.size === 0}
            onClick={addSelectedFaces}
          >
            {t("inspector.googleFontImport.addSelected")}
          </button>
        </div>
      )}
    </div>
  );
}
