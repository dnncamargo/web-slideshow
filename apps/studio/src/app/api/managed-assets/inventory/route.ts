import { NextResponse } from "next/server";

import { verifyFirebaseIdToken } from "../../../../features/auth/firebase-admin-auth";
import { FirebaseAuthenticationError } from "../../../../features/persistence/persistence-errors";
import {
  isValidManagedAssetInventoryCursor,
  listManagedAssetInventoryPage,
  ManagedAssetInventoryAnnotationError,
} from "../../../../features/persistence/managed-asset-inventory";

export const dynamic = "force-dynamic";

function response(body: { error: "authentication" | "invalid_request" | "unavailable" | "annotations_unavailable" }, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
}

export async function GET(request: Request): Promise<NextResponse> {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]?.trim()) return response({ error: "authentication" }, 401);
  try {
    const user = await verifyFirebaseIdToken(match[1]);
    const params = new URL(request.url).searchParams;
    const cursors = params.getAll("cursor");
    if (cursors.length > 1) return response({ error: "invalid_request" }, 400);
    const cursor = cursors[0] ?? null;
    if (!isValidManagedAssetInventoryCursor(cursor)) return response({ error: "invalid_request" }, 400);
    return NextResponse.json(await listManagedAssetInventoryPage(user.uid, cursor), {
      headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
    });
  } catch (error) {
    if (error instanceof FirebaseAuthenticationError) return response({ error: "authentication" }, 401);
    if (error instanceof ManagedAssetInventoryAnnotationError) return response({ error: "annotations_unavailable" }, 503);
    return response({ error: "unavailable" }, 503);
  }
}
