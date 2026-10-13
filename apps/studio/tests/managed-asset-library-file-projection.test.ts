import { describe, expect, it } from "vitest";

import type { ManagedAssetInventoryItem } from "../src/features/persistence/managed-asset-inventory";
import type { ManagedAssetIntent, ManagedAssetIntentRecord } from "../src/features/persistence/managed-asset-intents";
import {
  preserveManagedAssetLibraryFileRecords,
  projectManagedAssetLibraryFiles,
} from "../src/features/persistence/managed-asset-library-file-projection";

const uid = "owner-1";
const storeId = "Mixed-Store";
const assetId = "123e4567-e89b-42d3-a456-426614174000";
const storagePath = `users/${uid}/assets/${assetId}.txt`;
const downloadUrl = `https://${storeId}.public.blob.vercel-storage.com/${storagePath}`;

function physical(overrides: Partial<ManagedAssetInventoryItem> = {}): ManagedAssetInventoryItem {
  return {
    pathname: storagePath,
    url: downloadUrl,
    size: 12,
    uploadedAt: "2026-10-12T00:00:00.000Z",
    etag: "verified-etag",
    ...overrides,
  };
}

function intent(overrides: Partial<ManagedAssetIntent> = {}): ManagedAssetIntent {
  return {
    assetId,
    originalFilename: "notes.txt",
    extension: ".txt",
    contentType: "text/plain",
    expectedSizeBytes: 12,
    sourceLastModified: 1,
    storagePath,
    state: "complete",
    downloadUrl,
    sizeBytes: 12,
    etag: "verified-etag",
    ...overrides,
  };
}

function intentRecord(overrides: Partial<ManagedAssetIntent> = {}, id = assetId): ManagedAssetIntentRecord {
  return { id, intent: intent(overrides) };
}

describe("managed asset Custom Library file projection", () => {
  it("lists an existing Blob with a completed matching intent even when customLibraryFiles is empty", () => {
    const records = projectManagedAssetLibraryFiles(uid, storeId, [physical()], [intentRecord()]);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: assetId,
      file: {
        name: "notes.txt",
        representation: "text",
        source: { assetId, storagePath, downloadUrl, sizeBytes: 12 },
      },
    });
  });

  it("excludes a physical object without an eligible managedAssets intent", () => {
    expect(projectManagedAssetLibraryFiles(uid, storeId, [physical()], [])).toEqual([]);
    expect(projectManagedAssetLibraryFiles(uid, storeId, [physical()], [intentRecord({ state: "pending" })])).toEqual([]);
    expect(projectManagedAssetLibraryFiles(uid, storeId, [physical()], [intentRecord({ state: "uploading" })])).toEqual([]);
    expect(projectManagedAssetLibraryFiles(uid, storeId, [physical()], [intentRecord({ state: "uncertain" })])).toEqual([]);
  });

  it("excludes a completed Firestore intent when its exact physical Blob is absent", () => {
    expect(projectManagedAssetLibraryFiles(uid, storeId, [], [intentRecord()])).toEqual([]);
  });

  it("requires exact owner path, URL host and path, size, and ETag agreement", () => {
    expect(projectManagedAssetLibraryFiles(uid, storeId, [physical({ pathname: `users/other/assets/${assetId}.txt` })], [intentRecord()])).toEqual([]);
    expect(projectManagedAssetLibraryFiles(uid, storeId, [physical({ size: 13 })], [intentRecord()])).toEqual([]);
    expect(projectManagedAssetLibraryFiles(uid, storeId, [physical({ etag: "different-etag" })], [intentRecord()])).toEqual([]);
    expect(projectManagedAssetLibraryFiles(uid, storeId, [physical({ url: downloadUrl.replace(storeId, "other-store") })], [intentRecord()])).toEqual([]);
  });

  it("uses the exact Store-scoped inventory while accepting DNS-normalized hostname casing", () => {
    const dnsNormalizedUrl = downloadUrl.replace(storeId, storeId.toLowerCase());
    const records = projectManagedAssetLibraryFiles(
      uid,
      storeId,
      [physical({ url: dnsNormalizedUrl })],
      [intentRecord({ downloadUrl: dnsNormalizedUrl })],
    );

    expect(records).toHaveLength(1);
    expect(records[0]?.file.source.downloadUrl).toBe(dnsNormalizedUrl);
  });

  it("rejects Store mismatches and malformed upload metadata", () => {
    expect(projectManagedAssetLibraryFiles(uid, storeId, [physical()], [intentRecord({ downloadUrl: downloadUrl.replace(storeId, "other-store") })])).toEqual([]);
    expect(projectManagedAssetLibraryFiles(uid, storeId, [physical()], [intentRecord({ contentType: "application/json" })])).toEqual([]);
    expect(projectManagedAssetLibraryFiles(uid, storeId, [physical()], [intentRecord({ storagePath: `users/${uid}/assets/${assetId}.json` })])).toEqual([]);
  });

  it("deduplicates repeated physical rows and preserves a matching legacy record ID and name", () => {
    const projected = projectManagedAssetLibraryFiles(uid, storeId, [physical(), physical()], [intentRecord()]);
    expect(projected).toHaveLength(1);
    const preserved = preserveManagedAssetLibraryFileRecords(projected, [{
      ...projected[0]!,
      id: "legacy-stable-id",
      file: { ...projected[0]!.file, name: "Renamed notes.txt" },
    }]);
    expect(preserved).toMatchObject([{ id: "legacy-stable-id", file: { name: "Renamed notes.txt", source: { downloadUrl } } }]);
  });

  it("uses the stable asset identity when persisted metadata is duplicated or belongs to another Store", () => {
    const projected = projectManagedAssetLibraryFiles(uid, storeId, [physical()], [intentRecord()]);
    const otherStore = { ...projected[0]!, id: "foreign-id", file: { ...projected[0]!.file, source: { ...projected[0]!.file.source, downloadUrl: downloadUrl.replace(storeId, "other-store") } } };
    expect(preserveManagedAssetLibraryFileRecords(projected, [otherStore])[0]?.id).toBe(assetId);
    expect(preserveManagedAssetLibraryFileRecords(projected, [projected[0]!, otherStore])[0]?.id).toBe(assetId);
  });

  it("rejects an intent whose document ID does not match its asset ID", () => {
    expect(projectManagedAssetLibraryFiles(uid, storeId, [physical()], [intentRecord({}, "223e4567-e89b-42d3-a456-426614174000")])).toEqual([]);
  });
});
