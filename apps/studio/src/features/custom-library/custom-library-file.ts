import type { ManagedAssetContentType } from "../persistence/managed-asset-content-types";

export const CUSTOM_LIBRARY_FILE_KINDS = [
  "image",
  "audio",
  "font",
  "text",
  "markdown",
  "structured-data",
] as const;

export type CustomLibraryFileKind = (typeof CUSTOM_LIBRARY_FILE_KINDS)[number];

export const CUSTOM_LIBRARY_FILE_REPRESENTATIONS = ["binary", "text"] as const;

export type CustomLibraryFileRepresentation =
  (typeof CUSTOM_LIBRARY_FILE_REPRESENTATIONS)[number];

export interface CustomLibraryFileSource {
  assetId: string;
  storagePath: string;
  downloadUrl: string;
  contentType: ManagedAssetContentType;
  sizeBytes: number;
}

export interface CustomLibraryFileDraft {
  name: string;
  kind: CustomLibraryFileKind;
  representation: CustomLibraryFileRepresentation;
  source: CustomLibraryFileSource;
}

export interface CustomLibraryFileRecord {
  id: string;
  file: CustomLibraryFileDraft;
}

export function formatCustomLibraryFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;

  const units = ["KB", "MB", "GB"] as const;
  let size = sizeBytes;
  let unitIndex = -1;

  do {
    size /= 1024;
    unitIndex += 1;
  } while (size >= 1024 && unitIndex < units.length - 1);

  return `${size.toFixed(size >= 10 || Number.isInteger(size) ? 0 : 1)} ${units[unitIndex]}`;
}
