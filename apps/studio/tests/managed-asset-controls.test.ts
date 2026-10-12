import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  documents: new Map<string, Record<string, unknown>>(),
  head: vi.fn(),
  del: vi.fn(),
  hasPhysical: true,
  transactionQueue: null as Promise<unknown> | null,
  failNextFinalize: false,
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
      async getAll(...references: Array<ReturnType<typeof documentRef>>) { return references.map((reference) => snapshot(reference.path)); },
    async runTransaction<T>(callback: (transaction: {
      get: (reference: ReturnType<typeof documentRef> | ReturnType<typeof collectionRef>) => Promise<ReturnType<typeof snapshot> | ReturnType<typeof querySnapshot>>;
      set: (reference: ReturnType<typeof documentRef>, value: Record<string, unknown>) => void;
      create: (reference: ReturnType<typeof documentRef>, value: Record<string, unknown>) => void;
      update: (reference: ReturnType<typeof documentRef>, value: Record<string, unknown>) => void;
      delete: (reference: ReturnType<typeof documentRef>) => void;
    }) => Promise<T>) {
      const run = (state.transactionQueue ?? Promise.resolve()).then(async () => {
        const writes: Array<() => void> = [];
        const transaction = {
          get: async (reference: ReturnType<typeof documentRef> | ReturnType<typeof collectionRef>) => reference.get(),
          set: (reference: ReturnType<typeof documentRef>, value: Record<string, unknown>) => writes.push(() => {
            state.documents.set(reference.path, applyValues(state.documents.get(reference.path) ?? {}, value));
          }),
          create: (reference: ReturnType<typeof documentRef>, value: Record<string, unknown>) => writes.push(() => {
            if (state.documents.has(reference.path)) throw new Error("already exists");
            state.documents.set(reference.path, applyValues({}, value));
          }),
          update: (reference: ReturnType<typeof documentRef>, value: Record<string, unknown>) => {
            if (state.failNextFinalize && reference.path.includes("/managedAssetControls/") && value.state === "deleted") {
              state.failNextFinalize = false;
              throw new Error("simulated Firestore finalization failure");
            }
            writes.push(() => {
              const prior = state.documents.get(reference.path);
              if (!prior) throw new Error("missing document");
              state.documents.set(reference.path, applyValues(prior, value));
            });
          },
          delete: (reference: ReturnType<typeof documentRef>) => writes.push(() => { state.documents.delete(reference.path); }),
        };
        const result = await callback(transaction);
        writes.forEach((write) => write());
        return result;
      });
      state.transactionQueue = run.then(() => undefined, () => undefined);
      return run;
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
  readManagedAssetDisplayNames,
  renameManagedAsset,
  setManagedAssetProtection,
  validateManagedAssetPath,
} from "../src/features/persistence/managed-asset-controls";

const owner = "owner-1";
const path = `users/${owner}/assets/123e4567-e89b-42d3-a456-426614174000.png`;
const physical = { pathname: path, url: `https://fixture.public.blob.vercel-storage.com/${path}`, contentType: "image/png", size: 8, etag: "provider-etag" };
const fontPath = `users/${owner}/customLibraryFonts/font-1`;
const filePath = `users/${owner}/customLibraryFiles/file-1`;
const intentPath = `users/${owner}/managedAssets/123e4567-e89b-42d3-a456-426614174000`;
const cdnUrl = "https://fonts.gstatic.com/s/example.woff2";
const externalUrl = "https://fonts.example.test/external.woff2";

function seedLogicalAssociations() {
  state.documents.set(fontPath, {
    family: "Fixture Sans",
    faces: [
      { source: { type: "url", url: physical.url, format: "woff2" }, provenance: { kind: "managed-upload", assetId: "123e4567-e89b-42d3-a456-426614174000" } },
      { source: { type: "url", url: cdnUrl, format: "woff2" }, provenance: { kind: "cdn", provider: "google-fonts" } },
      { source: { type: "url", url: externalUrl, format: "woff2" }, provenance: { kind: "external-url" } },
    ],
  });
  state.documents.set(filePath, { file: { source: { storagePath: path } } });
  state.documents.set(intentPath, { state: "complete", storagePath: path });
}

beforeEach(() => {
  state.documents.clear();
  vi.clearAllMocks();
  state.transactionQueue = Promise.resolve();
  state.failNextFinalize = false;
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

  it("persists owner-scoped protection, blocks deletion, and allows explicit unprotect", async () => {
    await setManagedAssetProtection(owner, path, true);
    expect((await readManagedAssetControl(owner, path))?.protected).toBe(true);
    await expect(deleteManagedAsset(owner, path)).rejects.toMatchObject({ code: "protected" });
    expect(state.del).not.toHaveBeenCalled();
    expect(state.head).toHaveBeenCalledWith(path, { storeId: "test-store" });
    await setManagedAssetProtection(owner, path, false);
    expect((await readManagedAssetControl(owner, path))?.protected).toBe(false);
    await expect(deleteManagedAsset(owner, path)).resolves.toEqual({ alreadyMissing: false });
  });

  it("validates and persists Unicode display names without changing physical identity", async () => {
    const renamed = await renameManagedAsset(owner, path, "  春の資料 📘  ");
    expect(renamed.displayName).toBe("春の資料 📘");
    expect(await readManagedAssetDisplayNames(owner, [path])).toEqual(new Map([[path, "春の資料 📘"]]));
    await expect(renameManagedAsset(owner, path, "   ")).rejects.toMatchObject({ code: "invalid_display_name" });
    await expect(renameManagedAsset(owner, path, "folder/name")).rejects.toMatchObject({ code: "invalid_display_name" });
    await expect(renameManagedAsset(owner, path, `x${"😀".repeat(512)}`)).rejects.toMatchObject({ code: "invalid_display_name" });
    await expect(renameManagedAsset(owner, `users/other/assets/${path.split("/").at(-1)}`, "Other")).rejects.toMatchObject({ code: "invalid_identity" });
  });

  it("allows duplicate names, rename while protected, and retains the name through protection", async () => {
    const otherPath = `users/${owner}/assets/223e4567-e89b-42d3-a456-426614174000.png`;
    await renameManagedAsset(owner, path, "Shared name");
    state.head.mockResolvedValueOnce({ ...physical, pathname: otherPath });
    await renameManagedAsset(owner, otherPath, "Shared name");
    state.head.mockResolvedValue({ ...physical, pathname: path });
    await setManagedAssetProtection(owner, path, true);
    expect((await renameManagedAsset(owner, path, "Protected renamed file")).protected).toBe(true);
    expect((await readManagedAssetControl(owner, path))?.displayName).toBe("Protected renamed file");
    await expect(deleteManagedAsset(owner, path)).rejects.toMatchObject({ code: "protected" });
  });

  it("preserves display names through deletion failure, retry, and terminal tombstone", async () => {
    await renameManagedAsset(owner, path, "Keep this label");
    state.del.mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(deleteManagedAsset(owner, path)).rejects.toMatchObject({ code: "provider_unavailable" });
    expect((await readManagedAssetControl(owner, path))?.displayName).toBe("Keep this label");
    await expect(deleteManagedAsset(owner, path)).resolves.toEqual({ alreadyMissing: false });
    expect((await readManagedAssetControl(owner, path))?.displayName).toBe("Keep this label");
    await expect(renameManagedAsset(owner, path, "Too late")).rejects.toMatchObject({ code: "not_found" });
  });

  it("serializes concurrent protection and rename updates without losing either field", async () => {
    await Promise.all([
      setManagedAssetProtection(owner, path, true),
      renameManagedAsset(owner, path, "Concurrent name"),
    ]);
    expect(await readManagedAssetControl(owner, path)).toMatchObject({ protected: true, displayName: "Concurrent name", state: "active" });
  });

  it("deletes only the selected Blob and removes matching uploaded Font and File associations", async () => {
    seedLogicalAssociations();
    const unrelatedPath = `users/${owner}/assets/223e4567-e89b-42d3-a456-426614174000.png`;
    state.documents.set(`users/${owner}/customLibraryFonts/font-2`, {
      family: "Unrelated Sans",
      faces: [{ source: { type: "url", url: `https://fixture.public.blob.vercel-storage.com/${unrelatedPath}`, format: "woff2" } }],
    });
    state.documents.set(`users/${owner}/customLibraryFiles/file-2`, { file: { source: { storagePath: unrelatedPath } } });
    state.documents.set(`users/${owner}/managedAssets/223e4567-e89b-42d3-a456-426614174000`, {
      state: "complete", storagePath: unrelatedPath,
    });

    await expect(deleteManagedAsset(owner, path)).resolves.toEqual({ alreadyMissing: false });
    expect(state.del).toHaveBeenCalledTimes(1);
    expect(state.del).toHaveBeenCalledWith(path, { storeId: "test-store" });
    expect(state.documents.has(filePath)).toBe(false);
    const font = state.documents.get(fontPath);
    expect(font?.faces).toHaveLength(2);
    expect((font?.faces as Array<{ source: { url: string } }>).map((face) => face.source.url)).toEqual([cdnUrl, externalUrl]);
    expect(state.documents.get(intentPath)?.state).toBe("deleted");
    expect((await readManagedAssetControl(owner, path))?.state).toBe("deleted");
    expect(state.documents.has(`users/${owner}/customLibraryFonts/font-2`)).toBe(true);
    expect(state.documents.has(`users/${owner}/customLibraryFiles/file-2`)).toBe(true);
    expect(state.documents.get(`users/${owner}/managedAssets/223e4567-e89b-42d3-a456-426614174000`)?.state).toBe("complete");
    await expect(deleteManagedAsset(owner, path)).resolves.toEqual({ alreadyMissing: true });
    expect(state.del).toHaveBeenCalledTimes(1);
  });

  it("keeps provider failures recoverable and allows retry after an uncertain delete", async () => {
    seedLogicalAssociations();
    state.del.mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(deleteManagedAsset(owner, path)).rejects.toMatchObject({ code: "provider_unavailable" });
    expect((await readManagedAssetControl(owner, path))?.state).toBe("delete_failed");
    expect(state.hasPhysical).toBe(true);
    expect(state.documents.has(filePath)).toBe(true);
    expect(state.documents.get(fontPath)?.faces).toHaveLength(3);
    expect(state.documents.get(intentPath)?.state).toBe("complete");
    await expect(deleteManagedAsset(owner, path)).resolves.toEqual({ alreadyMissing: false });
    expect((await readManagedAssetControl(owner, path))?.state).toBe("deleted");
    expect(state.del).toHaveBeenCalledTimes(2);
  });

  it("reconciles a deleted Blob after the provider response is lost using the same operation ID", async () => {
    seedLogicalAssociations();
    state.del.mockImplementationOnce(async () => {
      state.hasPhysical = false;
      throw new Error("response lost after provider deletion");
    });
    await expect(deleteManagedAsset(owner, path)).rejects.toMatchObject({ code: "provider_unavailable" });
    const failed = await readManagedAssetControl(owner, path);
    expect(failed?.state).toBe("delete_failed");
    expect(failed?.deleteOperationId).toBeTruthy();
    expect(state.documents.has(filePath)).toBe(true);
    await expect(deleteManagedAsset(owner, path)).resolves.toEqual({ alreadyMissing: true });
    const complete = await readManagedAssetControl(owner, path);
    expect(complete?.state).toBe("deleted");
    expect(complete?.deleteOperationId).toBe(failed?.deleteOperationId);
    expect(state.documents.has(filePath)).toBe(false);
    expect(state.documents.get(intentPath)?.state).toBe("deleted");
    expect(state.del).toHaveBeenCalledTimes(1);
  });

  it("retains associations when Firestore finalization fails and completes them on retry", async () => {
    seedLogicalAssociations();
    state.failNextFinalize = true;
    await expect(deleteManagedAsset(owner, path)).rejects.toMatchObject({ code: "provider_unavailable" });
    expect(state.hasPhysical).toBe(false);
    expect((await readManagedAssetControl(owner, path))?.state).toBe("delete_failed");
    expect(state.documents.has(filePath)).toBe(true);
    expect(state.documents.get(fontPath)?.faces).toHaveLength(3);
    expect(state.documents.get(intentPath)?.state).toBe("complete");

    await expect(deleteManagedAsset(owner, path)).resolves.toEqual({ alreadyMissing: true });
    expect(state.documents.has(filePath)).toBe(false);
    expect((state.documents.get(fontPath)?.faces as unknown[])).toHaveLength(2);
    expect(state.documents.get(intentPath)?.state).toBe("deleted");
    expect(state.del).toHaveBeenCalledTimes(1);
  });

  it("prevents overlapping protection and deletion while another delete lease is active", async () => {
    state.documents.set(`users/${owner}/managedAssetControls/123e4567-e89b-42d3-a456-426614174000.png`, {
      storagePath: path,
      protected: false,
      state: "deleting",
      displayName: "Deletion in progress",
      deleteLeaseExpiresAt: Timestamp.fromMillis(Date.now() + 60_000),
      deleteOperationId: "existing-operation",
      deleteAttemptId: "existing-attempt",
    });
    await expect(setManagedAssetProtection(owner, path, true)).rejects.toMatchObject({ code: "deletion_in_progress" });
    await expect(deleteManagedAsset(owner, path)).rejects.toMatchObject({ code: "deletion_in_progress" });
    await expect(renameManagedAsset(owner, path, "Must not reactivate")).rejects.toMatchObject({ code: "deletion_in_progress" });
    expect((await readManagedAssetControl(owner, path))?.displayName).toBe("Deletion in progress");
    expect(state.del).not.toHaveBeenCalled();
  });

  it("reuses one operation across lease expiry while an earlier provider call is delayed", async () => {
    seedLogicalAssociations();
    let finishFirstAttempt: (() => void) | undefined;
    let signalStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    const originalNow = Date.now;
    let now = originalNow();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    state.del.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishFirstAttempt = () => { state.hasPhysical = false; resolve(); };
      signalStarted?.();
    })).mockImplementationOnce(async () => { state.hasPhysical = false; });

    const firstRequest = deleteManagedAsset(owner, path);
    await started;
    const firstControl = await readManagedAssetControl(owner, path);
    expect(firstControl?.state).toBe("deleting");
    await expect(setManagedAssetProtection(owner, path, true)).rejects.toMatchObject({ code: "deletion_in_progress" });
    await expect(setManagedAssetProtection(owner, path, false)).rejects.toMatchObject({ code: "deletion_in_progress" });
    await expect(deleteManagedAsset(owner, path)).rejects.toMatchObject({ code: "deletion_in_progress" });
    expect(state.del).toHaveBeenCalledTimes(1);

    now += 2 * 60 * 1000 + 1;
    const retryRequest = deleteManagedAsset(owner, path);
    await expect(retryRequest).resolves.toEqual({ alreadyMissing: false });
    const retryControl = await readManagedAssetControl(owner, path);
    expect(retryControl?.deleteOperationId).toBe(firstControl?.deleteOperationId);
    expect(retryControl?.state).toBe("deleted");
    finishFirstAttempt?.();
    await expect(firstRequest).resolves.toEqual({ alreadyMissing: false });
    expect(state.documents.has(filePath)).toBe(false);
    expect(state.documents.get(intentPath)?.state).toBe("deleted");
    expect(state.del).toHaveBeenCalledTimes(2);
  });

  it("only finalizes an already-missing object when a prior deletion transition exists", async () => {
    state.hasPhysical = false;
    await expect(deleteManagedAsset(owner, path)).rejects.toMatchObject({ code: "not_found" });
    state.documents.set(`users/${owner}/managedAssetControls/123e4567-e89b-42d3-a456-426614174000.png`, {
      storagePath: path, protected: false, state: "delete_failed", deleteOperationId: "previous-operation",
    });
    await expect(deleteManagedAsset(owner, path)).resolves.toEqual({ alreadyMissing: true });
    expect(state.del).not.toHaveBeenCalled();
    expect((await readManagedAssetControl(owner, path))?.state).toBe("deleted");
  });
});
