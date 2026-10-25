import { NextResponse } from "next/server";

import { verifyFirebaseIdToken } from "../../../../features/auth/firebase-admin-auth";
import { listManagedAssetIntents } from "../../../../features/persistence/managed-asset-intents";
import { FirebaseAuthenticationError } from "../../../../features/persistence/persistence-errors";
import { handleCreateManagedAssetIntent } from "../intent-handler";

export const dynamic = "force-dynamic";

function authToken(request: Request): string | null {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
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
  return handleCreateManagedAssetIntent(request, "generic");
}
