import { BlobNotFoundError, head } from "@vercel/blob";
import { NextResponse } from "next/server";

import { verifyFirebaseIdToken } from "../../../../features/auth/firebase-admin-auth";
import { FirebaseAuthenticationError } from "../../../../features/persistence/persistence-errors";

export const dynamic = "force-dynamic";
const PREFIX_PATTERN = /^users\/([^/]+)\/assets\//;

export async function GET(request: Request): Promise<NextResponse> {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]?.trim()) return NextResponse.json({ error: "authentication" }, { status: 401 });
  const pathname = new URL(request.url).searchParams.get("pathname");
  if (!pathname || pathname.length > 2048 || /[\x00-\x1f\x7f]/.test(pathname)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  try {
    const user = await verifyFirebaseIdToken(match[1]);
    const pathMatch = PREFIX_PATTERN.exec(pathname);
    if (!pathMatch || pathMatch[1] !== user.uid) return NextResponse.json({ error: "authorization" }, { status: 403 });
    const storeId = process.env.BLOB_STORE_ID?.trim();
    if (!storeId) return NextResponse.json({ error: "unavailable" }, { status: 503 });
    const blob = await head(pathname, { storeId });
    if (
      blob.pathname !== pathname || typeof blob.contentType !== "string" ||
      blob.contentType.length === 0 || blob.contentType.length > 256 ||
      !/^[\x20-\x7e]+$/.test(blob.contentType) ||
      typeof blob.size !== "number" || !Number.isSafeInteger(blob.size) || blob.size < 0
    ) {
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    return NextResponse.json({ contentType: blob.contentType, size: blob.size }, {
      headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
    });
  } catch (error) {
    if (error instanceof FirebaseAuthenticationError) return NextResponse.json({ error: "authentication" }, { status: 401 });
    if (error instanceof BlobNotFoundError) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
