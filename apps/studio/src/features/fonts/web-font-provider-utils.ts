import { WebFontProviderError } from "./web-font-types";

export const WEB_FONT_CATALOG_TTL_MS = 15 * 60 * 1000;
export const WEB_FONT_PROVIDER_TIMEOUT_MS = 5_000;
export const WEB_FONT_SEARCH_LIMIT = 20;

export type WebFontFetch = typeof fetch;

export interface ProviderRequestOptions {
  fetchImpl?: WebFontFetch;
  mapNotFound?: boolean;
  timeoutMs?: number;
}

export interface TimedCacheEntry<T> {
  expiresAt: number;
  value: T;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readStringArray(value: unknown): string[] | undefined {
  if (
    !Array.isArray(value) ||
    !value.every((item): item is string => typeof item === "string")
  ) {
    return undefined;
  }

  return value;
}

export function isStaticFontWeight(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= 100 &&
    value <= 900 &&
    value % 100 === 0
  );
}

export function isWebFontStyle(
  value: string,
): value is "normal" | "italic" {
  return value === "normal" || value === "italic";
}

export function rankWebFontMatches<T extends { family: string }>(
  fonts: readonly T[],
  query: string,
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const prefixMatches: T[] = [];
  const containsMatches: T[] = [];

  for (const font of fonts) {
    const normalizedFamily = font.family.toLocaleLowerCase();

    if (normalizedFamily.startsWith(normalizedQuery)) {
      prefixMatches.push(font);
    } else if (normalizedFamily.includes(normalizedQuery)) {
      containsMatches.push(font);
    }
  }

  return [...prefixMatches, ...containsMatches].slice(
    0,
    WEB_FONT_SEARCH_LIMIT,
  );
}

export async function fetchProviderJson(
  url: URL,
  options: ProviderRequestOptions = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? WEB_FONT_PROVIDER_TIMEOUT_MS,
  );

  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (response.status === 404 && options.mapNotFound) {
      throw new WebFontProviderError("family_not_found");
    }

    if (!response.ok) {
      throw new WebFontProviderError("provider_unavailable");
    }

    try {
      return await response.json();
    } catch {
      throw new WebFontProviderError("invalid_provider_response");
    }
  } catch (error) {
    if (error instanceof WebFontProviderError) {
      throw error;
    }

    if (controller.signal.aborted) {
      throw new WebFontProviderError("provider_timeout");
    }

    throw new WebFontProviderError("provider_unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

export function readCachedValue<T>(
  cache: TimedCacheEntry<T> | undefined,
  now: number,
): T | undefined {
  return cache !== undefined && cache.expiresAt > now
    ? cache.value
    : undefined;
}
