import {
  resolveFontsourceFamily,
  searchFontsourceFonts,
} from "./providers/fontsource-provider";
import {
  isGoogleFontsSearchConfigured,
  resolveGoogleFontsFamily,
  searchGoogleFonts,
} from "./providers/google-fonts-provider";
import type {
  ResolvedWebFontFamily,
  WebFontProviderId,
  WebFontSummary,
} from "./web-font-types";
import { WebFontProviderError } from "./web-font-types";

export function isWebFontProviderId(
  value: string | null,
): value is WebFontProviderId {
  return value === "fontsource" || value === "google-fonts";
}

export async function searchWebFonts(
  provider: WebFontProviderId,
  query: string,
): Promise<WebFontSummary[]> {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length < 2) {
    throw new WebFontProviderError("invalid_query");
  }

  return provider === "fontsource"
    ? searchFontsourceFonts(normalizedQuery)
    : searchGoogleFonts(normalizedQuery);
}

export async function resolveWebFontFamily(
  provider: WebFontProviderId,
  id: string,
): Promise<ResolvedWebFontFamily> {
  const normalizedId = id.trim();

  if (normalizedId === "") {
    throw new WebFontProviderError("family_not_found");
  }

  return provider === "fontsource"
    ? resolveFontsourceFamily(normalizedId)
    : resolveGoogleFontsFamily(normalizedId);
}

export function isWebFontProviderAvailable(
  provider: WebFontProviderId,
): boolean {
  return provider === "fontsource" || isGoogleFontsSearchConfigured();
}
