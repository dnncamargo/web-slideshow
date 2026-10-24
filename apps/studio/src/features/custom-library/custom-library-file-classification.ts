import {
  MANAGED_ASSET_EXTENSIONS,
  classifyManagedAssetFilename,
  type ManagedAssetContentType,
} from "../persistence/managed-asset-content-types";

import type {
  CustomLibraryFileKind,
  CustomLibraryFileRepresentation,
} from "./custom-library-file";

const INSTALLABLE_FONT_EXTENSIONS = new Set([".ttf", ".otf", ".woff", ".woff2"]);

export const CUSTOM_LIBRARY_FILE_ACCEPT = Object.keys(MANAGED_ASSET_EXTENSIONS)
  .filter((extension) => !INSTALLABLE_FONT_EXTENSIONS.has(extension))
  .join(",");

export interface SupportedFileNameClassification {
  extension: string;
  kind: CustomLibraryFileKind;
  representation: CustomLibraryFileRepresentation;
  contentType: ManagedAssetContentType;
}

export type CustomLibraryFileClassification = SupportedFileNameClassification;

export class UnsupportedCustomLibraryFileError extends Error {
  constructor(filename: string) {
    super(`Unsupported Custom Library file extension for "${filename}".`);
    this.name = "UnsupportedCustomLibraryFileError";
  }
}

export function classifySupportedFileName(
  filename: string,
): SupportedFileNameClassification | null {
  const classification = classifyManagedAssetFilename(filename);
  if (classification === null) return null;

  return {
    extension: classification.extension,
    kind: classification.category,
    representation: classification.representation,
    contentType: classification.contentType,
  };
}

export function classifyCustomLibraryFile(
  file: Pick<File, "name" | "type">,
): CustomLibraryFileClassification {
  const classification = classifySupportedFileName(file.name);

  if (classification === null) {
    throw new UnsupportedCustomLibraryFileError(file.name);
  }

  return classification;
}

/** Classifies new generic uploads while reserving installable font uploads for Fonts. */
export function classifyCustomLibraryFileUpload(
  file: Pick<File, "name" | "type">,
): CustomLibraryFileClassification {
  const classification = classifyCustomLibraryFile(file);
  if (classification.kind === "font") {
    throw new UnsupportedCustomLibraryFileError(file.name);
  }
  return classification;
}
