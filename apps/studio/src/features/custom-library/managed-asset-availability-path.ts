import type {
  FontFaceResource,
  PresentationFileResource,
} from "@web-slideshow/document-schema";

import type { CustomLibraryFileRecord } from "./custom-library-file";
import type { CustomLibraryFontFace } from "./custom-library-font";
import { isManagedAssetControlPath } from "../persistence/managed-asset-control-path";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_ASSET_LEAF_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\.([a-z0-9]+))?$/i;

function pathFromManagedBlobUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password
      || !url.hostname.toLowerCase().endsWith(".public.blob.vercel-storage.com")) return null;
    const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const owner = /^users\/([^/]+)\/assets\//.exec(pathname)?.[1];
    if (!owner || !isManagedAssetControlPath(owner, pathname)) return null;
    return pathname;
  } catch {
    return null;
  }
}

function assetLeaf(storagePath: string): string | null {
  const leaf = storagePath.slice(storagePath.lastIndexOf("/") + 1);
  const match = UUID_ASSET_LEAF_PATTERN.exec(leaf);
  return match?.[1] ? match[1].toLowerCase() : null;
}

export function customLibraryFileAvailabilityPath(
  record: CustomLibraryFileRecord,
): string | null {
  const { assetId, storagePath, downloadUrl } = record.file.source;
  const pathFromUrl = pathFromManagedBlobUrl(downloadUrl);
  if (!pathFromUrl || pathFromUrl !== storagePath || assetLeaf(storagePath) !== assetId.toLowerCase()) return null;
  return storagePath;
}

function fontFormatMatchesPath(face: FontFaceResource, storagePath: string): boolean {
  const leaf = storagePath.slice(storagePath.lastIndexOf("/") + 1);
  const extension = /\.([a-z0-9]+)$/i.exec(leaf)?.[1]?.toLowerCase();
  if (!extension) return false;
  const expectedFormat = extension === "ttf" ? "truetype" : extension === "otf" ? "opentype" : extension;
  return face.source.format === expectedFormat;
}

export function managedFontFaceAvailabilityPath(
  face: CustomLibraryFontFace | FontFaceResource,
): string | null {
  const provenance = "provenance" in face ? face.provenance : undefined;
  if (provenance && provenance.kind !== "managed-upload") return null;

  const storagePath = pathFromManagedBlobUrl(face.source.url);
  if (!storagePath || !fontFormatMatchesPath(face, storagePath)) return null;
  const leaf = storagePath.slice(storagePath.lastIndexOf("/") + 1);
  const match = UUID_ASSET_LEAF_PATTERN.exec(leaf);
  if (!match?.[1]) return null;

  if (provenance?.kind === "managed-upload") {
    if (provenance.assetId.toLowerCase() !== match[1].toLowerCase()) return null;
  } else if (!UUID_PATTERN.test(match[1])) {
    return null;
  }

  return storagePath;
}

export function presentationFileAvailabilityPath(
  file: PresentationFileResource,
): string | null {
  if (file.representation !== "binary") return null;
  const storagePath = pathFromManagedBlobUrl(file.source.url);
  if (!storagePath || !assetLeaf(storagePath)) return null;
  return storagePath;
}
