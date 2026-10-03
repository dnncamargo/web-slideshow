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
