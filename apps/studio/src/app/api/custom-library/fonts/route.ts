import { NextResponse } from "next/server";

import { verifyFirebaseIdToken } from "../../../../features/auth/firebase-admin-auth";
import { FirebaseAuthenticationError } from "../../../../features/persistence/persistence-errors";
import {
  CustomLibraryFontWriteError,
  deleteCustomLibraryFont,
  saveCustomLibraryFont,
  updateCustomLibraryFont,
} from "../../../../features/persistence/custom-library-font-admin";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });
}

async function requestContext(request: Request): Promise<{ uid: string } | NextResponse> {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]?.trim()) return json({ error: "authentication" }, 401);
  try { return await verifyFirebaseIdToken(match[1]); }
  catch (error) {
    return error instanceof FirebaseAuthenticationError
      ? json({ error: "authentication" }, 401)
      : json({ error: "unavailable" }, 503);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof CustomLibraryFontWriteError) {
    const status = error.code === "managed_face_removal_denied" ? 403
      : error.code === "font_not_found" ? 404
        : error.code === "identity_conflict" || error.code === "unverified_managed_face" ? 409
          : 400;
    return json({ error: error.code }, status);
  }
  return json({ error: "unavailable" }, 503);
}

export async function POST(request: Request): Promise<NextResponse> {
  const context = await requestContext(request);
  if (context instanceof NextResponse) return context;
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
  if (!isRecord(body) || body.operation !== "save" || !("font" in body)
    || (body.documentId !== undefined && typeof body.documentId !== "string")) {
    return json({ error: "invalid_request" }, 400);
  }
  try {
    const id = await saveCustomLibraryFont(context.uid, body.font, body.documentId as string | undefined);
    return json({ id }, 201);
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request): Promise<NextResponse> {
  const context = await requestContext(request);
  if (context instanceof NextResponse) return context;
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
  if (!isRecord(body) || body.operation !== "update" || typeof body.id !== "string" || !body.id || !("font" in body)) {
    return json({ error: "invalid_request" }, 400);
  }
  try {
    await updateCustomLibraryFont(context.uid, body.id, body.font);
    return json({ ok: true });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const context = await requestContext(request);
  if (context instanceof NextResponse) return context;
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
  if (!isRecord(body) || body.operation !== "delete" || typeof body.id !== "string" || !body.id) {
    return json({ error: "invalid_request" }, 400);
  }
  try {
    await deleteCustomLibraryFont(context.uid, body.id);
    return json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
