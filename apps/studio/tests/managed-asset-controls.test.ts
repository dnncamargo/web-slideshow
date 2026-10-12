import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  documents: new Map<string, Record<string, unknown>>(),
  head: vi.fn(),
  del: vi.fn(),
  hasPhysical: true,
  sentinels: {
    serverTimestamp: { kind: "serverTimestamp" },
    delete: { kind: "delete" },
  },
  firestore: null as unknown,
}));

function snapshot(path: string) {
  const value = state.documents.get(path);
  return {
    id: path.split("/").at(-1),
    ref: documentRef(path),
    exists: Boolean(value),
    data: () => value ? { ...value } : undefined,
    get: (field: string) => value?.[field],
  };
}

function documentRef(path: string) {
  return {
    path,
    id: path.split("/").at(-1) ?? "",
    async get() { return snapshot(path); },
    collection(name: string) { return collectionRef(`${path}/${name}`); },
  };
}

function collectionRef(path: string, filters: Array<[string, unknown]> = []) {
  return {
    path,
    doc(id?: string) { return documentRef(`${path}/${id ?? "generated-id"}`); },
    where(field: string, _operator: string, value: unknown) { return collectionRef(path, [...filters, [field, value]]); },
    async get() { return querySnapshot(path, filters); },
  };
}

function querySnapshot(path: string, filters: Array<[string, unknown]>) {
  const prefix = `${path}/`;
  const docs = [...state.documents.entries()]
    .filter(([key, value]) => {
      if (!key.startsWith(prefix) || key.slice(prefix.length).includes("/")) return false;
      return filters.every(([field, expected]) => {
        const actual = field.split(".").reduce<unknown>((current, keyPart) => current && typeof current === "object"
          ? (current as Record<string, unknown>)[keyPart] : undefined, value);
        return actual === expected;
      });
    })
    .map(([key]) => snapshot(key));
  return { docs, empty: docs.length === 0, size: docs.length };
}

function createFirestore() {
  return {
    doc: documentRef,
    collection: collectionRef,
    async runTransaction<T>(callback: (transaction: {
      get: (reference: ReturnType<typeof documentRef> | ReturnType<typeof collectionRef>) => Promise<ReturnType<typeof snapshot> | ReturnType<typeof querySnapshot>>;
      set: (reference: ReturnType<typeof documentRef>, value: Record<string, unknown>) => void;
      create: (reference: ReturnType<typeof documentRef>, value: Record<string, unknown>) => void;
      update: (reference: ReturnType<typeof documentRef>, value: Record<string, unknown>) => void;
      delete: (reference: ReturnType<typeof documentRef>) => void;
    }) => Promise<T>) {
      const writes: Array<() => void> = [];
      const transaction = {
        get: async (reference: ReturnType<typeof documentRef> | ReturnType<typeof collectionRef>) => "id" in reference
          ? reference.get() : reference.get(),
        set: (reference: ReturnType<typeof documentRef>, value: Record<string, unknown>) => writes.push(() => {
          state.documents.set(reference.path, applyValues(state.documents.get(reference.path) ?? {}, value));
        }),
        create: (reference: ReturnType<typeof documentRef>, value: Record<string, unknown>) => writes.push(() => {
          if (state.documents.has(reference.path)) throw new Error("already exists");
          state.documents.set(reference.path, applyValues({}, value));
        }),
        update: (reference: ReturnType<typeof documentRef>, value: Record<string, unknown>) => writes.push(() => {
          const prior = state.documents.get(reference.path);
          if (!prior) throw new Error("missing document");
          state.documents.set(reference.path, applyValues(prior, value));
        }),
        delete: (reference: ReturnType<typeof documentRef>) => writes.push(() => { state.documents.delete(reference.path); }),
      };
      const result = await callback(transaction);
      writes.forEach((write) => write());
      return result;
    },
  };
}

function applyValues(prior: Record<string, unknown>, values: Record<string, unknown>) {
  const result = { ...prior };
  for (const [key, value] of Object.entries(values)) {
    if (value === state.sentinels.delete) delete result[key];
    else result[key] = value;
  }
  return result;
}

state.firestore = createFirestore();

vi.mock("@vercel/blob", async (importOriginal) => {
  const original = await importOriginal<typeof import("@vercel/blob")>();
  return { ...original, head: state.head, del: state.del };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => state.sentinels.serverTimestamp,
    delete: () => state.sentinels.delete,
  },
  Timestamp: class MockTimestamp {
    constructor(private readonly value: number) {}
    toMillis() { return this.value; }
    static fromMillis(value: number) { return new MockTimestamp(value); }
  },
  getFirestore: () => state.firestore,
}));
vi.mock("../src/features/auth/firebase-admin-auth", () => ({ getFirebaseAdminApp: () => ({}) }));
vi.mock("../src/features/custom-library/custom-library-font-schema", () => ({
  parseCustomLibraryFontDraft: (value: unknown) => value,
}));

import { BlobNotFoundError } from "@vercel/blob";
import { Timestamp } from "firebase-admin/firestore";
import {
  deleteManagedAsset,
  ManagedAssetControlError,
  readManagedAssetControl,
  setManagedAssetProtection,
  validateManagedAssetPath,
} from "../src/features/persistence/managed-asset-controls";

const owner = "owner-1";
const path = `users/${owner}/assets/123e4567-e89b-42d3-a456-426614174000.png`;
const physical = { pathname: path, url: `https://fixture.public.blob.vercel-storage.com/${path}`, contentType: "image/png", size: 8, etag: "provider-etag" };

beforeEach(() => {
  state.documents.clear();
  vi.clearAllMocks();
  state.hasPhysical = true;
  process.env.BLOB_STORE_ID = "test-store";
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  state.head.mockImplementation(async () => {
    if (!state.hasPhysical) throw new BlobNotFoundError();
    return physical;
  });
  state.del.mockImplementation(async () => { state.hasPhysical = false; });
});

describe("managed asset controls", () => {
  it("accepts exact owner paths for modern UUID and legacy extensionless objects", () => {
    expect(validateManagedAssetPath(owner, path)).toBe("123e4567-e89b-42d3-a456-426614174000.png");
    expect(validateManagedAssetPath(owner, `users/${owner}/assets/legacy-object`)).toBe("legacy-object");
    expect(() => validateManagedAssetPath("another-owner", path)).toThrowError(ManagedAssetControlError);
    expect(() => validateManagedAssetPath(owner, `users/${owner}/assets/not-a-uuid.png`)).toThrowError(ManagedAssetControlError);
    expect(() => validateManagedAssetPath(owner, `users/${owner}/assets/../secret`)).toThrowError(ManagedAssetControlError);
  });

  it("persists owner-scoped protection and rejects removal while protected", async () => {
    await setManagedAssetProtection(owner, path, true);
    expect((await readManagedAssetControl(owner, path))?.protected).toBe(true);
    await expect(deleteManagedAsset(owner, path)).rejects.toMatchObject({ code: "protected" });
    expect(state.del).not.toHaveBeenCalled();
    expect(state.head).toHaveBeenCalledWith(path, { storeId: "test-store" });
  });

  it("deletes only the selected Blob and removes matching uploaded Font and File associations", async () => {
    const fontPath = "users/owner-1/customLibraryFonts/font-1";
    const cdnUrl = "https://fonts.gstatic.com/s/example.woff2";
    const externalUrl = "https://fonts.example.test/external.woff2";
    state.documents.set("users/owner-1/customLibraryFonts/font-1", {
      family: "Fixture Sans",
      faces: [
        { source: { type: "url", url: physical.url, format: "woff2" }, provenance: { kind: "managed-upload", assetId: "123e4567-e89b-42d3-a456-426614174000" } },
        { source: { type: "url", url: cdnUrl, format: "woff2" }, provenance: { kind: "cdn", provider: "google-fonts" } },
        { source: { type: "url", url: externalUrl, format: "woff2" }, provenance: { kind: "external-url" } },
      ],
    });
    state.documents.set("users/owner-1/customLibraryFiles/file-1", { file: { source: { storagePath: path } } });
    state.documents.set("users/owner-1/managedAssets/123e4567-e89b-42d3-a456-426614174000", {
      state: "complete", storagePath: path,
    });

    await expect(deleteManagedAsset(owner, path)).resolves.toEqual({ alreadyMissing: false });
    expect(state.del).toHaveBeenCalledTimes(1);
    expect(state.del).toHaveBeenCalledWith(path, { storeId: "test-store" });
    expect(state.documents.has("users/owner-1/customLibraryFiles/file-1")).toBe(false);
    const font = state.documents.get(fontPath);
    expect(font?.faces).toHaveLength(2);
    expect((font?.faces as Array<{ source: { url: string } }>).map((face) => face.source.url)).toEqual([cdnUrl, externalUrl]);
    expect(state.documents.get("users/owner-1/managedAssets/123e4567-e89b-42d3-a456-426614174000")?.state).toBe("deleted");
    expect((await readManagedAssetControl(owner, path))?.state).toBe("deleted");
  });

  it("keeps provider failures recoverable and allows retry after an uncertain delete", async () => {
    state.del.mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(deleteManagedAsset(owner, path)).rejects.toMatchObject({ code: "provider_unavailable" });
    expect((await readManagedAssetControl(owner, path))?.state).toBe("delete_failed");
    await expect(deleteManagedAsset(owner, path)).resolves.toEqual({ alreadyMissing: false });
    expect((await readManagedAssetControl(owner, path))?.state).toBe("deleted");
    expect(state.del).toHaveBeenCalledTimes(2);
  });

  it("prevents overlapping protection and deletion while another delete lease is active", async () => {
    state.documents.set(`users/${owner}/managedAssetControls/123e4567-e89b-42d3-a456-426614174000.png`, {
      storagePath: path,
      protected: false,
      state: "deleting",
      deleteLeaseExpiresAt: Timestamp.fromMillis(Date.now() + 60_000),
      deleteOperationId: "existing-operation",
    });
    await expect(setManagedAssetProtection(owner, path, true)).rejects.toMatchObject({ code: "deletion_in_progress" });
    await expect(deleteManagedAsset(owner, path)).rejects.toMatchObject({ code: "deletion_in_progress" });
    expect(state.del).not.toHaveBeenCalled();
  });

  it("only finalizes an already-missing object when a prior deletion transition exists", async () => {
    state.hasPhysical = false;
    await expect(deleteManagedAsset(owner, path)).rejects.toMatchObject({ code: "not_found" });
    state.documents.set(`users/${owner}/managedAssetControls/123e4567-e89b-42d3-a456-426614174000.png`, {
      storagePath: path, protected: false, state: "delete_failed",
    });
    await expect(deleteManagedAsset(owner, path)).resolves.toEqual({ alreadyMissing: true });
    expect(state.del).not.toHaveBeenCalled();
    expect((await readManagedAssetControl(owner, path))?.state).toBe("deleted");
  });
});
