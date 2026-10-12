import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  documents: new Map<string, Record<string, unknown>>(),
  physical: null as null | Record<string, unknown>,
  head: vi.fn(),
  sentinels: {
    serverTimestamp: { kind: "serverTimestamp" },
    delete: { kind: "delete" },
    increment: (value: number) => ({ kind: "increment", value }),
  },
}));

function ref(path: string) {
  return {
    path,
    async get() {
      const data = state.documents.get(path);
      return { exists: Boolean(data), data: () => data };
    },
    async update(values: Record<string, unknown>) {
      const prior = state.documents.get(path);
      if (!prior) throw new Error("missing document");
      for (const [key, value] of Object.entries(values)) {
        if (value === state.sentinels.delete) delete prior[key];
        else if (typeof value === "object" && value !== null && "kind" in value && value.kind === "increment") {
          prior[key] = Number(prior[key] ?? 0) + Number((value as unknown as { value: number }).value);
        } else prior[key] = value;
      }
    },
  };
}

const firestore = {
  doc: ref,
  collection(path: string) {
    return {
      orderBy() { return this; },
      limit() { return this; },
      async get() {
        const prefix = `${path}/`;
        const docs = [...state.documents.entries()]
          .filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"))
          .map(([path, data]) => ({ id: path.split("/").at(-1), data: () => data }));
        return { docs };
      },
    };
  },
  async runTransaction<T>(callback: (transaction: {
    get: (document: ReturnType<typeof ref>) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
    create: (document: ReturnType<typeof ref>, data: Record<string, unknown>) => void;
    update: (document: ReturnType<typeof ref>, data: Record<string, unknown>) => void;
  }) => Promise<T>) {
    const writes: Array<() => void> = [];
    const transaction = {
      get: async (document: ReturnType<typeof ref>) => document.get(),
      create: (document: ReturnType<typeof ref>, data: Record<string, unknown>) => writes.push(() => {
        if (state.documents.has(document.path)) throw new Error("already exists");
        state.documents.set(document.path, { ...data });
      }),
      update: (document: ReturnType<typeof ref>, data: Record<string, unknown>) => writes.push(() => { void document.update(data); }),
    };
    const result = await callback(transaction);
    writes.forEach((write) => write());
    return result;
  },
};

vi.mock("@vercel/blob", async (importOriginal) => {
  const original = await importOriginal<typeof import("@vercel/blob")>();
  return { ...original, head: state.head };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => state.sentinels.serverTimestamp,
    delete: () => state.sentinels.delete,
    increment: state.sentinels.increment,
  },
  Timestamp: class MockTimestamp {
    constructor(private readonly value: number) {}
    toMillis() { return this.value; }
    static fromMillis(value: number) { return new MockTimestamp(value); }
  },
  getFirestore: () => firestore,
}));
vi.mock("../src/features/auth/firebase-admin-auth", () => ({ getFirebaseAdminApp: () => ({}) }));

import { BlobNotFoundError } from "@vercel/blob";
import { Timestamp } from "firebase-admin/firestore";
import {
  authorizeManagedAssetUpload,
  createManagedAssetIntent,
  getManagedAssetIntent,
  reconcileManagedAssetIntent,
} from "../src/features/persistence/managed-asset-intents";

const intentInput = {
  assetId: "123e4567-e89b-12d3-a456-426614174000",
  originalFilename: "display-font.ttf",
  extension: ".ttf",
  contentType: "font/ttf",
  expectedSizeBytes: 23,
  sourceLastModified: 100,
};

beforeEach(() => {
  state.documents.clear();
  state.physical = null;
  vi.clearAllMocks();
  state.head.mockImplementation(async () => {
    if (!state.physical) throw new BlobNotFoundError();
    return state.physical;
  });
});

describe("managed asset durable intents", () => {
  it("persists a canonical intent and reuses its stable identity", async () => {
    const first = await createManagedAssetIntent("owner", intentInput);
    const retry = await createManagedAssetIntent("owner", intentInput);

    expect(first.storagePath).toBe(`users/owner/assets/${intentInput.assetId}.ttf`);
    expect(retry.assetId).toBe(first.assetId);
    expect(state.documents.size).toBe(1);
    expect(await getManagedAssetIntent("other-owner", intentInput.assetId)).toBeNull();
  });

  it("rejects an intent identity reused with a different descriptor", async () => {
    await createManagedAssetIntent("owner", intentInput);
    await expect(createManagedAssetIntent("owner", { ...intentInput, expectedSizeBytes: 24 })).rejects.toThrow("identity_conflict");
    expect(state.documents.size).toBe(1);
  });

  it("authorizes only the matching owner's durable intent before token issuance", async () => {
    await expect(authorizeManagedAssetUpload("owner", intentInput.assetId, `users/owner/assets/${intentInput.assetId}.ttf`, "font/ttf", 23)).rejects.toThrow("intent_mismatch");
    await createManagedAssetIntent("owner", intentInput);
    await expect(authorizeManagedAssetUpload("other-owner", intentInput.assetId, `users/other-owner/assets/${intentInput.assetId}.ttf`, "font/ttf", 23)).rejects.toThrow("intent_mismatch");
    await expect(authorizeManagedAssetUpload("owner", intentInput.assetId, `users/owner/assets/${intentInput.assetId}.ttf`, "font/ttf", 23)).resolves.toBe("authorized");
  });

  it("finalizes from authoritative matching physical metadata and is idempotent", async () => {
    await createManagedAssetIntent("owner", intentInput);
    state.physical = {
      pathname: `users/owner/assets/${intentInput.assetId}.ttf`,
      contentType: "font/ttf",
      size: 23,
      etag: "0123456789abcdef0123456789abcdef",
      downloadUrl: "https://blob.test/verified.ttf",
    };

    const [first, repeated] = await Promise.all([
      reconcileManagedAssetIntent("owner", intentInput.assetId),
      reconcileManagedAssetIntent("owner", intentInput.assetId),
    ]);
    expect(first.status).toBe("complete");
    expect(repeated.status).toBe("complete");
    expect(first.result?.etag).toBe("0123456789abcdef0123456789abcdef");
    expect(state.documents.get(`users/owner/managedAssets/${intentInput.assetId}`)?.state).toBe("complete");
  });

  it.each([
    { contentType: "application/octet-stream" },
    { size: 22 },
    { etag: undefined },
    { etag: "invalid etag" },
    { pathname: "users/owner/assets/other.ttf" },
  ])("marks conflicting physical metadata as conflict", async (override) => {
    await createManagedAssetIntent("owner", intentInput);
    state.physical = {
      pathname: `users/owner/assets/${intentInput.assetId}.ttf`,
      contentType: "font/ttf",
      size: 23,
      etag: "0123456789abcdef0123456789abcdef",
      downloadUrl: "https://blob.test/verified.ttf",
      ...override,
    };
    await expect(reconcileManagedAssetIntent("owner", intentInput.assetId)).resolves.toEqual({ status: "conflict" });
  });

  it("permits a same-path retry only after the provider confirms absence", async () => {
    await createManagedAssetIntent("owner", intentInput);
    await expect(authorizeManagedAssetUpload("owner", intentInput.assetId, `users/owner/assets/${intentInput.assetId}.ttf`, "font/ttf", 23)).resolves.toBe("authorized");
    const document = state.documents.get(`users/owner/managedAssets/${intentInput.assetId}`)!;
    document.leaseExpiresAt = Timestamp.fromMillis(Date.now() - 1);
    await expect(reconcileManagedAssetIntent("owner", intentInput.assetId)).resolves.toEqual({ status: "absent" });
    await expect(authorizeManagedAssetUpload("owner", intentInput.assetId, `users/owner/assets/${intentInput.assetId}.ttf`, "font/ttf", 23)).resolves.toBe("authorized");
    expect(state.head).toHaveBeenCalledWith(`users/owner/assets/${intentInput.assetId}.ttf`);
  });

  it("keeps active operations and inconclusive provider results from triggering another upload", async () => {
    await createManagedAssetIntent("owner", intentInput);
    await authorizeManagedAssetUpload("owner", intentInput.assetId, `users/owner/assets/${intentInput.assetId}.ttf`, "font/ttf", 23);
    await expect(authorizeManagedAssetUpload("owner", intentInput.assetId, `users/owner/assets/${intentInput.assetId}.ttf`, "font/ttf", 23)).resolves.toBe("in_progress");
    state.head.mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(reconcileManagedAssetIntent("owner", intentInput.assetId)).resolves.toEqual({ status: "uncertain" });
  });
});
