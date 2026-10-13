import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  list: vi.fn(),
  head: vi.fn(),
  getAll: vi.fn(),
  annotations: new Map<string, { storagePath: string; protected: boolean; state: string; displayName?: string }>(),
}));

vi.mock("@vercel/blob", () => ({
  BlobNotFoundError: class BlobNotFoundError extends Error {},
  del: vi.fn(),
  head: state.head,
  list: state.list,
}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: vi.fn(), delete: vi.fn() },
  Timestamp: class Timestamp {},
  getFirestore: () => ({
    doc: (path: string) => ({ path }),
    getAll: state.getAll,
  }),
}));
vi.mock("../src/features/auth/firebase-admin-auth", () => ({
  getFirebaseAdminApp: () => ({}),
  verifyFirebaseIdToken: vi.fn(async () => ({ uid: "owner-1" })),
}));

import { listManagedAssetInventoryPage } from "../src/features/persistence/managed-asset-inventory";
import { validateManagedAssetPath } from "../src/features/persistence/managed-asset-controls";
import { GET as getInventory } from "../src/app/api/managed-assets/inventory/route";
import { GET as getMetadata } from "../src/app/api/managed-assets/metadata/route";

const owner = "owner-1";
const prefix = `users/${owner}/assets/`;
const modernPath = `${prefix}123e4567-e89b-42d3-a456-426614174000.png`;
const extensionlessLegacyPath = `${prefix}arquivo-antigo`;
const legacyWithExtensionPath = `${prefix}arquivo-antigo.png`;
const unknownExtensionPath = `${prefix}223e4567-e89b-42d3-a456-426614174000.xyz`;
const longPath = `${prefix}${"a".repeat(520)}`;

function blob(pathname: string) {
  return {
    pathname,
    url: `https://blob.example/${encodeURIComponent(pathname)}`,
    size: 12,
    uploadedAt: new Date("2026-01-02T03:04:05Z"),
    etag: "provider-etag",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.annotations.clear();
  state.getAll.mockImplementation(async (...refs: Array<{ path: string }>) => refs.map(({ path }) => {
    const value = state.annotations.get(path);
    return { exists: Boolean(value), data: () => value };
  }));
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_mock-store_test-token");
  vi.stubEnv("BLOB_STORE_ID", "mock-store");
});
afterEach(() => vi.unstubAllEnvs());

describe("managed asset inventory annotations integration", () => {
  it("keeps every valid owner Blob and annotates only control-eligible paths in one batch", async () => {
    state.annotations.set(`users/${owner}/managedAssetControls/${modernPath.slice(prefix.length)}`, {
      storagePath: modernPath, protected: false, state: "active", displayName: "Modern named image",
    });
    state.annotations.set(`users/${owner}/managedAssetControls/${extensionlessLegacyPath.slice(prefix.length)}`, {
      storagePath: extensionlessLegacyPath, protected: false, state: "active", displayName: "Legacy named asset",
    });
    state.list.mockResolvedValueOnce({
      blobs: [blob(modernPath), blob(extensionlessLegacyPath), blob(legacyWithExtensionPath), blob(unknownExtensionPath), blob(longPath)],
      hasMore: false,
    });

    const response = await getInventory(new Request("https://studio.example/api/managed-assets/inventory", {
      headers: { Authorization: "Bearer owner-token" },
    }));
    expect(response.status).toBe(200);
    const page = await response.json() as Awaited<ReturnType<typeof listManagedAssetInventoryPage>>;

    expect(page.items.map(({ pathname }) => pathname)).toEqual([
      modernPath, extensionlessLegacyPath, legacyWithExtensionPath, unknownExtensionPath, longPath,
    ]);
    expect(page.items.map(({ displayName }) => displayName)).toEqual([
      "Modern named image", "Legacy named asset", undefined, undefined, undefined,
    ]);
    expect(state.getAll).toHaveBeenCalledTimes(1);
    expect(state.getAll.mock.calls[0]?.map((ref) => ref.path)).toEqual([
      `users/${owner}/managedAssetControls/${modernPath.slice(prefix.length)}`,
      `users/${owner}/managedAssetControls/${extensionlessLegacyPath.slice(prefix.length)}`,
    ]);
    expect(() => validateManagedAssetPath(owner, legacyWithExtensionPath)).toThrow();
    expect(() => validateManagedAssetPath(owner, unknownExtensionPath)).toThrow();
    expect(() => validateManagedAssetPath(owner, longPath)).toThrow();
  });

  it("returns exact focused legacy metadata without trying an ineligible control path", async () => {
    state.head.mockResolvedValueOnce({ pathname: legacyWithExtensionPath, contentType: "image/png", size: 12 });
    state.list.mockResolvedValueOnce({ blobs: [blob(legacyWithExtensionPath)], hasMore: false });

    const response = await getMetadata(new Request(
      `https://studio.example/api/managed-assets/metadata?pathname=${encodeURIComponent(legacyWithExtensionPath)}`,
      { headers: { Authorization: "Bearer owner-token" } },
    ));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ pathname: legacyWithExtensionPath, contentType: "image/png", size: 12 });
    expect(state.getAll).not.toHaveBeenCalled();
  });

  it("keeps eligible annotation read failures explicit even when the batch also has legacy paths", async () => {
    state.list.mockResolvedValueOnce({ blobs: [blob(legacyWithExtensionPath), blob(modernPath)], hasMore: false });
    state.getAll.mockRejectedValueOnce(new Error("Firestore read unavailable"));

    const response = await getInventory(new Request("https://studio.example/api/managed-assets/inventory", {
      headers: { Authorization: "Bearer owner-token" },
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "annotations_unavailable" });
    expect(state.getAll).toHaveBeenCalledTimes(1);
    expect(state.getAll.mock.calls[0]?.map((ref) => ref.path)).toEqual([
      `users/${owner}/managedAssetControls/${modernPath.slice(prefix.length)}`,
    ]);
  });
});
