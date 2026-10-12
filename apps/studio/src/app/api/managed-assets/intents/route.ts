import { NextResponse } from "next/server";

import { verifyFirebaseIdToken } from "../../../../features/auth/firebase-admin-auth";
import {
  createManagedAssetIntent,
  listManagedAssetIntents,
  type ManagedAssetIntentInput,
} from "../../../../features/persistence/managed-asset-intents";
import { FirebaseAuthenticationError } from "../../../../features/persistence/persistence-errors";

export const dynamic = "force-dynamic";

function authToken(request: Request): string | null {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function isIntentInput(value: unknown): value is ManagedAssetIntentInput {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.assetId === "string"
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

export async function GET(request: Request): Promise<NextResponse> {
  const token = authToken(request);
  if (!token) return json({ error: "authentication" }, 401);
  try {
    const user = await verifyFirebaseIdToken(token);
    return json({ intents: await listManagedAssetIntents(user.uid) });
  } catch (error) {
    return json({ error: error instanceof FirebaseAuthenticationError ? "authentication" : "unavailable" }, error instanceof FirebaseAuthenticationError ? 401 : 503);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const token = authToken(request);
  if (!token) return json({ error: "authentication" }, 401);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
  if (!isIntentInput(body)) return json({ error: "invalid_request" }, 400);
  try {
    const user = await verifyFirebaseIdToken(token);
    const intent = await createManagedAssetIntent(user.uid, body);
    return json({ intent }, 201);
  } catch (error) {
    if (error instanceof FirebaseAuthenticationError) return json({ error: "authentication" }, 401);
    if (error instanceof Error && ["invalid_identity", "invalid_type", "invalid_size", "invalid_descriptor"].includes(error.message)) return json({ error: "invalid_intent" }, 400);
    if (error instanceof Error && error.message === "identity_conflict") return json({ error: "conflict" }, 409);
    return json({ error: "unavailable" }, 503);
  }
}
