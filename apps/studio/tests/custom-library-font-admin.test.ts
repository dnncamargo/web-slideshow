import { beforeEach, describe, expect, it, vi } from "vitest";

const { documents, getIntent, db } = vi.hoisted(() => {
  const documents = new Map<string, unknown>();
  const getIntent = vi.fn();
  const generatedId = { value: "generated-font-id" };
  const ref = (id: string) => ({ id, create: vi.fn(async (value: unknown) => { documents.set(id, value); }) });
  const collectionFor = (path: string): Record<string, unknown> => ({
    doc: (id?: string) => id === undefined ? ref(generatedId.value) : ({
      ...ref(id), collection: (name: string) => collectionFor(`${path}/${id}/${name}`),
    }),
  });
  const db = {
    doc: (path: string) => ref(path.split("/").at(-1) ?? path),
    collection: (name: string) => collectionFor(name),
    runTransaction: async (callback: (transaction: {
      get: (reference: { id: string }) => Promise<{ exists: boolean; data: () => unknown }>;
      create: (reference: { id: string }, value: unknown) => void;
      set: (reference: { id: string }, value: unknown) => void;
      delete: (reference: { id: string }) => void;
    }) => unknown) => callback({
      get: async (reference: { id: string }) => ({ exists: documents.has(reference.id), data: () => documents.get(reference.id) }),
      create: (reference: { id: string }, value: unknown) => { documents.set(reference.id, value); },
      set: (reference: { id: string }, value: unknown) => { documents.set(reference.id, value); },
      delete: (reference: { id: string }) => { documents.delete(reference.id); },
    }),
  };
  return { documents, getIntent, db };
});

vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => db }));
vi.mock("../src/features/auth/firebase-admin-auth", () => ({ getFirebaseAdminApp: () => ({}) }));
vi.mock("../src/features/persistence/managed-asset-intents", () => ({ getManagedAssetIntent: getIntent }));

import {
  deleteCustomLibraryFont,
  saveCustomLibraryFont,
  updateCustomLibraryFont,
} from "../src/features/persistence/custom-library-font-admin";

const uuid = "123e4567-e89b-42d3-a456-426614174000";
const managedUrl = `https://store.public.blob.vercel-storage.com/users/font-owner/assets/${uuid}.woff2`;
const cdnFace = { source: { type: "url" as const, url: "https://cdn.jsdelivr.net/fontsource/fonts/inter.woff2", format: "woff2" as const }, provenance: { kind: "cdn" as const, provider: "fontsource" as const } };
const googleCdnFace = { source: { type: "url" as const, url: "https://fonts.gstatic.com/s/inter/v1/inter.woff2", format: "woff2" as const }, provenance: { kind: "cdn" as const, provider: "google-fonts" as const } };
const externalFace = { source: { type: "url" as const, url: "https://fonts.example.test/inter.woff2", format: "woff2" as const }, provenance: { kind: "external-url" as const } };
const externalHttpFace = { source: { type: "url" as const, url: "http://legacy-fonts.example.test/inter.woff2", format: "woff2" as const }, provenance: { kind: "external-url" as const } };
const managedFace = { source: { type: "url" as const, url: managedUrl, format: "woff2" as const }, provenance: { kind: "managed-upload" as const, assetId: uuid } };

beforeEach(() => {
  documents.clear();
  getIntent.mockReset();
  getIntent.mockResolvedValue({ state: "complete", storagePath: `users/font-owner/assets/${uuid}.woff2`, downloadUrl: managedUrl });
});

describe("authoritative Custom Library font writes", () => {
  it.each([
    ["CDN", cdnFace],
    ["Google Fonts CDN", googleCdnFace],
    ["external URL", externalFace],
    ["legacy HTTP external URL", externalHttpFace],
  ])("persists %s provenance", async (_name, face) => {
    const id = await saveCustomLibraryFont("font-owner", { family: "Inter", faces: [face] });
    expect(documents.get(id)).toEqual({ family: "Inter", faces: [face] });
  });

  it("persists managed-upload provenance only when the owner's completed intent matches", async () => {
    const font = { family: "Inter", faces: [managedFace] };
    const id = await saveCustomLibraryFont("font-owner", font);
    expect(documents.get(id)).toEqual(font);
    expect(getIntent).toHaveBeenCalledWith("font-owner", uuid);
    getIntent.mockResolvedValueOnce(null);
    await expect(saveCustomLibraryFont("font-owner", font)).rejects.toMatchObject({ code: "unverified_managed_face" });
  });

  it("allows CDN and external URL family deletion through the server", async () => {
    for (const [id, face] of [["cdn-family", cdnFace], ["external-family", externalFace]] as const) {
      documents.set(id, { family: "Inter", faces: [face] });
      await expect(deleteCustomLibraryFont("font-owner", id)).resolves.toBeUndefined();
      expect(documents.has(id)).toBe(false);
    }
  });

  it.each([
    ["explicitly managed", managedFace],
    ["legacy canonical owner path", { source: { type: "url", url: managedUrl, format: "woff2" } }],
    ["ambiguous owner Storage path", { source: { type: "url", url: `https://store.public.blob.vercel-storage.com/users/font-owner/assets/old-font.otf`, format: "opentype" } }],
  ])("denies Fonts deletion for %s faces", async (_name, face) => {
    documents.set("protected-family", { family: "Inter", faces: [face] });
    await expect(deleteCustomLibraryFont("font-owner", "protected-family")).rejects.toMatchObject({ code: "managed_face_removal_denied" });
    expect(documents.has("protected-family")).toBe(true);
  });

  it("allows an unambiguous legacy external URL face to be removed", async () => {
    documents.set("legacy-external", { family: "Inter", faces: [{ source: { type: "url", url: "https://legacy.example.test/font.woff2", format: "woff2" } }] });
    await expect(deleteCustomLibraryFont("font-owner", "legacy-external")).resolves.toBeUndefined();
    expect(documents.has("legacy-external")).toBe(false);
  });

  it("blocks removal of protected faces in an update while allowing removable faces to be removed", async () => {
    documents.set("managed", { family: "Inter", faces: [managedFace, cdnFace] });
    await expect(updateCustomLibraryFont("font-owner", "managed", { family: "Inter", faces: [cdnFace] })).rejects.toMatchObject({ code: "managed_face_removal_denied" });
    await expect(updateCustomLibraryFont("font-owner", "managed", { family: "Inter", faces: [managedFace] })).resolves.toBeUndefined();
    expect(documents.get("managed")).toEqual({ family: "Inter", faces: [managedFace] });
  });

  it("does not allow an update to erase explicit managed provenance", async () => {
    documents.set("managed", { family: "Inter", faces: [managedFace] });
    await expect(updateCustomLibraryFont("font-owner", "managed", {
      family: "Inter",
      faces: [{ source: managedFace.source }],
    })).rejects.toMatchObject({ code: "managed_face_removal_denied" });
    expect((documents.get("managed") as { faces: unknown[] }).faces[0]).toEqual(managedFace);
  });
});
