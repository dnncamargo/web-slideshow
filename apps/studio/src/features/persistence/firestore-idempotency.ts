import { FirestoreOperationError } from "./persistence-errors";

const ASSET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface StablePersistenceOptions {
  documentId?: string;
}

export function assertStableAssetDocumentId(documentId: string): void {
  if (!ASSET_ID_PATTERN.test(documentId)) {
    throw new FirestoreOperationError("Stable persistence identity is invalid.");
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function canonicalValuesEqual(first: unknown, second: unknown): boolean {
  return JSON.stringify(canonicalize(first)) === JSON.stringify(canonicalize(second));
}
