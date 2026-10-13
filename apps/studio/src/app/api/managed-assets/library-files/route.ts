import { NextResponse } from "next/server";

import { verifyFirebaseIdToken } from "../../../../features/auth/firebase-admin-auth";
import { FirebaseAuthenticationError } from "../../../../features/persistence/persistence-errors";
import {
  isValidManagedAssetInventoryCursor,
} from "../../../../features/persistence/managed-asset-inventory";
import { listManagedAssetLibraryFilePage } from "../../../../features/persistence/managed-asset-library-files";

export const dynamic = "force-dynamic";

function response(body: { error: "authentication" | "invalid_request" | "unavailable" }, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });
}

export async function GET(request: Request): Promise<NextResponse> {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]?.trim()) return response({ error: "authentication" }, 401);
  try {
    const user = await verifyFirebaseIdToken(match[1]);
    const cursors = new URL(request.url).searchParams.getAll("cursor");
    if (cursors.length > 1) return response({ error: "invalid_request" }, 400);
    const cursor = cursors[0] ?? null;
    if (!isValidManagedAssetInventoryCursor(cursor)) return response({ error: "invalid_request" }, 400);
    const page = await listManagedAssetLibraryFilePage(user.uid, cursor);
    return NextResponse.json(page, {
      headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
    });
  } catch (error) {
    return response({ error: error instanceof FirebaseAuthenticationError ? "authentication" : "unavailable" }, error instanceof FirebaseAuthenticationError ? 401 : 503);
  }
}
