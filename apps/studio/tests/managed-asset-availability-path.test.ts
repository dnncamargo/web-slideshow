import { describe, expect, it } from "vitest";

import type { FontFaceResource, PresentationFileResource } from "@web-slideshow/document-schema";
import type { CustomLibraryFileRecord } from "../src/features/custom-library/custom-library-file";
import type { CustomLibraryFontFace } from "../src/features/custom-library/custom-library-font";
import {
  customLibraryFileAvailabilityPath,
  managedFontFaceAvailabilityPath,
  presentationFileAvailabilityPath,
} from "../src/features/custom-library/managed-asset-availability-path";

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
  it("accepts an exact managed File association and rejects path or asset identity mismatches", () => {
    expect(customLibraryFileAvailabilityPath(libraryFile())).toBe(storagePath);
    expect(customLibraryFileAvailabilityPath(libraryFile({ storagePath: `users/other/assets/${assetId}.woff2` }))).toBeNull();
    expect(customLibraryFileAvailabilityPath(libraryFile({ downloadUrl: "https://example.test/font.woff2" }))).toBeNull();
    expect(customLibraryFileAvailabilityPath(libraryFile({ assetId: "223e4567-e89b-42d3-a456-426614174000" }))).toBeNull();
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
