import { useEffect, useRef, useState } from "react";

import {
  FontFaceResourceSchema,
  getFontResourceFaces,
  type FontFaceResource,
  type FontResource,
} from "@powershow/document-schema";

import type {
  ResolvedWebFontFace,
  ResolvedWebFontFamily,
  WebFontApiErrorCode,
  WebFontProviderId,
  WebFontStyle,
  WebFontSummary,
} from "@/features/fonts/web-font-types";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import {
  areFontFacesEquivalent,
  normalizeFontFamily,
} from "../../font-resource-helpers";
import styles from "../../editor-workspace.module.css";
import { getControlName } from "../inspector-helpers";

const SEARCH_DEBOUNCE_MS = 300;

type SearchStatus =
  | "idle"
  | "loading"
  | "results"
  | "empty"
  | "error"
  | "unavailable";

type FamilyStatus = "idle" | "loading" | "error" | "unavailable";

type ProviderAvailability = "available" | "checking" | "unavailable";

interface FaceSelection {
  weight: number | undefined;
  style: WebFontStyle | undefined;
  subset: string | undefined;
}

interface WebFontDiscoveryControlProps {
  provider: WebFontProviderId;
  fontResources: readonly FontResource[];
  onAddFontFace: (family: string, face: FontFaceResource) => void;
}

function unique<Value>(values: readonly Value[]): Value[] {
  return [...new Set(values)];
}

function readApiError(value: unknown): WebFontApiErrorCode | undefined {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return undefined;
  }

  const error = value.error;

  return error === "provider_not_configured" ||
    error === "provider_unavailable" ||
    error === "invalid_query" ||
    error === "invalid_provider" ||
    error === "family_not_found" ||
    error === "invalid_provider_response"
    ? error
    : undefined;
}

function readSearchResults(value: unknown): WebFontSummary[] | undefined {
  if (typeof value !== "object" || value === null || !("fonts" in value)) {
    return undefined;
  }

  return Array.isArray(value.fonts) ? (value.fonts as WebFontSummary[]) : undefined;
}

function readResolvedFamily(
  value: unknown,
): ResolvedWebFontFamily | undefined {
  if (typeof value !== "object" || value === null || !("family" in value)) {
    return undefined;
  }

  const family = value.family;

  return typeof family === "object" &&
    family !== null &&
    "faces" in family &&
    Array.isArray(family.faces)
    ? (family as ResolvedWebFontFamily)
    : undefined;
}

function chooseCompatibleFace(
  faces: readonly ResolvedWebFontFace[],
  defaultSubset: string | undefined,
  preferred: Partial<FaceSelection> = {},
): FaceSelection | undefined {
  if (faces.length === 0) {
    return undefined;
  }

  const weights = unique(faces.map((face) => face.weight));
  const weight = weights.includes(preferred.weight)
    ? preferred.weight
    : weights.includes(400)
      ? 400
      : weights[0];
  const facesForWeight = faces.filter((face) => face.weight === weight);
  const stylesForWeight = unique(facesForWeight.map((face) => face.style));
  const style = stylesForWeight.includes(preferred.style)
    ? preferred.style
    : stylesForWeight.includes("normal")
      ? "normal"
      : stylesForWeight[0];
  const compatibleFaces = facesForWeight.filter(
    (face) => face.style === style,
  );
  const subsets = unique(compatibleFaces.map((face) => face.subset));
  const subset = subsets.includes(preferred.subset)
    ? preferred.subset
    : defaultSubset && subsets.includes(defaultSubset)
      ? defaultSubset
      : subsets.includes("latin")
        ? "latin"
        : subsets[0];

  return { weight, style, subset };
}

function toCanonicalFace(
  face: ResolvedWebFontFace | undefined,
): FontFaceResource | undefined {
  if (!face) {
    return undefined;
  }

  const result = FontFaceResourceSchema.safeParse({
    ...(face.weight === undefined ? {} : { weight: face.weight }),
    ...(face.style === undefined ? {} : { style: face.style }),
    ...(face.subset === undefined ? {} : { subset: face.subset }),
    ...(face.unicodeRange === undefined
      ? {}
      : { unicodeRange: face.unicodeRange }),
    source: {
      type: "url",
      url: face.url,
      format: face.format,
    },
  });

  return result.success ? result.data : undefined;
}

export function WebFontDiscoveryControl({
  provider,
  fontResources,
  onAddFontFace,
}: WebFontDiscoveryControlProps) {
  const { t } = useStudioI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WebFontSummary[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [familyStatus, setFamilyStatus] = useState<FamilyStatus>("idle");
  const [providerAvailability, setProviderAvailability] =
    useState<ProviderAvailability>(
      provider === "google-fonts" ? "checking" : "available",
    );
  const [selectedFamily, setSelectedFamily] =
    useState<ResolvedWebFontFamily>();
  const [selection, setSelection] = useState<FaceSelection>();
  const searchRequestId = useRef(0);
  const familyRequestId = useRef(0);
  const familyController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (provider !== "google-fonts") {
      return;
    }

    const controller = new AbortController();

    void (async () => {
      try {
        const parameters = new URLSearchParams({ provider });
        const response = await fetch(`/api/fonts/status?${parameters}`, {
          signal: controller.signal,
        });
        const payload: unknown = await response.json();
        const available =
          typeof payload === "object" &&
          payload !== null &&
          "available" in payload &&
          typeof payload.available === "boolean"
            ? payload.available
            : undefined;

        if (!controller.signal.aborted) {
          setProviderAvailability(
            available === false ? "unavailable" : "available",
          );
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setProviderAvailability("available");
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [provider]);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (
      trimmedQuery.length < 2 ||
      providerAvailability !== "available"
    ) {
      return;
    }

    const controller = new AbortController();
    const requestId = ++searchRequestId.current;
    let active = true;
    const timer = setTimeout(() => {
      setSearchStatus("loading");

      void (async () => {
        try {
          const parameters = new URLSearchParams({
            provider,
            query: trimmedQuery,
          });
          const response = await fetch(`/api/fonts/search?${parameters}`, {
            signal: controller.signal,
          });
          const payload: unknown = await response.json();

          if (!active || requestId !== searchRequestId.current) {
            return;
          }

          const error = readApiError(payload);

          if (error) {
            setResults([]);
            setSearchStatus(
              error === "provider_not_configured" ? "unavailable" : "error",
            );
            return;
          }

          const fonts = readSearchResults(payload);

          if (!fonts) {
            setResults([]);
            setSearchStatus("error");
            return;
          }

          setResults(fonts);
          setSearchStatus(fonts.length === 0 ? "empty" : "results");
        } catch (error) {
          if (
            active &&
            requestId === searchRequestId.current &&
            !(error instanceof DOMException && error.name === "AbortError")
          ) {
            setResults([]);
            setSearchStatus("error");
          }
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [provider, providerAvailability, query]);

  useEffect(
    () => () => {
      familyRequestId.current += 1;
      familyController.current?.abort();
    },
    [],
  );

  async function selectFamily(summary: WebFontSummary) {
    familyController.current?.abort();

    const controller = new AbortController();
    const requestId = ++familyRequestId.current;

    familyController.current = controller;
    setSelectedFamily(undefined);
    setSelection(undefined);
    setFamilyStatus("loading");

    try {
      const parameters = new URLSearchParams({
        provider,
        id: summary.id,
      });
      const response = await fetch(`/api/fonts/family?${parameters}`, {
        signal: controller.signal,
      });
      const payload: unknown = await response.json();

      if (requestId !== familyRequestId.current) {
        return;
      }

      const error = readApiError(payload);

      if (error) {
        setFamilyStatus(
          error === "provider_not_configured" ? "unavailable" : "error",
        );
        return;
      }

      const resolvedFamily = readResolvedFamily(payload);
      const initialSelection = resolvedFamily
        ? chooseCompatibleFace(
            resolvedFamily.faces,
            resolvedFamily.defaultSubset,
          )
        : undefined;

      if (!resolvedFamily || !initialSelection) {
        setFamilyStatus("error");
        return;
      }

      setSelectedFamily(resolvedFamily);
      setSelection(initialSelection);
      setFamilyStatus("idle");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setFamilyStatus("error");
      }
    }
  }

  const weights = selectedFamily
    ? unique(selectedFamily.faces.map((face) => face.weight))
    : [];
  const availableStyles = selectedFamily
    ? unique(
        selectedFamily.faces
          .filter((face) => face.weight === selection?.weight)
          .map((face) => face.style),
      )
    : [];
  const availableSubsets = selectedFamily
    ? unique(
        selectedFamily.faces
          .filter(
            (face) =>
              face.weight === selection?.weight &&
              face.style === selection?.style,
          )
          .map((face) => face.subset),
      )
    : [];
  const selectedFace = selectedFamily?.faces.find(
    (face) =>
      face.weight === selection?.weight &&
      face.style === selection?.style &&
      face.subset === selection?.subset,
  );
  const canonicalFace = toCanonicalFace(selectedFace);
  const registeredResource = selectedFamily
    ? fontResources.find(
        (resource) =>
          normalizeFontFamily(resource.family) ===
          normalizeFontFamily(selectedFamily.family),
      )
    : undefined;
  const faceAlreadyRegistered =
    canonicalFace !== undefined && registeredResource !== undefined
      ? getFontResourceFaces(registeredResource).some((face) =>
          areFontFacesEquivalent(face, canonicalFace),
        )
      : false;

  return (
    <div className={styles.webFontDiscovery}>
      <label className={styles.field}>
        <span>{t("inspector.searchFonts")}</span>

        <input
          id="presentation-font-search"
          name={getControlName("presentation", "FontSearch")}
          type="search"
          minLength={2}
          autoComplete="off"
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;

            familyController.current?.abort();
            familyRequestId.current += 1;
            setQuery(nextQuery);
            setResults([]);
            setSearchStatus("idle");
            setSelectedFamily(undefined);
            setSelection(undefined);
            setFamilyStatus("idle");
          }}
        />
      </label>

      {searchStatus === "loading" && (
        <span className={styles.fontResourceEmpty} role="status">
          {t("inspector.searchingFonts")}
        </span>
      )}

      {searchStatus === "empty" && (
        <span className={styles.fontResourceEmpty} role="status">
          {t("inspector.noFontsFound")}
        </span>
      )}

      {(searchStatus === "unavailable" ||
        providerAvailability === "unavailable") && (
        <span className={styles.validationMessage} role="status">
          {t("inspector.googleFontsNotConfigured")}
        </span>
      )}

      {searchStatus === "error" && (
        <span className={styles.validationMessage} role="alert">
          {t("inspector.couldNotSearchFonts")}
        </span>
      )}

      {searchStatus === "results" && (
        <div className={styles.webFontResults}>
          <span className={styles.appearanceSubheading}>
            {t("inspector.fontSearchResults")}
          </span>

          {results.map((result) => {
            const alreadyRegistered = fontResources.some(
              (resource) =>
                normalizeFontFamily(resource.family) ===
                normalizeFontFamily(result.family),
            );
            const details = [
              result.category,
              result.weights.join(", "),
              result.styles
                .map((style) => t(`inspector.fontStyle.${style}`))
                .join(", "),
            ].filter(Boolean);

            return (
              <div
                className={styles.webFontResultRow}
                key={`${result.provider}-${result.id}`}
              >
                <div className={styles.webFontResultDetails}>
                  <strong>{result.family}</strong>
                  <span>{details.join(" · ")}</span>

                  {alreadyRegistered && (
                    <span className={styles.fontResourceStatus}>
                      {t("inspector.alreadyRegistered")}
                    </span>
                  )}
                </div>

                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => {
                    void selectFamily(result);
                  }}
                >
                  {t("inspector.selectFont")}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {familyStatus === "loading" && (
        <span className={styles.fontResourceEmpty} role="status">
          {t("inspector.loadingFontFamily")}
        </span>
      )}

      {familyStatus === "unavailable" && (
        <span className={styles.validationMessage} role="status">
          {t("inspector.googleFontsNotConfigured")}
        </span>
      )}

      {familyStatus === "error" && (
        <span className={styles.validationMessage} role="alert">
          {t("inspector.couldNotLoadFontFamily")}
        </span>
      )}

      {selectedFamily && selection && (
        <div className={styles.webFontSelection}>
          <span className={styles.appearanceSubheading}>
            {t("inspector.selectedFontFamily")}
          </span>

          <strong>{selectedFamily.family}</strong>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>{t("inspector.fontWeight")}</span>

              <select
                id="presentation-font-search-weight"
                name={getControlName("presentation", "FontSearchWeight")}
                value={selection.weight ?? ""}
                onChange={(event) => {
                  const nextSelection = chooseCompatibleFace(
                    selectedFamily.faces,
                    selectedFamily.defaultSubset,
                    {
                      ...selection,
                      weight: Number(event.target.value),
                    },
                  );

                  if (nextSelection) {
                    setSelection(nextSelection);
                  }
                }}
              >
                {weights.map((weight) => (
                  <option key={weight ?? "default"} value={weight ?? ""}>
                    {weight ?? t("inspector.default")}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>{t("inspector.fontStyle")}</span>

              <select
                id="presentation-font-search-style"
                name={getControlName("presentation", "FontSearchStyle")}
                value={selection.style ?? ""}
                onChange={(event) => {
                  const style = event.target.value;

                  if (style !== "normal" && style !== "italic") {
                    return;
                  }

                  const nextSelection = chooseCompatibleFace(
                    selectedFamily.faces,
                    selectedFamily.defaultSubset,
                    {
                      ...selection,
                      style,
                    },
                  );

                  if (nextSelection) {
                    setSelection(nextSelection);
                  }
                }}
              >
                {availableStyles.map((style) => (
                  <option key={style ?? "default"} value={style ?? ""}>
                    {style === undefined
                      ? t("inspector.default")
                      : t(`inspector.fontStyle.${style}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span>{t("inspector.webFontSubset")}</span>

            <select
              id="presentation-font-search-subset"
              name={getControlName("presentation", "FontSearchSubset")}
              value={selection.subset ?? ""}
              onChange={(event) => {
                const subset = event.target.value || undefined;

                if (availableSubsets.includes(subset)) {
                  setSelection({
                    ...selection,
                    subset,
                  });
                }
              }}
            >
              {availableSubsets.map((subset) => (
                <option key={subset ?? "default"} value={subset ?? ""}>
                  {subset ?? t("inspector.default")}
                </option>
              ))}
            </select>
          </label>

          <button
            className={styles.secondaryButton}
            type="button"
            disabled={!canonicalFace || faceAlreadyRegistered}
            onClick={() => {
              if (canonicalFace && !faceAlreadyRegistered) {
                onAddFontFace(selectedFamily.family, canonicalFace);
              }
            }}
          >
            {faceAlreadyRegistered
              ? t("inspector.faceAlreadyRegistered")
              : t("inspector.addToPresentation")}
          </button>
        </div>
      )}
    </div>
  );
}
