const DEVELOPMENT_PLAYER_URL = "http://localhost:5173";

export interface PublicPlayerUrl {
  available: boolean;
  baseUrl: string | null;
}


export function normalizePlayerBaseUrl(value: string): string | null {
  const candidate = value.trim().replace(/\/+$/, "");

  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:"
      ? candidate
      : null;
  } catch {
    return null;
  }
}

export function resolvePublicPlayerUrl(
  configuredUrl = process.env.NEXT_PUBLIC_PLAYER_URL,
  environment = process.env.NODE_ENV,
): PublicPlayerUrl {
  const baseUrl = configuredUrl ? normalizePlayerBaseUrl(configuredUrl) : null;

  if (baseUrl !== null) return { available: true, baseUrl };

  if (environment !== "production") {
    return { available: true, baseUrl: DEVELOPMENT_PLAYER_URL };
  }

  return { available: false, baseUrl: null };
}
