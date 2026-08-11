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
  readStringArray,
} from "../font-provider";
import type { WebFontProvider } from "../font-provider";
import {
  TtlCache,
  WEB_FONT_CACHE_TTL_MS,
} from "../font-provider-cache";

const GOOGLE_FONTS_API_URL = new URL(
  "https://www.googleapis.com/webfonts/v1/webfonts",
);

interface GoogleFontsProviderOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  cacheTtlMs?: number;
  timeoutMs?: number;
}

interface ParsedGoogleVariant {
  style: WebFontStyle;
  weight: number;
}

function parseGoogleVariant(value: string): ParsedGoogleVariant | undefined {
  if (value === "regular") {
    return { weight: 400, style: "normal" };
  }

  if (value === "italic") {
    return { weight: 400, style: "italic" };
  }

  const match = /^(\d{3})(italic)?$/.exec(value);

  if (!match) {
    return undefined;
  }

  const weight = Number(match[1]);

  if (!isStaticFontWeight(weight)) {
    return undefined;
  }

  return {
    weight,
    style: match[2] ? "italic" : "normal",
  };
}

function unique<Value>(values: readonly Value[]): Value[] {
  return [...new Set(values)];
}

function normalizeGoogleFamily(value: unknown): ResolvedWebFontFamily | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const family = readRequiredString(value, "family");
  const category = readRequiredString(value, "category");
  const variants = readStringArray(value, "variants");
  const subsets = readStringArray(value, "subsets");
  const files = value.files;

  if (!family || !variants || !subsets || !isRecord(files)) {
    return undefined;
  }

  const faces: ResolvedWebFontFace[] = [];

  for (const variant of variants) {
    const parsedVariant = parseGoogleVariant(variant);
    const url = readHttpUrl(files[variant]);

    if (!parsedVariant || !url) {
      continue;
    }

    if (subsets.length === 0) {
      faces.push({
        ...parsedVariant,
        url,
        format: "woff2",
      });
      continue;
    }

    for (const subset of subsets) {
      faces.push({
        ...parsedVariant,
        subset,
        url,
        format: "woff2",
      });
    }
  }

  if (faces.length === 0) {
    return undefined;
  }

  const weights = unique(faces.flatMap((face) =>
    face.weight === undefined ? [] : [face.weight],
  ));
  const styles = unique(faces.flatMap((face) =>
    face.style === undefined ? [] : [face.style],
  ));
  const defaultSubset = subsets.includes("latin") ? "latin" : subsets[0];

  return {
    provider: "google-fonts",
    id: family,
    family,
    ...(category ? { category } : {}),
    weights,
    styles,
    subsets,
    ...(defaultSubset ? { defaultSubset } : {}),
    faces,
  };
}

export function normalizeGoogleCatalog(
  value: unknown,
): ResolvedWebFontFamily[] {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new WebFontProviderError("invalid_provider_response");
  }

  const families = value.items.map(normalizeGoogleFamily);

  if (families.some((family) => family === undefined)) {
    throw new WebFontProviderError("invalid_provider_response");
  }

  return families as ResolvedWebFontFamily[];
}

function toSummary(family: ResolvedWebFontFamily): WebFontSummary {
  return {
    provider: family.provider,
    id: family.id,
    family: family.family,
    ...(family.category === undefined ? {} : { category: family.category }),
    weights: family.weights,
    styles: family.styles,
    subsets: family.subsets,
    ...(family.defaultSubset === undefined
      ? {}
      : { defaultSubset: family.defaultSubset }),
  };
}

export class GoogleFontsProvider implements WebFontProvider {
  readonly id = "google-fonts" as const;

  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number | undefined;
  private readonly catalogCache: TtlCache<ResolvedWebFontFamily[]>;

  constructor({
    apiKey,
    fetchImpl = fetch,
    now = Date.now,
    cacheTtlMs = WEB_FONT_CACHE_TTL_MS,
    timeoutMs,
  }: GoogleFontsProviderOptions = {}) {
    this.apiKey = apiKey?.trim() || undefined;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.catalogCache = new TtlCache(cacheTtlMs, now);
  }

  async search(query: string): Promise<WebFontSummary[]> {
    const catalog = await this.getCatalog();

    return filterWebFontSummaries(catalog.map(toSummary), query);
  }

  async resolveFamily(id: string): Promise<ResolvedWebFontFamily> {
    const catalog = await this.getCatalog();
    const normalizedId = id.trim().toLocaleLowerCase();
    const family = catalog.find(
      (item) => item.id.toLocaleLowerCase() === normalizedId,
    );

    if (!family) {
      throw new WebFontProviderError("family_not_found");
    }

    return family;
  }

  private getCatalog(): Promise<ResolvedWebFontFamily[]> {
    if (!this.apiKey) {
      throw new WebFontProviderError("provider_not_configured");
    }

    return this.catalogCache.getOrLoad(async () => {
      const url = new URL(GOOGLE_FONTS_API_URL);

      url.searchParams.set("key", this.apiKey as string);
      url.searchParams.set("capability", "WOFF2");
      url.searchParams.set("sort", "alpha");

      return normalizeGoogleCatalog(
        await fetchJsonWithTimeout(url, {
          fetchImpl: this.fetchImpl,
          headers: {
            Accept: "application/json",
          },
          ...(this.timeoutMs === undefined
            ? {}
            : { timeoutMs: this.timeoutMs }),
        }),
      );
    });
  }
}
