import {
  isWebFontProviderId,
  resolveWebFontFamily,
} from "../../../../features/fonts/font-provider";
import type { WebFontFamilySuccessResponse } from "../../../../features/fonts/web-font-types";
import { WebFontProviderError } from "../../../../features/fonts/web-font-types";
import { webFontErrorResponse } from "../../../../features/fonts/web-font-route";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  const id = url.searchParams.get("id") ?? "";

  if (!isWebFontProviderId(provider)) {
    return webFontErrorResponse(
      new WebFontProviderError("invalid_provider"),
    );
  }

  try {
    const family = await resolveWebFontFamily(provider, id);
    const body: WebFontFamilySuccessResponse = { ok: true, family };

    return Response.json(body);
  } catch (error) {
    return webFontErrorResponse(error);
  }
}
