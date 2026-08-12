import { NextResponse } from "next/server";

import { resolveGoogleFontImport } from "../../../../../features/fonts/google-font-import-resolver";
import {
  GoogleFontImportError,
  type GoogleFontImportErrorCode,
  type GoogleFontImportResponse,
} from "../../../../../features/fonts/google-font-import-types";

function errorResponse(
  error: GoogleFontImportErrorCode,
  status: number,
): NextResponse<GoogleFontImportResponse> {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(
  request: Request,
): Promise<NextResponse<GoogleFontImportResponse>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_google_fonts_url", 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("url" in body) ||
    typeof body.url !== "string"
  ) {
    return errorResponse("invalid_google_fonts_url", 400);
  }

  try {
    const result = await resolveGoogleFontImport(body.url);

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof GoogleFontImportError) {
      const status =
        error.code === "google_stylesheet_unavailable" ||
        error.code === "google_stylesheet_timeout"
          ? 502
          : error.code === "google_stylesheet_too_large"
            ? 413
            : 400;

      return errorResponse(error.code, status);
    }

    return errorResponse("google_stylesheet_unavailable", 502);
  }
}

