import { getFirestore } from "firebase-admin/firestore";

import { getFirebaseAdminApp } from "../auth/firebase-admin-auth";
import type { CustomLibraryFontDraft, CustomLibraryFontFace } from "../custom-library/custom-library-font";
import { fontFaceRemovalSafety, hasSameFontFaceIdentity, managedFontPathFromUrl } from "../custom-library/custom-library-font-provenance";
import { parseCustomLibraryFontDraft } from "../custom-library/custom-library-font-schema";
import { managedAssetControlRef } from "./managed-asset-controls";
import { getManagedAssetIntent } from "./managed-asset-intents";
import { assertStableAssetDocumentId, canonicalValuesEqual } from "./firestore-idempotency";

export type CustomLibraryFontWriteErrorCode = "invalid_font" | "identity_conflict" | "font_not_found" | "managed_face_removal_denied" | "unverified_managed_face";

export class CustomLibraryFontWriteError extends Error {
  constructor(readonly code: CustomLibraryFontWriteErrorCode) {
    super(code);
    this.name = "CustomLibraryFontWriteError";
  }
}

function fontCollection(uid: string) {
  return getFirestore(getFirebaseAdminApp()).collection("users").doc(uid).collection("customLibraryFonts");
}

function parseFont(value: unknown): CustomLibraryFontDraft {
  try { return parseCustomLibraryFontDraft(value); }
  catch { throw new CustomLibraryFontWriteError("invalid_font"); }
}

async function validateNewFace(uid: string, face: CustomLibraryFontFace): Promise<void> {
  const provenance = face.provenance;
  if (!provenance) throw new CustomLibraryFontWriteError("invalid_font");
  let url: URL;
  try { url = new URL(face.source.url); }
  catch { throw new CustomLibraryFontWriteError("invalid_font"); }

  if (provenance.kind === "managed-upload") {
    const identity = managedFontPathFromUrl(face.source.url, uid);
    const intent = await getManagedAssetIntent(uid, provenance.assetId);
    const extension = identity?.pathname.slice(identity.pathname.lastIndexOf(".")).toLowerCase();
    const expectedFormat = extension === ".ttf" ? "truetype"
      : extension === ".otf" ? "opentype"
        : extension?.slice(1);
    if (!identity || identity.assetId.toLowerCase() !== provenance.assetId.toLowerCase()
      || face.source.format !== expectedFormat || !intent || intent.state !== "complete"
      || intent.storagePath !== identity.pathname || intent.downloadUrl !== face.source.url) {
      throw new CustomLibraryFontWriteError("unverified_managed_face");
    }
    return;
  }

  if (fontFaceRemovalSafety(face, uid) !== "removable") {
    throw new CustomLibraryFontWriteError("unverified_managed_face");
  }
  if (provenance.kind === "cdn") {
    const providerUrl = url.protocol === "https:" && (provenance.provider === "fontsource"
      ? url.hostname === "cdn.jsdelivr.net" && url.pathname.startsWith("/fontsource/fonts/")
      : url.hostname === "fonts.gstatic.com");
    if (!providerUrl) throw new CustomLibraryFontWriteError("invalid_font");
  } else if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new CustomLibraryFontWriteError("invalid_font");
  }
}

async function validateNewFaces(uid: string, previous: CustomLibraryFontDraft | null, next: CustomLibraryFontDraft): Promise<void> {
  const additions = next.faces.filter((face) => !previous?.faces.some((existing) => hasSameFontFaceIdentity(existing, face)));
  await Promise.all(additions.map((face) => validateNewFace(uid, face)));
}

async function assertManagedFacesAvailable(
  transaction: FirebaseFirestore.Transaction,
  uid: string,
  font: CustomLibraryFontDraft,
): Promise<void> {
  const paths = [...new Set(font.faces.flatMap((face) => {
    const identity = managedFontPathFromUrl(face.source.url, uid);
    return identity ? [identity.pathname] : [];
  }))];
  for (const path of paths) {
    const snapshot = await transaction.get(managedAssetControlRef(uid, path));
    const state = snapshot.exists ? snapshot.get("state") : undefined;
    if (state === "deleting" || state === "delete_failed" || state === "deleted") {
      throw new CustomLibraryFontWriteError("unverified_managed_face");
    }
  }
}

function assertProtectedFacesRetained(uid: string, previous: CustomLibraryFontDraft, next: CustomLibraryFontDraft): void {
  for (const face of previous.faces) {
    if (fontFaceRemovalSafety(face, uid) === "removable") continue;
    const retained = next.faces.some((candidate) => {
      if (!hasSameFontFaceIdentity(face, candidate) || fontFaceRemovalSafety(candidate, uid) === "removable") return false;
      return canonicalValuesEqual(face.provenance ?? null, candidate.provenance ?? null);
    });
    if (!retained) {
      throw new CustomLibraryFontWriteError("managed_face_removal_denied");
    }
  }
}

export async function saveCustomLibraryFont(uid: string, input: unknown, documentId?: string): Promise<string> {
  const font = parseFont(input);
  if (documentId !== undefined) assertStableAssetDocumentId(documentId);
  await validateNewFaces(uid, null, font);
  const collection = fontCollection(uid);
  const ref = documentId ? collection.doc(documentId) : collection.doc();
  return getFirestore(getFirebaseAdminApp()).runTransaction(async (transaction) => {
    await assertManagedFacesAvailable(transaction, uid, font);
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) {
      const existing = parseFont(snapshot.data());
      if (!canonicalValuesEqual(existing, font)) throw new CustomLibraryFontWriteError("identity_conflict");
      return ref.id;
    }
    transaction.create(ref, font);
    return ref.id;
  });
}

export async function updateCustomLibraryFont(uid: string, id: string, input: unknown): Promise<void> {
  const next = parseFont(input);
  const ref = fontCollection(uid).doc(id);
  await getFirestore(getFirebaseAdminApp()).runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new CustomLibraryFontWriteError("font_not_found");
    const previous = parseFont(snapshot.data());
    assertProtectedFacesRetained(uid, previous, next);
    await validateNewFaces(uid, previous, next);
    await assertManagedFacesAvailable(transaction, uid, next);
    transaction.set(ref, next);
  });
}

export async function deleteCustomLibraryFont(uid: string, id: string): Promise<void> {
  const ref = fontCollection(uid).doc(id);
  await getFirestore(getFirebaseAdminApp()).runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return;
    const font = parseFont(snapshot.data());
    if (font.faces.some((face) => fontFaceRemovalSafety(face, uid) !== "removable")) {
      throw new CustomLibraryFontWriteError("managed_face_removal_denied");
    }
    transaction.delete(ref);
  });
}
