import type { CustomLibraryFileRecord } from "../custom-library/custom-library-file";
import { classifyCustomLibraryFile } from "../custom-library/custom-library-file-classification";
import { parseCustomLibraryFileDraft } from "../custom-library/custom-library-file-schema";
import { isManagedAssetControlPath } from "./managed-asset-control-path";
import { managedAssetBlobIdentityFromUrl } from "./managed-asset-blob-identity";
import type { ManagedAssetInventoryItem } from "./managed-asset-inventory";
import type { ManagedAssetIntentRecord } from "./managed-asset-intents";

const ASSET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ETAG_PATTERN = /^[^\s\u0000-\u001f\u007f]{1,512}$/;

/** Projects only completed, physically listed managed assets into file-library records. */
export function projectManagedAssetLibraryFiles(
  uid: string,
  storeId: string,
  physicalItems: readonly ManagedAssetInventoryItem[],
  intentRecords: readonly ManagedAssetIntentRecord[],
): CustomLibraryFileRecord[] {
  const intentsByPath = new Map<string, ManagedAssetIntentRecord[]>();
  for (const record of intentRecords) {
    const { intent } = record;
    if (intent.assetId !== record.id) continue;
    if (intent.state !== "complete") continue;
    if (typeof intent.storagePath !== "string") {
      continue;
    }
    const matching = intentsByPath.get(intent.storagePath) ?? [];
    matching.push(record);
    intentsByPath.set(intent.storagePath, matching);
  }

  const physicalByPath = new Map<string, ManagedAssetInventoryItem>();
  for (const item of physicalItems) {
    if (physicalByPath.has(item.pathname)) {
      continue;
    }
    if (!matchesStoreScopedBlobUrl(item.url, storeId, item.pathname)) continue;
    physicalByPath.set(item.pathname, item);
  }

  const result: CustomLibraryFileRecord[] = [];
  const seenAssetIds = new Set<string>();
  for (const [storagePath, matchingRecords] of intentsByPath) {
    if (matchingRecords.length !== 1) {
      continue;
    }
    const intent = matchingRecords[0]?.intent;
    const physical = physicalByPath.get(storagePath);
    if (!intent) continue;
    if (!physical) continue;
    if (!ASSET_ID_PATTERN.test(intent.assetId)) continue;
    if (!isManagedAssetControlPath(uid, storagePath)) continue;

    let classification: ReturnType<typeof classifyCustomLibraryFile>;
    try {
      classification = classifyCustomLibraryFile({ name: intent.originalFilename, type: intent.contentType });
    } catch {
      continue;
    }
    const expectedPath = `users/${uid}/assets/${intent.assetId}${classification.extension}`;
    if (
      intent.storagePath !== expectedPath || intent.extension !== classification.extension ||
      intent.contentType !== classification.contentType || intent.expectedSizeBytes !== physical.size ||
      intent.sizeBytes !== physical.size || typeof intent.etag !== "string" || !ETAG_PATTERN.test(intent.etag) ||
      physical.etag !== intent.etag
    ) {
      continue;
    }
    if (
      typeof intent.downloadUrl !== "string" ||
      !matchesStoreScopedBlobUrl(intent.downloadUrl, storeId, storagePath) ||
      !matchesStoreScopedBlobUrl(physical.url, storeId, storagePath)
    ) {
      continue;
    }
    if (seenAssetIds.has(intent.assetId)) continue;

    try {
      const file = parseCustomLibraryFileDraft({
        name: intent.originalFilename.trim(),
        kind: classification.kind,
        representation: classification.representation,
        source: {
          assetId: intent.assetId,
          storagePath,
          downloadUrl: physical.url,
          contentType: classification.contentType,
          sizeBytes: physical.size,
        },
      });
      result.push({ id: intent.assetId, file });
      seenAssetIds.add(intent.assetId);
    } catch {
      // Malformed legacy intent data is not eligible for a selectable file row.
    }
  }

  return result;
}

/**
 * Blob inventory is requested with the exact provider Store ID. The URL host is
 * only DNS metadata, whose casing is normalized by URL implementations; it is
 * not used to establish provider Store identity.
 */
function matchesStoreScopedBlobUrl(value: string, storeId: string, storagePath: string): boolean {
  const identity = managedAssetBlobIdentityFromUrl(value);
  return identity !== null && identity.storagePath === storagePath &&
    identity.storeId.toLowerCase() === storeId.toLowerCase();
}

/** Keeps valid legacy metadata and stable Firestore IDs only for projected live assets. */
export function preserveManagedAssetLibraryFileRecords(
  projected: readonly CustomLibraryFileRecord[],
  persisted: readonly CustomLibraryFileRecord[],
): CustomLibraryFileRecord[] {
  return projected.map((record) => {
    const matches = persisted.filter((candidate) =>
      candidate.file.source.assetId === record.file.source.assetId &&
      candidate.file.source.storagePath === record.file.source.storagePath &&
      candidate.file.source.contentType === record.file.source.contentType &&
      managedAssetBlobIdentityFromUrl(candidate.file.source.downloadUrl)?.storeId ===
        managedAssetBlobIdentityFromUrl(record.file.source.downloadUrl)?.storeId &&
      managedAssetBlobIdentityFromUrl(candidate.file.source.downloadUrl)?.storagePath === record.file.source.storagePath,
    );
    if (matches.length !== 1) return record;
    const [existing] = matches;
    if (!existing) return record;
    return {
      ...record,
      id: existing.id,
      file: { ...record.file, name: existing.file.name },
    };
  });
}
