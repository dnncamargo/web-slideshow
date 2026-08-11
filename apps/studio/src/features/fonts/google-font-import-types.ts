import type { FontFaceResource } from "@powershow/document-schema";

export type GoogleFontImportErrorCode =
  | "invalid_google_fonts_url"
  | "unsupported_google_fonts_parameter"
  | "text_optimized_font_not_supported"
  | "google_stylesheet_unavailable"
  | "google_stylesheet_timeout"
  | "google_stylesheet_too_large"
  | "invalid_google_stylesheet_response"
  | "no_supported_font_faces";

export type UnsupportedGoogleFontFaceReason =
  | "malformed_font_face"
  | "unsupported_font_variant"
  | "unsupported_font_source";

export interface UnsupportedGoogleFontFace {
  family?: string;
  weight?: string;
  style?: string;
  reason: UnsupportedGoogleFontFaceReason;
}

export interface ResolvedGoogleFontVariant {
  weight: number;
  style: "normal" | "italic";
  faces: FontFaceResource[];
}

export interface ResolvedGoogleFontFamily {
  family: string;
  variants: ResolvedGoogleFontVariant[];
}

export interface GoogleFontImportResult {
  families: ResolvedGoogleFontFamily[];
  unsupported: UnsupportedGoogleFontFace[];
}

export interface GoogleFontImportSuccessResponse {
  ok: true;
  result: GoogleFontImportResult;
}

export interface GoogleFontImportErrorResponse {
  ok: false;
  error: GoogleFontImportErrorCode;
}

export type GoogleFontImportResponse =
  | GoogleFontImportSuccessResponse
  | GoogleFontImportErrorResponse;

export class GoogleFontImportError extends Error {
  readonly code: GoogleFontImportErrorCode;

  constructor(code: GoogleFontImportErrorCode) {
    super(code);
    this.name = "GoogleFontImportError";
    this.code = code;
  }
}

