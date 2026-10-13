"use client";

import type { CustomLibraryFileRecord } from "../custom-library/custom-library-file";
import { classifyCustomLibraryFile } from "../custom-library/custom-library-file-classification";
import { parseCustomLibraryFileDraft } from "../custom-library/custom-library-file-schema";
import { getCurrentNonAnonymousUser } from "../auth/firebase-auth";
import { managedAssetBlobIdentityFromUrl } from "./managed-asset-blob-identity";

const ASSET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CURSOR_LENGTH = 4096;

function validCursor(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_CURSOR_LENGTH && !/[\x00-\x1f\x7f]/.test(value);
}

function parsePage(value: unknown, uid: string): { records: CustomLibraryFileRecord[]; hasMore: boolean; cursor?: string } {
  if (typeof value !== "object" || value === null) throw new Error("Invalid managed asset file list.");
  const page = value as Record<string, unknown>;
  if (page.scope !== "owner" || !Array.isArray(page.records) || typeof page.hasMore !== "boolean") {
    throw new Error("Invalid managed asset file list.");
  }
  const records = page.records.map((raw): CustomLibraryFileRecord => {
    if (typeof raw !== "object" || raw === null) throw new Error("Invalid managed asset file record.");
    const record = raw as Record<string, unknown>;
    if (typeof record.id !== "string" || !ASSET_ID_PATTERN.test(record.id)) throw new Error("Invalid managed asset file identity.");
    const file = parseCustomLibraryFileDraft(record.file);
    const classification = classifyCustomLibraryFile({ name: file.name, type: file.source.contentType });
    const identity = managedAssetBlobIdentityFromUrl(file.source.downloadUrl);
    if (
      file.source.assetId !== record.id ||
      file.source.storagePath !== `users/${uid}/assets/${record.id}${classification.extension}` ||
      identity?.storagePath !== file.source.storagePath
    ) throw new Error("Invalid managed asset file identity.");
    return { id: record.id, file };
  });
  if (page.hasMore) {
    if (!validCursor(page.cursor)) throw new Error("Invalid managed asset file cursor.");
    return { records, hasMore: true, cursor: page.cursor };
  }
  if (page.cursor !== undefined) throw new Error("Invalid managed asset file cursor.");
  return { records, hasMore: false };
}

export async function listManagedAssetLibraryFiles(): Promise<CustomLibraryFileRecord[]> {
  const user = getCurrentNonAnonymousUser();
  if (!user || user.isAnonymous) throw new Error("Authentication is unavailable.");
  const idToken = await user.getIdToken();
  const records: CustomLibraryFileRecord[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | null = null;

  while (true) {
    const queryParameters = new URLSearchParams();
    if (cursor !== null) queryParameters.set("cursor", cursor);
    const serializedQuery = queryParameters.toString();
    const query = serializedQuery ? `?${serializedQuery}` : "";
    const response = await fetch(`/api/managed-assets/library-files${query}`, {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Managed asset file list is unavailable.");
    const page = parsePage(await response.json(), user.uid);
    for (const record of page.records) {
      if (ids.has(record.id) || paths.has(record.file.source.storagePath)) throw new Error("Repeated managed asset file.");
      ids.add(record.id);
      paths.add(record.file.source.storagePath);
      records.push(record);
    }
    if (!page.hasMore) return records;
    if (!page.cursor || cursors.has(page.cursor) || page.cursor === cursor) throw new Error("Repeated managed asset cursor.");
    cursors.add(page.cursor);
    cursor = page.cursor;
  }
}
