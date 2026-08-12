import type { FontFaceResource } from "@powershow/document-schema";

export type FontManagerSource =
  | "fontsource"
  | "google-fonts"
  | "manual";

export type WebFontProviderId = Exclude<FontManagerSource, "manual">;

export interface WebFontSummary {
  provider: WebFontProviderId;
  id: string;
  family: string;
  category?: string;
  weights: number[];
  styles: Array<"normal" | "italic">;
  subsets: string[];
}

export interface WebFontFaceOption extends FontFaceResource {
  weight: number;
  style: "normal" | "italic";
  source: FontFaceResource["source"] & {
    format: "woff2";
  };
}

export interface ResolvedWebFontFamily extends WebFontSummary {
  defaultSubset?: string;
  faces: WebFontFaceOption[];
}

export type WebFontProviderErrorCode =
  | "invalid_provider"
  | "invalid_query"
  | "family_not_found"
  | "provider_not_configured"
  | "provider_timeout"
  | "provider_unavailable"
  | "invalid_provider_response";

export interface WebFontSearchSuccessResponse {
  ok: true;
  results: WebFontSummary[];
}

export interface WebFontFamilySuccessResponse {
  ok: true;
  family: ResolvedWebFontFamily;
}

export interface WebFontProviderStatusSuccessResponse {
  ok: true;
  available: boolean;
}

export interface WebFontErrorResponse {
  ok: false;
  error: WebFontProviderErrorCode;
}

export type WebFontSearchResponse =
  | WebFontSearchSuccessResponse
  | WebFontErrorResponse;

export type WebFontFamilyResponse =
  | WebFontFamilySuccessResponse
  | WebFontErrorResponse;

export type WebFontProviderStatusResponse =
  | WebFontProviderStatusSuccessResponse
  | WebFontErrorResponse;

export class WebFontProviderError extends Error {
  readonly code: WebFontProviderErrorCode;

  constructor(code: WebFontProviderErrorCode) {
    super(code);
    this.name = "WebFontProviderError";
    this.code = code;
  }
}
