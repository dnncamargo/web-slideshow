import type { ManagedAssetContentType } from "../persistence/managed-asset-content-types";

import type {
  CustomLibraryFileKind,
  CustomLibraryFileRepresentation,
} from "./custom-library-file";

interface ClassificationEntry {
  kind: CustomLibraryFileKind;
  representation: CustomLibraryFileRepresentation;
  contentType: ManagedAssetContentType;
}

const CLASSIFICATION_BY_EXTENSION: Readonly<Record<string, ClassificationEntry>> = {
  ".jpg": { kind: "image", representation: "binary", contentType: "image/jpeg" },
  ".jpeg": { kind: "image", representation: "binary", contentType: "image/jpeg" },
  ".png": { kind: "image", representation: "binary", contentType: "image/png" },
  ".webp": { kind: "image", representation: "binary", contentType: "image/webp" },
  ".gif": { kind: "image", representation: "binary", contentType: "image/gif" },
  ".svg": { kind: "image", representation: "text", contentType: "image/svg+xml" },
  ".mp3": { kind: "audio", representation: "binary", contentType: "audio/mpeg" },
  ".wav": { kind: "audio", representation: "binary", contentType: "audio/wav" },
  ".ogg": { kind: "audio", representation: "binary", contentType: "audio/ogg" },
  ".ttf": { kind: "font", representation: "binary", contentType: "font/ttf" },
  ".otf": { kind: "font", representation: "binary", contentType: "font/otf" },
  ".woff": { kind: "font", representation: "binary", contentType: "font/woff" },
  ".woff2": { kind: "font", representation: "binary", contentType: "font/woff2" },
  ".txt": { kind: "text", representation: "text", contentType: "text/plain" },
  ".md": { kind: "markdown", representation: "text", contentType: "text/markdown" },
  ".csv": { kind: "structured-data", representation: "text", contentType: "text/csv" },
  ".json": { kind: "structured-data", representation: "text", contentType: "application/json" },
  ".xml": { kind: "structured-data", representation: "text", contentType: "application/xml" },
};

export const CUSTOM_LIBRARY_FILE_ACCEPT = Object.keys(CLASSIFICATION_BY_EXTENSION).join(",");

export interface CustomLibraryFileClassification extends ClassificationEntry {
  extension: string;
}

export class UnsupportedCustomLibraryFileError extends Error {
  constructor(filename: string) {
    super(`Unsupported Custom Library file extension for "${filename}".`);
    this.name = "UnsupportedCustomLibraryFileError";
  }
}

function getFilenameExtension(filename: string): string {
  const trimmedFilename = filename.trim();
  const trimmedLastDot = trimmedFilename.lastIndexOf(".");
  return trimmedLastDot >= 0 ? trimmedFilename.slice(trimmedLastDot).toLowerCase() : "";
}

export function classifyCustomLibraryFile(file: Pick<File, "name" | "type">): CustomLibraryFileClassification {
  const extension = getFilenameExtension(file.name);
  const classification = CLASSIFICATION_BY_EXTENSION[extension];

  if (!classification) {
    throw new UnsupportedCustomLibraryFileError(file.name);
  }

  return { extension, ...classification };
}
