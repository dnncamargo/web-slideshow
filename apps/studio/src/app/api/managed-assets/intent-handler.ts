import { NextResponse } from "next/server";

import { verifyFirebaseIdToken } from "../../../features/auth/firebase-admin-auth";
import {
  createManagedAssetIntent,
  type ManagedAssetIntentInput,
  type ManagedAssetUploadPurpose,
} from "../../../features/persistence/managed-asset-intents";
import { FirebaseAuthenticationError } from "../../../features/persistence/persistence-errors";

function isIntentInput(value: unknown): value is ManagedAssetIntentInput {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  const allowedKeys = ["assetId", "contentType", "expectedSizeBytes", "extension", "originalFilename", "sourceLastModified"];
  return Object.keys(item).every((key) => allowedKeys.includes(key))
    && typeof item.assetId === "string"
    && typeof item.originalFilename === "string"
    && typeof item.extension === "string"
    && typeof item.contentType === "string"
    && typeof item.expectedSizeBytes === "number"
    && typeof item.sourceLastModified === "number";
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });
}

export async function handleCreateManagedAssetIntent(
  request: Request,
  purpose: ManagedAssetUploadPurpose,
): Promise<NextResponse> {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) return json({ error: "authentication" }, 401);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
  if (!isIntentInput(body)) return json({ error: "invalid_request" }, 400);
  try {
    const user = await verifyFirebaseIdToken(token);
    const intent = await createManagedAssetIntent(user.uid, body, purpose);
    return json({ intent }, 201);
  } catch (error) {
    if (error instanceof FirebaseAuthenticationError) return json({ error: "authentication" }, 401);
    if (error instanceof Error && ["invalid_identity", "invalid_type", "invalid_size", "invalid_descriptor"].includes(error.message)) return json({ error: "invalid_intent" }, 400);
    if (error instanceof Error && error.message === "identity_conflict") return json({ error: "conflict" }, 409);
    return json({ error: "unavailable" }, 503);
  }
}
