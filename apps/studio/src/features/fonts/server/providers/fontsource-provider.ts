import type {
  ResolvedWebFontFace,
  ResolvedWebFontFamily,
  WebFontStyle,
  WebFontSummary,
} from "../../web-font-types";
import {
  WebFontProviderError,
  fetchJsonWithTimeout,
  filterWebFontSummaries,
  isRecord,
  isStaticFontWeight,
  readHttpUrl,
  readRequiredString,
  readStaticFontWeights,
  readStringArray,
} from "../font-provider";
import type { WebFontProvider } from "../font-provider";
import {
  TtlCache,
  TtlMapCache,
  WEB_FONT_CACHE_TTL_MS,
} from "../font-provider-cache";

const FONTSOURCE_API_URL = new URL("https://api.fontsource.org/v1/fonts");

interface FontsourceProviderOptions {
  fetchImpl?: typeof fetch;
  now?: () => number;
  cacheTtlMs?: number;
  timeoutMs?: number;
}

function readStyles(record: Record<string, unknown>): WebFontStyle[] | undefined {
  const styles = readStringArray(record, "styles");

  if (!styles) {
    return undefined;
  }

  const supported = styles.filter(
    (style): style is WebFontStyle => style === "normal" || style === "italic",
  );

  return supported.length > 0 ? supported : undefined;
}

function normalizeSummary(value: unknown): WebFontSummary | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = readRequiredString(value, "id");
  const family = readRequiredString(value, "family");
  const weights = readStaticFontWeights(value, "weights");
  const styles = readStyles(value);
  const subsets = readStringArray(value, "subsets");
  const category = readRequiredString(value, "category");
  const defaultSubset = readRequiredString(value, "defSubset");

  if (!id || !family || !weights || !styles || !subsets) {
    return undefined;
  }

  return {
    provider: "fontsource",
    id,
    family,
    ...(category ? { category } : {}),
    weights,
    styles,
    subsets,
    ...(defaultSubset ? { defaultSubset } : {}),
  };
}

export function normalizeFontsourceCatalog(value: unknown): WebFontSummary[] {
  if (!Array.isArray(value)) {
    throw new WebFontProviderError("invalid_provider_response");
  }

  const summaries = value.map(normalizeSummary);

  if (summaries.some((summary) => summary === undefined)) {
    throw new WebFontProviderError("invalid_provider_response");
  }

  return summaries as WebFontSummary[];
}

function normalizeFontsourceFaces(
  value: Record<string, unknown>,
): ResolvedWebFontFace[] {
  const variants = value.variants;
  const unicodeRanges = isRecord(value.unicodeRange)
    ? value.unicodeRange
    : undefined;

  if (!isRecord(variants)) {
    throw new WebFontProviderError("invalid_provider_response");
  }

  const faces: ResolvedWebFontFace[] = [];

  for (const [weightValue, stylesValue] of Object.entries(variants)) {
    const weight = Number(weightValue);

    if (!isStaticFontWeight(weight) || !isRecord(stylesValue)) {
      continue;
    }

    for (const [styleValue, subsetsValue] of Object.entries(stylesValue)) {
      if (
        (styleValue !== "normal" && styleValue !== "italic") ||
        !isRecord(subsetsValue)
      ) {
        continue;
      }

      for (const [subset, subsetValue] of Object.entries(subsetsValue)) {
        if (!isRecord(subsetValue) || !isRecord(subsetValue.url)) {
          continue;
        }

        const url = readHttpUrl(subsetValue.url.woff2);

        if (!url) {
          continue;
        }

        const unicodeRange = unicodeRanges?.[subset];

        faces.push({
          weight,
          style: styleValue,
          subset,
          ...(typeof unicodeRange === "string" && unicodeRange
            ? { unicodeRange }
            : {}),
          url,
          format: "woff2",
        });
      }
    }
  }

  if (faces.length === 0) {
    throw new WebFontProviderError("invalid_provider_response");
  }

  return faces;
}

export function normalizeFontsourceFamily(
  value: unknown,
): ResolvedWebFontFamily {
  const summary = normalizeSummary(value);

  if (!summary || !isRecord(value)) {
    throw new WebFontProviderError("invalid_provider_response");
  }

  return {
    ...summary,
    faces: normalizeFontsourceFaces(value),
  };
}

export class FontsourceProvider implements WebFontProvider {
  readonly id = "fontsource" as const;

  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number | undefined;
  private readonly catalogCache: TtlCache<WebFontSummary[]>;
  private readonly familyCache: TtlMapCache<string, ResolvedWebFontFamily>;

  constructor({
    fetchImpl = fetch,
    now = Date.now,
    cacheTtlMs = WEB_FONT_CACHE_TTL_MS,
    timeoutMs,
  }: FontsourceProviderOptions = {}) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.catalogCache = new TtlCache(cacheTtlMs, now);
    this.familyCache = new TtlMapCache(cacheTtlMs, now);
  }

  async search(query: string): Promise<WebFontSummary[]> {
    const catalog = await this.catalogCache.getOrLoad(async () =>
      normalizeFontsourceCatalog(
        await fetchJsonWithTimeout(FONTSOURCE_API_URL, {
          fetchImpl: this.fetchImpl,
          ...(this.timeoutMs === undefined
            ? {}
            : { timeoutMs: this.timeoutMs }),
        }),
      ),
    );

    return filterWebFontSummaries(catalog, query);
  }

  resolveFamily(id: string): Promise<ResolvedWebFontFamily> {
    return this.familyCache.getOrLoad(id, async () => {
      const familyUrl = new URL(
        `/v1/fonts/${encodeURIComponent(id)}`,
        FONTSOURCE_API_URL,
      );

      return normalizeFontsourceFamily(
        await fetchJsonWithTimeout(familyUrl, {
          fetchImpl: this.fetchImpl,
          notFoundError: "family_not_found",
          ...(this.timeoutMs === undefined
            ? {}
            : { timeoutMs: this.timeoutMs }),
        }),
      );
    });
  }
}
