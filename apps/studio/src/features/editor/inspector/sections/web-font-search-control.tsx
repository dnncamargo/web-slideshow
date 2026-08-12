import { useEffect, useMemo, useRef, useState } from "react";

import {
  FontFaceResourceSchema,
  getFontResourceFaces,
} from "@powershow/document-schema";

import type { StudioMessageKey } from "@/features/i18n/studio-i18n";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import type {
  ResolvedWebFontFamily,
  WebFontFamilyResponse,
  WebFontProviderId,
  WebFontProviderStatusResponse,
  WebFontSearchResponse,
  WebFontSummary,
} from "@/features/fonts/web-font-types";

import {
  areFontFacesEquivalent,
  normalizeFontFamily,
} from "../../font-resource-helpers";
import styles from "../../editor-workspace.module.css";

import { getControlName } from "../inspector-helpers";
import type { FontResourceControls } from "../inspector-types";

interface WebFontSearchControlProps
  extends Pick<FontResourceControls, "fontResources" | "onAddFontFace"> {
  provider: WebFontProviderId;
  onFontAdded: (family: string) => void;
}

type SearchState = "idle" | "searching" | "results" | "empty" | "error";
type ProviderAvailability = "checking" | "available" | "unavailable";

interface FaceSelection {
  weight: number;
  style: "normal" | "italic";
  subset: string;
}

const SEARCH_DEBOUNCE_MS = 300;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSearchResponse(value: unknown): WebFontSearchResponse | undefined {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return undefined;
  }

  if (value.ok === false) {
    return typeof value.error === "string"
      ? (value as unknown as WebFontSearchResponse)
      : undefined;
  }

  return Array.isArray(value.results)
    ? (value as unknown as WebFontSearchResponse)
    : undefined;
}

function readFamilyResponse(value: unknown): WebFontFamilyResponse | undefined {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return undefined;
  }

  if (value.ok === false) {
    return typeof value.error === "string"
      ? (value as unknown as WebFontFamilyResponse)
      : undefined;
  }

  return isRecord(value.family) && Array.isArray(value.family.faces)
    ? (value as unknown as WebFontFamilyResponse)
    : undefined;
}

function readStatusResponse(
  value: unknown,
): WebFontProviderStatusResponse | undefined {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return undefined;
  }

  if (value.ok === false) {
    return typeof value.error === "string"
      ? (value as unknown as WebFontProviderStatusResponse)
      : undefined;
  }

  return typeof value.available === "boolean"
    ? (value as unknown as WebFontProviderStatusResponse)
    : undefined;
}

function chooseFaceSelection(
  family: ResolvedWebFontFamily,
  preferred: Partial<FaceSelection> = {},
): FaceSelection | undefined {
  const weights = [...new Set(family.faces.map((face) => face.weight))];
  const weight =
    preferred.weight !== undefined && weights.includes(preferred.weight)
      ? preferred.weight
      : weights[0];

  if (weight === undefined) {
    return undefined;
  }

  const weightFaces = family.faces.filter((face) => face.weight === weight);
  const styles = [...new Set(weightFaces.map((face) => face.style))];
  const style =
    preferred.style !== undefined && styles.includes(preferred.style)
      ? preferred.style
      : styles[0];

  if (style === undefined) {
    return undefined;
  }

  const variantFaces = weightFaces.filter((face) => face.style === style);
  const subsets = [
    ...new Set(variantFaces.map((face) => face.subset ?? "")),
  ];
  const preferredSubset =
    preferred.subset ??
    family.defaultSubset ??
    (subsets.includes("latin") ? "latin" : undefined);
  const subset =
    preferredSubset !== undefined && subsets.includes(preferredSubset)
      ? preferredSubset
      : (subsets[0] ?? "");

  return { weight, style, subset };
}

function providerErrorMessage(error: string): StudioMessageKey {
  return error === "provider_not_configured"
    ? "inspector.webFonts.googleNotConfigured"
    : "inspector.webFonts.searchError";
}

export function WebFontSearchControl({
  provider,
  fontResources,
  onAddFontFace,
  onFontAdded,
}: WebFontSearchControlProps) {
  const { t } = useStudioI18n();
  const searchController = useRef<AbortController | null>(null);
  const familyController = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const [providerAvailability, setProviderAvailability] =
    useState<ProviderAvailability>(
      provider === "fontsource" ? "available" : "checking",
    );
  const [query, setQuery] = useState("");
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [results, setResults] = useState<WebFontSummary[]>([]);
  const [selectedFamily, setSelectedFamily] =
    useState<ResolvedWebFontFamily>();
  const [selection, setSelection] = useState<FaceSelection>();
  const [familyLoadingId, setFamilyLoadingId] = useState<string>();
  const [error, setError] = useState<StudioMessageKey | null>(null);

  useEffect(() => {
    if (provider === "fontsource") {
      return;
    }

    const controller = new AbortController();

    void fetch(`/api/fonts/status?provider=${encodeURIComponent(provider)}`, {
      signal: controller.signal,
    })
      .then(async (response) => readStatusResponse(await response.json()))
      .then((body) => {
        if (!body || !body.ok) {
          setProviderAvailability("unavailable");
          return;
        }

        setProviderAvailability(body.available ? "available" : "unavailable");
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof Error && requestError.name === "AbortError")) {
          setProviderAvailability("unavailable");
        }
      });

    return () => controller.abort();
  }, [provider]);

  useEffect(() => {
    searchController.current?.abort();
    const sequence = requestSequence.current;

    const normalizedQuery = query.trim();

    if (
      normalizedQuery.length < 2 ||
      providerAvailability !== "available"
    ) {
      return;
    }

    const timer = setTimeout(() => {
      const controller = new AbortController();
      searchController.current = controller;
      setSearchState("searching");

      void fetch(
        `/api/fonts/search?provider=${encodeURIComponent(provider)}&q=${encodeURIComponent(normalizedQuery)}`,
        { signal: controller.signal },
      )
        .then(async (response) => readSearchResponse(await response.json()))
        .then((body) => {
          if (sequence !== requestSequence.current || !body) {
            return;
          }

          if (!body.ok) {
            if (body.error === "provider_not_configured") {
              setProviderAvailability("unavailable");
            }

            setError(providerErrorMessage(body.error));
            setSearchState("error");
            return;
          }

          setResults(body.results);
          setSearchState(body.results.length === 0 ? "empty" : "results");
        })
        .catch((requestError: unknown) => {
          if (
            sequence === requestSequence.current &&
            !(requestError instanceof Error && requestError.name === "AbortError")
          ) {
            setError("inspector.webFonts.searchError");
            setSearchState("error");
          }
        })
        .finally(() => {
          if (searchController.current === controller) {
            searchController.current = null;
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      searchController.current?.abort();
    };
  }, [provider, providerAvailability, query]);

  useEffect(
    () => () => {
      searchController.current?.abort();
      familyController.current?.abort();
    },
    [],
  );

  async function selectFamily(summary: WebFontSummary) {
    familyController.current?.abort();
    const controller = new AbortController();
    familyController.current = controller;
    const sequence = ++requestSequence.current;

    setFamilyLoadingId(summary.id);
    setSelectedFamily(undefined);
    setSelection(undefined);
    setError(null);

    try {
      const response = await fetch(
        `/api/fonts/family?provider=${encodeURIComponent(provider)}&id=${encodeURIComponent(summary.id)}`,
        { signal: controller.signal },
      );
      const body = readFamilyResponse(await response.json());

      if (sequence !== requestSequence.current || !body) {
        return;
      }

      if (!body.ok) {
        setError(providerErrorMessage(body.error));
        return;
      }

      setSelectedFamily(body.family);
      setSelection(chooseFaceSelection(body.family));
    } catch (requestError) {
      if (!(requestError instanceof Error && requestError.name === "AbortError")) {
        setError("inspector.webFonts.searchError");
      }
    } finally {
      if (familyController.current === controller) {
        familyController.current = null;
        setFamilyLoadingId(undefined);
      }
    }
  }

  const weightOptions = useMemo(
    () =>
      selectedFamily
        ? [...new Set(selectedFamily.faces.map((face) => face.weight))]
        : [],
    [selectedFamily],
  );
  const styleOptions = useMemo(
    () =>
      selectedFamily && selection
        ? [
            ...new Set(
              selectedFamily.faces
                .filter((face) => face.weight === selection.weight)
                .map((face) => face.style),
            ),
          ]
        : [],
    [selectedFamily, selection],
  );
  const subsetOptions = useMemo(
    () =>
      selectedFamily && selection
        ? [
            ...new Set(
              selectedFamily.faces
                .filter(
                  (face) =>
                    face.weight === selection.weight &&
                    face.style === selection.style,
                )
                .map((face) => face.subset ?? ""),
            ),
          ]
        : [],
    [selectedFamily, selection],
  );
  const selectedFace =
    selectedFamily && selection
      ? selectedFamily.faces.find(
          (face) =>
            face.weight === selection.weight &&
            face.style === selection.style &&
            (face.subset ?? "") === selection.subset,
        )
      : undefined;

  function addSelectedFace() {
    if (!selectedFamily || !selectedFace) {
      return;
    }

    const parsedFace = FontFaceResourceSchema.safeParse(selectedFace);

    if (!parsedFace.success) {
      setError("inspector.webFonts.searchError");
      return;
    }

    const normalizedFamily = normalizeFontFamily(selectedFamily.family);
    const existingResource = fontResources.find(
      (fontResource) =>
        normalizeFontFamily(fontResource.family) === normalizedFamily,
    );
    const duplicate = existingResource
      ? getFontResourceFaces(existingResource).some((face) =>
          areFontFacesEquivalent(face, parsedFace.data),
        )
      : false;

    if (duplicate) {
      setError("inspector.fontFaceExists");
      return;
    }

    const family = existingResource?.family ?? selectedFamily.family;

    onAddFontFace(family, parsedFace.data);
    onFontAdded(family);
    setError(null);
  }

  return (
    <div className={styles.fontSourcePanel}>
      <label className={styles.field}>
        <span>{t("inspector.webFonts.search")}</span>

        <input
          id="presentation-font-search"
          name={getControlName("presentation", "FontSearch")}
          type="search"
          autoComplete="off"
          value={query}
          disabled={providerAvailability !== "available"}
          onChange={(event) => {
            searchController.current?.abort();
            familyController.current?.abort();
            requestSequence.current += 1;
            setQuery(event.target.value);
            setSearchState("idle");
            setResults([]);
            setSelectedFamily(undefined);
            setSelection(undefined);
            setFamilyLoadingId(undefined);
            setError(null);
          }}
        />
      </label>

      {providerAvailability === "unavailable" && (
        <span className={styles.validationMessage} role="status">
          {t("inspector.webFonts.googleNotConfigured")}
        </span>
      )}

      {searchState === "searching" && (
        <span className={styles.fontResourceEmpty} role="status">
          {t("inspector.webFonts.searching")}
        </span>
      )}

      {searchState === "empty" && (
        <span className={styles.fontResourceEmpty} role="status">
          {t("inspector.webFonts.empty")}
        </span>
      )}

      {searchState === "error" && error && (
        <span className={styles.validationMessage} role="alert">
          {t(error)}
        </span>
      )}

      {results.length > 0 && (
        <div className={styles.webFontResults}>
          {results.map((result) => (
            <div
              className={styles.webFontResult}
              key={`${result.provider}:${result.id}`}
            >
              <div className={styles.webFontResultMeta}>
                <strong>{result.family}</strong>
                {result.category && <span>{result.category}</span>}
                <span>
                  {result.weights.join(", ")} ·{" "}
                  {result.styles
                    .map((style) => t(`inspector.fontStyle.${style}`))
                    .join(", ")}
                </span>
              </div>

              <button
                className={styles.secondaryButton}
                type="button"
                disabled={familyLoadingId !== undefined}
                onClick={() => void selectFamily(result)}
              >
                {familyLoadingId === result.id
                  ? t("inspector.webFonts.loadingFamily")
                  : t("inspector.webFonts.select")}
              </button>
            </div>
          ))}
        </div>
      )}

      {error && searchState !== "error" && !selectedFamily && (
        <span className={styles.validationMessage} role="alert">
          {t(error)}
        </span>
      )}

      {selectedFamily && selection && (
        <div className={styles.webFontSelection}>
          <strong>{selectedFamily.family}</strong>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>{t("inspector.fontWeight")}</span>

              <select
                id="presentation-font-search-weight"
                name={getControlName("presentation", "FontSearchWeight")}
                value={selection.weight}
                onChange={(event) => {
                  const next = chooseFaceSelection(selectedFamily, {
                    ...selection,
                    weight: Number(event.target.value),
                  });
                  setSelection(next);
                }}
              >
                {weightOptions.map((weight) => (
                  <option key={weight} value={weight}>
                    {weight}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>{t("inspector.fontStyle")}</span>

              <select
                id="presentation-font-search-style"
                name={getControlName("presentation", "FontSearchStyle")}
                value={selection.style}
                onChange={(event) => {
                  const style = event.target.value;

                  if (style === "normal" || style === "italic") {
                    setSelection(
                      chooseFaceSelection(selectedFamily, {
                        ...selection,
                        style,
                      }),
                    );
                  }
                }}
              >
                {styleOptions.map((style) => (
                  <option key={style} value={style}>
                    {t(`inspector.fontStyle.${style}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span>{t("inspector.webFonts.subset")}</span>

            <select
              id="presentation-font-search-subset"
              name={getControlName("presentation", "FontSearchSubset")}
              value={selection.subset}
              onChange={(event) => {
                setSelection({ ...selection, subset: event.target.value });
              }}
            >
              {subsetOptions.map((subset) => (
                <option key={subset || "default"} value={subset}>
                  {subset || t("inspector.default")}
                </option>
              ))}
            </select>
          </label>

          <button
            className={styles.secondaryButton}
            type="button"
            disabled={!selectedFace}
            onClick={addSelectedFace}
          >
            {t("inspector.webFonts.add")}
          </button>

          {error && searchState !== "error" && (
            <span className={styles.validationMessage} role="alert">
              {t(error)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
