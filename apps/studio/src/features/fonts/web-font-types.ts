export const WEB_FONT_PROVIDER_IDS = [
  "fontsource",
  "google-fonts",
] as const;

export type WebFontProviderId = (typeof WEB_FONT_PROVIDER_IDS)[number];

export type WebFontSourceSelection = WebFontProviderId | "manual";

export type WebFontStyle = "normal" | "italic";

export interface WebFontSummary {
  provider: WebFontProviderId;
  id: string;
  family: string;
  category?: string;
  weights: number[];
  styles: WebFontStyle[];
  subsets: string[];
  defaultSubset?: string;
}

export interface ResolvedWebFontFace {
  weight?: number;
  style?: WebFontStyle;
  subset?: string;
  unicodeRange?: string;
  url: string;
  format: "woff2";
}

export interface ResolvedWebFontFamily extends WebFontSummary {
  faces: ResolvedWebFontFace[];
}

export type WebFontApiErrorCode =
  | "provider_not_configured"
  | "provider_unavailable"
  | "invalid_query"
  | "invalid_provider"
  | "family_not_found"
  | "invalid_provider_response";

export type WebFontSearchApiResponse =
  | { fonts: WebFontSummary[] }
  | { error: WebFontApiErrorCode };

export type WebFontFamilyApiResponse =
  | { family: ResolvedWebFontFamily }
  | { error: WebFontApiErrorCode };

export type WebFontStatusApiResponse =
  | { available: boolean }
  | { error: WebFontApiErrorCode };

export function isWebFontProviderId(
  value: string | null,
): value is WebFontProviderId {
  return value === "fontsource" || value === "google-fonts";
}
