import { NextResponse } from "next/server";

import { verifyFirebaseIdToken } from "../../../../features/auth/firebase-admin-auth";
import { reconcileManagedAssetIntent } from "../../../../features/persistence/managed-asset-intents";
import { FirebaseAuthenticationError } from "../../../../features/persistence/persistence-errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]?.trim()) return NextResponse.json({ error: "authentication" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_request" }, { status: 400 }); }
  if (typeof body !== "object" || body === null || typeof (body as Record<string, unknown>).assetId !== "string") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  try {
    const user = await verifyFirebaseIdToken(match[1]);
    const result = await reconcileManagedAssetIntent(user.uid, (body as { assetId: string }).assetId);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
  } catch (error) {
    if (error instanceof FirebaseAuthenticationError) return NextResponse.json({ error: "authentication" }, { status: 401 });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
