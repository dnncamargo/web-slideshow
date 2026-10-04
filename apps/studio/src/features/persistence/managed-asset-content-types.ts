export const MANAGED_ASSET_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "font/ttf",
  "font/otf",
  "font/woff",
  "font/woff2",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/xml",
] as const;

export type ManagedAssetContentType =
  (typeof MANAGED_ASSET_CONTENT_TYPES)[number];

export function isManagedAssetContentType(
  value: string,
): value is ManagedAssetContentType {
  return (MANAGED_ASSET_CONTENT_TYPES as readonly string[]).includes(value);
}
