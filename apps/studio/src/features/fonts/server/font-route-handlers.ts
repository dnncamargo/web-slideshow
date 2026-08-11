import type {
  WebFontApiErrorCode,
  WebFontFamilyApiResponse,
  WebFontSearchApiResponse,
  WebFontStatusApiResponse,
} from "../web-font-types";
import { WebFontProviderError } from "./font-provider";
import {
  parseWebFontProviderId,
  isWebFontProviderConfigured,
  webFontService,
  type WebFontService,
} from "./web-font-service";

function errorStatus(code: WebFontApiErrorCode): number {
  switch (code) {
    case "invalid_provider":
    case "invalid_query":
      return 400;
    case "family_not_found":
      return 404;
    case "provider_not_configured":
      return 503;
    case "provider_unavailable":
    case "invalid_provider_response":
      return 502;
  }
}

function normalizeError(error: unknown): WebFontApiErrorCode {
  return error instanceof WebFontProviderError
    ? error.code
    : "provider_unavailable";
}

function errorResponse(code: WebFontApiErrorCode): Response {
  return Response.json({ error: code }, { status: errorStatus(code) });
}

export function createFontSearchHandler(
  service: WebFontService = webFontService,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      const url = new URL(request.url);
      const providerId = parseWebFontProviderId(
        url.searchParams.get("provider"),
      );
      const query = url.searchParams.get("query")?.trim() ?? "";

      if (query.length < 2) {
        throw new WebFontProviderError("invalid_query");
      }

      const response: WebFontSearchApiResponse = {
        fonts: await service.search(providerId, query),
      };

      return Response.json(response);
    } catch (error) {
      return errorResponse(normalizeError(error));
    }
  };
}

export function createFontFamilyHandler(
  service: WebFontService = webFontService,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      const url = new URL(request.url);
      const providerId = parseWebFontProviderId(
        url.searchParams.get("provider"),
      );
      const id = url.searchParams.get("id")?.trim() ?? "";

      if (!id) {
        throw new WebFontProviderError("invalid_query");
      }

      const response: WebFontFamilyApiResponse = {
        family: await service.resolveFamily(providerId, id),
      };

      return Response.json(response);
    } catch (error) {
      return errorResponse(normalizeError(error));
    }
  };
}

export function createFontStatusHandler(
  isConfigured: (
    providerId: Parameters<typeof isWebFontProviderConfigured>[0],
  ) => boolean = isWebFontProviderConfigured,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      const url = new URL(request.url);
      const providerId = parseWebFontProviderId(
        url.searchParams.get("provider"),
      );
      const response: WebFontStatusApiResponse = {
        available: isConfigured(providerId),
      };

      return Response.json(response);
    } catch (error) {
      return errorResponse(normalizeError(error));
    }
  };
}
