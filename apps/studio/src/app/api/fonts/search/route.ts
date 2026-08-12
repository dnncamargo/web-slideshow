import {
  isWebFontProviderId,
  searchWebFonts,
} from "../../../../features/fonts/font-provider";
import type { WebFontSearchSuccessResponse } from "../../../../features/fonts/web-font-types";
import { WebFontProviderError } from "../../../../features/fonts/web-font-types";
import { webFontErrorResponse } from "../../../../features/fonts/web-font-route";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  const query = url.searchParams.get("q") ?? "";

  if (!isWebFontProviderId(provider)) {
    return webFontErrorResponse(
      new WebFontProviderError("invalid_provider"),
    );
  }

  try {
    const results = await searchWebFonts(provider, query);
    const body: WebFontSearchSuccessResponse = { ok: true, results };

    return Response.json(body);
  } catch (error) {
    return webFontErrorResponse(error);
  }
}
