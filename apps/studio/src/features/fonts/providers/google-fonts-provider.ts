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
  rankWebFontMatches,
  readCachedValue,
  readStringArray,
  WEB_FONT_CATALOG_TTL_MS,
  type ProviderRequestOptions,
  type TimedCacheEntry,
} from "../web-font-provider-utils";

const GOOGLE_FONTS_CATALOG_URL = new URL(
  "https://www.googleapis.com/webfonts/v1/webfonts",
);

interface GoogleFontsProviderOptions extends ProviderRequestOptions {
  apiKey?: string | null;
  now?: () => number;
}

interface GoogleCatalogFamily {
  summary: WebFontSummary;
  faces: WebFontFaceOption[];
  defaultSubset?: string;
}

let catalogCache: TimedCacheEntry<GoogleCatalogFamily[]> | undefined;
let catalogRequest: Promise<GoogleCatalogFamily[]> | undefined;

export function parseGoogleFontVariant(
  variant: string,
): { weight: number; style: "normal" | "italic" } | undefined {
  if (variant === "regular") {
    return { weight: 400, style: "normal" };
  }

  if (variant === "italic") {
    return { weight: 400, style: "italic" };
  }

  const match = /^(100|200|300|400|500|600|700|800|900)(italic)?$/.exec(
    variant,
  );

  if (!match) {
    return undefined;
  }

  const weight = Number(match[1]);

  return isStaticFontWeight(weight)
    ? { weight, style: match[2] === undefined ? "normal" : "italic" }
    : undefined;
}

function readGoogleWoff2Url(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  try {
    const url = new URL(value);

    if (url.hostname !== "fonts.gstatic.com") {
      return undefined;
    }

    if (url.protocol === "http:") {
      url.protocol = "https:";
    }

    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function normalizeGoogleCatalogFamily(
  value: unknown,
): GoogleCatalogFamily | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const { family, category } = value;
  const variants = readStringArray(value.variants);
  const subsets = readStringArray(value.subsets);

  if (
    typeof family !== "string" ||
    family.trim() === "" ||
    variants === undefined ||
    subsets === undefined ||
    !isRecord(value.files) ||
    (category !== undefined && typeof category !== "string")
  ) {
    return undefined;
  }

  const faces: WebFontFaceOption[] = [];

  for (const variant of variants) {
    const parsedVariant = parseGoogleFontVariant(variant);
    const url = readGoogleWoff2Url(value.files[variant]);

    if (!parsedVariant || !url) {
      continue;
    }

    if (subsets.length === 0) {
      faces.push({
        ...parsedVariant,
        source: { type: "url", url, format: "woff2" },
      });
      continue;
    }

    for (const subset of subsets) {
      faces.push({
        ...parsedVariant,
        subset,
        source: { type: "url", url, format: "woff2" },
      });
    }
  }

  const weights = [...new Set(faces.map((face) => face.weight))];
  const styles = [...new Set(faces.map((face) => face.style))];
  const defaultSubset = subsets.includes("latin") ? "latin" : subsets[0];

  return {
    summary: {
      provider: "google-fonts",
      id: family,
      family,
      ...(typeof category === "string" ? { category } : {}),
      weights,
      styles,
      subsets: [...new Set(subsets)],
    },
    faces,
    ...(defaultSubset !== undefined ? { defaultSubset } : {}),
  };
}

function readApiKey(options: GoogleFontsProviderOptions): string {
  const apiKey =
    options.apiKey === undefined
      ? process.env.GOOGLE_FONTS_API_KEY
      : options.apiKey;

  if (!apiKey) {
    throw new WebFontProviderError("provider_not_configured");
  }

  return apiKey;
}

async function getGoogleFontsCatalog(
  options: GoogleFontsProviderOptions = {},
): Promise<GoogleCatalogFamily[]> {
  const apiKey = readApiKey(options);
  const now = options.now?.() ?? Date.now();
  const cachedCatalog = readCachedValue(catalogCache, now);

  if (cachedCatalog) {
    return cachedCatalog;
  }

  if (!catalogRequest) {
    catalogRequest = (async () => {
      const url = new URL(GOOGLE_FONTS_CATALOG_URL);
      url.searchParams.set("key", apiKey);
      url.searchParams.set("capability", "WOFF2");

      const response = await fetchProviderJson(url, options);

      if (!isRecord(response) || !Array.isArray(response.items)) {
        throw new WebFontProviderError("invalid_provider_response");
      }

      const catalog = response.items.map(normalizeGoogleCatalogFamily);

      if (catalog.some((font) => font === undefined)) {
        throw new WebFontProviderError("invalid_provider_response");
      }

      const normalizedCatalog = catalog.filter(
        (font): font is GoogleCatalogFamily =>
          font !== undefined && font.faces.length > 0,
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

export async function searchGoogleFonts(
  query: string,
  options: GoogleFontsProviderOptions = {},
): Promise<WebFontSummary[]> {
  const catalog = await getGoogleFontsCatalog(options);

  return rankWebFontMatches(
    catalog.map((font) => font.summary),
    query,
  );
}

export async function resolveGoogleFontsFamily(
  id: string,
  options: GoogleFontsProviderOptions = {},
): Promise<ResolvedWebFontFamily> {
  const normalizedId = id.trim().toLocaleLowerCase();
  const catalog = await getGoogleFontsCatalog(options);
  const family = catalog.find(
    (font) =>
      font.summary.id.toLocaleLowerCase() === normalizedId ||
      font.summary.family.toLocaleLowerCase() === normalizedId,
  );

  if (!family) {
    throw new WebFontProviderError("family_not_found");
  }

  return {
    ...family.summary,
    ...(family.defaultSubset !== undefined
      ? { defaultSubset: family.defaultSubset }
      : {}),
    faces: family.faces,
  };
}

export function isGoogleFontsSearchConfigured(): boolean {
  return Boolean(process.env.GOOGLE_FONTS_API_KEY);
}

export function resetGoogleFontsProviderCacheForTests(): void {
  catalogCache = undefined;
  catalogRequest = undefined;
}
