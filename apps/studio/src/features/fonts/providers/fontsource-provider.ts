import type {
  ResolvedWebFontFamily,
  WebFontFaceOption,
  WebFontSummary,
} from "../web-font-types";
import { WebFontProviderError } from "../web-font-types";
import {
  fetchProviderJson,
  isRecord,
  isStaticFontWeight,
  isWebFontStyle,
  rankWebFontMatches,
  readCachedValue,
  readStringArray,
  WEB_FONT_CATALOG_TTL_MS,
  type ProviderRequestOptions,
  type TimedCacheEntry,
} from "../web-font-provider-utils";

const FONTSOURCE_CATALOG_URL = new URL(
  "https://api.fontsource.org/v1/fonts",
);
const FONTSOURCE_FAMILY_URL = "https://api.fontsource.org/v1/fonts/";

interface FontsourceProviderOptions extends ProviderRequestOptions {
  now?: () => number;
}

let catalogCache: TimedCacheEntry<WebFontSummary[]> | undefined;
let catalogRequest: Promise<WebFontSummary[]> | undefined;
const familyCache = new Map<
  string,
  TimedCacheEntry<ResolvedWebFontFamily>
>();

function normalizeFontsourceSummary(value: unknown): WebFontSummary | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const { id, family, category } = value;
  const weights = Array.isArray(value.weights)
    ? value.weights.filter(
        (weight): weight is number =>
          typeof weight === "number" && isStaticFontWeight(weight),
      )
    : undefined;
  const rawStyles = readStringArray(value.styles);
  const subsets = readStringArray(value.subsets);

  if (
    typeof id !== "string" ||
    id.trim() === "" ||
    typeof family !== "string" ||
    family.trim() === "" ||
    weights === undefined ||
    rawStyles === undefined ||
    subsets === undefined ||
    (category !== undefined && typeof category !== "string")
  ) {
    return undefined;
  }

  const styles = rawStyles.filter(isWebFontStyle);

  return {
    provider: "fontsource",
    id,
    family,
    ...(typeof category === "string" ? { category } : {}),
    weights: [...new Set(weights)],
    styles: [...new Set(styles)],
    subsets: [...new Set(subsets)],
  };
}

function readHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function normalizeFontsourceFamily(
  value: unknown,
): ResolvedWebFontFamily | undefined {
  const summary = normalizeFontsourceSummary(value);

  if (!summary || !isRecord(value)) {
    return undefined;
  }

  const variants = value.variants;
  const unicodeRanges = isRecord(value.unicodeRange)
    ? value.unicodeRange
    : {};

  if (!isRecord(variants)) {
    return undefined;
  }

  const faces: WebFontFaceOption[] = [];

  for (const [weightValue, styleValues] of Object.entries(variants)) {
    const weight = Number(weightValue);

    if (!isStaticFontWeight(weight) || !isRecord(styleValues)) {
      continue;
    }

    for (const [style, subsetValues] of Object.entries(styleValues)) {
      if (!isWebFontStyle(style) || !isRecord(subsetValues)) {
        continue;
      }

      for (const [subset, subsetValue] of Object.entries(subsetValues)) {
        if (!isRecord(subsetValue) || !isRecord(subsetValue.url)) {
          continue;
        }

        const url = readHttpsUrl(subsetValue.url.woff2);

        if (!url) {
          continue;
        }

        const unicodeRange = unicodeRanges[subset];

        faces.push({
          weight,
          style,
          subset,
          ...(typeof unicodeRange === "string" && unicodeRange !== ""
            ? { unicodeRange }
            : {}),
          source: { type: "url", url, format: "woff2" },
        });
      }
    }
  }

  if (faces.length === 0) {
    return undefined;
  }

  const defaultSubset = value.defSubset;

  return {
    ...summary,
    ...(typeof defaultSubset === "string" && defaultSubset !== ""
      ? { defaultSubset }
      : {}),
    faces,
  };
}

async function getFontsourceCatalog(
  options: FontsourceProviderOptions = {},
): Promise<WebFontSummary[]> {
  const now = options.now?.() ?? Date.now();
  const cachedCatalog = readCachedValue(catalogCache, now);

  if (cachedCatalog) {
    return cachedCatalog;
  }

  if (!catalogRequest) {
    catalogRequest = (async () => {
      const response = await fetchProviderJson(
        FONTSOURCE_CATALOG_URL,
        options,
      );

      if (!Array.isArray(response)) {
        throw new WebFontProviderError("invalid_provider_response");
      }

      const catalog = response.map(normalizeFontsourceSummary);

      if (catalog.some((font) => font === undefined)) {
        throw new WebFontProviderError("invalid_provider_response");
      }

      const normalizedCatalog = catalog.filter(
        (font): font is WebFontSummary => font !== undefined,
      );

      catalogCache = {
        expiresAt: now + WEB_FONT_CATALOG_TTL_MS,
        value: normalizedCatalog,
      };

      return normalizedCatalog;
    })();
  }

  try {
    return await catalogRequest;
  } finally {
    catalogRequest = undefined;
  }
}

export async function searchFontsourceFonts(
  query: string,
  options: FontsourceProviderOptions = {},
): Promise<WebFontSummary[]> {
  const catalog = await getFontsourceCatalog(options);

  return rankWebFontMatches(catalog, query);
}

export async function resolveFontsourceFamily(
  id: string,
  options: FontsourceProviderOptions = {},
): Promise<ResolvedWebFontFamily> {
  const normalizedId = id.trim().toLocaleLowerCase();
  const now = options.now?.() ?? Date.now();
  const cachedFamily = readCachedValue(familyCache.get(normalizedId), now);

  if (cachedFamily) {
    return cachedFamily;
  }

  const response = await fetchProviderJson(
    new URL(encodeURIComponent(normalizedId), FONTSOURCE_FAMILY_URL),
    { ...options, mapNotFound: true },
  );
  const family = normalizeFontsourceFamily(response);

  if (!family) {
    throw new WebFontProviderError("invalid_provider_response");
  }

  familyCache.set(normalizedId, {
    expiresAt: now + WEB_FONT_CATALOG_TTL_MS,
    value: family,
  });

  return family;
}

export function resetFontsourceProviderCacheForTests(): void {
  catalogCache = undefined;
  catalogRequest = undefined;
  familyCache.clear();
}
