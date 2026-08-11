import type {
  ResolvedWebFontFamily,
  WebFontApiErrorCode,
  WebFontProviderId,
  WebFontSummary,
} from "../web-font-types";

export const WEB_FONT_REQUEST_TIMEOUT_MS = 5_000;
export const WEB_FONT_SEARCH_RESULT_LIMIT = 20;

export interface WebFontProvider {
  readonly id: WebFontProviderId;

  search(query: string): Promise<WebFontSummary[]>;

  resolveFamily(id: string): Promise<ResolvedWebFontFamily>;
}

export class WebFontProviderError extends Error {
  constructor(
    readonly code: WebFontApiErrorCode,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "WebFontProviderError";
  }
}

export interface FetchJsonOptions {
  fetchImpl?: typeof fetch;
  headers?: HeadersInit;
  notFoundError?: WebFontApiErrorCode;
  timeoutMs?: number;
}

export async function fetchJsonWithTimeout(
  url: URL,
  {
    fetchImpl = fetch,
    headers,
    notFoundError,
    timeoutMs = WEB_FONT_REQUEST_TIMEOUT_MS,
  }: FetchJsonOptions = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, {
      headers,
      signal: controller.signal,
    });

    if (response.status === 404 && notFoundError) {
      throw new WebFontProviderError(notFoundError);
    }

    if (!response.ok) {
      throw new WebFontProviderError("provider_unavailable");
    }

    try {
      return await response.json();
    } catch (error) {
      throw new WebFontProviderError("invalid_provider_response", {
        cause: error,
      });
    }
  } catch (error) {
    if (error instanceof WebFontProviderError) {
      throw error;
    }

    throw new WebFontProviderError("provider_unavailable", {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function filterWebFontSummaries(
  summaries: readonly WebFontSummary[],
  query: string,
): WebFontSummary[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const startsWith: WebFontSummary[] = [];
  const contains: WebFontSummary[] = [];

  for (const summary of summaries) {
    const normalizedFamily = summary.family.toLocaleLowerCase();

    if (normalizedFamily.startsWith(normalizedQuery)) {
      startsWith.push(summary);
    } else if (normalizedFamily.includes(normalizedQuery)) {
      contains.push(summary);
    }

  }

  return [...startsWith, ...contains].slice(0, WEB_FONT_SEARCH_RESULT_LIMIT);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readRequiredString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function readStringArray(
  record: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const value = record[key];

  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || !item.trim())
  ) {
    return undefined;
  }

  return value.map((item) => (item as string).trim());
}

export function isStaticFontWeight(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= 100 &&
    value <= 900 &&
    value % 100 === 0
  );
}

export function readStaticFontWeights(
  record: Record<string, unknown>,
  key: string,
): number[] | undefined {
  const value = record[key];

  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "number" || !isStaticFontWeight(item))
  ) {
    return undefined;
  }

  return value as number[];
}

export function readHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }

    if (url.protocol === "http:") {
      url.protocol = "https:";
    }

    return url.toString();
  } catch {
    return undefined;
  }
}
