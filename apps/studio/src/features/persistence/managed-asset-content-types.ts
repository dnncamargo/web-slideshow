export const MANAGED_ASSET_EXTENSIONS = {
  ".jpg": { category: "image", representation: "binary", contentType: "image/jpeg" },
  ".jpeg": { category: "image", representation: "binary", contentType: "image/jpeg" },
  ".png": { category: "image", representation: "binary", contentType: "image/png" },
  ".webp": { category: "image", representation: "binary", contentType: "image/webp" },
  ".gif": { category: "image", representation: "binary", contentType: "image/gif" },
  ".svg": { category: "image", representation: "text", contentType: "image/svg+xml" },
  ".mp3": { category: "audio", representation: "binary", contentType: "audio/mpeg" },
  ".wav": { category: "audio", representation: "binary", contentType: "audio/wav" },
  ".ogg": { category: "audio", representation: "binary", contentType: "audio/ogg" },
  ".ttf": { category: "font", representation: "binary", contentType: "font/ttf", fontFormat: "truetype" },
  ".otf": { category: "font", representation: "binary", contentType: "font/otf", fontFormat: "opentype" },
  ".woff": { category: "font", representation: "binary", contentType: "font/woff", fontFormat: "woff" },
  ".woff2": { category: "font", representation: "binary", contentType: "font/woff2", fontFormat: "woff2" },
  ".txt": { category: "text", representation: "text", contentType: "text/plain" },
  ".md": { category: "markdown", representation: "text", contentType: "text/markdown" },
  ".csv": { category: "structured-data", representation: "text", contentType: "text/csv" },
  ".json": { category: "structured-data", representation: "text", contentType: "application/json" },
  ".xml": { category: "structured-data", representation: "text", contentType: "application/xml" },
} as const;

export type ManagedAssetExtension = keyof typeof MANAGED_ASSET_EXTENSIONS;
export type ManagedAssetContentType =
  (typeof MANAGED_ASSET_EXTENSIONS)[ManagedAssetExtension]["contentType"];
export type ManagedAssetCategory =
  (typeof MANAGED_ASSET_EXTENSIONS)[ManagedAssetExtension]["category"];
export type ManagedAssetRepresentation =
  (typeof MANAGED_ASSET_EXTENSIONS)[ManagedAssetExtension]["representation"];
type ManagedAssetExtensionEntry =
  (typeof MANAGED_ASSET_EXTENSIONS)[ManagedAssetExtension];
type FontFormatFromEntry<T> = T extends { fontFormat: infer Format }
  ? Format
  : never;
export type ManagedAssetFontFormat = FontFormatFromEntry<ManagedAssetExtensionEntry>;

export const MANAGED_ASSET_CONTENT_TYPES = [
  ...new Set(Object.values(MANAGED_ASSET_EXTENSIONS).map(({ contentType }) => contentType)),
] as readonly ManagedAssetContentType[];

export interface ManagedAssetExtensionClassification {
  extension: ManagedAssetExtension;
  category: ManagedAssetCategory;
  representation: ManagedAssetRepresentation;
  contentType: ManagedAssetContentType;
  fontFormat?: ManagedAssetFontFormat;
}

export function classifyManagedAssetExtension(
  extension: string,
): ManagedAssetExtensionClassification | null {
  const normalized = extension.toLowerCase();

  if (!Object.hasOwn(MANAGED_ASSET_EXTENSIONS, normalized)) return null;

  const classification = MANAGED_ASSET_EXTENSIONS[normalized as ManagedAssetExtension];
  return { extension: normalized as ManagedAssetExtension, ...classification };
}

export function classifyManagedAssetFilename(
  filename: string,
): ManagedAssetExtensionClassification | null {
  const normalized = filename.trim().toLowerCase();
  const dot = normalized.lastIndexOf(".");
  return dot < 0 ? null : classifyManagedAssetExtension(normalized.slice(dot));
}

export function isManagedAssetContentType(
  value: string,
): value is ManagedAssetContentType {
  return MANAGED_ASSET_CONTENT_TYPES.some((contentType) => contentType === value);
}
