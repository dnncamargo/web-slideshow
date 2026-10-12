import { NextResponse } from "next/server";

import { verifyFirebaseIdToken } from "../../../../features/auth/firebase-admin-auth";
import { FirebaseAuthenticationError } from "../../../../features/persistence/persistence-errors";
import { checkManagedAssetAvailability } from "../../../../features/persistence/managed-asset-availability";
import { ManagedAssetControlError } from "../../../../features/persistence/managed-asset-controls";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]?.trim()) return json({ error: "authentication" }, 401);

  let owner: { uid: string };
  try {
    owner = await verifyFirebaseIdToken(match[1]);
  } catch (error) {
    return json(
      { error: error instanceof FirebaseAuthenticationError ? "authentication" : "unavailable" },
      error instanceof FirebaseAuthenticationError ? 401 : 503,
    );
  }

  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
  if (typeof body !== "object" || body === null || Array.isArray(body)
    || typeof (body as Record<string, unknown>).pathname !== "string") {
    return json({ error: "invalid_request" }, 400);
  }

  const pathname = (body as { pathname: string }).pathname;
  try {
    return json(await checkManagedAssetAvailability(owner.uid, pathname));
  } catch (error) {
    if (error instanceof ManagedAssetControlError && error.code === "invalid_identity") {
      return json({ error: "authorization" }, 403);
    }
    return json({ state: "unknown" });
  }
}
