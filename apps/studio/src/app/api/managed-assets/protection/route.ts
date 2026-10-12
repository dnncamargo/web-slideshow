import { NextResponse } from "next/server";

import { verifyFirebaseIdToken } from "../../../../features/auth/firebase-admin-auth";
import { FirebaseAuthenticationError } from "../../../../features/persistence/persistence-errors";
import {
  ManagedAssetControlError,
  readManagedAssetControl,
  setManagedAssetProtection,
  validateManagedAssetPath,
} from "../../../../features/persistence/managed-asset-controls";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
}

async function owner(request: Request): Promise<{ uid: string } | NextResponse> {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]?.trim()) return json({ error: "authentication" }, 401);
  try { return await verifyFirebaseIdToken(match[1]); }
  catch (error) {
    return json({ error: error instanceof FirebaseAuthenticationError ? "authentication" : "unavailable" }, error instanceof FirebaseAuthenticationError ? 401 : 503);
  }
}

function controlError(error: unknown): NextResponse {
  if (!(error instanceof ManagedAssetControlError)) return json({ error: "unavailable" }, 503);
  const status = error.code === "invalid_identity" ? 400
    : error.code === "not_found" || error.code === "already_deleted" ? 404
      : error.code === "provider_unavailable" || error.code === "identity_conflict" ? 503 : 409;
  return json({ error: error.code }, status);
}

export async function GET(request: Request): Promise<NextResponse> {
  const context = await owner(request);
  if (context instanceof NextResponse) return context;
  const pathname = new URL(request.url).searchParams.get("pathname");
  try {
    validateManagedAssetPath(context.uid, pathname);
    const control = await readManagedAssetControl(context.uid, pathname!);
    return json({
      protected: control?.protected ?? false,
      state: control?.state ?? "active",
      retryAvailable: control?.state === "delete_failed"
        || (control?.state === "deleting" && control.deleteLeaseExpiresAt?.toMillis() !== undefined
          && control.deleteLeaseExpiresAt.toMillis() <= Date.now()),
    });
  } catch (error) { return controlError(error); }
}

export async function PUT(request: Request): Promise<NextResponse> {
  const context = await owner(request);
  if (context instanceof NextResponse) return context;
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
  if (typeof body !== "object" || body === null || Array.isArray(body)
    || typeof (body as Record<string, unknown>).pathname !== "string"
    || typeof (body as Record<string, unknown>).protected !== "boolean") {
    return json({ error: "invalid_request" }, 400);
  }
  const value = body as { pathname: string; protected: boolean };
  try {
    validateManagedAssetPath(context.uid, value.pathname);
    const control = await setManagedAssetProtection(context.uid, value.pathname, value.protected);
    return json({ protected: control.protected, state: control.state });
  } catch (error) { return controlError(error); }
}
