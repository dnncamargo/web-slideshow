import {
  isWebFontProviderAvailable,
  isWebFontProviderId,
} from "../../../../features/fonts/font-provider";
import type { WebFontProviderStatusSuccessResponse } from "../../../../features/fonts/web-font-types";
import { WebFontProviderError } from "../../../../features/fonts/web-font-types";
import { webFontErrorResponse } from "../../../../features/fonts/web-font-route";

export function GET(request: Request): Response {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");

  if (!isWebFontProviderId(provider)) {
    return webFontErrorResponse(
      new WebFontProviderError("invalid_provider"),
    );
  }

  const body: WebFontProviderStatusSuccessResponse = {
    ok: true,
    available: isWebFontProviderAvailable(provider),
  };

  return Response.json(body);
}
