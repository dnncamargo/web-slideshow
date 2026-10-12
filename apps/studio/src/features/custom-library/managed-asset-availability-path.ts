import type {
  FontFaceResource,
  PresentationFileResource,
} from "@web-slideshow/document-schema";

import type { CustomLibraryFileRecord } from "./custom-library-file";
import type { CustomLibraryFontFace } from "./custom-library-font";
import { isManagedAssetControlPath } from "../persistence/managed-asset-control-path";
import { managedAssetBlobIdentityFromUrl, type ManagedAssetBlobIdentity } from "../persistence/managed-asset-blob-identity";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_ASSET_LEAF_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\.([a-z0-9]+))?$/i;

function managedAssetIdentityFromBlobUrl(value: string): ManagedAssetBlobIdentity | null {
  const identity = managedAssetBlobIdentityFromUrl(value);
  if (!identity) return null;
  const owner = /^users\/([^/]+)\/assets\//.exec(identity.storagePath)?.[1];
  if (!owner || !isManagedAssetControlPath(owner, identity.storagePath)) return null;
  return identity;
}

function assetLeaf(storagePath: string): string | null {
  const leaf = storagePath.slice(storagePath.lastIndexOf("/") + 1);
  const match = UUID_ASSET_LEAF_PATTERN.exec(leaf);
  return match?.[1] ? match[1].toLowerCase() : null;
}

export function customLibraryFileAvailabilityIdentity(
  record: CustomLibraryFileRecord,
): ManagedAssetBlobIdentity | null {
  const { assetId, storagePath, downloadUrl } = record.file.source;
  const identity = managedAssetIdentityFromBlobUrl(downloadUrl);
  if (!identity || identity.storagePath !== storagePath || assetLeaf(storagePath) !== assetId.toLowerCase()) return null;
  return identity;
}

export function customLibraryFileAvailabilityPath(record: CustomLibraryFileRecord): string | null {
  return customLibraryFileAvailabilityIdentity(record)?.storagePath ?? null;
}

function fontFormatMatchesPath(face: FontFaceResource, storagePath: string): boolean {
  const leaf = storagePath.slice(storagePath.lastIndexOf("/") + 1);
  const extension = /\.([a-z0-9]+)$/i.exec(leaf)?.[1]?.toLowerCase();
  if (!extension) return false;
  const expectedFormat = extension === "ttf" ? "truetype" : extension === "otf" ? "opentype" : extension;
  return face.source.format === expectedFormat;
}

export function managedFontFaceAvailabilityIdentity(
  face: CustomLibraryFontFace | FontFaceResource,
): ManagedAssetBlobIdentity | null {
  const provenance = "provenance" in face ? face.provenance : undefined;
  if (provenance && provenance.kind !== "managed-upload") return null;

  const identity = managedAssetIdentityFromBlobUrl(face.source.url);
  if (!identity || !fontFormatMatchesPath(face, identity.storagePath)) return null;
  const storagePath = identity.storagePath;
  const leaf = storagePath.slice(storagePath.lastIndexOf("/") + 1);
  const match = UUID_ASSET_LEAF_PATTERN.exec(leaf);
  if (!match?.[1]) return null;

  if (provenance?.kind === "managed-upload") {
    if (provenance.assetId.toLowerCase() !== match[1].toLowerCase()) return null;
  } else if (!UUID_PATTERN.test(match[1])) {
    return null;
  }

  return identity;
}

export function managedFontFaceAvailabilityPath(face: CustomLibraryFontFace | FontFaceResource): string | null {
  return managedFontFaceAvailabilityIdentity(face)?.storagePath ?? null;
}

export function presentationFileAvailabilityIdentity(
  file: PresentationFileResource,
): ManagedAssetBlobIdentity | null {
  if (file.representation !== "binary") return null;
  const identity = managedAssetIdentityFromBlobUrl(file.source.url);
  if (!identity || !assetLeaf(identity.storagePath)) return null;
  return identity;
}

export function presentationFileAvailabilityPath(file: PresentationFileResource): string | null {
  return presentationFileAvailabilityIdentity(file)?.storagePath ?? null;
}
