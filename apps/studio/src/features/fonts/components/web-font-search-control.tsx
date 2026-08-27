import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  FontFaceResourceSchema,
  type FontFaceResource,
} from "@powershow/document-schema";

import {
  chooseRecommendedFontFace,
  type WebFontFaceSelection,
} from "@/features/fonts/web-font-face-selection";
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

import { areFontFacesEquivalent, normalizeFontFamily } from "@/features/fonts/font-face-helpers";
import styles from "./font-acquisition.module.css";
import type { FontFamilyFaces, OnAddFontFace } from "../font-acquisition-types";

interface WebFontSearchControlProps {
  provider: WebFontProviderId;
  fontFamilies: readonly FontFamilyFaces[];
  onAddFontFace: OnAddFontFace;
  onFontAdded: (family: string) => void;
  controlPrefix: string;
}

type SearchState = "idle" | "searching" | "results" | "empty" | "error";
type ProviderAvailability = "checking" | "available" | "unavailable";

interface PendingAction {
  key: string;
  kind: "adding" | "customizing";
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

function providerErrorMessage(error: string): StudioMessageKey {
  return error === "provider_not_configured"
    ? "inspector.webFonts.googleNotConfigured"
    : "inspector.webFonts.searchError";
}

function findFace(
  family: ResolvedWebFontFamily,
  style: WebFontFaceSelection["style"],
  subset: string,
  weight: number,
): FontFaceResource | undefined {
  return family.faces.find(
    (face) =>
      face.weight === weight &&
      face.style === style &&
      (face.subset ?? "") === subset,
  );
}

function getAvailableWeights(
  family: ResolvedWebFontFamily,
  style: WebFontFaceSelection["style"],
  subset: string,
): number[] {
  return [...new Set(
    family.faces
      .filter((face) => face.style === style && (face.subset ?? "") === subset)
      .map((face) => face.weight),
  )].sort((first, second) => first - second);
}

function nearestWeight(weights: readonly number[]): number | undefined {
  return weights.reduce<number | undefined>((best, weight) => {
    if (best === undefined) return weight;
    const distance = Math.abs(weight - 400);
    const bestDistance = Math.abs(best - 400);
    return distance < bestDistance || (distance === bestDistance && weight < best)
      ? weight
      : best;
  }, undefined);
}

function faceKey(face: FontFaceResource): string {
  return [
    face.weight ?? "",
    face.style ?? "",
    face.subset ?? "",
    face.unicodeRange ?? "",
    face.source.url,
  ].join("|");
}

export function WebFontSearchControl({
  provider,
  fontFamilies,
  onAddFontFace,
  onFontAdded,
  controlPrefix,
}: WebFontSearchControlProps) {
  const { t } = useStudioI18n();
  const searchController = useRef<AbortController | null>(null);
  const familyController = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const familyCache = useRef<Map<string, ResolvedWebFontFamily>>(new Map());
  const [providerAvailability, setProviderAvailability] =
    useState<ProviderAvailability>(
      provider === "fontsource" ? "available" : "checking",
    );
  const [query, setQuery] = useState("");
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [results, setResults] = useState<WebFontSummary[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction>();
  const [customize, setCustomize] = useState<{
    family: ResolvedWebFontFamily;
    style: WebFontFaceSelection["style"];
    subset: string;
    previewWeight: number;
    selectedWeights: Set<number>;
  }>();
  const [locallyAddedFaces, setLocallyAddedFaces] = useState<Set<string>>(
    () => new Set(),
  );
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
        if (
          !(requestError instanceof Error && requestError.name === "AbortError")
        ) {
          setProviderAvailability("unavailable");
        }
      });

    return () => controller.abort();
  }, [provider]);

  useEffect(() => {
    searchController.current?.abort();
    const sequence = requestSequence.current;

    const normalizedQuery = query.trim();

    if (normalizedQuery.length < 2 || providerAvailability !== "available") {
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
            !(
              requestError instanceof Error &&
              requestError.name === "AbortError"
            )
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

  async function resolveFamily(
    summary: WebFontSummary,
  ): Promise<ResolvedWebFontFamily | undefined> {
    const cached = familyCache.current.get(summary.id);

    if (cached !== undefined) {
      return cached;
    }

    familyController.current?.abort();
    const controller = new AbortController();
    familyController.current = controller;
    const sequence = ++requestSequence.current;

    try {
      const response = await fetch(
        `/api/fonts/family?provider=${encodeURIComponent(provider)}&id=${encodeURIComponent(summary.id)}`,
        { signal: controller.signal },
      );
      const body = readFamilyResponse(await response.json());

      if (sequence !== requestSequence.current || !body) {
        return undefined;
      }

      if (!body.ok) {
        setError(providerErrorMessage(body.error));
        return undefined;
      }

      familyCache.current.set(summary.id, body.family);

      return body.family;
    } catch (requestError) {
      if (
        !(requestError instanceof Error && requestError.name === "AbortError")
      ) {
        setError("inspector.webFonts.searchError");
      }

      return undefined;
    } finally {
      if (familyController.current === controller) {
        familyController.current = null;
      }
    }
  }

  function isAlreadyAdded(family: ResolvedWebFontFamily, face: FontFaceResource): boolean {
    const normalizedFamily = normalizeFontFamily(family.family);
    const existingFamily = fontFamilies.find(
      (fontFamily) => normalizeFontFamily(fontFamily.family) === normalizedFamily,
    );
    return Boolean(
      locallyAddedFaces.has(faceKey(face)) ||
        existingFamily?.faces.some((registeredFace) =>
          areFontFacesEquivalent(registeredFace, face),
        ),
    );
  }

  async function persistFace(
    family: ResolvedWebFontFamily,
    face: FontFaceResource,
  ): Promise<boolean> {
    const parsedFace = FontFaceResourceSchema.safeParse(face);

    if (!parsedFace.success) {
      setError("inspector.webFonts.searchError");
      return false;
    }

    const normalizedFamily = normalizeFontFamily(family.family);
    const existingFamily = fontFamilies.find(
      (fontFamily) => normalizeFontFamily(fontFamily.family) === normalizedFamily,
    );
    const duplicate = existingFamily
      ? existingFamily.faces.some((registeredFace) =>
          areFontFacesEquivalent(registeredFace, parsedFace.data),
        )
      : false;

    if (duplicate) {
      return false;
    }

    const canonicalFamily = existingFamily?.family ?? family.family;

    const added = await onAddFontFace(canonicalFamily, parsedFace.data);

    if (!added) {
      return false;
    }

    onFontAdded(canonicalFamily);
    setLocallyAddedFaces((current) => new Set(current).add(faceKey(parsedFace.data)));
    setError(null);

    return true;
  }

  async function openCustomizer(summary: WebFontSummary) {
    const pendingKey = summary.id;
    setPendingAction({ key: pendingKey, kind: "customizing" });
    setError(null);

    try {
      const family = await resolveFamily(summary);

      if (!family) {
        return;
      }

      const selection = chooseRecommendedFontFace(family);

      if (!selection) {
        setError("inspector.webFonts.searchError");
        return;
      }

      setCustomize({
        family,
        style: selection.style,
        subset: selection.subset,
        previewWeight: selection.weight,
        selectedWeights: new Set(),
      });
    } finally {
      setPendingAction((current) =>
        current?.key === pendingKey ? undefined : current,
      );
    }
  }

  function closeCustomize() {
    setCustomize(undefined);
    setError(null);
  }

  const weightOptions = customize
    ? getAvailableWeights(customize.family, customize.style, customize.subset)
    : [];

  const styleOptions = useMemo(
    () =>
      customize
        ? [
            ...new Set(
              customize.family.faces
                .filter((face) => (face.subset ?? "") === customize.subset)
                .map((face) => face.style),
            ),
          ].sort((a, b) => {
            if (a === b) return 0;
            if (a === "normal") return -1;
            if (b === "normal") return 1;
            return a < b ? -1 : 1;
          })
        : [],
    [customize],
  );

  const subsetOptions = useMemo(
    () =>
      customize
        ? [
            ...new Set(
              customize.family.faces
                .filter((face) => face.style === customize.style)
                .map((face) => face.subset ?? ""),
            ),
          ]
        : [],
    [customize],
  );
  const previewFace = customize
    ? findFace(customize.family, customize.style, customize.subset, customize.previewWeight)
    : undefined;
  const selectedFaces = customize
    ? [...customize.selectedWeights]
        .sort((first, second) => first - second)
        .map((weight) => findFace(customize.family, customize.style, customize.subset, weight))
        .filter((face): face is FontFaceResource => face !== undefined)
    : [];
  const previewFamilyName = `powershow-web-font-preview-${useId().replaceAll(":", "")}`;

  useEffect(() => {
    if (!customize || !previewFace || typeof FontFace === "undefined") return;

    let active = true;
    const temporaryFace = new FontFace(
      previewFamilyName,
      `url("${previewFace.source.url}")`,
      {
        style: customize.style,
        weight: String(customize.previewWeight),
        ...(previewFace.unicodeRange
          ? { unicodeRange: previewFace.unicodeRange }
          : {}),
      },
    );
    void temporaryFace
      .load()
      .then(() => {
        if (active) document.fonts.add(temporaryFace);
      })
      .catch(() => undefined);

    return () => {
      active = false;
      document.fonts?.delete(temporaryFace);
    };
  }, [customize, previewFace, previewFamilyName]);

  const resultsPanel = results.length > 0 ? (
    <div className={styles.webFontResults} data-web-font-results>
      {results.map((result) => {
        const pendingForResult = pendingAction?.key === result.id;

        return (
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

            <div className={styles.webFontResultActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={pendingForResult}
                onClick={() => void openCustomizer(result)}
              >
                {pendingForResult && pendingAction.kind === "customizing"
                  ? t("inspector.webFonts.loadingFamily")
                  : t("inspector.webFonts.customize")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <div className={styles.fontSourcePanel}>
      <label className={styles.field}>
        <span>{t("inspector.webFonts.search")}</span>

        <input
          id={`${controlPrefix}-search`}
          name={`${controlPrefix}-search`}
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
            setPendingAction(undefined);
            setCustomize(undefined);
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

      {!customize && resultsPanel}

      {error && searchState !== "error" && !customize && (
        <span className={styles.validationMessage} role="alert">
          {t(error)}
        </span>
      )}

      {customize && (
        <div className={styles.webFontSelection} data-web-font-customizer>
          <strong>{customize.family.family}</strong>

          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <span>{t("inspector.fontWeight")}</span>
              <div className={styles.webFontWeightChips} role="group" aria-label={t("inspector.fontWeight")}>
                {weightOptions.map((weight) => {
                  const face = findFace(customize.family, customize.style, customize.subset, weight);
                  const alreadyAdded = face ? isAlreadyAdded(customize.family, face) : false;
                  const selected = customize.selectedWeights.has(weight);
                  return (
                    <button
                      key={weight}
                      id={`${controlPrefix}-search-weight-${weight}`}
                      data-weight={weight}
                      className={`${styles.webFontWeightChip} ${selected ? styles.webFontWeightChipSelected : ""} ${alreadyAdded ? styles.webFontWeightChipAdded : ""}`}
                      type="button"
                      aria-pressed={selected}
                      aria-disabled={alreadyAdded}
                      aria-label={`Weight ${weight}${alreadyAdded ? ", already added" : selected ? ", selected" : ""}`}
                      onClick={() => {
                        setCustomize((current) => {
                          if (!current) return current;
                          const nextSelected = new Set(current.selectedWeights);
                          if (!alreadyAdded) {
                            if (nextSelected.has(weight)) nextSelected.delete(weight);
                            else nextSelected.add(weight);
                          }
                          return { ...current, previewWeight: weight, selectedWeights: nextSelected };
                        });
                      }}
                    >
                      {weight}{alreadyAdded ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className={styles.field}>
              <span>{t("inspector.fontStyle")}</span>

              <select
                id={`${controlPrefix}-search-style`}
                name={`${controlPrefix}-search-style`}
                value={customize.style}
                onChange={(event) => {
                  const style = event.target.value;

                  if (style === "normal" || style === "italic") {
                    const subsets = customize.family.faces
                      .filter((face) => face.style === style)
                      .map((face) => face.subset ?? "");
                    const subset = subsets.includes(customize.subset)
                      ? customize.subset
                      : (subsets.includes("latin") ? "latin" : subsets[0]);
                    if (subset === undefined) return;
                    const weights = getAvailableWeights(customize.family, style, subset);
                    const previewWeight = nearestWeight(weights);
                    if (previewWeight === undefined) return;
                    setCustomize({ ...customize, style, subset, previewWeight, selectedWeights: new Set() });
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
              id={`${controlPrefix}-search-subset`}
              name={`${controlPrefix}-search-subset`}
              value={customize.subset}
              onChange={(event) => {
                const subset = event.target.value;
                const weights = getAvailableWeights(customize.family, customize.style, subset);
                const previewWeight = nearestWeight(weights);
                if (previewWeight !== undefined) {
                  setCustomize({ ...customize, subset, previewWeight, selectedWeights: new Set() });
                }
              }}
            >
              {subsetOptions.map((subset) => (
                <option key={subset || "default"} value={subset}>
                  {subset || t("inspector.default")}
                </option>
              ))}
            </select>
          </label>

          {previewFace && (
            <div className={styles.webFontPreview} style={{ fontFamily: `"${previewFamilyName}"` }}>
              <span>Ag</span>
              <span>Montserrat</span>
            </div>
          )}

          {selectedFaces.length > 0 && (
            <div className={styles.webFontSelectionSummary}>
              {selectedFaces.map((face) => face.weight).join(", ")} · {t(`inspector.fontStyle.${customize.style}`)} · {customize.subset || t("inspector.default")}
              {new Set(selectedFaces.map((face) => face.source.format)).size === 1 && selectedFaces[0]?.source.format
                ? ` · ${selectedFaces[0].source.format.toUpperCase()}`
                : ""}
            </div>
          )}

          <div className={styles.webFontVariantActions}>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={selectedFaces.length === 0 || pendingAction !== undefined}
              onClick={async () => {
                const pendingKey = customize.family.id;
                setPendingAction({ key: pendingKey, kind: "adding" });
                setError(null);
                try {
                  const completedWeights = new Set<number>();
                  for (const face of selectedFaces) {
                    if (
                      isAlreadyAdded(customize.family, face) ||
                      (await persistFace(customize.family, face))
                    ) {
                      completedWeights.add(face.weight ?? 0);
                    }
                  }
                  setCustomize((current) => {
                    if (!current) return current;
                    const remaining = new Set(current.selectedWeights);
                    completedWeights.forEach((weight) => remaining.delete(weight));
                    return { ...current, selectedWeights: remaining };
                  });
                } finally {
                  setPendingAction((current) => current?.key === pendingKey ? undefined : current);
                }
              }}
            >
              {pendingAction?.kind === "adding" ? t("inspector.webFonts.adding") : t("inspector.webFonts.addSelectedVariants")}
            </button>

            <button
              className={styles.secondaryButton}
              type="button"
              onClick={closeCustomize}
            >
              {t("inspector.webFonts.back")}
            </button>
          </div>

          {error && (
            <span className={styles.validationMessage} role="alert">
              {t(error)}
            </span>
          )}
        </div>
      )}

      {customize && resultsPanel}
    </div>
  );
}
