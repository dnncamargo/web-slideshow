import { describe, expect, it } from "vitest";

import type { FontFaceResource, PresentationFileResource } from "@web-slideshow/document-schema";
import type { CustomLibraryFileRecord } from "../src/features/custom-library/custom-library-file";
import type { CustomLibraryFontFace } from "../src/features/custom-library/custom-library-font";
import {
  customLibraryFileAvailabilityIdentity,
  customLibraryFileAvailabilityPath,
  managedFontFaceAvailabilityIdentity,
  managedFontFaceAvailabilityPath,
  presentationFileAvailabilityPath,
} from "../src/features/custom-library/managed-asset-availability-path";
import {
  configuredManagedAssetStoreId,
  managedAssetBlobIdentityFromUrl,
  normalizeManagedAssetStoreId,
} from "../src/features/persistence/managed-asset-blob-identity";

const uid = "owner-1";
const assetId = "123e4567-e89b-42d3-a456-426614174000";
const storagePath = `users/${uid}/assets/${assetId}.woff2`;
const blobUrl = `https://store.public.blob.vercel-storage.com/${storagePath}`;

function libraryFile(overrides: Partial<CustomLibraryFileRecord["file"]["source"]> = {}): CustomLibraryFileRecord {
  return {
    id: assetId,
    file: {
      name: "Inter",
      kind: "font",
      representation: "binary",
      source: { assetId, storagePath, downloadUrl: blobUrl, contentType: "font/woff2", sizeBytes: 10, ...overrides },
    },
  };
}

function fontFace(url = blobUrl, overrides: Partial<CustomLibraryFontFace> = {}): CustomLibraryFontFace {
  return {
    weight: 400,
    style: "normal",
    source: { type: "url", url, format: "woff2" },
    provenance: { kind: "managed-upload", assetId },
    ...overrides,
  };
}

describe("managed asset availability identity", () => {
  it("only trusts the configured Store when the read/write token selects the same Store", () => {
    expect(configuredManagedAssetStoreId("store_store-a", "vercel_blob_rw_store-a_secret")).toBe("store-a");
    expect(configuredManagedAssetStoreId("store-a", "vercel_blob_rw_store-b_secret")).toBeNull();
    expect(configuredManagedAssetStoreId("store-a", "malformed-token")).toBeNull();
    expect(configuredManagedAssetStoreId("store-a", undefined)).toBe("store-a");
  });

  it("preserves provider Store ID case and strips only the SDK's optional prefix", () => {
    expect(normalizeManagedAssetStoreId("store_lower-store")).toBe("lower-store");
    expect(normalizeManagedAssetStoreId("Mixed-Store")).toBe("Mixed-Store");
    expect(normalizeManagedAssetStoreId("store_Mixed-Store")).toBe("Mixed-Store");
    expect(configuredManagedAssetStoreId("store_Mixed-Store", "vercel_blob_rw_Mixed-Store_secret")).toBe("Mixed-Store");
    expect(configuredManagedAssetStoreId("store_Mixed-Store", "vercel_blob_rw_mixed-store_secret")).toBeNull();
  });

  it("preserves the raw Blob hostname label because URL.hostname lowercases DNS names", () => {
    const mixedCaseUrl = `https://Mixed-Store.public.blob.vercel-storage.com/${storagePath}`;
    expect(new URL(mixedCaseUrl).hostname).toBe("mixed-store.public.blob.vercel-storage.com");
    expect(managedAssetBlobIdentityFromUrl(mixedCaseUrl)).toEqual({ storeId: "Mixed-Store", storagePath });
    expect(managedAssetBlobIdentityFromUrl(`https://store.public.blob.vercel-storage.com/${storagePath}`)).toEqual({
      storeId: "store",
      storagePath,
    });
    expect(managedAssetBlobIdentityFromUrl(`https://a.b.public.blob.vercel-storage.com/${storagePath}`)).toBeNull();
    expect(managedAssetBlobIdentityFromUrl(`https://store_Mixed-Store.public.blob.vercel-storage.com/${storagePath}`)).toBeNull();
  });

  it("accepts an exact managed File association and rejects path or asset identity mismatches", () => {
    expect(customLibraryFileAvailabilityPath(libraryFile())).toBe(storagePath);
    expect(customLibraryFileAvailabilityPath(libraryFile({ storagePath: `users/other/assets/${assetId}.woff2` }))).toBeNull();
    expect(customLibraryFileAvailabilityPath(libraryFile({ downloadUrl: "https://example.test/font.woff2" }))).toBeNull();
    expect(customLibraryFileAvailabilityPath(libraryFile({ assetId: "223e4567-e89b-42d3-a456-426614174000" }))).toBeNull();
  });

  it("keeps Store identity distinct when two Blob hosts use the same pathname", () => {
    const storeA = customLibraryFileAvailabilityIdentity(libraryFile({
      downloadUrl: `https://store-a.public.blob.vercel-storage.com/${storagePath}`,
    }));
    const storeB = customLibraryFileAvailabilityIdentity(libraryFile({
      downloadUrl: `https://store-b.public.blob.vercel-storage.com/${storagePath}`,
    }));
    expect(storeA).toEqual({ storeId: "store-a", storagePath });
    expect(storeB).toEqual({ storeId: "store-b", storagePath });
    expect(storeA).not.toEqual(storeB);
  });

  it("recognizes a managed font face only when its URL, format, and provenance agree", () => {
    expect(managedFontFaceAvailabilityPath(fontFace())).toBe(storagePath);
    expect(managedFontFaceAvailabilityPath(fontFace(blobUrl, {
      provenance: { kind: "managed-upload", assetId: "223e4567-e89b-42d3-a456-426614174000" },
    }))).toBeNull();
    expect(managedFontFaceAvailabilityPath(fontFace(blobUrl, {
      provenance: { kind: "external-url" },
    }))).toBeNull();
    expect(managedFontFaceAvailabilityPath(fontFace(blobUrl, {
      source: { type: "url", url: blobUrl, format: "woff" },
    }))).toBeNull();
  });

  it("recognizes a safe legacy managed face and leaves ambiguous identities unverified", () => {
    const legacyFace: FontFaceResource = {
      source: { type: "url", url: blobUrl, format: "woff2" },
    };
    expect(managedFontFaceAvailabilityPath(legacyFace)).toBe(storagePath);
    expect(managedFontFaceAvailabilityPath({
      source: { type: "url", url: `https://store.public.blob.vercel-storage.com/users/${uid}/assets/legacy-font`, format: "woff2" },
    })).toBeNull();
    expect(managedFontFaceAvailabilityPath({
      source: { type: "url", url: "https://fonts.example.test/font.woff2", format: "woff2" },
    })).toBeNull();
    expect(managedFontFaceAvailabilityIdentity({
      source: { type: "url", url: "https://a.b.public.blob.vercel-storage.com/users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.woff2", format: "woff2" },
    })).toBeNull();
  });

  it("preserves external Font provenance even when its Blob pathname collides", () => {
    const external = fontFace(`https://store-a.public.blob.vercel-storage.com/${storagePath}`, {
      provenance: { kind: "external-url" },
    });
    expect(managedFontFaceAvailabilityIdentity(external)).toBeNull();
  });

  it("checks only binary managed Presentation Files, never embedded text content", () => {
    const binary: PresentationFileResource = {
      id: "file-image", name: "Image", kind: "image", representation: "binary", contentType: "image/png",
      source: { type: "url", url: `https://store.public.blob.vercel-storage.com/users/${uid}/assets/${assetId}.png` },
    };
    const text: PresentationFileResource = {
      id: "file-text", name: "Text", kind: "text", representation: "text", contentType: "text/plain",
      source: { type: "text", content: "embedded" },
    };
    expect(presentationFileAvailabilityPath(binary)).toBe(`users/${uid}/assets/${assetId}.png`);
    expect(presentationFileAvailabilityPath(text)).toBeNull();
    expect(presentationFileAvailabilityPath({ ...binary, source: { type: "url", url: "https://example.test/image.png" } })).toBeNull();
  });
});
