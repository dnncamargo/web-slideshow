import type {
  WebFontErrorResponse,
  WebFontProviderErrorCode,
} from "./web-font-types";
import { WebFontProviderError } from "./web-font-types";

function statusForError(code: WebFontProviderErrorCode): number {
  switch (code) {
    case "invalid_provider":
    case "invalid_query":
      return 400;

    case "family_not_found":
      return 404;

    case "provider_not_configured":
      return 503;

    case "provider_timeout":
      return 504;

    case "provider_unavailable":
    case "invalid_provider_response":
      return 502;
  }
}

export function webFontErrorResponse(error: unknown): Response {
  const code =
    error instanceof WebFontProviderError
      ? error.code
      : "provider_unavailable";
  const body: WebFontErrorResponse = { ok: false, error: code };

  return Response.json(body, { status: statusForError(code) });
}
