import { useEffect, useMemo, useRef, useState } from "react";

import {
  FontFaceResourceSchema,
  getFontResourceFaces,
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

import {
  areFontFacesEquivalent,
  normalizeFontFamily,
} from "../../font-resource-helpers";
import styles from "../../editor-workspace.module.css";

import { getControlName } from "../inspector-helpers";
import type { FontResourceControls } from "../inspector-types";

interface WebFontSearchControlProps extends Pick<
  FontResourceControls,
  "fontResources" | "onAddFontFace"
> {
  provider: WebFontProviderId;
  onFontAdded: (family: string) => void;
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

function findFamilyFace(
  family: ResolvedWebFontFamily,
  selection: WebFontFaceSelection,
): FontFaceResource | undefined {
  return family.faces.find(
    (face) =>
      face.weight === selection.weight &&
      face.style === selection.style &&
      (face.subset ?? "") === selection.subset,
  );
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
    selection: WebFontFaceSelection;
  }>();
  const [lastAdded, setLastAdded] = useState<{
    id: string;
    family: ResolvedWebFontFamily;
  }>();
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

  function commitFaceSelection(
    family: ResolvedWebFontFamily,
    selection: WebFontFaceSelection,
  ): boolean {
    const face = findFamilyFace(family, selection);

    if (!face) {
      return false;
    }

    const parsedFace = FontFaceResourceSchema.safeParse(face);

    if (!parsedFace.success) {
      setError("inspector.webFonts.searchError");
      return false;
    }

    const normalizedFamily = normalizeFontFamily(family.family);
    const existingFamily = fontResources.find(
      (fontResource) =>
        normalizeFontFamily(fontResource.family) === normalizedFamily,
    );
    const duplicate = existingFamily
      ? getFontResourceFaces(existingFamily).some((registeredFace) =>
          areFontFacesEquivalent(registeredFace, parsedFace.data),
        )
      : false;

    if (duplicate) {
      setError("inspector.fontFaceExists");
      return false;
    }

    const canonicalFamily = existingFamily?.family ?? family.family;

    onAddFontFace(canonicalFamily, parsedFace.data);
    onFontAdded(canonicalFamily);
    setError(null);

    return true;
  }

  async function addRecommendedFace(summary: WebFontSummary) {
    const pendingKey = summary.id;
    setPendingAction({ key: pendingKey, kind: "adding" });
    setError(null);

    try {
      const family = await resolveFamily(summary);

      if (!family) {
        return;
      }

      const recommendation = chooseRecommendedFontFace(family);

      if (!recommendation) {
        setError("inspector.webFonts.searchError");
        return;
      }

      if (commitFaceSelection(family, recommendation)) {
        setLastAdded({ id: summary.id, family });
      }
    } finally {
      setPendingAction((current) =>
        current?.key === pendingKey ? undefined : current,
      );
    }
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

      setCustomize({ family, selection });
    } finally {
      setPendingAction((current) =>
        current?.key === pendingKey ? undefined : current,
      );
    }
  }

  function reopenLastAdded() {
    if (!lastAdded) {
      return;
    }

    const selection = chooseRecommendedFontFace(lastAdded.family);

    if (!selection) {
      return;
    }

    setError(null);
    setCustomize({ family: lastAdded.family, selection });
  }

  function closeCustomize() {
    setCustomize(undefined);
    setError(null);
  }

  const weightOptions = useMemo(
    () =>
      customize
        ? [...new Set(customize.family.faces.map((face) => face.weight))].sort(
            (a, b) => a - b,
          )
        : [],
    [customize],
  );

  const styleOptions = useMemo(
    () =>
      customize
        ? [
            ...new Set(
              customize.family.faces
                .filter((face) => face.weight === customize.selection.weight)
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
                .filter(
                  (face) =>
                    face.weight === customize.selection.weight &&
                    face.style === customize.selection.style,
                )
                .map((face) => face.subset ?? ""),
            ),
          ]
        : [],
    [customize],
  );
  const selectedFace =
    customize !== undefined
      ? findFamilyFace(customize.family, customize.selection)
      : undefined;

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
            setPendingAction(undefined);
            setCustomize(undefined);
            setLastAdded(undefined);
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
                    onClick={() => {
                      void addRecommendedFace(result);
                    }}
                  >
                    {pendingForResult && pendingAction.kind === "adding"
                      ? t("inspector.webFonts.adding")
                      : t("inspector.webFonts.addFont")}
                  </button>

                  <button
                    className={styles.secondaryButton}
                    type="button"
                    disabled={pendingForResult}
                    onClick={() => {
                      void openCustomizer(result);
                    }}
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
      )}

      {lastAdded && (
        <div className={styles.webFontAddVariantRow}>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={pendingAction !== undefined}
            onClick={reopenLastAdded}
          >
            {t("inspector.webFonts.addAnotherVariant")}
          </button>
        </div>
      )}

      {error && searchState !== "error" && !customize && (
        <span className={styles.validationMessage} role="alert">
          {t(error)}
        </span>
      )}

      {customize && (
        <div className={styles.webFontSelection}>
          <strong>{customize.family.family}</strong>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>{t("inspector.fontWeight")}</span>

              <select
                id="presentation-font-search-weight"
                name={getControlName("presentation", "FontSearchWeight")}
                value={customize.selection.weight}
                onChange={(event) => {
                  const next = chooseRecommendedFontFace(customize.family, {
                    ...customize.selection,
                    weight: Number(event.target.value),
                  });
                  setCustomize(
                    next
                      ? { family: customize.family, selection: next }
                      : undefined,
                  );
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
                value={customize.selection.style}
                onChange={(event) => {
                  const style = event.target.value;

                  if (style === "normal" || style === "italic") {
                    const next = chooseRecommendedFontFace(customize.family, {
                      ...customize.selection,
                      style,
                    });
                    setCustomize(
                      next
                        ? { family: customize.family, selection: next }
                        : undefined,
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
              value={customize.selection.subset}
              onChange={(event) => {
                setCustomize({
                  family: customize.family,
                  selection: {
                    ...customize.selection,
                    subset: event.target.value,
                  },
                });
              }}
            >
              {subsetOptions.map((subset) => (
                <option key={subset || "default"} value={subset}>
                  {subset || t("inspector.default")}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.webFontVariantActions}>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={!selectedFace}
              onClick={() => {
                const added = commitFaceSelection(
                  customize.family,
                  customize.selection,
                );

                if (added) {
                  setLastAdded({
                    id: customize.family.id,
                    family: customize.family,
                  });
                }
              }}
            >
              {t("inspector.webFonts.addVariant")}
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
    </div>
  );
}
